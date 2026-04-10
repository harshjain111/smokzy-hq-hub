import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package, ShoppingCart, AlertTriangle, ClipboardCheck, ChevronRight,
  CalendarDays, BarChart3, Users, Bell, ListChecks, Clock,
} from "lucide-react";
import { useNavigate as useNav } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import { Skeleton } from "@/components/ui/skeleton";

const formatDate = (d: Date) => d.toISOString().split("T")[0];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const DailySummary = () => {
  const navigate = useNavigate();
  const today = formatDate(new Date());
  const [userName, setUserName] = useState("");

  const [kpis, setKpis] = useState({
    dispatched: 0, sold: 0, mismatches: 0,
    inspections: 0, staffOnDuty: 0, activeClubs: 0,
  });
  const [alerts, setAlerts] = useState<{ type: string; message: string; venueId?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingTasks, setPendingTasks] = useState<{ id: string; venue_name: string; status: string; deadline: string }[]>([]);

  useEffect(() => {
    fetchDailyData();
    fetchUserName();
    fetchPendingTasks();
  }, []);

  const fetchPendingTasks = async () => {
    const { data: tasks } = await supabase
      .from("incharge_daily_tasks" as any)
      .select("id, venue_id, status, deadline")
      .eq("task_date", today)
      .eq("task_type", "confirm_daily_roster")
      .in("status", ["pending", "overdue"]);

    if (tasks && tasks.length > 0) {
      const venueIds = [...new Set((tasks as any[]).map((t: any) => t.venue_id))];
      const { data: venues } = await supabase.from("venues").select("id, name").in("id", venueIds);
      const vMap = new Map((venues || []).map(v => [v.id, v.name]));
      setPendingTasks((tasks as any[]).map((t: any) => ({
        id: t.id,
        venue_name: vMap.get(t.venue_id) || "Unknown",
        status: t.status,
        deadline: t.deadline,
      })));
    }
  };


  const fetchUserName = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
    if (data?.full_name) setUserName(data.full_name.split(" ")[0]);
  };

  const fetchDailyData = async () => {
    setLoading(true);
    const [
      { data: dispatches }, { data: salesData }, { data: trackableCats },
      { data: stockDaily }, { data: inspections }, { data: activeBlocks },
      { data: openSessions }, { data: lowStockVenues },
    ] = await Promise.all([
      supabase.from("packet_dispatches").select("quantity_sent").eq("date", today),
      supabase.from("sales_reports").select("quantity_sold, category_id").eq("report_date", today),
      supabase.from("venue_hookah_categories").select("id").eq("is_packet_trackable", true),
      supabase.from("venue_stock_daily").select("venue_id, packets_used, closing_stock, min_stock_threshold").eq("date", today),
      supabase.from("inspections").select("id").eq("date", today),
      supabase.from("staff_attendance_blocks").select("user_id, session_id").is("check_out_time", null),
      supabase.from("club_sessions").select("id, venue_id").eq("status", "open"),
      supabase.from("venue_stock_daily").select("venue_id, closing_stock, min_stock_threshold").eq("date", today),
    ]);

    const totalDispatched = (dispatches || []).reduce((s, d) => s + d.quantity_sent, 0);
    const trackableIds = new Set((trackableCats || []).map((c) => c.id));
    const totalSold = (salesData || []).filter((s) => trackableIds.has(s.category_id)).reduce((s, d) => s + d.quantity_sold, 0);
    const totalUsed = (stockDaily || []).reduce((s, d) => s + d.packets_used, 0);
    const uniqueStaff = new Set((activeBlocks || []).map((b) => b.user_id));

    const newAlerts: typeof alerts = [];
    (lowStockVenues || []).forEach((v) => {
      if (v.closing_stock !== null && v.closing_stock <= v.min_stock_threshold) {
        newAlerts.push({ type: "low_stock", message: `Low stock: ${v.closing_stock} packets remaining`, venueId: v.venue_id });
      }
    });
    if (totalUsed - totalSold > 0) {
      newAlerts.push({ type: "mismatch", message: `Net mismatch today: ${totalUsed - totalSold} packets unaccounted` });
    }

    setKpis({
      dispatched: totalDispatched, sold: totalSold, mismatches: totalUsed - totalSold,
      inspections: (inspections || []).length, staffOnDuty: uniqueStaff.size, activeClubs: (openSessions || []).length,
    });
    setAlerts(newAlerts);
    setLoading(false);
  };

  const quickActions = [
    { label: "Packet Dispatch", icon: Package, route: "/packet-dispatch", color: "bg-primary/10 text-primary" },
    { label: "Daily Report", icon: BarChart3, route: "/daily-report", color: "bg-success/10 text-success" },
    { label: "New Inspection", icon: ClipboardCheck, route: "/inspections/new", color: "bg-warning/10 text-warning" },
    { label: "Today's Roster", icon: CalendarDays, route: "/roster/daily", color: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Greeting */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          {getGreeting()}, {userName || "Boss"} 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="Dispatched" value={kpis.dispatched} unit="packets" icon={Package} />
          <KPICard label="Shisha Sold" value={kpis.sold} unit="orders" icon={ShoppingCart} />
          <KPICard
            label="Mismatch" value={kpis.mismatches} unit={kpis.mismatches > 0 ? "leakage" : "OK"}
            icon={AlertTriangle} className={kpis.mismatches > 0 ? "text-destructive" : "text-success"}
          />
          <KPICard label="Inspections" value={kpis.inspections} unit="today" icon={ClipboardCheck} />
          <KPICard label="Staff On Duty" value={kpis.staffOnDuty} unit="active" icon={Users} />
          <KPICard label="Active Clubs" value={kpis.activeClubs} unit="open" icon={BarChart3} />
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <Bell className="h-4 w-4" /> Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-3">
            {alerts.slice(0, 5).map((alert, i) => (
              <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-background/50">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                <span className="flex-1">{alert.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's Tasks */}
      {pendingTasks.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-warning">
              <ListChecks className="h-4 w-4" /> Today's Tasks ({pendingTasks.length} pending)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-3">
            {pendingTasks.map(task => {
              const isOverdue = task.status === "overdue";
              const deadlineTime = new Date(task.deadline).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
              return (
                <button
                  key={task.id}
                  onClick={() => navigate("/roster/daily")}
                  className="flex items-center gap-2 text-sm p-2.5 rounded-lg bg-background/50 hover:bg-background w-full text-left"
                >
                  <Clock className={`h-3.5 w-3.5 shrink-0 ${isOverdue ? "text-destructive" : "text-warning"}`} />
                  <span className="flex-1">Confirm Roster — {task.venue_name}</span>
                  <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-[10px]">
                    {isOverdue ? "OVERDUE" : `Due ${deadlineTime}`}
                  </Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-widest">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.route}
              onClick={() => navigate(action.route)}
              className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-all touch-target text-left group"
            >
              <div className={`p-2.5 rounded-lg ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <span className="font-medium text-sm flex-1">{action.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivityFeed />
    </div>
  );
};

const KPICard = ({ label, value, unit, icon: Icon, className }: {
  label: string; value: number; unit: string; icon: any; className?: string;
}) => (
  <Card className="rounded-xl shadow-sm">
    <CardContent className="p-4 text-center">
      <Icon className={`h-5 w-5 mx-auto mb-1.5 ${className || "text-muted-foreground"}`} />
      <div className={`text-2xl font-bold ${className || "text-foreground"}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
      <div className="text-[10px] text-muted-foreground/60">{unit}</div>
    </CardContent>
  </Card>
);

export default DailySummary;
