import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subWeeks, startOfDay, isSameDay } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ClubSalesTabProps {
  clubId: string;
  clubName: string;
}

interface SalesData {
  date: string;
  total: number;
  categories: Record<string, number>;
}

interface CategorySales {
  name: string;
  today: number;
  yesterday: number;
  lastWeek: number;
}

export const ClubSalesTab = ({ clubId, clubName }: ClubSalesTabProps) => {
  const [todaySales, setTodaySales] = useState(0);
  const [yesterdaySales, setYesterdaySales] = useState(0);
  const [lastWeekSameDaySales, setLastWeekSameDaySales] = useState(0);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; sales: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalesData();
  }, [clubId]);

  const fetchSalesData = async () => {
    setLoading(true);
    const today = new Date();
    const yesterday = subDays(today, 1);
    const lastWeekSameDay = subWeeks(today, 1);
    const weekAgo = subDays(today, 7);

    try {
      // Fetch sales with categories
      const { data: salesData } = await supabase
        .from("sales_reports")
        .select("*, venue_hookah_categories(category_name)")
        .eq("venue_id", clubId)
        .gte("report_date", format(weekAgo, "yyyy-MM-dd"))
        .order("report_date", { ascending: true });

      if (salesData) {
        // Calculate daily totals
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

        // Trend data for chart
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
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (current: number, compare: number) => {
    if (current > compare) return <TrendingUp className="h-4 w-4 text-success" />;
    if (current < compare) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getPercentChange = (current: number, compare: number) => {
    if (compare === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - compare) / compare) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`;
  };

  if (loading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Comparison Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{todaySales}</div>
            <p className="text-xs text-muted-foreground">Today's Sales</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {getTrendIcon(todaySales, yesterdaySales)}
              <span className="text-lg font-semibold">{getPercentChange(todaySales, yesterdaySales)}</span>
            </div>
            <p className="text-xs text-muted-foreground">vs Yesterday ({yesterdaySales})</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {getTrendIcon(todaySales, lastWeekSameDaySales)}
              <span className="text-lg font-semibold">{getPercentChange(todaySales, lastWeekSameDaySales)}</span>
            </div>
            <p className="text-xs text-muted-foreground">vs Last {format(new Date(), "EEEE")} ({lastWeekSameDaySales})</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">7-Day Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), "dd/MM")} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={30} />
                <Tooltip 
                  labelFormatter={(d) => format(new Date(d), "MMM dd, yyyy")}
                  contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {categorySales.length > 0 ? (
            <div className="space-y-3">
              {categorySales.map(cat => (
                <div key={cat.name} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm font-medium">{cat.name}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-success font-semibold">{cat.today}</span>
                    <span className="text-muted-foreground text-xs">Y: {cat.yesterday}</span>
                    <span className="text-muted-foreground text-xs">LW: {cat.lastWeek}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sales data for categories</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
