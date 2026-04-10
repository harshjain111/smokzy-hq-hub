import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { useAdminStats } from "@/hooks/useAdminStats";
import { KPIStrip } from "@/components/admin/KPIStrip";
import { ClubGrid } from "@/components/admin/ClubGrid";
import { AlertBar } from "@/components/admin/AlertBar";
import { AnalyticsDashboard } from "./admin/AnalyticsDashboard";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { DollarSign } from "lucide-react";

interface AdminDashboardProps {
  user: User;
}

type DashboardMode = "today" | "analytics";

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const { kpis, clubs, loading } = useAdminStats();
  const [mode, setMode] = useState<DashboardMode>("today");
  const [yesterdaySales, setYesterdaySales] = useState<number>(0);

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

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Mode Toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setMode("today")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              mode === "today"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            TODAY
          </button>
          <button
            onClick={() => setMode("analytics")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              mode === "analytics"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ANALYTICS
          </button>
        </div>
      </div>

      {mode === "today" ? (
        <>
          {/* KPI Strip — hero */}
          <KPIStrip kpis={kpis} loading={loading} />

          {/* Yesterday's Sales */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-success/20">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <div className="text-lg font-bold">{yesterdaySales}</div>
              <div className="text-xs text-muted-foreground">Yesterday's Total Sales (All Clubs)</div>
            </div>
          </div>

          {/* Alert Bar */}
          <AlertBar />

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
