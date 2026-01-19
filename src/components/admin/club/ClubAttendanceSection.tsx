import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMinutes, differenceInHours, subDays } from "date-fns";
import { Users, AlertTriangle, Clock, Coffee, Download, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ClubAttendanceSectionProps {
  clubId: string;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  full_name: string;
  check_in_time: string;
  check_out_time: string | null;
  total_break_minutes: number;
  total_hours: number;
  is_morning_only: boolean;
  has_long_break: boolean;
  missed_checkout: boolean;
}

export const ClubAttendanceSection = ({ clubId }: ClubAttendanceSectionProps) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  useEffect(() => {
    fetchAttendance();
  }, [clubId]);

  const fetchAttendance = async () => {
    setLoading(true);
    const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

    try {
      const { data: blocks } = await supabase
        .from("staff_attendance_blocks")
        .select("*, profiles:user_id(full_name)")
        .eq("venue_id", clubId)
        .gte("check_in_time", `${weekAgo}T00:00:00`)
        .order("check_in_time", { ascending: false });

      const { data: breaks } = await supabase
        .from("staff_breaks")
        .select("*")
        .eq("venue_id", clubId)
        .gte("break_start_time", `${weekAgo}T00:00:00`);

      if (blocks) {
        const records: AttendanceRecord[] = blocks.map((block: any) => {
          const checkInDate = new Date(block.check_in_time);
          const checkOutDate = block.check_out_time ? new Date(block.check_out_time) : null;
          
          const blockBreaks = breaks?.filter(b => b.attendance_block_id === block.id) || [];
          const totalBreakMinutes = blockBreaks.reduce((sum, b) => sum + (b.duration_minutes || 0), 0);

          let totalMinutes = 0;
          if (checkOutDate) {
            totalMinutes = differenceInMinutes(checkOutDate, checkInDate) - totalBreakMinutes;
          }
          const totalHours = totalMinutes / 60;

          const isMorningOnly = checkInDate.getHours() < 12 && (!checkOutDate || checkOutDate.getHours() < 14);
          const hasLongBreak = blockBreaks.some(b => (b.duration_minutes || 0) > 45);
          const missedCheckout = !block.check_out_time && differenceInHours(new Date(), checkInDate) > 12;

          return {
            id: block.id,
            user_id: block.user_id,
            full_name: block.profiles?.full_name || "Unknown",
            check_in_time: block.check_in_time,
            check_out_time: block.check_out_time,
            total_break_minutes: totalBreakMinutes,
            total_hours: Math.max(0, totalHours),
            is_morning_only: isMorningOnly,
            has_long_break: hasLongBreak,
            missed_checkout: missedCheckout,
          };
        });

        setAttendance(records);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  // Summary metrics
  const todayRecords = attendance.filter(r => {
    const checkIn = new Date(r.check_in_time);
    const today = new Date();
    return checkIn.toDateString() === today.toDateString();
  });

  const staffCheckedInToday = todayRecords.length;
  const staffOnDuty = todayRecords.filter(r => !r.check_out_time).length;
  const longBreaks = attendance.filter(r => r.has_long_break).length;
  const missedCheckouts = attendance.filter(r => r.missed_checkout).length;

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const exportAttendance = () => {
    const headers = ["Staff", "Check-in", "Check-out", "Break (min)", "Total Hours", "Flags"];
    const rows = attendance.map(r => [
      r.full_name,
      format(new Date(r.check_in_time), "yyyy-MM-dd HH:mm"),
      r.check_out_time ? format(new Date(r.check_out_time), "HH:mm") : "Active",
      r.total_break_minutes,
      r.check_out_time ? formatDuration(r.total_hours) : "-",
      [
        r.is_morning_only && "Morning",
        r.has_long_break && "Long Break",
        r.missed_checkout && "Missed Checkout"
      ].filter(Boolean).join("; ") || "-"
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Attendance report exported");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-semibold">{staffCheckedInToday}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Checked in Today</p>
        </div>
        <div className="p-3 rounded-lg bg-success/10 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Clock className="h-4 w-4 text-success" />
            <span className="text-lg font-semibold">{staffOnDuty}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Currently On Duty</p>
        </div>
        <div className={`p-3 rounded-lg text-center ${longBreaks > 0 ? 'bg-warning/10' : 'bg-muted/30'}`}>
          <div className="flex items-center justify-center gap-1.5">
            <Coffee className={`h-4 w-4 ${longBreaks > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
            <span className="text-lg font-semibold">{longBreaks}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Long Breaks (7d)</p>
        </div>
        <div className={`p-3 rounded-lg text-center ${missedCheckouts > 0 ? 'bg-destructive/10' : 'bg-muted/30'}`}>
          <div className="flex items-center justify-center gap-1.5">
            <AlertTriangle className={`h-4 w-4 ${missedCheckouts > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            <span className="text-lg font-semibold">{missedCheckouts}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Missed Checkouts</p>
        </div>
      </div>

      {/* View Detailed Table Button */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            View Attendance Table
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base">Attendance (Last 7 Days)</DialogTitle>
          </DialogHeader>
          
          <div className="flex justify-end pb-3 border-b">
            <Button variant="outline" size="sm" onClick={exportAttendance} className="h-8 text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </div>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sticky left-0 bg-background">Staff</TableHead>
                  <TableHead className="text-xs">Check-in</TableHead>
                  <TableHead className="text-xs text-center">Breaks</TableHead>
                  <TableHead className="text-xs">Check-out</TableHead>
                  <TableHead className="text-xs text-right">Hours</TableHead>
                  <TableHead className="text-xs">Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="text-xs font-medium sticky left-0 bg-background">
                      {record.full_name}
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(record.check_in_time), "MMM dd, hh:mm a")}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {record.total_break_minutes > 0 ? (
                        <span className={record.has_long_break ? "text-warning" : ""}>
                          {record.total_break_minutes}m
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {record.check_out_time ? (
                        format(new Date(record.check_out_time), "hh:mm a")
                      ) : (
                        <Badge variant="outline" className="text-[9px]">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {record.check_out_time ? formatDuration(record.total_hours) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {record.is_morning_only && (
                          <Badge variant="outline" className="text-[8px] px-1">Morning</Badge>
                        )}
                        {record.has_long_break && (
                          <Badge variant="outline" className="text-[8px] px-1 text-warning border-warning">
                            <Coffee className="h-2 w-2" />
                          </Badge>
                        )}
                        {record.missed_checkout && (
                          <Badge variant="destructive" className="text-[8px] px-1">
                            <AlertTriangle className="h-2 w-2" />
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {attendance.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                      No attendance records found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Download Button */}
      <Button variant="ghost" size="sm" onClick={exportAttendance} className="w-full text-muted-foreground">
        <Download className="h-4 w-4 mr-2" />
        Download Attendance Report
      </Button>
    </div>
  );
};
