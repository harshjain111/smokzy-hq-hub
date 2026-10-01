import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [dailySnapshot, setDailySnapshot] = useState<{
    opening_stock: number | null;
    closing_stock: number | null;
    packets_received: number;
    packets_used: number;
  } | null>(null);
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
      const [salesRes, snapshotRes, stockRes, settingsRes] = await Promise.all([
        supabase
          .from("sales_reports")
          .select("quantity_sold")
          .eq("venue_id", clubId)
          .eq("report_date", session.session_date),
        supabase
          .from("venue_stock_daily")
          .select("opening_stock, closing_stock, packets_received, packets_used")
          .eq("venue_id", clubId)
          .eq("date", session.session_date)
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
      setDailySnapshot(snapshotRes.data || null);
      setStockItems(stockRes.data || []);
      if (settingsRes.data?.value) setGramsPerChillum(Number(settingsRes.data.value) || 25);
    } catch (error) {
      console.error("Error fetching historical stock:", error);
    } finally {
      setLoading(false);
    }
  };

  const predictedConsumption = Math.round(totalSales * gramsPerChillum);
  const actualConsumption = dailySnapshot?.packets_used || 0;
  const variance = actualConsumption - predictedConsumption;

  const downloadExcel = async () => {
    const rows = stockItems.map(item => ({
      Item: item.item_name,
      "Current Quantity (g)": item.quantity,
    }));

    if (dailySnapshot) {
      rows.push({
        Item: "--- Daily Summary ---",
        "Current Quantity (g)": 0,
      });
    }

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

      {/* Daily Consumption Summary */}
      {dailySnapshot ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-muted/30 text-center">
            <div className="text-lg font-bold">{dailySnapshot.opening_stock ?? "—"}<span className="text-xs font-normal text-muted-foreground">g</span></div>
            <p className="text-[9px] text-muted-foreground">Opening Stock</p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/30 text-center">
            <div className="text-lg font-bold">{dailySnapshot.closing_stock ?? "—"}<span className="text-xs font-normal text-muted-foreground">g</span></div>
            <p className="text-[9px] text-muted-foreground">Closing Stock</p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/30 text-center">
            <div className="text-lg font-bold">{dailySnapshot.packets_received}<span className="text-xs font-normal text-muted-foreground">g</span></div>
            <p className="text-[9px] text-muted-foreground">Received</p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/30 text-center">
            <div className="text-lg font-bold">{actualConsumption}<span className="text-xs font-normal text-muted-foreground">g</span></div>
            <p className="text-[9px] text-muted-foreground">Used (Actual)</p>
          </div>
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground text-center">
          No daily stock snapshot recorded for this date.
        </div>
      )}

      {/* Consumption comparison */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-lg bg-muted/30 text-center">
          <div className="text-lg font-bold">{actualConsumption}<span className="text-xs font-normal text-muted-foreground">g</span></div>
          <p className="text-[9px] text-muted-foreground">Actual</p>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/30 text-center">
          <div className="text-lg font-bold">{predictedConsumption}<span className="text-xs font-normal text-muted-foreground">g</span></div>
          <p className="text-[9px] text-muted-foreground">Predicted ({totalSales} × {gramsPerChillum}g)</p>
        </div>
        <div className={`p-2.5 rounded-lg text-center ${
          variance > 0 ? 'bg-destructive/10' : variance < 0 ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-success/10'
        }`}>
          <div className={`text-lg font-bold ${
            variance > 0 ? 'text-destructive' : variance < 0 ? 'text-orange-500' : 'text-success'
          }`}>
            {variance > 0 ? "+" : ""}{variance}<span className="text-xs font-normal">g</span>
          </div>
          <p className="text-[9px] text-muted-foreground">Variance</p>
        </div>
      </div>

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
