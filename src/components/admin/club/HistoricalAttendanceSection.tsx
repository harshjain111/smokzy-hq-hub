import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, Clock, AlertTriangle, Coffee, Users, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface HistoricalSession {
  id: string;
  session_date: string;
}

interface HistoricalAttendanceSectionProps {
  session: HistoricalSession;
  clubId: string;
  clubName: string;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  staff_name: string;
  check_in_time: string;
  check_out_time: string | null;
  total_hours: number;
  break_minutes: number;
  flags: string[];
}

interface StaffOption {
  id: string;
  full_name: string;
}

export const HistoricalAttendanceSection = ({ session, clubId, clubName }: HistoricalAttendanceSectionProps) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [checkInTime, setCheckInTime] = useState("18:00");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAttendanceData();
  }, [session.id]);

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const { data: attendanceData } = await supabase
        .from("staff_attendance_blocks")
        .select("id, user_id, check_in_time, check_out_time")
        .eq("session_id", session.id);

      if (!attendanceData || attendanceData.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(attendanceData.map(a => a.user_id))];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const { data: breaksData } = await supabase
        .from("staff_breaks")
        .select("user_id, duration_minutes")
        .eq("session_id", session.id);

      const attendanceRecords: AttendanceRecord[] = attendanceData.map(a => {
        const profile = profilesData?.find(p => p.id === a.user_id);
        const userBreaks = breaksData?.filter(b => b.user_id === a.user_id) || [];
        const totalBreakMinutes = userBreaks.reduce((sum, b) => sum + (b.duration_minutes || 0), 0);

        const checkIn = new Date(a.check_in_time);
        const checkOut = a.check_out_time ? new Date(a.check_out_time) : null;
        const totalMinutes = checkOut ? differenceInMinutes(checkOut, checkIn) : 0;
        const workingMinutes = totalMinutes - totalBreakMinutes;
        const totalHours = Math.round((workingMinutes / 60) * 10) / 10;

        const flags: string[] = [];
        if (!a.check_out_time) flags.push("Missed Checkout");
        if (totalBreakMinutes > 30) flags.push("Long Break");

        return {
          id: a.id,
          user_id: a.user_id,
          staff_name: profile?.full_name || "Unknown",
          check_in_time: a.check_in_time,
          check_out_time: a.check_out_time,
          total_hours: totalHours > 0 ? totalHours : 0,
          break_minutes: totalBreakMinutes,
          flags,
        };
      });

      setRecords(attendanceRecords);
    } catch (error) {
      console.error("Error fetching historical attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffOptions = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("venue_id", clubId)
      .eq("role", "employee");

    if (data && data.length > 0) {
      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      setStaffOptions(profiles || []);
    }
  };

  const handleOpenAddDialog = async () => {
    await fetchStaffOptions();
    setSelectedStaffId("");
    setCheckInTime("18:00");
    setCheckOutTime("");
    setAddDialogOpen(true);
  };

  const handleAddPunchIn = async () => {
    if (!selectedStaffId || !checkInTime) return;
    setSaving(true);
    try {
      const dateStr = session.session_date;
      const checkInISO = new Date(`${dateStr}T${checkInTime}:00`).toISOString();
      const checkOutISO = checkOutTime ? new Date(`${dateStr}T${checkOutTime}:00`).toISOString() : null;

      const { error } = await supabase.from("staff_attendance_blocks").insert({
        session_id: session.id,
        user_id: selectedStaffId,
        venue_id: clubId,
        check_in_time: checkInISO,
        check_out_time: checkOutISO,
        check_in_lat: 0,
        check_in_lng: 0,
        check_in_selfie_url: "admin-added",
        is_break: false,
      });

      if (error) throw error;

      toast({ title: "Punch-in added successfully" });
      setAddDialogOpen(false);
      fetchAttendanceData();
    } catch (error: any) {
      toast({ title: "Error adding punch-in", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;
    try {
      const { error } = await supabase
        .from("staff_attendance_blocks")
        .delete()
        .eq("id", recordToDelete.id);

      if (error) throw error;

      toast({ title: "Punch-in deleted" });
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      fetchAttendanceData();
    } catch (error: any) {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
    }
  };

  const downloadExcel = () => {
    const exportData = records.map(r => ({
      Staff: r.staff_name,
      "Check In": format(new Date(r.check_in_time), "HH:mm"),
      "Check Out": r.check_out_time ? format(new Date(r.check_out_time), "HH:mm") : "—",
      "Break (min)": r.break_minutes,
      "Total Hours": r.total_hours,
      Flags: r.flags.join(", ") || "—",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `${clubName}_Attendance_${session.session_date}.xlsx`);
  };

  const missedCheckouts = records.filter(r => !r.check_out_time).length;
  const longBreaks = records.filter(r => r.break_minutes > 30).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <Users className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
          <div className="text-lg font-bold">{records.length}</div>
          <div className="text-[10px] text-muted-foreground">Staff</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <Clock className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
          <div className="text-lg font-bold">
            {Math.round(records.reduce((sum, r) => sum + r.total_hours, 0))}h
          </div>
          <div className="text-[10px] text-muted-foreground">Total</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <Coffee className={`h-3.5 w-3.5 mx-auto mb-1 ${longBreaks > 0 ? "text-warning" : "text-muted-foreground"}`} />
          <div className={`text-lg font-bold ${longBreaks > 0 ? "text-warning" : ""}`}>{longBreaks}</div>
          <div className="text-[10px] text-muted-foreground">Long Breaks</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <AlertTriangle className={`h-3.5 w-3.5 mx-auto mb-1 ${missedCheckouts > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          <div className={`text-lg font-bold ${missedCheckouts > 0 ? "text-destructive" : ""}`}>{missedCheckouts}</div>
          <div className="text-[10px] text-muted-foreground">Missed</div>
        </div>
      </div>

      {/* Add Punch-In Button */}
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleOpenAddDialog}>
        <Plus className="h-4 w-4" />
        Add Punch-In
      </Button>

      {/* Attendance List */}
      {records.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          No attendance records for this session
        </div>
      ) : (
        <ScrollArea className="h-[250px]">
          <div className="space-y-2">
            {records.map((record) => (
              <div
                key={record.id}
                className={`p-2 rounded-lg border ${
                  record.flags.length > 0 ? "border-warning/50 bg-warning/5" : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{record.staff_name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {format(new Date(record.check_in_time), "HH:mm")} -{" "}
                      {record.check_out_time ? format(new Date(record.check_out_time), "HH:mm") : "?"}
                      {record.break_minutes > 0 && ` • ${record.break_minutes}m break`}
                    </div>
                    {record.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {record.flags.map((flag, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-sm font-medium">{record.total_hours}h</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setRecordToDelete(record);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Download Button */}
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadExcel}>
        <Download className="h-4 w-4" />
        Download Attendance Report (Excel)
      </Button>

      {/* Add Punch-In Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Punch-In</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Staff Member</label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Check-In Time</label>
                <Input type="time" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Check-Out Time</label>
                <Input
                  type="time"
                  value={checkOutTime}
                  onChange={e => setCheckOutTime(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPunchIn} disabled={!selectedStaffId || !checkInTime || saving}>
              {saving ? "Adding..." : "Add Punch-In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Punch-In</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the punch-in record for{" "}
              <span className="font-medium">{recordToDelete?.staff_name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
