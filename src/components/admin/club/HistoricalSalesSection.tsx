import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import * as XLSX from "xlsx";

interface HistoricalSession {
  id: string;
  session_date: string;
}

interface HistoricalSalesSectionProps {
  session: HistoricalSession;
  clubId: string;
  clubName: string;
}

interface CategorySales {
  category_name: string;
  quantity: number;
}

export const HistoricalSalesSection = ({ session, clubId, clubName }: HistoricalSalesSectionProps) => {
  const [totalSales, setTotalSales] = useState(0);
  const [previousDaySales, setPreviousDaySales] = useState(0);
  const [sameWeekdaySales, setSameWeekdaySales] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategorySales[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalesData();
  }, [session.id, clubId]);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const sessionDate = parseISO(session.session_date);
      const previousDay = format(subDays(sessionDate, 1), "yyyy-MM-dd");
      const sameWeekday = format(subDays(sessionDate, 7), "yyyy-MM-dd");

      // Fetch categories
      const { data: categories } = await supabase
        .from("venue_hookah_categories")
        .select("id, category_name")
        .eq("venue_id", clubId);

      // Fetch sales for session date
      const { data: todaySales } = await supabase
        .from("sales_reports")
        .select("category_id, quantity_sold")
        .eq("venue_id", clubId)
        .eq("report_date", session.session_date);

      // Fetch previous day sales
      const { data: prevDaySales } = await supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", clubId)
        .eq("report_date", previousDay);

      // Fetch same weekday sales
      const { data: weekdaySales } = await supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", clubId)
        .eq("report_date", sameWeekday);

      // Calculate totals
      const total = todaySales?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      const prevTotal = prevDaySales?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      const weekdayTotal = weekdaySales?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;

      setTotalSales(total);
      setPreviousDaySales(prevTotal);
      setSameWeekdaySales(weekdayTotal);

      // Build category breakdown
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

  const downloadExcel = () => {
    const exportData = categoryBreakdown.map(cat => ({
      Category: cat.category_name,
      "Quantity Sold": cat.quantity,
    }));

    exportData.push({
      Category: "TOTAL",
      "Quantity Sold": totalSales,
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, `${clubName}_Sales_${session.session_date}.xlsx`);
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

  return (
    <div className="space-y-4">
      {/* Total Sales */}
      <div className="bg-primary/10 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-primary">{totalSales}</div>
        <div className="text-xs text-muted-foreground mt-1">Total Hookahs Sold</div>
      </div>

      {/* Comparisons */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">vs Previous Day</div>
          <div className="flex items-center gap-2">
            <prevDayComparison.icon className={`h-4 w-4 ${prevDayComparison.color}`} />
            <span className={`font-medium ${prevDayComparison.color}`}>{prevDayComparison.text}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{previousDaySales} sold</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">vs Same Weekday</div>
          <div className="flex items-center gap-2">
            <weekdayComparison.icon className={`h-4 w-4 ${weekdayComparison.color}`} />
            <span className={`font-medium ${weekdayComparison.color}`}>{weekdayComparison.text}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{sameWeekdaySales} sold</div>
        </div>
      </div>

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-sm font-medium mb-2">Category Breakdown</div>
          <div className="space-y-2">
            {categoryBreakdown.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span>{cat.category_name}</span>
                <span className="font-medium">{cat.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download Button */}
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadExcel}>
        <Download className="h-4 w-4" />
        Download Sales Report (Excel)
      </Button>
    </div>
  );
};
