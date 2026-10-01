import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToXlsx } from "@/lib/exportXlsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface HistoricalSession {
  id: string;
  session_date: string;
}

interface HistoricalStockSectionProps {
  session: HistoricalSession;
  clubId: string;
  clubName: string;
  onSummaryChange?: (data: { itemCount: number; mismatchCount: number } | null) => void;
}

interface StockItem {
  item_name: string;
  quantity: number;
}

export const HistoricalStockSection = ({ session, clubId, clubName, onSummaryChange }: HistoricalStockSectionProps) => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [prevDayTotal, setPrevDayTotal] = useState<number | null>(null);
  const [todayTotal, setTodayTotal] = useState<number | null>(null);
  const [receivedToday, setReceivedToday] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [gramsPerChillum, setGramsPerChillum] = useState(25);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStockData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, clubId]);

  useEffect(() => {
    onSummaryChange?.(loading ? null : { itemCount: stockItems.length, mismatchCount: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockItems, loading]);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const prevDate = new Date(session.session_date + "T00:00:00");
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split("T")[0];

      const [salesRes, todaySnapshotRes, prevSnapshotRes, stockRes, settingsRes] = await Promise.all([
        supabase
          .from("sales_reports")
          .select("quantity_sold")
          .eq("venue_id", clubId)
          .eq("report_date", session.session_date),
        supabase
          .from("venue_stock_daily")
          .select("closing_stock, packets_received")
          .eq("venue_id", clubId)
          .eq("date", session.session_date)
          .maybeSingle(),
        supabase
          .from("venue_stock_daily")
          .select("closing_stock")
          .eq("venue_id", clubId)
          .eq("date", prevDateStr)
          .maybeSingle(),
        supabase
          .from("stock")
          .select("item_name, quantity")
          .eq("venue_id", clubId)
          .eq("category", "flavour")
          .order("item_name"),
        supabase
          .from("global_settings")
          .select("value")
          .eq("key", "grams_per_chillum")
          .maybeSingle(),
      ]);

      const sales = salesRes.data?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      setTotalSales(sales);
      setTodayTotal(todaySnapshotRes.data?.closing_stock ?? null);
      setPrevDayTotal(prevSnapshotRes.data?.closing_stock ?? null);
      setReceivedToday(todaySnapshotRes.data?.packets_received || 0);
      setStockItems(stockRes.data || []);
      if (settingsRes.data?.value) setGramsPerChillum(Number(settingsRes.data.value) || 25);
    } catch (error) {
      console.error("Error fetching historical stock:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasData = prevDayTotal !== null && todayTotal !== null;
  const rawConsumption = hasData ? (prevDayTotal + receivedToday - todayTotal) : null;
  const actualConsumption = rawConsumption !== null ? Math.max(0, rawConsumption) : null;
  const stockAdded = rawConsumption !== null && rawConsumption < 0 ? Math.abs(rawConsumption) : 0;
  const predictedConsumption = totalSales * gramsPerChillum;

  const downloadExcel = async () => {
    const rows = stockItems.map(item => ({
      Item: item.item_name,
      "Quantity (g)": item.quantity,
    }));
    await exportToXlsx(rows, `${clubName}_Stock_${session.session_date}.xlsx`, "Stock");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadExcel}>
        <Download className="h-4 w-4" />
        Export Stock Report
      </Button>

      {/* Simple consumption summary */}
      {hasData ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <div className="text-lg font-bold">{prevDayTotal}g</div>
              <p className="text-[10px] text-muted-foreground">Previous Day Stock</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <div className="text-lg font-bold">{todayTotal}g</div>
              <p className="text-[10px] text-muted-foreground">Today's Stock</p>
            </div>
          </div>

          {stockAdded > 0 && (
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-center">
              <span className="text-xs text-blue-600 dark:text-blue-400">+{stockAdded}g stock added today</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <div className="text-lg font-bold">
                {actualConsumption}g
              </div>
              <p className="text-[10px] text-muted-foreground">Actual Consumption</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <div className="text-lg font-bold">{predictedConsumption}g</div>
              <p className="text-[10px] text-muted-foreground">
                Predicted ({totalSales} × {gramsPerChillum}g)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground text-center">
          No daily stock snapshot recorded for this date.
        </div>
      )}

      {/* Per-item stock table */}
      <div className="border rounded-lg max-h-[280px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs sticky left-0 top-0 bg-background z-10">Item</TableHead>
              <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Current Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockItems.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell className="text-xs font-medium sticky left-0 bg-background">{item.item_name}</TableCell>
                <TableCell className="text-xs text-center text-muted-foreground">{item.quantity}g</TableCell>
              </TableRow>
            ))}
            {stockItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground py-6 text-xs">
                  No flavour stock recorded
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
