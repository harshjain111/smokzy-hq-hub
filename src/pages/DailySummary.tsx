import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  ClipboardCheck,
  ChevronRight,
  CalendarDays,
  BarChart3,
  Users,
  Loader2,
  Bell,
} from "lucide-react";
import ProfileMenu from "@/components/ProfileMenu";
import AdminSettingsMenu from "@/components/AdminSettingsMenu";
import NotificationBell from "@/components/NotificationBell";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import { User } from "@supabase/supabase-js";

interface DailySummaryProps {
  user: User;
}

const formatDate = (d: Date) => d.toISOString().split("T")[0];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const DailySummary = ({ user }: DailySummaryProps) => {
  const navigate = useNavigate();
  const today = formatDate(new Date());
  const [userName, setUserName] = useState("");

  const [kpis, setKpis] = useState({
    dispatched: 0,
    sold: 0,
    mismatches: 0,
    inspections: 0,
    staffOnDuty: 0,
    activeClubs: 0,
  });
  const [alerts, setAlerts] = useState<{ type: string; message: string; venueId?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDailyData();
    fetchUserName();
  }, []);

  const fetchUserName = async () => {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    if (data?.full_name) setUserName(data.full_name.split(" ")[0]);
  };

  const fetchDailyData = async () => {
    setLoading(true);

    const [
      { data: dispatches },
      { data: salesData },
      { data: trackableCats },
      { data: stockDaily },
      { data: inspections },
      { data: activeBlocks },
      { data: openSessions },
      { data: lowStockVenues },
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

    const newAlerts: { type: string; message: string; venueId?: string }[] = [];
    (lowStockVenues || []).forEach((v) => {
      if (v.closing_stock !== null && v.closing_stock <= v.min_stock_threshold) {
        newAlerts.push({ type: "low_stock", message: `Low stock: ${v.closing_stock} packets remaining`, venueId: v.venue_id });
      }
    });
    if (totalUsed - totalSold > 0) {
      newAlerts.push({ type: "mismatch", message: `Net mismatch today: ${totalUsed - totalSold} packets unaccounted` });
    }

    setKpis({
      dispatched: totalDispatched,
      sold: totalSold,
      mismatches: totalUsed - totalSold,
      inspections: (inspections || []).length,
      staffOnDuty: uniqueStaff.size,
      activeClubs: (openSessions || []).length,
    });
    setAlerts(newAlerts);
    setLoading(false);
  };

  const quickActions = [
    { label: "Packet Dispatch", icon: Package, route: "/packet-dispatch", color: "bg-primary/10 text-primary" },
    { label: "Daily Report", icon: BarChart3, route: "/daily-report", color: "bg-success/10 text-success" },
    { label: "New Inspection", icon: ClipboardCheck, route: "/inspections/new", color: "bg-warning/10 text-warning" },
    { label: "Weekly Roster", icon: CalendarDays, route: "/roster/weekly", color: "bg-accent/10 text-accent-foreground" },
    { label: "Daily Roster", icon: Users, route: "/roster/daily", color: "bg-secondary text-secondary-foreground" },
    { label: "Weekly Summary", icon: BarChart3, route: "/weekly-summary", color: "bg-destructive/10 text-destructive" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-primary">
              {getGreeting()}, {userName || "Boss"} 👋
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <NotificationBell />
            <AdminSettingsMenu />
            <ProfileMenu user={user} role="club_incharge" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="Dispatched" value={kpis.dispatched} unit="packets" icon={Package} />
          <KPICard label="Shisha Sold" value={kpis.sold} unit="orders" icon={ShoppingCart} />
          <KPICard
            label="Mismatch"
            value={kpis.mismatches}
            unit={kpis.mismatches > 0 ? "leakage" : "OK"}
            icon={AlertTriangle}
            className={kpis.mismatches > 0 ? "text-destructive" : "text-success"}
          />
          <KPICard label="Inspections" value={kpis.inspections} unit="today" icon={ClipboardCheck} />
          <KPICard label="Staff On Duty" value={kpis.staffOnDuty} unit="active" icon={Users} />
          <KPICard label="Active Clubs" value={kpis.activeClubs} unit="open" icon={BarChart3} />
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                <Bell className="h-4 w-4" />
                Alerts ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.slice(0, 5).map((alert, i) => (
                <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-background/50">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <span className="flex-1">{alert.message}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.route}
                onClick={() => navigate(action.route)}
                className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-all touch-manipulation text-left group"
              >
                <div className={`p-2.5 rounded-lg ${action.color}`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{action.label}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <RecentActivityFeed />
      </main>
    </div>
  );
};

const KPICard = ({
  label,
  value,
  unit,
  icon: Icon,
  className,
}: {
  label: string;
  value: number;
  unit: string;
  icon: any;
  className?: string;
}) => (
  <Card>
    <CardContent className="p-3 text-center">
      <Icon className={`h-5 w-5 mx-auto mb-1 ${className || "text-muted-foreground"}`} />
      <div className={`text-2xl font-bold ${className || "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-[9px] text-muted-foreground/70">{unit}</div>
    </CardContent>
  </Card>
);

export default DailySummary;
