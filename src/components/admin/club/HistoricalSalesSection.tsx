import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, parseISO, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { exportToXlsx } from "@/lib/exportXlsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface HistoricalSession {
  id: string;
  session_date: string;
}

interface HistoricalSalesSectionProps {
  session: HistoricalSession;
  clubId: string;
  clubName: string;
  onSummaryChange?: (data: { today: number; monthlyAvgDaily: number } | null) => void;
}

interface CategorySales {
  category_name: string;
  quantity: number;
}

export const HistoricalSalesSection = ({ session, clubId, clubName, onSummaryChange }: HistoricalSalesSectionProps) => {
  const [totalSales, setTotalSales] = useState(0);
  const [previousDaySales, setPreviousDaySales] = useState(0);
  const [sameWeekdaySales, setSameWeekdaySales] = useState(0);
  const [monthlyAvgDaily, setMonthlyAvgDaily] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategorySales[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, clubId]);

  useEffect(() => {
    onSummaryChange?.(loading ? null : { today: totalSales, monthlyAvgDaily });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSales, monthlyAvgDaily, loading]);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const sessionDate = parseISO(session.session_date);
      const previousDay = format(subDays(sessionDate, 1), "yyyy-MM-dd");
      const sameWeekday = format(subDays(sessionDate, 7), "yyyy-MM-dd");
      const monthStart = startOfMonth(sessionDate);

      const { data: categories } = await supabase
        .from("venue_hookah_categories")
        .select("id, category_name")
        .eq("venue_id", clubId);

      const { data: todaySales } = await supabase
        .from("sales_reports")
        .select("category_id, quantity_sold")
        .eq("venue_id", clubId)
        .eq("report_date", session.session_date);

      const { data: prevDaySales } = await supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", clubId)
        .eq("report_date", previousDay);

      const { data: weekdaySales } = await supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", clubId)
        .eq("report_date", sameWeekday);

      // Same monthly-context query pattern as the live ClubSalesSection, anchored to
      // the historical session's own month instead of the current calendar month.
      const { data: monthSales } = await supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", clubId)
        .gte("report_date", format(monthStart, "yyyy-MM-dd"))
        .lte("report_date", session.session_date);

      const total = todaySales?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      const prevTotal = prevDaySales?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      const weekdayTotal = weekdaySales?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      const monthTotal = monthSales?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      const daysElapsed = Math.max(1, Math.ceil((sessionDate.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      setTotalSales(total);
      setPreviousDaySales(prevTotal);
      setSameWeekdaySales(weekdayTotal);
      setMonthlyAvgDaily(Math.round(monthTotal / daysElapsed));

      const breakdown = categories?.map(cat => ({
        category_name: cat.category_name,
        quantity: todaySales?.filter(s => s.category_id === cat.id).reduce((sum, s) => sum + s.quantity_sold, 0) || 0,
      })).filter(c => c.quantity > 0) || [];

      setCategoryBreakdown(breakdown);
    } catch (error) {
      console.error("Error fetching historical sales:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    const exportData = categoryBreakdown.map(cat => ({
      Category: cat.category_name,
      "Quantity Sold": cat.quantity,
    }));

    exportData.push({
      Category: "TOTAL",
      "Quantity Sold": totalSales,
    });

    await exportToXlsx(exportData, `${clubName}_Sales_${session.session_date}.xlsx`, "Sales");
  };

  const getComparisonIndicator = (current: number, previous: number) => {
    if (previous === 0) return { icon: Minus, color: "text-muted-foreground", text: "N/A" };
    const diff = ((current - previous) / previous) * 100;
    if (diff > 0) return { icon: TrendingUp, color: "text-success", text: `+${diff.toFixed(0)}%` };
    if (diff < 0) return { icon: TrendingDown, color: "text-destructive", text: `${diff.toFixed(0)}%` };
    return { icon: Minus, color: "text-muted-foreground", text: "0%" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  const prevDayComparison = getComparisonIndicator(totalSales, previousDaySales);
  const weekdayComparison = getComparisonIndicator(totalSales, sameWeekdaySales);
  const monthlyComparison = getComparisonIndicator(totalSales, monthlyAvgDaily);

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadExcel}>
        <Download className="h-4 w-4" />
        Export Sales Report
      </Button>

      {/* Total Sales */}
      <div className="bg-primary/10 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-primary">{totalSales}</div>
        <div className="text-xs text-muted-foreground mt-1">Total Hookahs Sold</div>
      </div>

      {/* Comparisons */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/50 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground mb-1">vs Previous Day</div>
          <div className="flex items-center gap-1.5">
            <prevDayComparison.icon className={`h-3.5 w-3.5 ${prevDayComparison.color}`} />
            <span className={`text-sm font-medium ${prevDayComparison.color}`}>{prevDayComparison.text}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{previousDaySales} sold</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground mb-1">vs Same Weekday</div>
          <div className="flex items-center gap-1.5">
            <weekdayComparison.icon className={`h-3.5 w-3.5 ${weekdayComparison.color}`} />
            <span className={`text-sm font-medium ${weekdayComparison.color}`}>{weekdayComparison.text}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{sameWeekdaySales} sold</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground mb-1">vs Monthly Avg</div>
          <div className="flex items-center gap-1.5">
            <monthlyComparison.icon className={`h-3.5 w-3.5 ${monthlyComparison.color}`} />
            <span className={`text-sm font-medium ${monthlyComparison.color}`}>{monthlyComparison.text}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{monthlyAvgDaily}/day avg</div>
        </div>
      </div>

      {/* Category Breakdown — inline table */}
      {categoryBreakdown.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Category Breakdown</span>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryBreakdown.map((cat) => (
                <TableRow key={cat.category_name}>
                  <TableCell className="text-xs font-medium">{cat.category_name}</TableCell>
                  <TableCell className="text-xs text-right">{cat.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
