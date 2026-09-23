import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { useAdminStats } from "@/hooks/useAdminStats";
import { KPIStrip } from "@/components/admin/KPIStrip";
import { ClubGrid } from "@/components/admin/ClubGrid";
import { AlertBar } from "@/components/admin/AlertBar";
import { AnalyticsDashboard } from "./admin/AnalyticsDashboard";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { BarChart3, LayoutDashboard, RefreshCw, TrendingUp } from "lucide-react";

interface AdminDashboardProps {
  user: User;
}

type DashboardMode = "today" | "analytics";

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const { kpis, clubs, loading, refresh } = useAdminStats();
  const [mode, setMode] = useState<DashboardMode>("today");
  const [yesterdaySales, setYesterdaySales] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const fetchYesterdaySales = async () => {
      const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
      const { data } = await supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("report_date", yesterday);
      const total = data?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      setYesterdaySales(total);
    };
    fetchYesterdaySales();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = user.user_metadata?.full_name?.split(" ")[0] ||
                     user.email?.split("@")[0] || "Admin";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center w-9 h-9 rounded-lg border bg-card hover:bg-accent/10 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {/* Mode Toggle */}
          <div className="inline-flex rounded-lg border bg-card p-0.5">
            <button
              onClick={() => setMode("today")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === "today"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Today
            </button>
            <button
              onClick={() => setMode("analytics")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === "analytics"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </button>
          </div>
        </div>
      </div>

      {mode === "today" ? (
        <>
          {/* KPI Strip */}
          <KPIStrip kpis={kpis} loading={loading} />

          {/* Yesterday's Sales + Alert Bar — side by side on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-3">
            {/* Yesterday's Sales Card */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl border bg-card">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-success/15">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight">{yesterdaySales}</div>
                <div className="text-[11px] text-muted-foreground">Yesterday's sales</div>
              </div>
            </div>

            {/* Alert Bar */}
            <AlertBar />
          </div>

          {/* Club Tiles Grid */}
          <ClubGrid clubs={clubs} loading={loading} />
        </>
      ) : (
        <AnalyticsDashboard />
      )}
    </div>
  );
};

export default AdminDashboard;
