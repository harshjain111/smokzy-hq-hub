import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subWeeks, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { 
  TrendingUp, TrendingDown, Minus, Download, Info, ChevronDown, ChevronUp, 
  Image, FileX, Eye, Target, Award, AlertTriangle, BarChart3 
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { ClubSession } from "@/pages/ClubDetail";
import KotViewModal from "./KotViewModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  monthTotal: number;
  contribution: number; // percentage of total
}

interface SalesInsight {
  type: 'positive' | 'negative' | 'neutral';
  message: string;
}

interface KotStatus {
  photoCount: number;
  hasDeclaration: boolean;
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

export const ClubSalesSection = ({ clubId, clubName, session }: ClubSalesSectionProps) => {
  const [todaySales, setTodaySales] = useState(0);
  const [yesterdaySales, setYesterdaySales] = useState(0);
  const [lastWeekSameDaySales, setLastWeekSameDaySales] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyAvgDaily, setMonthlyAvgDaily] = useState(0);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; sales: number }[]>([]);
  const [insights, setInsights] = useState<SalesInsight[]>([]);
  const [showTrend, setShowTrend] = useState(false);
  const [showCategoryDetail, setShowCategoryDetail] = useState(false);
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
    const monthStart = startOfMonth(today);

    try {
      // Fetch this month's sales
      const { data: monthSalesData } = await supabase
        .from("sales_reports")
        .select("*, venue_hookah_categories(category_name)")
        .eq("venue_id", clubId)
        .gte("report_date", format(monthStart, "yyyy-MM-dd"))
        .order("report_date", { ascending: true });

      // Fetch last 7 days for trend
      const { data: salesData } = await supabase
        .from("sales_reports")
        .select("*, venue_hookah_categories(category_name)")
        .eq("venue_id", clubId)
        .gte("report_date", format(weekAgo, "yyyy-MM-dd"))
        .order("report_date", { ascending: true });

      if (monthSalesData && salesData) {
        const todayStr = format(today, "yyyy-MM-dd");
        const yesterdayStr = format(yesterday, "yyyy-MM-dd");
        const lastWeekStr = format(lastWeekSameDay, "yyyy-MM-dd");

        // Calculate totals
        const todayTotal = salesData.filter(s => s.report_date === todayStr).reduce((sum, s) => sum + s.quantity_sold, 0);
        const yesterdayTotal = salesData.filter(s => s.report_date === yesterdayStr).reduce((sum, s) => sum + s.quantity_sold, 0);
        const lastWeekTotal = salesData.filter(s => s.report_date === lastWeekStr).reduce((sum, s) => sum + s.quantity_sold, 0);
        const monthTotal = monthSalesData.reduce((sum, s) => sum + s.quantity_sold, 0);

        // Calculate days elapsed in month for average
        const daysInMonth = Math.max(1, Math.ceil((today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)));
        const avgDaily = Math.round(monthTotal / daysInMonth);

        setTodaySales(todayTotal);
        setYesterdaySales(yesterdayTotal);
        setLastWeekSameDaySales(lastWeekTotal);
        setMonthlyTotal(monthTotal);
        setMonthlyAvgDaily(avgDaily);

        // Category breakdown with contribution
        const categoryMap = new Map<string, CategorySales>();
        monthSalesData.forEach((sale: any) => {
          const catName = sale.venue_hookah_categories?.category_name || "Unknown";
          const existing = categoryMap.get(catName) || { 
            name: catName, today: 0, yesterday: 0, lastWeek: 0, monthTotal: 0, contribution: 0 
          };
          
          if (sale.report_date === todayStr) existing.today += sale.quantity_sold;
          if (sale.report_date === yesterdayStr) existing.yesterday += sale.quantity_sold;
          if (sale.report_date === lastWeekStr) existing.lastWeek += sale.quantity_sold;
          existing.monthTotal += sale.quantity_sold;
          
          categoryMap.set(catName, existing);
        });

        // Calculate contribution percentages
        const categories = Array.from(categoryMap.values());
        categories.forEach(cat => {
          cat.contribution = monthTotal > 0 ? Math.round((cat.monthTotal / monthTotal) * 100) : 0;
        });
        // Sort by contribution
        categories.sort((a, b) => b.contribution - a.contribution);
        setCategorySales(categories);

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

        // Generate insights
        generateInsights(todayTotal, yesterdayTotal, lastWeekTotal, avgDaily, categories);
      }
    } catch (error) {
      console.error("Error fetching sales:", error);
    }
  };

  const generateInsights = (
    today: number, 
    yesterday: number, 
    lastWeek: number, 
    avgDaily: number,
    categories: CategorySales[]
  ) => {
    const newInsights: SalesInsight[] = [];

    // Performance vs yesterday
    const vsYesterday = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : 0;
    if (vsYesterday > 20) {
      newInsights.push({ type: 'positive', message: `${Math.round(vsYesterday)}% above yesterday's sales` });
    } else if (vsYesterday < -20) {
      newInsights.push({ type: 'negative', message: `${Math.abs(Math.round(vsYesterday))}% below yesterday's sales` });
    }

    // Performance vs same day last week
    const vsLastWeek = lastWeek > 0 ? ((today - lastWeek) / lastWeek) * 100 : 0;
    if (vsLastWeek > 15) {
      newInsights.push({ type: 'positive', message: `Outperforming last ${format(new Date(), "EEEE")} by ${Math.round(vsLastWeek)}%` });
    } else if (vsLastWeek < -15) {
      newInsights.push({ type: 'negative', message: `Underperforming vs last ${format(new Date(), "EEEE")} by ${Math.abs(Math.round(vsLastWeek))}%` });
    }

    // vs monthly average
    if (today > avgDaily * 1.2) {
      newInsights.push({ type: 'positive', message: `Above monthly daily average (${avgDaily})` });
    } else if (today < avgDaily * 0.8) {
      newInsights.push({ type: 'negative', message: `Below monthly daily average (${avgDaily})` });
    }

    // Top category insight
    if (categories.length > 0) {
      const topCat = categories[0];
      newInsights.push({ type: 'neutral', message: `${topCat.name} drives ${topCat.contribution}% of sales` });
    }

    setInsights(newInsights);
  };

  const exportSales = () => {
    const headers = ["Category", "Today", "Yesterday", "Last Week Same Day", "Month Total", "Contribution %"];
    const rows = categorySales.map(cat => [cat.name, cat.today, cat.yesterday, cat.lastWeek, cat.monthTotal, `${cat.contribution}%`]);
    rows.push(["Total", todaySales, yesterdaySales, lastWeekSameDaySales, monthlyTotal, "100%"]);
    
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
        <div className="text-4xl font-bold text-primary">{todaySales}</div>
        <p className="text-xs text-muted-foreground mt-1">Today's Total Sales</p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-1">
            {getTrendIcon(todaySales, yesterdaySales)}
            <span className="text-xs">{getPercentChange(todaySales, yesterdaySales)} vs yesterday</span>
          </div>
        </div>
      </div>

      {/* Smart Insights */}
      {insights.length > 0 && (
        <div className="space-y-1.5">
          {insights.map((insight, i) => (
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
               <Target className="h-3.5 w-3.5" />}
              <span>{insight.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Comparison Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-lg bg-muted/30 text-center">
          <div className="text-lg font-bold">{yesterdaySales}</div>
          <p className="text-[9px] text-muted-foreground">Yesterday</p>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/30 text-center">
          <div className="text-lg font-bold">{lastWeekSameDaySales}</div>
          <p className="text-[9px] text-muted-foreground">Last {format(new Date(), "EEE")}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/30 text-center">
          <div className="text-lg font-bold">{monthlyAvgDaily}</div>
          <p className="text-[9px] text-muted-foreground">Avg/Day</p>
        </div>
      </div>

      {/* Monthly Performance */}
      <div className="p-3 rounded-lg border bg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{format(new Date(), "MMMM")} Total</span>
          <span className="text-lg font-bold text-primary">{monthlyTotal}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.min(100, (todaySales / Math.max(1, monthlyAvgDaily)) * 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Today: {Math.round((todaySales / Math.max(1, monthlyAvgDaily)) * 100)}% of daily average
        </p>
      </div>

      {/* Category Breakdown - Tap for details */}
      {categorySales.length > 0 && (
        <Dialog open={showCategoryDetail} onOpenChange={setShowCategoryDetail}>
          <DialogTrigger asChild>
            <button className="w-full text-left">
              <div className="space-y-2 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Category Breakdown</span>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  {categorySales.slice(0, 3).map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-xs flex-1 truncate">{cat.name}</span>
                      <span className="text-xs font-medium">{cat.today}</span>
                      <span className="text-[10px] text-muted-foreground">({cat.contribution}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Category Performance</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Pie Chart */}
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySales}
                      dataKey="monthTotal"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, contribution }) => `${name} (${contribution}%)`}
                      labelLine={false}
                    >
                      {categorySales.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Detailed Table */}
              <div className="space-y-2">
                {categorySales.map((cat, i) => (
                  <div key={cat.name} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="font-medium text-sm">{cat.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{cat.contribution}%</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Today</span>
                        <span className="font-medium">{cat.today}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Yesterday</span>
                        <span className="font-medium">{cat.yesterday}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Last Week</span>
                        <span className="font-medium">{cat.lastWeek}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Month</span>
                        <span className="font-medium">{cat.monthTotal}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* KOT Status */}
      {session && kotStatus && (
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            {kotStatus.photoCount > 0 ? (
              <>
                <Image className="h-4 w-4 text-success" />
                <span className="text-sm">KOT ({kotStatus.photoCount} images)</span>
              </>
            ) : kotStatus.hasDeclaration ? (
              <>
                <FileX className="h-4 w-4 text-warning" />
                <span className="text-sm text-warning">No KOT (Declared)</span>
              </>
            ) : (
              <>
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">No KOT uploaded</span>
              </>
            )}
          </div>
          {(kotStatus.photoCount > 0 || kotStatus.hasDeclaration) && (
            <Button variant="ghost" size="sm" onClick={() => setShowKotModal(true)} className="h-8 text-xs">
              <Eye className="h-3.5 w-3.5 mr-1" />
              View
            </Button>
          )}
        </div>
      )}

      {/* 7-Day Trend (Collapsible) */}
      <div className="space-y-2">
        <button 
          onClick={() => setShowTrend(!showTrend)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {showTrend ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          7-Day Trend
        </button>
        
        {showTrend && trendData.length > 0 && (
          <div className="h-[140px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => format(new Date(d), "dd")} 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip 
                  labelFormatter={(d) => format(new Date(d), "MMM dd, EEE")}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Export Button */}
      <Button variant="outline" size="sm" onClick={exportSales} className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Export Sales Report
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
