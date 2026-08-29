import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import {
  Users, AlertTriangle, Coffee, Download,
  Award, Timer, Info
} from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportToXlsx } from "@/lib/exportXlsx";

interface ClubAttendanceSectionProps {
  clubId: string;
  currentSession?: { id: string; session_date: string } | null;
  onSummaryChange?: (data: { onDuty: number; onBreak: number; rosteredTotal: number | null; notCheckedIn: number } | null) => void;
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

type RowStatus = 'on_duty' | 'on_break' | 'checked_out' | 'not_checked_in' | 'leave_off';

interface ReconciledRow {
  staff_id: string;
  full_name: string;
  role: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  hours: number | null;
  status: RowStatus;
  leaveLabel?: string;
  offRoster?: boolean;
}

export const ClubAttendanceSection = ({ clubId, currentSession, onSummaryChange }: ClubAttendanceSectionProps) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [insights, setInsights] = useState<AttendanceInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciledRows, setReconciledRows] = useState<ReconciledRow[]>([]);
  const [rosterFound, setRosterFound] = useState(true);

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, currentSession?.id]);

  const fetchAttendance = async () => {
    setLoading(true);

    try {
      const { data: recentSessions } = await supabase
        .from("club_sessions")
        .select("id, session_date, started_at")
        .eq("venue_id", clubId)
        .order("session_date", { ascending: false })
        .limit(14);

      if (!recentSessions || recentSessions.length === 0) {
        setAttendance([]);
        await fetchRosterReconciliation([]);
        setLoading(false);
        return;
      }

      const sessionIds = recentSessions.map(s => s.id);
      const sessionMap: Record<string, { date: string; start: string }> = {};
      recentSessions.forEach(s => {
        sessionMap[s.id] = { date: s.session_date, start: s.started_at };
      });

      const { data: blocks } = await supabase
        .from("staff_attendance_blocks")
        .select("*")
        .in("session_id", sessionIds)
        .order("check_in_time", { ascending: false });

      const { data: breaks } = await supabase
        .from("staff_breaks")
        .select("*")
        .in("session_id", sessionIds);

      const userIds = [...new Set(blocks?.map(b => b.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => { profileMap[p.id] = p.full_name; });

      const { data: settings } = await supabase
        .from("venue_settings")
        .select("core_hours_start")
        .eq("venue_id", clubId)
        .single();

      const coreHoursStart = settings?.core_hours_start || 18; // Default 6 PM (kept for parity, not currently used in the calc below)
      void coreHoursStart;

      let records: AttendanceRecord[] = [];
      if (blocks) {
        records = blocks.map((block) => {
          const checkInDate = new Date(block.check_in_time);
          const checkOutDate = block.check_out_time ? new Date(block.check_out_time) : null;
          const sessionInfo = sessionMap[block.session_id];

          const blockBreaks = breaks?.filter(b => b.attendance_block_id === block.id) || [];
          const totalBreakMinutes = blockBreaks.reduce((sum, b) => sum + (b.duration_minutes || 0), 0);

          let totalMinutes = 0;
          if (checkOutDate) {
            totalMinutes = differenceInMinutes(checkOutDate, checkInDate) - totalBreakMinutes;
          }
          const totalHours = totalMinutes / 60;

          const sessionStart = sessionInfo ? new Date(sessionInfo.start) : checkInDate;
          const lateMinutes = Math.max(0, differenceInMinutes(checkInDate, sessionStart) - 30);
          const isLate = lateMinutes > 0;

          const hasLongBreak = blockBreaks.some(b => (b.duration_minutes || 0) > 45);
          const missedCheckout = !block.check_out_time && differenceInHours(new Date(), checkInDate) > 12;

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
        calculateStaffPerformance(records);
        generateInsights(records);
      }

      const activeBreakUserIds = new Set(
        (breaks || []).filter(b => currentSession && b.session_id === currentSession.id && !b.break_end_time).map(b => b.user_id)
      );

      await fetchRosterReconciliation(records, activeBreakUserIds);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  // Cross-references today's roster against actual attendance for the day.
  // No formal leave-approval workflow exists — 'leave'/'off' below is only a manually-typed roster_assignments flag.
  const fetchRosterReconciliation = async (records: AttendanceRecord[], activeBreakUserIds?: Set<string>) => {
    const targetDate = currentSession?.session_date || format(new Date(), "yyyy-MM-dd");
    const breakSet = activeBreakUserIds || new Set<string>();

    const [{ data: rosterRows }, { data: assignmentRows }] = await Promise.all([
      supabase.from("daily_roster").select("staff_id, role").eq("venue_id", clubId).eq("date", targetDate).eq("is_removed", false),
      supabase.from("roster_assignments").select("staff_id, status").eq("venue_id", clubId).eq("date", targetDate),
    ]);

    const todaysRecords = records.filter(r => r.session_date === targetDate);
    const recordsByStaff = new Map<string, AttendanceRecord[]>();
    todaysRecords.forEach(r => {
      const arr = recordsByStaff.get(r.user_id) || [];
      arr.push(r);
      recordsByStaff.set(r.user_id, arr);
    });
    const pickRecord = (staffId: string) => {
      const recs = recordsByStaff.get(staffId);
      if (!recs || recs.length === 0) return null;
      const active = recs.find(r => !r.check_out_time);
      if (active) return active;
      return recs.reduce((latest, r) => (new Date(r.check_in_time) > new Date(latest.check_in_time) ? r : latest), recs[0]);
    };

    const roster = rosterRows || [];
    setRosterFound(roster.length > 0);

    const rosterStaffIds = new Set(roster.map(r => r.staff_id));
    const leaveMap = new Map(
      (assignmentRows || [])
        .filter(a => a.status === 'leave' || a.status === 'off')
        .map(a => [a.staff_id, a.status])
    );

    // Fetch names for rostered staff who may not have any attendance record (so no name from `records`)
    const missingProfileIds = roster.map(r => r.staff_id);
    const profileMap = new Map<string, string>();
    if (missingProfileIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", missingProfileIds);
      profiles?.forEach(p => profileMap.set(p.id, p.full_name));
    }

    const rows: ReconciledRow[] = roster.map(rs => {
      const rec = pickRecord(rs.staff_id);
      const fullName = profileMap.get(rs.staff_id) || rec?.full_name || "Unknown";

      if (rec) {
        const status: RowStatus = rec.check_out_time ? 'checked_out' : breakSet.has(rs.staff_id) ? 'on_break' : 'on_duty';
        return {
          staff_id: rs.staff_id,
          full_name: fullName,
          role: rs.role,
          check_in_time: rec.check_in_time,
          check_out_time: rec.check_out_time,
          hours: rec.check_out_time ? rec.total_hours : null,
          status,
        };
      }

      const leave = leaveMap.get(rs.staff_id);
      if (leave) {
        return {
          staff_id: rs.staff_id, full_name: fullName, role: rs.role,
          check_in_time: null, check_out_time: null, hours: null,
          status: 'leave_off', leaveLabel: leave,
        };
      }

      return {
        staff_id: rs.staff_id, full_name: fullName, role: rs.role,
        check_in_time: null, check_out_time: null, hours: null,
        status: 'not_checked_in',
      };
    });

    // Staff who attended today but weren't in today's roster — surfaced, not silently dropped
    const offRosterRows: ReconciledRow[] = [];
    recordsByStaff.forEach((_, staffId) => {
      if (rosterStaffIds.has(staffId)) return;
      const rec = pickRecord(staffId);
      if (!rec) return;
      const status: RowStatus = rec.check_out_time ? 'checked_out' : breakSet.has(staffId) ? 'on_break' : 'on_duty';
      offRosterRows.push({
        staff_id: staffId, full_name: rec.full_name, role: null,
        check_in_time: rec.check_in_time, check_out_time: rec.check_out_time,
        hours: rec.check_out_time ? rec.total_hours : null, status, offRoster: true,
      });
    });

    const allRows = [...rows, ...offRosterRows];
    setReconciledRows(allRows);

    const onDutyCount = allRows.filter(r => r.status === 'on_duty').length;
    const onBreakCount = allRows.filter(r => r.status === 'on_break').length;
    const notCheckedInCount = rows.filter(r => r.status === 'not_checked_in').length;

    onSummaryChange?.({
      onDuty: onDutyCount,
      onBreak: onBreakCount,
      rosteredTotal: roster.length > 0 ? rows.length : null,
      notCheckedIn: notCheckedInCount,
    });
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

    staffMap.forEach(staff => {
      const latePenalty = staff.late_count * 10;
      const missedPenalty = staff.missed_checkouts * 20;
      staff.punctuality_score = Math.max(0, 100 - latePenalty - missedPenalty);
    });

    const sorted = Array.from(staffMap.values()).sort((a, b) => b.sessions_present - a.sessions_present);
    setStaffPerformance(sorted);
  };

  const generateInsights = (records: AttendanceRecord[]) => {
    const newInsights: AttendanceInsight[] = [];

    const currentRecords = currentSession
      ? records.filter(r => r.session_id === currentSession.id)
      : [];

    const onDuty = currentRecords.filter(r => !r.check_out_time).length;
    const checkedOut = currentRecords.filter(r => r.check_out_time).length;

    if (onDuty > 0) {
      newInsights.push({ type: 'positive', message: `${onDuty} staff currently on duty` });
    }
    if (checkedOut > 0) {
      newInsights.push({ type: 'neutral', message: `${checkedOut} staff completed shifts today` });
    }

    const lateToday = currentRecords.filter(r => r.is_late).length;
    if (lateToday > 0) {
      newInsights.push({ type: 'negative', message: `${lateToday} late check-in${lateToday > 1 ? 's' : ''} today` });
    }

    const longBreaks = records.filter(r => r.has_long_break).length;
    if (longBreaks > 3) {
      newInsights.push({ type: 'negative', message: `${longBreaks} long breaks (>45m) in last 14 sessions` });
    }

    const missed = records.filter(r => r.missed_checkout).length;
    if (missed > 0) {
      newInsights.push({ type: 'negative', message: `${missed} missed checkout${missed > 1 ? 's' : ''} requiring attention` });
    }

    setInsights(newInsights);
  };

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

  const exportAttendance = async () => {
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

    await exportToXlsx(exportData, `Attendance_${clubId}_${format(new Date(), "yyyy-MM-dd")}.xlsx`, "Attendance");
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

  const rosteredRows = reconciledRows.filter(r => !r.offRoster);
  const offRosterRows = reconciledRows.filter(r => r.offRoster);
  const onDutyCount = reconciledRows.filter(r => r.status === 'on_duty').length;
  const onBreakCount = reconciledRows.filter(r => r.status === 'on_break').length;
  const checkedOutCount = reconciledRows.filter(r => r.status === 'checked_out').length;
  const notCheckedInCount = rosteredRows.filter(r => r.status === 'not_checked_in').length;
  const leaveOffCount = rosteredRows.filter(r => r.status === 'leave_off').length;

  const statusBadge = (row: ReconciledRow) => {
    switch (row.status) {
      case 'on_duty':
        return <Badge className="bg-success/15 text-success border-success/30 text-[10px]">On Duty</Badge>;
      case 'on_break':
        return <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px]">On Break</Badge>;
      case 'checked_out':
        return <Badge variant="secondary" className="text-[10px]">Checked Out</Badge>;
      case 'leave_off':
        return <Badge variant="outline" className="text-[10px] text-muted-foreground capitalize">{row.leaveLabel}</Badge>;
      case 'not_checked_in':
      default:
        return <Badge variant="outline" className="text-[10px] text-destructive/80 border-destructive/30">Not Checked In</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={exportAttendance} className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Export Attendance Report
      </Button>

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

      {!rosterFound && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>Roster not available for today — showing checked-in staff only.</span>
        </div>
      )}

      {/* Summary strip — plain labeled numbers, not another row of cards */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs px-0.5">
        {rosterFound && (
          <span><span className="font-semibold">{rosteredRows.length}</span> <span className="text-muted-foreground">rostered</span></span>
        )}
        <span><span className="font-semibold text-success">{onDutyCount}</span> <span className="text-muted-foreground">on duty</span></span>
        <span><span className="font-semibold text-warning">{onBreakCount}</span> <span className="text-muted-foreground">on break</span></span>
        <span><span className="font-semibold">{checkedOutCount}</span> <span className="text-muted-foreground">checked out</span></span>
        {rosterFound && (
          <>
            <span><span className="font-semibold text-destructive">{notCheckedInCount}</span> <span className="text-muted-foreground">not checked in</span></span>
            <span><span className="font-semibold">{leaveOffCount}</span> <span className="text-muted-foreground">leave/off</span></span>
          </>
        )}
      </div>

      {/* Attendance table — real rows and columns, no dialog */}
      <div className="border rounded-lg overflow-auto max-h-[420px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs sticky left-0 top-0 bg-background z-10">Staff</TableHead>
              <TableHead className="text-xs sticky top-0 bg-background z-10">Role</TableHead>
              <TableHead className="text-xs sticky top-0 bg-background z-10">Check-in</TableHead>
              <TableHead className="text-xs sticky top-0 bg-background z-10">Check-out</TableHead>
              <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Hours</TableHead>
              <TableHead className="text-xs sticky top-0 bg-background z-10">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reconciledRows.map(row => (
              <TableRow key={row.staff_id}>
                <TableCell className="text-xs font-medium sticky left-0 bg-background">
                  {row.full_name}
                  {row.offRoster && (
                    <Badge variant="outline" className="ml-1.5 text-[8px] px-1 text-muted-foreground">Off-roster</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground capitalize">{row.role || "-"}</TableCell>
                <TableCell className="text-xs">
                  {row.check_in_time ? format(new Date(row.check_in_time), "hh:mm a") : "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {row.check_out_time ? format(new Date(row.check_out_time), "hh:mm a") : "—"}
                </TableCell>
                <TableCell className="text-xs text-center font-medium">
                  {row.hours !== null ? formatDuration(row.hours) : "—"}
                </TableCell>
                <TableCell>{statusBadge(row)}</TableCell>
              </TableRow>
            ))}
            {reconciledRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs">
                  No staff checked in today
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {leaveOffCount > 0 && (
        <p className="text-[10px] text-muted-foreground -mt-2">
          * Leave/Off is a manually-set roster flag, not a formal approval workflow.
        </p>
      )}

      {/* Staff Performance — inline, no dialog */}
      {staffPerformance.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Staff Performance (Last 14 Sessions)</span>
          <div className="border rounded-lg overflow-auto max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sticky left-0 top-0 bg-background z-10">Staff</TableHead>
                  <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Sessions</TableHead>
                  <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Hours</TableHead>
                  <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Avg Break</TableHead>
                  <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Late</TableHead>
                  <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Missed</TableHead>
                  <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Punctuality</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffPerformance.map(staff => (
                  <TableRow key={staff.user_id}>
                    <TableCell className="text-xs font-medium sticky left-0 bg-background">{staff.full_name}</TableCell>
                    <TableCell className="text-xs text-center">{staff.sessions_present}</TableCell>
                    <TableCell className="text-xs text-center">{formatDuration(staff.total_hours)}</TableCell>
                    <TableCell className="text-xs text-center">
                      <span className="inline-flex items-center gap-1">
                        <Coffee className="h-3 w-3 text-muted-foreground" />
                        {Math.round(staff.avg_break_minutes)}m
                      </span>
                    </TableCell>
                    <TableCell className={`text-xs text-center ${staff.late_count > 0 ? 'text-warning' : ''}`}>
                      <span className="inline-flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {staff.late_count}
                      </span>
                    </TableCell>
                    <TableCell className={`text-xs text-center ${staff.missed_checkouts > 0 ? 'text-destructive' : ''}`}>
                      {staff.missed_checkouts}
                    </TableCell>
                    <TableCell className={`text-xs text-center font-medium ${getScoreColor(staff.punctuality_score)}`}>
                      {staff.punctuality_score}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};
