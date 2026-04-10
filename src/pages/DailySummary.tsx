import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package, ShoppingCart, AlertTriangle, ClipboardCheck, ChevronRight,
  CalendarDays, BarChart3, Users, Bell, Clock, X, Zap,
  TrendingUp, TrendingDown, Minus, Activity, Eye,
  AlertCircle, Shield, ListChecks,
} from "lucide-react";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";

const formatDate = (d: Date) => d.toISOString().split("T")[0];
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

// -- Types --
interface VenueHealth {
  id: string;
  name: string;
  severity: "critical" | "warning" | "pending" | "healthy";
  issues: AlertItem[];
}

interface AlertItem {
  id: string;
  severity: "critical" | "warning" | "pending" | "info";
  title: string;
  context: string;
  venueId?: string;
  venueName?: string;
  route: string;
  actionLabel: string;
  timestamp?: string;
}

interface PriorityItem extends AlertItem {}

// ============================================================
// DailySummary — Command Center
// ============================================================
const DailySummary = () => {
  const navigate = useNavigate();
  const today = formatDate(new Date());
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  // Raw data
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [kpis, setKpis] = useState({
    activeClubs: 0, staffOnDuty: 0, expectedStaff: 0,
    openSessions: 0, stockPendingVenues: 0, salesPendingVenues: 0, forceClosed: 0,
  });

  // Alerts & priorities
  const [allAlerts, setAllAlerts] = useState<AlertItem[]>([]);
  const [venueHealthMap, setVenueHealthMap] = useState<Map<string, VenueHealth>>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFilter, setDrawerFilter] = useState<string>("all");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Roster tasks
  const [rosterConfirmed, setRosterConfirmed] = useState(0);
  const [rosterTotal, setRosterTotal] = useState(0);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchUserName(), fetchDashboardData()]);
    setLoading(false);
  };

  const fetchUserName = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
    if (data?.full_name) setUserName(data.full_name.split(" ")[0]);
  };

  const fetchDashboardData = async () => {
    const [
      { data: venueList },
      { data: openSessions },
      { data: activeBlocks },
      { data: rosterAssignments },
      { data: stockDaily },
      { data: salesData },
      { data: trackableCats },
      { data: dispatches },
      { data: inspections },
      { data: allInspections },
      { data: forcedSessions },
      { data: dailyRosterData },
      { data: rosterTasks },
    ] = await Promise.all([
      supabase.from("venues").select("id, name").order("name"),
      supabase.from("club_sessions").select("id, venue_id, status").eq("status", "open"),
      supabase.from("staff_attendance_blocks").select("user_id, venue_id, check_in_time").is("check_out_time", null),
      supabase.from("roster_assignments").select("staff_id, venue_id").eq("date", today).eq("status", "assigned"),
      supabase.from("venue_stock_daily").select("venue_id, packets_used, closing_stock, min_stock_threshold").eq("date", today),
      supabase.from("sales_reports").select("quantity_sold, category_id, venue_id").eq("report_date", today),
      supabase.from("venue_hookah_categories").select("id").eq("is_packet_trackable", true),
      supabase.from("packet_dispatches").select("quantity_sent, venue_id").eq("date", today),
      supabase.from("inspections").select("id, venue_id").eq("date", today),
      supabase.from("inspections").select("venue_id, date").order("date", { ascending: false }),
      supabase.from("club_sessions").select("id, venue_id").eq("status", "force_closed").eq("session_date", today),
      supabase.from("daily_roster" as any).select("venue_id, status").eq("date", today),
      supabase.from("incharge_daily_tasks" as any).select("venue_id, status").eq("task_date", today).eq("task_type", "confirm_daily_roster"),
    ]);

    const vList = venueList || [];
    setVenues(vList);

    // Open sessions set
    const openVenueIds = new Set((openSessions || []).map(s => s.venue_id));
    const forceClosedVenueIds = new Set((forcedSessions || []).map(s => s.venue_id));

    // Staff
    const uniqueStaff = new Set((activeBlocks || []).map(b => b.user_id));
    const expectedStaff = new Set((rosterAssignments || []).map(r => r.staff_id)).size;

    // Stock venues with data vs without
    const stockVenueIds = new Set((stockDaily || []).map(s => s.venue_id));
    const stockPendingVenues = vList.filter(v => openVenueIds.has(v.id) && !stockVenueIds.has(v.id)).length;

    // Sales pending
    const salesVenueIds = new Set((salesData || []).map(s => s.venue_id));
    const salesPendingVenues = vList.filter(v => openVenueIds.has(v.id) && !salesVenueIds.has(v.id)).length;

    // Roster status
    const confirmedVenueIds = new Set(
      ((dailyRosterData || []) as any[])
        .filter((r: any) => r.status === "confirmed")
        .map((r: any) => r.venue_id)
    );
    setRosterConfirmed(confirmedVenueIds.size);
    setRosterTotal(vList.length);

    setKpis({
      activeClubs: openVenueIds.size,
      staffOnDuty: uniqueStaff.size,
      expectedStaff,
      openSessions: (openSessions || []).length,
      stockPendingVenues,
      salesPendingVenues,
      forceClosed: forceClosedVenueIds.size,
    });

    // -- Build alerts & venue health --
    const alerts: AlertItem[] = [];
    const healthMap = new Map<string, VenueHealth>();
    const venueNameMap = new Map(vList.map(v => [v.id, v.name]));

    vList.forEach(v => healthMap.set(v.id, { id: v.id, name: v.name, severity: "healthy", issues: [] }));

    // Force closed
    forceClosedVenueIds.forEach(vid => {
      const a: AlertItem = {
        id: `fc-${vid}`, severity: "critical",
        title: `${venueNameMap.get(vid)} — Force Closed`,
        context: "No sales today",
        venueId: vid, venueName: venueNameMap.get(vid),
        route: `/club/${vid}`, actionLabel: "Resolve",
      };
      alerts.push(a);
      healthMap.get(vid)!.severity = "critical";
      healthMap.get(vid)!.issues.push(a);
    });

    // Packet mismatches per venue
    const trackableIds = new Set((trackableCats || []).map(c => c.id));
    const dispatchByVenue = new Map<string, number>();
    (dispatches || []).forEach(d => dispatchByVenue.set(d.venue_id, (dispatchByVenue.get(d.venue_id) || 0) + d.quantity_sent));
    const soldByVenue = new Map<string, number>();
    (salesData || []).filter(s => trackableIds.has(s.category_id)).forEach(s =>
      soldByVenue.set(s.venue_id, (soldByVenue.get(s.venue_id) || 0) + s.quantity_sold)
    );

    const mismatchVenues: string[] = [];
    dispatchByVenue.forEach((dispatched, vid) => {
      const sold = soldByVenue.get(vid) || 0;
      if (dispatched - sold > 0) mismatchVenues.push(vid);
    });

    if (mismatchVenues.length > 2) {
      // Consolidated
      alerts.push({
        id: "mismatch-group", severity: "critical",
        title: `Packet Mismatch — ${mismatchVenues.length} venues`,
        context: "Dispatched > sold, investigate leakage",
        route: "/daily-report", actionLabel: "Investigate",
      });
      mismatchVenues.forEach(vid => {
        const h = healthMap.get(vid);
        if (h && h.severity !== "critical") h.severity = "critical";
      });
    } else {
      mismatchVenues.forEach(vid => {
        const dispatched = dispatchByVenue.get(vid) || 0;
        const sold = soldByVenue.get(vid) || 0;
        const a: AlertItem = {
          id: `mm-${vid}`, severity: "critical",
          title: `${venueNameMap.get(vid)} — Packet Mismatch`,
          context: `${dispatched} dispatched, ${sold} sold`,
          venueId: vid, venueName: venueNameMap.get(vid),
          route: "/daily-report", actionLabel: "Investigate",
        };
        alerts.push(a);
        const h = healthMap.get(vid);
        if (h) { h.severity = "critical"; h.issues.push(a); }
      });
    }

    // Low stock
    const lowStockVenues: string[] = [];
    (stockDaily || []).forEach(v => {
      if (v.closing_stock !== null && v.closing_stock <= v.min_stock_threshold) lowStockVenues.push(v.venue_id);
    });
    if (lowStockVenues.length > 2) {
      alerts.push({
        id: "lowstock-group", severity: "warning",
        title: `Low Stock — ${lowStockVenues.length} venues`,
        context: "Stock below threshold",
        route: "/daily-report", actionLabel: "Review",
      });
    } else {
      lowStockVenues.forEach(vid => {
        alerts.push({
          id: `ls-${vid}`, severity: "warning",
          title: `${venueNameMap.get(vid)} — Low Stock`,
          context: "Below minimum threshold",
          venueId: vid, route: "/daily-report", actionLabel: "Review",
        });
      });
    }
    lowStockVenues.forEach(vid => {
      const h = healthMap.get(vid);
      if (h && h.severity === "healthy") h.severity = "warning";
    });

    // Inspections overdue (no inspection in 2+ days)
    const lastInspection = new Map<string, string>();
    (allInspections || []).forEach(i => {
      if (!lastInspection.has(i.venue_id)) lastInspection.set(i.venue_id, i.date);
    });
    const overdueInspectionVenues: string[] = [];
    const twoDaysAgo = new Date(); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    vList.forEach(v => {
      const last = lastInspection.get(v.id);
      if (!last || new Date(last) < twoDaysAgo) overdueInspectionVenues.push(v.id);
    });

    if (overdueInspectionVenues.length > 2) {
      alerts.push({
        id: "insp-group", severity: "warning",
        title: `Inspection Overdue — ${overdueInspectionVenues.length} venues`,
        context: "No inspection in 2+ days",
        route: "/inspections", actionLabel: "Inspect Now",
      });
    } else {
      overdueInspectionVenues.forEach(vid => {
        const daysSince = lastInspection.has(vid)
          ? Math.floor((Date.now() - new Date(lastInspection.get(vid)!).getTime()) / 86400000)
          : 999;
        alerts.push({
          id: `insp-${vid}`, severity: "warning",
          title: `${venueNameMap.get(vid)} — Inspection Overdue`,
          context: daysSince > 100 ? "Never inspected" : `${daysSince} days since last`,
          venueId: vid, route: "/inspections/new", actionLabel: "Inspect Now",
        });
      });
    }
    overdueInspectionVenues.forEach(vid => {
      const h = healthMap.get(vid);
      if (h && h.severity === "healthy") h.severity = "warning";
    });

    // Roster unconfirmed
    const unconfirmedRosterVenues = vList.filter(v => !confirmedVenueIds.has(v.id));
    if (unconfirmedRosterVenues.length > 0) {
      alerts.push({
        id: "roster-unconfirmed", severity: "warning",
        title: `Daily Roster Unconfirmed — ${unconfirmedRosterVenues.length} venues`,
        context: "Confirm before 2 PM",
        route: "/roster/daily", actionLabel: "Confirm",
      });
      unconfirmedRosterVenues.forEach(v => {
        const h = healthMap.get(v.id);
        if (h && h.severity === "healthy") h.severity = "pending";
      });
    }

    // Stock pending
    if (stockPendingVenues > 0) {
      alerts.push({
        id: "stock-pending", severity: "pending",
        title: `Stock Entry Pending — ${stockPendingVenues} venues`,
        context: "Open sessions without stock data",
        route: "/daily-report", actionLabel: "Follow up",
      });
    }

    // Sales pending
    if (salesPendingVenues > 0) {
      alerts.push({
        id: "sales-pending", severity: "pending",
        title: `Sales Entry Pending — ${salesPendingVenues} venues`,
        context: "Open sessions without sales data",
        route: "/daily-report", actionLabel: "Follow up",
      });
    }

    // Sort: critical → warning → pending
    const sevOrder = { critical: 0, warning: 1, pending: 2, info: 3 };
    alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    setAllAlerts(alerts);
    setVenueHealthMap(healthMap);
  };

  // Health strip counts
  const healthCounts = useMemo(() => {
    const counts = { critical: 0, warning: 0, pending: 0, healthy: 0 };
    venueHealthMap.forEach(v => counts[v.severity]++);
    return counts;
  }, [venueHealthMap]);

  const totalVenues = venues.length;

  // Filtered alerts for drawer
  const filteredAlerts = useMemo(() => {
    let items = allAlerts.filter(a => !dismissedIds.has(a.id));
    if (drawerFilter !== "all") items = items.filter(a => a.severity === drawerFilter);
    return items;
  }, [allAlerts, drawerFilter, dismissedIds]);

  // Top 5 priorities
  const priorities = useMemo(() =>
    allAlerts.filter(a => !dismissedIds.has(a.id)).slice(0, 5),
    [allAlerts, dismissedIds]
  );

  const dismiss = (id: string) => setDismissedIds(prev => new Set(prev).add(id));

  const openDrawerWithFilter = (filter: string) => {
    setDrawerFilter(filter);
    setDrawerOpen(true);
  };

  // -- Quick actions --
  const quickActions = [
    { label: "Packet Dispatch", icon: Package, route: "/packet-dispatch" },
    { label: "New Inspection", icon: ClipboardCheck, route: "/inspections/new" },
    { label: "Today's Roster", icon: CalendarDays, route: "/roster/daily" },
    { label: "Daily Report", icon: BarChart3, route: "/daily-report" },
  ];

  // Next inspection due
  const nextInspectionVenue = useMemo(() => {
    let oldest: { name: string; days: number } | null = null;
    venueHealthMap.forEach(v => {
      if (v.issues.some(i => i.id.startsWith("insp-"))) {
        const issue = v.issues.find(i => i.id.startsWith("insp-"));
        if (issue) {
          const days = parseInt(issue.context) || 99;
          if (!oldest || days > oldest.days) oldest = { name: v.name, days };
        }
      }
    });
    return oldest;
  }, [venueHealthMap]);

  const sevColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-destructive text-destructive-foreground";
      case "warning": return "bg-orange-500 text-white";
      case "pending": return "bg-yellow-500 text-black";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const sevIcon = (s: string) => {
    switch (s) {
      case "critical": return <AlertCircle className="h-4 w-4" />;
      case "warning": return <AlertTriangle className="h-4 w-4" />;
      case "pending": return <Clock className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4 max-w-6xl pb-6">
      {/* Greeting — compact */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-foreground">
            {getGreeting()}, {userName || "Boss"} 👋
          </h2>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => openDrawerWithFilter("all")} className="relative">
          <Bell className="h-5 w-5" />
          {allAlerts.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
              {allAlerts.length}
            </span>
          )}
        </Button>
      </div>

      {/* Row 1 — Health Strip */}
      {loading ? (
        <Skeleton className="h-14 rounded-xl" />
      ) : (
        <div className="flex rounded-xl overflow-hidden border shadow-sm h-12 md:h-14">
          <HealthSegment
            count={healthCounts.critical}
            label="Critical"
            color="bg-destructive/10 text-destructive hover:bg-destructive/20"
            dotColor="bg-destructive"
            onClick={() => openDrawerWithFilter("critical")}
            total={totalVenues}
          />
          <HealthSegment
            count={healthCounts.warning}
            label="Warnings"
            color="bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:hover:bg-orange-950/50"
            dotColor="bg-orange-500"
            onClick={() => openDrawerWithFilter("warning")}
            total={totalVenues}
          />
          <HealthSegment
            count={healthCounts.pending}
            label="Pending"
            color="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-400 dark:hover:bg-yellow-950/50"
            dotColor="bg-yellow-500"
            onClick={() => openDrawerWithFilter("pending")}
            total={totalVenues}
          />
          <HealthSegment
            count={healthCounts.healthy}
            label="Healthy"
            color="bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
            dotColor="bg-green-500"
            onClick={() => openDrawerWithFilter("all")}
            total={totalVenues}
          />
        </div>
      )}

      {/* Row 2 — KPI Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <KPICard label="ACTIVE CLUBS" value={kpis.activeClubs} sub={`of ${totalVenues}`} icon={Activity} />
          <KPICard label="STAFF ON DUTY" value={kpis.staffOnDuty} sub={`/ ${kpis.expectedStaff}`} icon={Users} />
          <KPICard label="OPEN SESSIONS" value={kpis.openSessions} icon={Zap} />
          <KPICard
            label="STOCK PENDING" value={kpis.stockPendingVenues}
            sub={kpis.stockPendingVenues > 0 ? `${kpis.stockPendingVenues} venues` : "All clear"}
            icon={Package}
            onClick={() => navigate("/daily-report")}
            warn={kpis.stockPendingVenues > 0}
          />
          <KPICard
            label="SALES PENDING" value={kpis.salesPendingVenues}
            sub={kpis.salesPendingVenues > 0 ? `${kpis.salesPendingVenues} venues` : "All clear"}
            icon={ShoppingCart}
            onClick={() => navigate("/daily-report")}
            warn={kpis.salesPendingVenues > 0}
          />
          <KPICard
            label="FORCE CLOSED" value={kpis.forceClosed}
            icon={AlertTriangle}
            danger={kpis.forceClosed > 0}
          />
        </div>
      )}

      {/* Row 3 — Two-column split */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left — Today's Priorities (60%) */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Today's Priorities</h3>
              {allAlerts.length > 5 && (
                <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => openDrawerWithFilter("all")}>
                  View all ({allAlerts.length})
                </Button>
              )}
            </div>

            {priorities.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-6 rounded-xl border bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
                <Shield className="h-5 w-5" />
                <span className="text-sm font-medium">All clear — no issues to resolve</span>
              </div>
            ) : (
              <div className="space-y-1">
                {priorities.map((p, i) => (
                  <div key={p.id}
                    className="flex items-center gap-3 h-12 px-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      p.severity === "critical" ? "bg-destructive" :
                      p.severity === "warning" ? "bg-orange-500" : "bg-yellow-500"
                    }`} />
                    <span className="text-sm font-medium truncate flex-1">{p.title}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[150px]">{p.context}</span>
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => navigate(p.route)}
                    >
                      {p.actionLabel} <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                    <button onClick={() => dismiss(p.id)} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — Today's Pulse (40%) */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Today's Pulse</h3>

            {/* Roster Status */}
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Roster Status</span>
                  <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => navigate("/roster/daily")}>
                    Confirm <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{rosterConfirmed}/{rosterTotal}</span>
                  <span className="text-xs text-muted-foreground">confirmed</span>
                </div>
                <Progress value={rosterTotal > 0 ? (rosterConfirmed / rosterTotal) * 100 : 0} className="h-2" />
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-3 grid grid-cols-2 gap-2">
                {quickActions.map(a => (
                  <button
                    key={a.route}
                    onClick={() => navigate(a.route)}
                    className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <a.icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs font-medium truncate">{a.label}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Next Inspection */}
            {nextInspectionVenue && (
              <Card className="rounded-xl shadow-sm border-orange-200 dark:border-orange-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Next Inspection Due</p>
                      <p className="text-sm font-medium mt-1">{(nextInspectionVenue as any).name}</p>
                      <p className="text-xs text-orange-600 dark:text-orange-400">{(nextInspectionVenue as any).days}+ days overdue</p>
                    </div>
                    <Button size="sm" className="h-9" onClick={() => navigate("/inspections/new")}>
                      <ClipboardCheck className="h-4 w-4 mr-1" /> Start
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Row 4 — Recent Activity (below fold) */}
      <RecentActivityFeed />

      {/* Alert Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Active Alerts</span>
              <span className="text-xs font-normal text-muted-foreground">{filteredAlerts.length} alerts</span>
            </SheetTitle>
          </SheetHeader>

          <Tabs value={drawerFilter} onValueChange={setDrawerFilter} className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1 text-xs">All</TabsTrigger>
              <TabsTrigger value="critical" className="flex-1 text-xs">Critical</TabsTrigger>
              <TabsTrigger value="warning" className="flex-1 text-xs">Warning</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1 text-xs">Pending</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-4 space-y-2">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No alerts in this category</div>
            ) : (
              filteredAlerts.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <span className={`mt-0.5 p-1 rounded-md ${sevColor(a.severity)}`}>
                    {sevIcon(a.severity)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.context}</p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 h-8 text-xs" onClick={() => { navigate(a.route); setDrawerOpen(false); }}>
                    {a.actionLabel}
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// ============================================================
// Sub-components
// ============================================================

const HealthSegment = ({ count, label, color, dotColor, onClick, total }: {
  count: number; label: string; color: string; dotColor: string; onClick: () => void; total: number;
}) => {
  if (count === 0 && label !== "Healthy") return null;
  const pct = total > 0 ? Math.max((count / total) * 100, 15) : 25; // min 15% width
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-3 transition-colors ${color}`}
      style={{ flex: `${pct} 0 0%` }}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
      <span className="text-sm font-bold">{count}</span>
      <span className="text-xs hidden sm:inline">{label}</span>
    </button>
  );
};

const KPICard = ({ label, value, sub, icon: Icon, onClick, warn, danger }: {
  label: string; value: number; sub?: string; icon: any; onClick?: () => void; warn?: boolean; danger?: boolean;
}) => {
  const colorClass = danger ? "text-destructive" : warn ? "text-orange-600 dark:text-orange-400" : "text-foreground";
  return (
    <Card
      className={`rounded-xl shadow-sm ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${danger ? "border-destructive/30" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-3 flex flex-col items-center justify-center h-[88px]">
        <Icon className={`h-4 w-4 mb-1 ${danger ? "text-destructive" : warn ? "text-orange-500" : "text-muted-foreground"}`} />
        <div className={`text-2xl font-bold leading-tight ${colorClass}`}>{value}</div>
        <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
      </CardContent>
    </Card>
  );
};

export default DailySummary;
