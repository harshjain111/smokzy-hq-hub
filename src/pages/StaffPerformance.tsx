import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Award,
  Clock,
  TrendingUp,
} from "lucide-react";

interface StaffMetrics {
  user_id: string;
  full_name: string;
  venue_name: string;
  venue_id: string;
  total_sessions: number;
  sessions_present: number;
  attendance_pct: number;
  late_checkins: number;
  missed_checkouts: number;
  violations_count: number;
  unresolved_violations: number;
  training_completed: number;
  training_total: number;
  status: "Disciplined" | "Needs Attention" | "Non-Compliant";
}

const StaffPerformance = () => {
  const [staff, setStaff] = useState<StaffMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);

  // Date range: last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const [
      { data: venueData },
      { data: rolesData },
      { data: profileData },
      { data: attendanceBlocks },
      { data: sessionsData },
      { data: violationsData },
      { data: trainingData },
    ] = await Promise.all([
      supabase.from("venues").select("id, name").order("name"),
      supabase.from("user_roles").select("user_id, venue_id").eq("role", "employee"),
      supabase.from("profiles").select("id, full_name"),
      supabase
        .from("staff_attendance_blocks")
        .select("user_id, venue_id, session_id, check_in_time, check_out_time")
        .gte("check_in_time", fromDate),
      supabase
        .from("club_sessions")
        .select("id, venue_id, session_date")
        .gte("session_date", fromDate),
      supabase
        .from("staff_violations")
        .select("staff_id, resolved")
        .gte("date", fromDate),
      supabase
        .from("staff_training")
        .select("staff_id, completed"),
    ]);

    setVenues(venueData || []);

    const venueMap = new Map((venueData || []).map((v: any) => [v.id, v.name]));
    const profileMap = new Map((profileData || []).map((p: any) => [p.id, p.full_name]));

    // Sessions per venue
    const venueSessionCount = new Map<string, number>();
    const venueSessionIds = new Map<string, Set<string>>();
    (sessionsData || []).forEach((s: any) => {
      venueSessionCount.set(s.venue_id, (venueSessionCount.get(s.venue_id) || 0) + 1);
      if (!venueSessionIds.has(s.venue_id)) venueSessionIds.set(s.venue_id, new Set());
      venueSessionIds.get(s.venue_id)!.add(s.id);
    });

    // Attendance by user
    const userAttendance = new Map<string, { sessions: Set<string>; lateCheckins: number; missedCheckouts: number }>();
    (attendanceBlocks || []).forEach((b: any) => {
      if (!userAttendance.has(b.user_id)) {
        userAttendance.set(b.user_id, { sessions: new Set(), lateCheckins: 0, missedCheckouts: 0 });
      }
      const ua = userAttendance.get(b.user_id)!;
      ua.sessions.add(b.session_id);
      // Late = checked in after 19:30 (7:30 PM)
      const checkInHour = new Date(b.check_in_time).getHours();
      const checkInMin = new Date(b.check_in_time).getMinutes();
      if (checkInHour > 19 || (checkInHour === 19 && checkInMin > 30)) {
        ua.lateCheckins++;
      }
      if (!b.check_out_time) {
        ua.missedCheckouts++;
      }
    });

    // Violations by user
    const userViolations = new Map<string, { total: number; unresolved: number }>();
    (violationsData || []).forEach((v: any) => {
      if (!userViolations.has(v.staff_id)) {
        userViolations.set(v.staff_id, { total: 0, unresolved: 0 });
      }
      const uv = userViolations.get(v.staff_id)!;
      uv.total++;
      if (!v.resolved) uv.unresolved++;
    });

    // Training by user
    const userTraining = new Map<string, { completed: number; total: number }>();
    (trainingData || []).forEach((t: any) => {
      if (!userTraining.has(t.staff_id)) {
        userTraining.set(t.staff_id, { completed: 0, total: 0 });
      }
      const ut = userTraining.get(t.staff_id)!;
      ut.total++;
      if (t.completed) ut.completed++;
    });

    // Build metrics
    const metrics: StaffMetrics[] = (rolesData || []).map((role: any) => {
      const userId = role.user_id;
      const venueId = role.venue_id;
      const totalSessions = venueSessionCount.get(venueId) || 0;
      const ua = userAttendance.get(userId);
      const sessionsPresent = ua ? ua.sessions.size : 0;
      const attendancePct = totalSessions > 0 ? Math.round((sessionsPresent / totalSessions) * 100) : 0;
      const violations = userViolations.get(userId);
      const training = userTraining.get(userId);

      let status: StaffMetrics["status"] = "Disciplined";
      if ((violations?.unresolved || 0) > 0 || attendancePct < 60) {
        status = "Non-Compliant";
      } else if (attendancePct < 80 || (ua?.lateCheckins || 0) > 3) {
        status = "Needs Attention";
      }

      return {
        user_id: userId,
        full_name: profileMap.get(userId) || "Unknown",
        venue_name: venueMap.get(venueId) || "Unassigned",
        venue_id: venueId,
        total_sessions: totalSessions,
        sessions_present: sessionsPresent,
        attendance_pct: attendancePct,
        late_checkins: ua?.lateCheckins || 0,
        missed_checkouts: ua?.missedCheckouts || 0,
        violations_count: violations?.total || 0,
        unresolved_violations: violations?.unresolved || 0,
        training_completed: training?.completed || 0,
        training_total: training?.total || 0,
        status,
      };
    });

    metrics.sort((a, b) => {
      const statusOrder = { "Non-Compliant": 0, "Needs Attention": 1, Disciplined: 2 };
      return statusOrder[a.status] - statusOrder[b.status] || a.full_name.localeCompare(b.full_name);
    });

    setStaff(metrics);
    setLoading(false);
  };

  const toggleExpand = (userId: string) => {
    setExpandedStaff((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const filtered = staff.filter((s) => {
    if (filterVenue !== "all" && s.venue_id !== filterVenue) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

  const getStatusBadge = (status: StaffMetrics["status"]) => {
    switch (status) {
      case "Disciplined":
        return <Badge variant="outline" className="border-success/50 bg-success/10 text-success text-xs">Disciplined</Badge>;
      case "Needs Attention":
        return <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning text-xs">Needs Attention</Badge>;
      case "Non-Compliant":
        return <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive text-xs">Non-Compliant</Badge>;
    }
  };

  // Summary counts
  const disciplined = staff.filter((s) => s.status === "Disciplined").length;
  const needsAttention = staff.filter((s) => s.status === "Needs Attention").length;
  const nonCompliant = staff.filter((s) => s.status === "Non-Compliant").length;

  return (
    <PageLayout title="Staff Performance" subtitle="Last 30 days · Auto-calculated from attendance data">
      <div className="space-y-4">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Disciplined</div>
              <div className="text-2xl font-bold text-success">{disciplined}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Needs Attention</div>
              <div className="text-2xl font-bold text-warning">{needsAttention}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Non-Compliant</div>
              <div className="text-2xl font-bold text-destructive">{nonCompliant}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={filterVenue} onValueChange={setFilterVenue}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Clubs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clubs</SelectItem>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Disciplined">Disciplined</SelectItem>
              <SelectItem value="Needs Attention">Needs Attention</SelectItem>
              <SelectItem value="Non-Compliant">Non-Compliant</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Staff List */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Calculating performance...
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const isExpanded = expandedStaff.has(s.user_id);
              return (
                <Card key={s.user_id} className="overflow-hidden">
                  <button
                    className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors touch-manipulation"
                    onClick={() => toggleExpand(s.user_id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s.full_name}</div>
                      <div className="text-xs text-muted-foreground">{s.venue_name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-lg font-bold ${
                        s.attendance_pct >= 80 ? "text-success" :
                        s.attendance_pct >= 60 ? "text-warning" : "text-destructive"
                      }`}>
                        {s.attendance_pct}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">attendance</div>
                    </div>
                    {getStatusBadge(s.status)}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t p-4 bg-muted/10 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs text-muted-foreground">Sessions</div>
                            <div className="font-medium">{s.sessions_present}/{s.total_sessions}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs text-muted-foreground">Late Check-ins</div>
                            <div className={`font-medium ${s.late_checkins > 3 ? "text-destructive" : ""}`}>{s.late_checkins}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs text-muted-foreground">Violations</div>
                            <div className={`font-medium ${s.unresolved_violations > 0 ? "text-destructive" : ""}`}>
                              {s.violations_count} ({s.unresolved_violations} open)
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs text-muted-foreground">Training</div>
                            <div className="font-medium">
                              {s.training_total > 0 ? `${s.training_completed}/${s.training_total}` : "None"}
                            </div>
                          </div>
                        </div>
                      </div>
                      {s.missed_checkouts > 0 && (
                        <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-2">
                          ⚠️ {s.missed_checkouts} missed checkout(s) in the last 30 days
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No staff found matching filters</div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default StaffPerformance;
