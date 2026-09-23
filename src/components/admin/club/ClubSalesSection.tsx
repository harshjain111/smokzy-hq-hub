import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subWeeks, startOfMonth } from "date-fns";
import {
  TrendingUp, TrendingDown, Minus, Download, Info,
  Image, FileX, Eye, Target, Award, AlertTriangle
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { ClubSession } from "@/pages/ClubDetail";
import KotViewModal from "./KotViewModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ClubSalesSectionProps {
  clubId: string;
  clubName: string;
  session: ClubSession | null;
  onSummaryChange?: (data: { today: number; yesterday: number } | null) => void;
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

export const ClubSalesSection = ({ clubId, clubName, session, onSummaryChange }: ClubSalesSectionProps) => {
  const [todaySales, setTodaySales] = useState(0);
  const [yesterdaySales, setYesterdaySales] = useState(0);
  const [lastWeekSameDaySales, setLastWeekSameDaySales] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyAvgDaily, setMonthlyAvgDaily] = useState(0);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; sales: number }[]>([]);
  const [insights, setInsights] = useState<SalesInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [kotStatus, setKotStatus] = useState<KotStatus | null>(null);
  const [showKotModal, setShowKotModal] = useState(false);

  useEffect(() => {
    if (session) {
      fetchSalesData();
    }
  }, [clubId, session]);

  useEffect(() => {
    onSummaryChange?.(session ? { today: todaySales, yesterday: yesterdaySales } : null);
  }, [todaySales, yesterdaySales, session, onSummaryChange]);

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
      const { data: monthSalesData } = await supabase
        .from("sales_reports")
        .select("*, venue_hookah_categories(category_name)")
        .eq("venue_id", clubId)
        .gte("report_date", format(monthStart, "yyyy-MM-dd"))
        .order("report_date", { ascending: true });

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

        const todayTotal = salesData.filter(s => s.report_date === todayStr).reduce((sum, s) => sum + s.quantity_sold, 0);
        const yesterdayTotal = salesData.filter(s => s.report_date === yesterdayStr).reduce((sum, s) => sum + s.quantity_sold, 0);
        const lastWeekTotal = salesData.filter(s => s.report_date === lastWeekStr).reduce((sum, s) => sum + s.quantity_sold, 0);
        const monthTotal = monthSalesData.reduce((sum, s) => sum + s.quantity_sold, 0);

        const daysInMonth = Math.max(1, Math.ceil((today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)));
        const avgDaily = Math.round(monthTotal / daysInMonth);

        setTodaySales(todayTotal);
        setYesterdaySales(yesterdayTotal);
        setLastWeekSameDaySales(lastWeekTotal);
        setMonthlyTotal(monthTotal);
        setMonthlyAvgDaily(avgDaily);

        const categoryMap = new Map<string, CategorySales>();
        monthSalesData.forEach((sale: {
          report_date: string;
          quantity_sold: number;
          venue_hookah_categories: { category_name: string } | null;
        }) => {
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

        const categories = Array.from(categoryMap.values());
        categories.forEach(cat => {
          cat.contribution = monthTotal > 0 ? Math.round((cat.monthTotal / monthTotal) * 100) : 0;
        });
        categories.sort((a, b) => b.contribution - a.contribution);
        setCategorySales(categories);

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

    const vsYesterday = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : 0;
    if (vsYesterday > 20) {
      newInsights.push({ type: 'positive', message: `${Math.round(vsYesterday)}% above yesterday's sales` });
    } else if (vsYesterday < -20) {
      newInsights.push({ type: 'negative', message: `${Math.abs(Math.round(vsYesterday))}% below yesterday's sales` });
    }

    const vsLastWeek = lastWeek > 0 ? ((today - lastWeek) / lastWeek) * 100 : 0;
    if (vsLastWeek > 15) {
      newInsights.push({ type: 'positive', message: `Outperforming last ${format(new Date(), "EEEE")} by ${Math.round(vsLastWeek)}%` });
    } else if (vsLastWeek < -15) {
      newInsights.push({ type: 'negative', message: `Underperforming vs last ${format(new Date(), "EEEE")} by ${Math.abs(Math.round(vsLastWeek))}%` });
    }

    if (today > avgDaily * 1.2) {
      newInsights.push({ type: 'positive', message: `Above monthly daily average (${avgDaily})` });
    } else if (today < avgDaily * 0.8) {
      newInsights.push({ type: 'negative', message: `Below monthly daily average (${avgDaily})` });
    }

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

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
          <Info className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No Active Session</p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-[220px]">
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

      <Button variant="outline" size="sm" onClick={exportSales} className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Export Sales Report
      </Button>

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

      {/* 7-Day Trend — always visible, it answers "how is the shift pacing" */}
      {trendData.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">7-Day Trend</span>
          <div className="h-[140px]">
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
        </div>
      )}

      {/* Category Performance — inline table + small secondary donut, no dialog */}
      {categorySales.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Category Performance</span>
          <div className="grid md:grid-cols-[140px_1fr] gap-3 items-center">
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySales.map(c => ({ name: c.name, value: c.monthTotal }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={50}
                  >
                    {categorySales.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto -mx-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs text-right">Today</TableHead>
                    <TableHead className="text-xs text-right">Yesterday</TableHead>
                    <TableHead className="text-xs text-right">Last Week</TableHead>
                    <TableHead className="text-xs text-right">Contribution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categorySales.map((cat, i) => (
                    <TableRow key={cat.name}>
                      <TableCell className="text-xs font-medium">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          {cat.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">{cat.today}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">{cat.yesterday}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">{cat.lastWeek}</TableCell>
                      <TableCell className="text-xs text-right">{cat.contribution}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
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

      {/* KOT View Modal — legitimate full-size media viewer */}
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
