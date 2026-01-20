import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subWeeks } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Download, Info, ChevronDown, ChevronUp, Image, FileX, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { ClubSession } from "@/pages/ClubDetail";
import KotViewModal from "./KotViewModal";

interface ClubSalesSectionProps {
  clubId: string;
  clubName: string;
  session: ClubSession | null;
}

interface CategorySales {
  name: string;
  today: number;
  yesterday: number;
  lastWeek: number;
}

interface KotStatus {
  photoCount: number;
  hasDeclaration: boolean;
}

export const ClubSalesSection = ({ clubId, clubName, session }: ClubSalesSectionProps) => {
  const [todaySales, setTodaySales] = useState(0);
  const [yesterdaySales, setYesterdaySales] = useState(0);
  const [lastWeekSameDaySales, setLastWeekSameDaySales] = useState(0);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; sales: number }[]>([]);
  const [showTrend, setShowTrend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kotStatus, setKotStatus] = useState<KotStatus | null>(null);
  const [showKotModal, setShowKotModal] = useState(false);

  useEffect(() => {
    if (session) {
      fetchSalesData();
    }
  }, [clubId, session]);

  const fetchSalesData = async () => {
    setLoading(true);
    await Promise.all([fetchSales(), fetchKotStatus()]);
    setLoading(false);
  };

  const fetchKotStatus = async () => {
    if (!session?.id) return;
    
    const { data } = await supabase
      .from("kot_entries")
      .select("entry_type")
      .eq("session_id", session.id);

    if (data) {
      setKotStatus({
        photoCount: data.filter(e => e.entry_type === 'photo').length,
        hasDeclaration: data.some(e => e.entry_type === 'no_kot_declared'),
      });
    }
  };

  const fetchSales = async () => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    const lastWeekSameDay = subWeeks(today, 1);
    const weekAgo = subDays(today, 7);

    try {
      const { data: salesData } = await supabase
        .from("sales_reports")
        .select("*, venue_hookah_categories(category_name)")
        .eq("venue_id", clubId)
        .gte("report_date", format(weekAgo, "yyyy-MM-dd"))
        .order("report_date", { ascending: true });

      if (salesData) {
        const todayStr = format(today, "yyyy-MM-dd");
        const yesterdayStr = format(yesterday, "yyyy-MM-dd");
        const lastWeekStr = format(lastWeekSameDay, "yyyy-MM-dd");

        const todayTotal = salesData.filter(s => s.report_date === todayStr).reduce((sum, s) => sum + s.quantity_sold, 0);
        const yesterdayTotal = salesData.filter(s => s.report_date === yesterdayStr).reduce((sum, s) => sum + s.quantity_sold, 0);
        const lastWeekTotal = salesData.filter(s => s.report_date === lastWeekStr).reduce((sum, s) => sum + s.quantity_sold, 0);

        setTodaySales(todayTotal);
        setYesterdaySales(yesterdayTotal);
        setLastWeekSameDaySales(lastWeekTotal);

        // Category breakdown
        const categoryMap = new Map<string, CategorySales>();
        salesData.forEach((sale: any) => {
          const catName = sale.venue_hookah_categories?.category_name || "Unknown";
          const existing = categoryMap.get(catName) || { name: catName, today: 0, yesterday: 0, lastWeek: 0 };
          
          if (sale.report_date === todayStr) existing.today += sale.quantity_sold;
          if (sale.report_date === yesterdayStr) existing.yesterday += sale.quantity_sold;
          if (sale.report_date === lastWeekStr) existing.lastWeek += sale.quantity_sold;
          
          categoryMap.set(catName, existing);
        });
        setCategorySales(Array.from(categoryMap.values()));

        // Trend data
        const dailyTotals = new Map<string, number>();
        salesData.forEach(sale => {
          const current = dailyTotals.get(sale.report_date) || 0;
          dailyTotals.set(sale.report_date, current + sale.quantity_sold);
        });
        setTrendData(
          Array.from(dailyTotals.entries())
            .map(([date, sales]) => ({ date, sales }))
            .sort((a, b) => a.date.localeCompare(b.date))
        );
      }
    } catch (error) {
      console.error("Error fetching sales:", error);
    }
  };

  const exportSales = () => {
    const headers = ["Category", "Today", "Yesterday", "Last Week Same Day"];
    const rows = categorySales.map(cat => [cat.name, cat.today, cat.yesterday, cat.lastWeek]);
    rows.push(["Total", todaySales, yesterdaySales, lastWeekSameDaySales]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clubName}-sales-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Sales report exported");
  };

  const getTrendIcon = (current: number, compare: number) => {
    if (current > compare) return <TrendingUp className="h-3 w-3 text-success" />;
    if (current < compare) return <TrendingDown className="h-3 w-3 text-destructive" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getPercentChange = (current: number, compare: number) => {
    if (compare === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - compare) / compare) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`;
  };

  // No session state
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Info className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No Active Session</p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">
          Sales data will appear once the session is active.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Today's Total - Primary Metric */}
      <div className="text-center py-4 rounded-lg bg-primary/5 border border-primary/10">
        <div className="text-3xl font-bold text-primary">{todaySales}</div>
        <p className="text-xs text-muted-foreground mt-1">Today's Total Sales</p>
      </div>

      {/* Comparison Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="flex items-center justify-center gap-1.5">
            {getTrendIcon(todaySales, yesterdaySales)}
            <span className="text-sm font-semibold">{getPercentChange(todaySales, yesterdaySales)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">vs Yesterday ({yesterdaySales})</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="flex items-center justify-center gap-1.5">
            {getTrendIcon(todaySales, lastWeekSameDaySales)}
            <span className="text-sm font-semibold">{getPercentChange(todaySales, lastWeekSameDaySales)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">vs Last {format(new Date(), "EEE")} ({lastWeekSameDaySales})</p>
        </div>
      </div>

      {/* Category Breakdown */}
      {categorySales.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">By Category</span>
          <div className="space-y-1.5">
            {categorySales.map(cat => (
              <div key={cat.name} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
                <span className="font-medium">{cat.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-primary">{cat.today}</span>
                  <span className="text-muted-foreground text-[10px]">Y:{cat.yesterday}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KOT Status */}
      {session && kotStatus && (
        <div className="space-y-2">
          <span className="text-sm font-medium">KOT Proof</span>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              {kotStatus.photoCount > 0 ? (
                <>
                  <Image className="h-4 w-4 text-success" />
                  <span className="text-sm">
                    Available ({kotStatus.photoCount} image{kotStatus.photoCount > 1 ? 's' : ''})
                  </span>
                </>
              ) : kotStatus.hasDeclaration ? (
                <>
                  <FileX className="h-4 w-4 text-warning" />
                  <span className="text-sm text-warning">Not Available (Declared)</span>
                </>
              ) : (
                <>
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">No KOT uploaded</span>
                </>
              )}
            </div>
            {(kotStatus.photoCount > 0 || kotStatus.hasDeclaration) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKotModal(true)}
                className="h-8 text-xs"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                View
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 7-Day Trend (Collapsible) */}
      <div className="space-y-2">
        <button 
          onClick={() => setShowTrend(!showTrend)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {showTrend ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          7-Day Trend
        </button>
        
        {showTrend && trendData.length > 0 && (
          <div className="h-[140px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => format(new Date(d), "dd")} 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip 
                  labelFormatter={(d) => format(new Date(d), "MMM dd")}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Export Button */}
      <Button variant="outline" size="sm" onClick={exportSales} className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Download Sales Report
      </Button>

      {/* KOT View Modal */}
      {session && (
        <KotViewModal
          open={showKotModal}
          onOpenChange={setShowKotModal}
          sessionId={session.id}
          sessionDate={session.session_date}
        />
      )}
    </div>
  );
};
