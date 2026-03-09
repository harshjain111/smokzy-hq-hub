import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMinutes, differenceInHours, subDays } from "date-fns";
import { 
  Users, AlertTriangle, Clock, Coffee, Download, ChevronRight, 
  TrendingUp, TrendingDown, Award, UserX, Timer, Eye
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from "xlsx";

interface ClubAttendanceSectionProps {
  clubId: string;
  currentSession?: { id: string; session_date: string } | null;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  full_name: string;
  session_id: string;
  session_date: string;
  check_in_time: string;
  check_out_time: string | null;
  total_break_minutes: number;
  total_hours: number;
  is_late: boolean;
  late_minutes: number;
  has_long_break: boolean;
  missed_checkout: boolean;
  efficiency: number; // percentage of shift without breaks
}

interface StaffPerformance {
  user_id: string;
  full_name: string;
  sessions_present: number;
  total_hours: number;
  avg_break_minutes: number;
  late_count: number;
  missed_checkouts: number;
  punctuality_score: number;
}

interface AttendanceInsight {
  type: 'positive' | 'negative' | 'neutral';
  message: string;
}

export const ClubAttendanceSection = ({ clubId, currentSession }: ClubAttendanceSectionProps) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [insights, setInsights] = useState<AttendanceInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);

  useEffect(() => {
    fetchAttendance();
  }, [clubId, currentSession?.id]);

  const fetchAttendance = async () => {
    setLoading(true);

    try {
      // Fetch recent sessions for this club (last 14 sessions)
      const { data: recentSessions } = await supabase
        .from("club_sessions")
        .select("id, session_date, started_at")
        .eq("venue_id", clubId)
        .order("session_date", { ascending: false })
        .limit(14);

      if (!recentSessions || recentSessions.length === 0) {
        setAttendance([]);
        setLoading(false);
        return;
      }

      const sessionIds = recentSessions.map(s => s.id);
      const sessionMap: Record<string, { date: string; start: string }> = {};
      recentSessions.forEach(s => { 
        sessionMap[s.id] = { date: s.session_date, start: s.started_at }; 
      });

      // Fetch attendance blocks by session_id
      const { data: blocks } = await supabase
        .from("staff_attendance_blocks")
        .select("*")
        .in("session_id", sessionIds)
        .order("check_in_time", { ascending: false });

      // Fetch all breaks for these sessions
      const { data: breaks } = await supabase
        .from("staff_breaks")
        .select("*")
        .in("session_id", sessionIds);

      // Fetch profiles for staff names
      const userIds = [...new Set(blocks?.map(b => b.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => { profileMap[p.id] = p.full_name; });

      // Fetch venue settings for late threshold
      const { data: settings } = await supabase
        .from("venue_settings")
        .select("core_hours_start")
        .eq("venue_id", clubId)
        .single();

      const coreHoursStart = settings?.core_hours_start || 18; // Default 6 PM

      if (blocks) {
        const records: AttendanceRecord[] = blocks.map((block) => {
          const checkInDate = new Date(block.check_in_time);
          const checkOutDate = block.check_out_time ? new Date(block.check_out_time) : null;
          const sessionInfo = sessionMap[block.session_id];
          
          // Get breaks for this specific attendance block
          const blockBreaks = breaks?.filter(b => b.attendance_block_id === block.id) || [];
          const totalBreakMinutes = blockBreaks.reduce((sum, b) => sum + (b.duration_minutes || 0), 0);

          let totalMinutes = 0;
          if (checkOutDate) {
            totalMinutes = differenceInMinutes(checkOutDate, checkInDate) - totalBreakMinutes;
          }
          const totalHours = totalMinutes / 60;

          // Check if late (more than 30 mins after core hours start or session start)
          const sessionStart = sessionInfo ? new Date(sessionInfo.start) : checkInDate;
          const lateMinutes = Math.max(0, differenceInMinutes(checkInDate, sessionStart) - 30);
          const isLate = lateMinutes > 0;

          const hasLongBreak = blockBreaks.some(b => (b.duration_minutes || 0) > 45);
          const missedCheckout = !block.check_out_time && differenceInHours(new Date(), checkInDate) > 12;

          // Efficiency: (work time) / (total time including breaks)
          const totalTimeIncludingBreaks = checkOutDate 
            ? differenceInMinutes(checkOutDate, checkInDate) 
            : differenceInMinutes(new Date(), checkInDate);
          const efficiency = totalTimeIncludingBreaks > 0 
            ? Math.round(((totalTimeIncludingBreaks - totalBreakMinutes) / totalTimeIncludingBreaks) * 100)
            : 100;

          return {
            id: block.id,
            user_id: block.user_id,
            full_name: profileMap[block.user_id] || "Unknown",
            session_id: block.session_id,
            session_date: sessionInfo?.date || "Unknown",
            check_in_time: block.check_in_time,
            check_out_time: block.check_out_time,
            total_break_minutes: totalBreakMinutes,
            total_hours: Math.max(0, totalHours),
            is_late: isLate,
            late_minutes: lateMinutes,
            has_long_break: hasLongBreak,
            missed_checkout: missedCheckout,
            efficiency,
          };
        });

        setAttendance(records);

        // Calculate staff performance
        calculateStaffPerformance(records);
        
        // Generate insights
        generateInsights(records);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStaffPerformance = (records: AttendanceRecord[]) => {
    const staffMap = new Map<string, StaffPerformance>();

    records.forEach(r => {
      const existing = staffMap.get(r.user_id) || {
        user_id: r.user_id,
        full_name: r.full_name,
        sessions_present: 0,
        total_hours: 0,
        avg_break_minutes: 0,
        late_count: 0,
        missed_checkouts: 0,
        punctuality_score: 100,
      };

      existing.sessions_present++;
      existing.total_hours += r.total_hours;
      existing.avg_break_minutes = (existing.avg_break_minutes * (existing.sessions_present - 1) + r.total_break_minutes) / existing.sessions_present;
      if (r.is_late) existing.late_count++;
      if (r.missed_checkout) existing.missed_checkouts++;

      staffMap.set(r.user_id, existing);
    });

    // Calculate punctuality score
    staffMap.forEach(staff => {
      const latePenalty = staff.late_count * 10;
      const missedPenalty = staff.missed_checkouts * 20;
      staff.punctuality_score = Math.max(0, 100 - latePenalty - missedPenalty);
    });

    // Sort by sessions present (descending)
    const sorted = Array.from(staffMap.values()).sort((a, b) => b.sessions_present - a.sessions_present);
    setStaffPerformance(sorted);
  };

  const generateInsights = (records: AttendanceRecord[]) => {
    const newInsights: AttendanceInsight[] = [];
    
    const currentRecords = currentSession 
      ? records.filter(r => r.session_id === currentSession.id)
      : [];

    // Current session insights
    const onDuty = currentRecords.filter(r => !r.check_out_time).length;
    const checkedOut = currentRecords.filter(r => r.check_out_time).length;

    if (onDuty > 0) {
      newInsights.push({ type: 'positive', message: `${onDuty} staff currently on duty` });
    }
    if (checkedOut > 0) {
      newInsights.push({ type: 'neutral', message: `${checkedOut} staff completed shifts today` });
    }

    // Late check-ins today
    const lateToday = currentRecords.filter(r => r.is_late).length;
    if (lateToday > 0) {
      newInsights.push({ type: 'negative', message: `${lateToday} late check-in${lateToday > 1 ? 's' : ''} today` });
    }

    // Long breaks trend
    const longBreaks = records.filter(r => r.has_long_break).length;
    if (longBreaks > 3) {
      newInsights.push({ type: 'negative', message: `${longBreaks} long breaks (>45m) in last 14 sessions` });
    }

    // Missed checkouts
    const missed = records.filter(r => r.missed_checkout).length;
    if (missed > 0) {
      newInsights.push({ type: 'negative', message: `${missed} missed checkout${missed > 1 ? 's' : ''} requiring attention` });
    }

    setInsights(newInsights);
  };

  // Summary metrics based on current session
  const currentSessionRecords = currentSession 
    ? attendance.filter(r => r.session_id === currentSession.id)
    : [];

  const staffCheckedInThisSession = currentSessionRecords.length;
  const staffOnDuty = currentSessionRecords.filter(r => !r.check_out_time).length;
  const lateToday = currentSessionRecords.filter(r => r.is_late).length;
  const avgEfficiency = currentSessionRecords.length > 0
    ? Math.round(currentSessionRecords.reduce((sum, r) => sum + r.efficiency, 0) / currentSessionRecords.length)
    : 0;

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const exportAttendance = () => {
    const exportData = attendance.map(r => ({
      "Session Date": r.session_date,
      "Staff": r.full_name,
      "Check-in": format(new Date(r.check_in_time), "yyyy-MM-dd HH:mm"),
      "Check-out": r.check_out_time ? format(new Date(r.check_out_time), "yyyy-MM-dd HH:mm") : "Active",
      "Break (min)": r.total_break_minutes,
      "Total Hours": r.check_out_time ? formatDuration(r.total_hours) : "-",
      "Late (min)": r.late_minutes || 0,
      "Efficiency %": r.efficiency,
      "Flags": [
        r.is_late && "Late",
        r.has_long_break && "Long Break",
        r.missed_checkout && "Missed Checkout"
      ].filter(Boolean).join("; ") || "-"
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `Attendance_${clubId}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
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
        <div className="p-3 rounded-lg bg-success/10 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Users className="h-4 w-4 text-success" />
            <span className="text-xl font-bold">{staffOnDuty}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">On Duty Now</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xl font-bold">{staffCheckedInThisSession}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Total This Session</p>
        </div>
        <div className={`p-3 rounded-lg text-center ${lateToday > 0 ? 'bg-warning/10' : 'bg-muted/30'}`}>
          <div className="flex items-center justify-center gap-1.5">
            <Timer className={`h-4 w-4 ${lateToday > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
            <span className="text-xl font-bold">{lateToday}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Late Today</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span className={`text-xl font-bold ${getScoreColor(avgEfficiency)}`}>{avgEfficiency}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Avg Efficiency</p>
        </div>
      </div>

      {/* Smart Insights */}
      {insights.length > 0 && (
        <div className="space-y-1.5">
          {insights.slice(0, 3).map((insight, i) => (
            <div 
              key={i} 
              className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                insight.type === 'positive' ? 'bg-success/10 text-success' :
                insight.type === 'negative' ? 'bg-destructive/10 text-destructive' :
                'bg-muted/50 text-muted-foreground'
              }`}
            >
              {insight.type === 'positive' ? <Award className="h-3.5 w-3.5" /> :
               insight.type === 'negative' ? <AlertTriangle className="h-3.5 w-3.5" /> :
               <Users className="h-3.5 w-3.5" />}
              <span>{insight.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Staff Performance - Tap for details */}
      <Dialog open={showPerformanceDialog} onOpenChange={setShowPerformanceDialog}>
        <DialogTrigger asChild>
          <button className="w-full text-left">
            <div className="p-3 rounded-lg border hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Staff Performance (14 Sessions)</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex -space-x-2">
                {staffPerformance.slice(0, 5).map((staff, i) => (
                  <div 
                    key={staff.user_id}
                    className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium"
                    title={staff.full_name}
                  >
                    {staff.full_name.charAt(0)}
                  </div>
                ))}
                {staffPerformance.length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                    +{staffPerformance.length - 5}
                  </div>
                )}
              </div>
            </div>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Staff Performance Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {staffPerformance.map(staff => (
              <div key={staff.user_id} className="p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{staff.full_name}</span>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] ${getScoreColor(staff.punctuality_score)}`}
                  >
                    {staff.punctuality_score}% Punctuality
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span>{staff.sessions_present} sessions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{formatDuration(staff.total_hours)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Coffee className="h-3 w-3 text-muted-foreground" />
                    <span>{Math.round(staff.avg_break_minutes)}m avg break</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Timer className={`h-3 w-3 ${staff.late_count > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                    <span className={staff.late_count > 0 ? 'text-warning' : ''}>{staff.late_count} late</span>
                  </div>
                </div>
                {staff.missed_checkouts > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    {staff.missed_checkouts} missed checkout{staff.missed_checkouts > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Detailed Table Button */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            View Attendance Records
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base">Attendance Records (Last 14 Sessions)</DialogTitle>
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
                  <TableHead className="text-xs sticky left-0 bg-background">Session</TableHead>
                  <TableHead className="text-xs">Staff</TableHead>
                  <TableHead className="text-xs">Check-in</TableHead>
                  <TableHead className="text-xs">Check-out</TableHead>
                  <TableHead className="text-xs text-center">Hours</TableHead>
                  <TableHead className="text-xs text-center">Breaks</TableHead>
                  <TableHead className="text-xs text-center">Eff %</TableHead>
                  <TableHead className="text-xs">Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="text-xs font-medium sticky left-0 bg-background">
                      {format(new Date(record.session_date), "MMM dd")}
                    </TableCell>
                    <TableCell className="text-xs">{record.full_name}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(record.check_in_time), "hh:mm a")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {record.check_out_time ? (
                        format(new Date(record.check_out_time), "hh:mm a")
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-success">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-center font-medium">
                      {record.check_out_time ? formatDuration(record.total_hours) : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {record.total_break_minutes > 0 ? (
                        <span className={record.has_long_break ? "text-warning" : ""}>
                          {record.total_break_minutes}m
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className={`text-xs text-center font-medium ${getScoreColor(record.efficiency)}`}>
                      {record.efficiency}%
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {record.is_late && (
                          <Badge variant="outline" className="text-[8px] px-1 text-warning border-warning">
                            Late {record.late_minutes}m
                          </Badge>
                        )}
                        {record.has_long_break && (
                          <Badge variant="outline" className="text-[8px] px-1 text-warning border-warning">
                            Long Break
                          </Badge>
                        )}
                        {record.missed_checkout && (
                          <Badge variant="destructive" className="text-[8px] px-1">
                            Missed
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {attendance.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">
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
        Export Full Report
      </Button>
    </div>
  );
};
