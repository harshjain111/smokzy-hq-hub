import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarCheck, Package, BarChart3, FileText, Activity, Users,
  TrendingUp, Clock, RefreshCw, Loader2, ChevronRight,
  CheckCircle2, AlertTriangle, Circle, ArrowUpRight, ArrowDownRight,
  
} from "lucide-react";
import { format, subDays, startOfMonth, startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

interface ClubManagementDashboardProps {
  user: User;
  venueIds: string[];
}

interface Venue { id: string; name: string; location: string; }

type TaskStatus = "done" | "pending" | "overdue" | "not-due";

interface TaskCard {
  label: string;
  status: TaskStatus;
  statusText: string;
  icon: React.ElementType;
  route: string;
  detail?: string;
}

interface TimelineEvent {
  time: string;
  label: string;
  isPast: boolean;
  isCurrent: boolean;
}

const statusColors: Record<TaskStatus, string> = {
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  overdue: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  "not-due": "bg-muted text-muted-foreground border-border",
};

const statusIcons: Record<TaskStatus, React.ElementType> = {
  done: CheckCircle2,
  pending: Clock,
  overdue: AlertTriangle,
  "not-due": Circle,
};

const ClubManagementDashboard = ({ user, venueIds }: ClubManagementDashboardProps) => {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(venueIds[0] || "");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [activeSession, setActiveSession] = useState<any>(null);
  const [staffOnDuty, setStaffOnDuty] = useState<any[]>([]);
  const [expectedStaff, setExpectedStaff] = useState<any[]>([]);
  const [todaySales, setTodaySales] = useState(0);
  const [yesterdaySales, setYesterdaySales] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [weekSales, setWeekSales] = useState(0);
  const [rosterConfirmed, setRosterConfirmed] = useState(false);
  const [stockSubmitted, setStockSubmitted] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [packetsReceived, setPacketsReceived] = useState(0);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [alertCount, setAlertCount] = useState({ critical: 0, warnings: 0, pending: 0 });
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const today = format(new Date(), "yyyy-MM-dd");
  const now = new Date();
  const currentHour = now.getHours();

  // Fetch venues
  useEffect(() => {
    const fetchVenues = async () => {
      const query = supabase.from("venues").select("id, name, location").order("name");
      const { data } = venueIds.length > 0
        ? await query.in("id", venueIds)
        : await query;
      if (data) {
        setVenues(data);
        if (data.length > 0 && !selectedVenueId) setSelectedVenueId(data[0].id);
      }
      setLoading(false);
    };
    fetchVenues();
  }, [venueIds]);

  const fetchAllData = useCallback(async () => {
    if (!selectedVenueId) { setLoading(false); return; }

    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();
    const yesterdayEnd = endOfDay(subDays(now, 1)).toISOString();
    const weekStart = startOfDay(subDays(now, 6)).toISOString();
    const monthStart = startOfMonth(now).toISOString();

    const [
      sessionRes, rosterRes, stockRes, dispatchRes,
      todaySalesRes, yesterdaySalesRes, weekSalesRes, monthSalesRes,
      notifRes,
    ] = await Promise.all([
      supabase.from("club_sessions").select("id, started_at, status, photo_uploaded, stock_submitted, sales_submitted, closed_at")
        .eq("venue_id", selectedVenueId).eq("session_date", today).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("daily_roster").select("id, staff_id, status, role, shift_start, shift_end, confirmed_at")
        .eq("venue_id", selectedVenueId).eq("date", today).eq("is_removed", false),
      supabase.from("venue_stock_daily").select("id, closing_stock, opening_stock, updated_at")
        .eq("venue_id", selectedVenueId).eq("date", today).limit(1).maybeSingle(),
      supabase.from("packet_dispatches").select("id, quantity_sent")
        .eq("venue_id", selectedVenueId).eq("date", today),
      supabase.from("sales_reports").select("quantity_sold")
        .eq("venue_id", selectedVenueId).gte("created_at", todayStart).lte("created_at", todayEnd),
      supabase.from("sales_reports").select("quantity_sold")
        .eq("venue_id", selectedVenueId).gte("created_at", yesterdayStart).lte("created_at", yesterdayEnd),
      supabase.from("sales_reports").select("quantity_sold")
        .eq("venue_id", selectedVenueId).gte("created_at", weekStart).lte("created_at", todayEnd),
      supabase.from("sales_reports").select("quantity_sold")
        .eq("venue_id", selectedVenueId).gte("created_at", monthStart).lte("created_at", todayEnd),
      supabase.from("admin_notifications").select("id, title, message, priority, type, created_at")
        .eq("venue_id", selectedVenueId).gte("created_at", startOfDay(subDays(now, 3)).toISOString())
        .eq("is_read", false).order("created_at", { ascending: false }).limit(20),
    ]);

    const session = sessionRes.data;
    setActiveSession(session);
    setPhotoUploaded(session?.photo_uploaded || false);
    setStockSubmitted(session?.stock_submitted || false);

    // Roster
    const rosterRows = rosterRes.data || [];
    setExpectedStaff(rosterRows);
    setRosterConfirmed(rosterRows.length > 0 && rosterRows.every(r => r.status === "confirmed"));

    // Stock
    const stockRow = stockRes.data;
    // If there's a stock row with opening_stock set, consider it started

    // Dispatches
    const totalPackets = (dispatchRes.data || []).reduce((s, d) => s + d.quantity_sent, 0);
    setPacketsReceived(totalPackets);

    // Sales
    setTodaySales((todaySalesRes.data || []).reduce((s, r) => s + r.quantity_sold, 0));
    setYesterdaySales((yesterdaySalesRes.data || []).reduce((s, r) => s + r.quantity_sold, 0));
    setWeekSales((weekSalesRes.data || []).reduce((s, r) => s + r.quantity_sold, 0));
    setMonthSales((monthSalesRes.data || []).reduce((s, r) => s + r.quantity_sold, 0));

    // Staff on duty (fetch from session if active)
    if (session?.id) {
      const { data: blocks } = await supabase
        .from("staff_attendance_blocks")
        .select("id, user_id, check_in_time, check_out_time")
        .eq("session_id", session.id).eq("is_break", false);

      if (blocks && blocks.length > 0) {
        const uids = [...new Set(blocks.map(b => b.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", uids);
        const pMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        setStaffOnDuty(blocks.map(b => ({ ...b, name: pMap.get(b.user_id) || "Unknown" })));
      } else {
        setStaffOnDuty([]);
      }
    } else {
      setStaffOnDuty([]);
    }

    // Build timeline
    const events: TimelineEvent[] = [];
    const addEvent = (time: string, label: string) => {
      const t = new Date(time);
      events.push({
        time: format(t, "h:mm a"),
        label,
        isPast: t < now,
        isCurrent: Math.abs(differenceInMinutes(t, now)) < 30,
      });
    };

    // Roster auto-prefill
    addEvent(format(now, "yyyy-MM-dd") + "T10:00:00", "Daily Roster auto-prefilled");

    if (stockRow?.updated_at) addEvent(stockRow.updated_at, "Stock entry updated");
    if (totalPackets > 0 && dispatchRes.data?.[0]) {
      addEvent(format(now, "yyyy-MM-dd") + "T13:00:00", `${totalPackets} packets dispatched`);
    }
    if (rosterRows.some(r => r.confirmed_at)) {
      const confirmTime = rosterRows.find(r => r.confirmed_at)?.confirmed_at;
      if (confirmTime) addEvent(confirmTime, "Roster confirmed ✓");
    }
    if (session?.started_at) addEvent(session.started_at, "Session started");
    else addEvent(format(now, "yyyy-MM-dd") + "T18:00:00", "Session starts (expected)");

    if (session?.closed_at) addEvent(session.closed_at, "Session closed");
    else addEvent(format(now, "yyyy-MM-dd") + "T03:00:00", "Closing report due");

    events.sort((a, b) => a.time.localeCompare(b.time));
    setTimelineEvents(events);

    // Alerts
    const notifs = notifRes.data || [];
    setAlerts(notifs);
    setAlertCount({
      critical: notifs.filter(n => n.priority === "high").length,
      warnings: notifs.filter(n => n.priority === "medium").length,
      pending: notifs.filter(n => n.priority === "low").length,
    });

    setLastUpdated(new Date());
  }, [selectedVenueId, today]);

  useEffect(() => {
    if (!selectedVenueId) { setLoading(false); return; }
    setLoading(true);
    fetchAllData().finally(() => setLoading(false));
  }, [selectedVenueId, fetchAllData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
    toast.success("Data refreshed");
  };

  // Task cards
  const taskCards: TaskCard[] = useMemo(() => {
    const isAfter2PM = currentHour >= 14;
    const isAfter3AM = currentHour >= 3 && currentHour < 7;

    const rosterStatus: TaskStatus = rosterConfirmed ? "done" : isAfter2PM ? "overdue" : "pending";
    const stockStatus: TaskStatus = stockSubmitted ? "done" : activeSession ? "pending" : "not-due";
    const dispatchStatus: TaskStatus = packetsReceived > 0 ? "done" : "pending";
    const closingStatus: TaskStatus = activeSession?.closed_at
      ? "done"
      : isAfter3AM && activeSession && !activeSession.closed_at
        ? "overdue"
        : activeSession
          ? "pending"
          : "not-due";

    return [
      {
        label: "Daily Roster",
        status: rosterStatus,
        statusText: rosterConfirmed ? "Confirmed ✓" : isAfter2PM ? "Overdue ⚠" : "Pending Confirmation",
        icon: CalendarCheck,
        route: "/roster/daily",
        detail: `${expectedStaff.length} staff assigned`,
      },
      {
        label: "Stock Entry",
        status: stockStatus,
        statusText: stockSubmitted ? "Done ✓" : activeSession ? "In Progress" : "Not Due Yet",
        icon: Package,
        route: "/daily-report",
      },
      {
        label: "Packet Dispatch",
        status: dispatchStatus,
        statusText: packetsReceived > 0 ? `${packetsReceived} received` : "Awaiting dispatch",
        icon: Package,
        route: "/packet-dispatch",
      },
      {
        label: "Closing Report",
        status: closingStatus,
        statusText: activeSession?.closed_at ? "Submitted ✓" : activeSession ? "Pending" : "Not Due Yet",
        icon: FileText,
        route: "/daily-report",
      },
    ];
  }, [rosterConfirmed, stockSubmitted, packetsReceived, activeSession, expectedStaff.length, currentHour]);

  const selectedVenue = venues.find(v => v.id === selectedVenueId);
  const activeStaff = staffOnDuty.filter(s => !s.check_out_time);
  const sessionDuration = activeSession?.started_at
    ? differenceInMinutes(now, new Date(activeSession.started_at))
    : 0;
  const sessionHours = Math.floor(sessionDuration / 60);
  const sessionMins = sessionDuration % 60;

  // Avg shishas per day this week
  const avgPerDay = weekSales > 0 ? Math.round(weekSales / 7) : 0;
  const salesTrend = yesterdaySales > 0
    ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header: Venue badge + refresh */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {venues.length > 1 ? (
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger className="w-[220px] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {venues.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="secondary" className="text-sm font-semibold px-3 py-1.5">
              {selectedVenue?.name || "My Venue"}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {format(now, "EEEE, MMM d")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {format(lastUpdated, "HH:mm")}
          </span>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="h-9 w-9">
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ═══ ROW 1: Today's Tasks ═══ */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Today's Tasks</h2>
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {taskCards.map((task) => {
              const StatusIcon = statusIcons[task.status];
              return (
                <Card
                  key={task.label}
                  className={cn(
                    "min-w-[180px] sm:min-w-0 sm:flex-1 cursor-pointer hover:shadow-md transition-shadow border",
                    task.status === "overdue" && "border-red-500/40",
                    task.status === "done" && "border-emerald-500/30"
                  )}
                  onClick={() => navigate(task.route)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <task.icon className="h-4 w-4 text-muted-foreground" />
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium leading-tight">{task.label}</p>
                    <Badge variant="outline" className={cn("text-[11px] font-medium", statusColors[task.status])}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {task.statusText}
                    </Badge>
                    {task.detail && (
                      <p className="text-[11px] text-muted-foreground">{task.detail}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* ═══ ROW 2: Live Venue State ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Session */}
        <Card className="border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
              activeSession ? "bg-emerald-500/15" : "bg-muted"
            )}>
              <Activity className={cn("h-5 w-5", activeSession ? "text-emerald-500" : "text-muted-foreground")} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Session</p>
              {activeSession ? (
                <>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    Live — {sessionHours}h {sessionMins}m
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Started {format(new Date(activeSession.started_at), "h:mm a")}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">No Active Session</p>
                  <p className="text-[11px] text-muted-foreground">Expected at 6:00 PM</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Staff */}
        <Card className="border cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/attendance-report")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
              activeStaff.length > 0 ? "bg-blue-500/15" : "bg-muted"
            )}>
              <Users className={cn("h-5 w-5", activeStaff.length > 0 ? "text-blue-500" : "text-muted-foreground")} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Staff On Duty</p>
              <p className="text-sm font-bold">
                {activeStaff.length} / {expectedStaff.length} {activeSession ? "checked in" : "expected"}
              </p>
              {!activeSession && expectedStaff.length > 0 && (
                <p className="text-[11px] text-muted-foreground">Roster for today</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sales */}
        <Card className="border cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/daily-report")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
              todaySales > 0 ? "bg-primary/15" : "bg-muted"
            )}>
              <TrendingUp className={cn("h-5 w-5", todaySales > 0 ? "text-primary" : "text-muted-foreground")} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Sales Today</p>
              <p className="text-sm font-bold">{todaySales} shishas</p>
              {yesterdaySales > 0 && (
                <div className="flex items-center gap-1">
                  {salesTrend >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span className={cn("text-[11px] font-medium", salesTrend >= 0 ? "text-emerald-600" : "text-red-500")}>
                    {Math.abs(salesTrend)}% vs yesterday
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ ROW 3: Timeline + Quick Stats ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Timeline (60%) */}
        <Card className="lg:col-span-3 border">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Timeline</h3>
            <div className="relative space-y-0">
              {timelineEvents.map((event, idx) => (
                <div key={idx} className="flex gap-3 relative">
                  {/* Line */}
                  {idx < timelineEvents.length - 1 && (
                    <div className="absolute left-[7px] top-5 w-px h-full bg-border" />
                  )}
                  {/* Dot */}
                  <div className={cn(
                    "h-[15px] w-[15px] rounded-full border-2 shrink-0 mt-0.5 z-10",
                    event.isCurrent
                      ? "bg-primary border-primary"
                      : event.isPast
                        ? "bg-muted-foreground/40 border-muted-foreground/40"
                        : "bg-background border-muted-foreground/30"
                  )} />
                  <div className={cn(
                    "pb-4 min-w-0",
                    !event.isPast && !event.isCurrent && "opacity-50"
                  )}>
                    <p className="text-[11px] text-muted-foreground font-medium">{event.time}</p>
                    <p className={cn(
                      "text-sm",
                      event.isCurrent ? "font-semibold text-primary" : "text-foreground"
                    )}>{event.label}</p>
                  </div>
                </div>
              ))}
              {timelineEvents.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No events yet today</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats (40%) */}
        <Card className="lg:col-span-2 border">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Stats</h3>

            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-[11px] text-muted-foreground font-medium mb-1">Yesterday</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">{yesterdaySales}</span>
                  <span className="text-xs text-muted-foreground">shishas sold</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-[11px] text-muted-foreground font-medium mb-1">This Week</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">{weekSales}</span>
                  <span className="text-xs text-muted-foreground">total • ~{avgPerDay}/day</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-[11px] text-muted-foreground font-medium mb-1">This Month</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">{monthSales}</span>
                  <span className="text-xs text-muted-foreground">shishas total</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ ROW 4: Staff Attendance ═══ */}
      <Card className="border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Today's Staff
            </h3>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/attendance-report")}>
              View All <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {activeSession && staffOnDuty.length > 0 ? (
            <div className="divide-y divide-border">
              {staffOnDuty.map(staff => (
                <div key={staff.id} className="py-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{staff.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      In: {format(new Date(staff.check_in_time), "h:mm a")}
                      {staff.check_out_time && <> • Out: {format(new Date(staff.check_out_time), "h:mm a")}</>}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    staff.check_out_time
                      ? "bg-muted text-muted-foreground"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  )}>
                    {staff.check_out_time ? "Left" : "On Duty"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : expectedStaff.length > 0 ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {activeSession ? "No check-ins yet" : `Expected ${expectedStaff.length} staff today (shift not started)`}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {expectedStaff.slice(0, 6).map(staff => (
                  <div key={staff.id} className="text-xs bg-muted/50 rounded-md p-2 text-muted-foreground">
                    {staff.role} • {staff.shift_start || "TBD"}
                  </div>
                ))}
                {expectedStaff.length > 6 && (
                  <div className="text-xs bg-muted/50 rounded-md p-2 text-muted-foreground">
                    +{expectedStaff.length - 6} more
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No roster entries for today</p>
          )}
        </CardContent>
      </Card>

      {/* ═══ ROW 5: Alert Bar ═══ */}
      {(alertCount.critical + alertCount.warnings + alertCount.pending) > 0 && (
        <Card
          className={cn(
            "border cursor-pointer hover:shadow-md transition-shadow",
            alertCount.critical > 0 && "border-red-500/40"
          )}
          onClick={() => setAlertDrawerOpen(true)}
        >
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              {alertCount.critical > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="font-medium">{alertCount.critical} Critical</span>
                </span>
              )}
              {alertCount.warnings > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="font-medium">{alertCount.warnings} Warnings</span>
                </span>
              )}
              {alertCount.pending > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="font-medium">{alertCount.pending} Pending</span>
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Alert Drawer */}
      <Drawer open={alertDrawerOpen} onOpenChange={setAlertDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Venue Alerts</DrawerTitle>
            <DrawerDescription>Recent alerts for {selectedVenue?.name}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto divide-y divide-border">
            {alerts.map(alert => (
              <div key={alert.id} className="py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "h-2 w-2 rounded-full",
                    alert.priority === "high" ? "bg-red-500" : alert.priority === "medium" ? "bg-amber-500" : "bg-yellow-500"
                  )} />
                  <p className="text-sm font-medium">{alert.title}</p>
                </div>
                <p className="text-xs text-muted-foreground ml-4">{alert.message}</p>
                <p className="text-[10px] text-muted-foreground ml-4 mt-1">
                  {format(new Date(alert.created_at), "MMM d, h:mm a")}
                </p>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No recent alerts</p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default ClubManagementDashboard;
