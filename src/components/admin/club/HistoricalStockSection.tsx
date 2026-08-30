import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Info } from "lucide-react";
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
  opening: number;
  closing: number;
  difference: number;
  expectedUsage: number;
  status: "match" | "mismatch" | "unknown";
}

const AVG_GRAMS_PER_CHILLUM = 25;

export const HistoricalStockSection = ({ session, clubId, clubName, onSummaryChange }: HistoricalStockSectionProps) => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStockData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, clubId]);

  const mismatchCount = stockItems.filter(i => i.status === "mismatch").length;

  useEffect(() => {
    onSummaryChange?.(loading ? null : { itemCount: stockItems.length, mismatchCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockItems, loading]);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const { data: salesData } = await supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", clubId)
        .eq("report_date", session.session_date);

      const sales = salesData?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      setTotalSales(sales);

      // No per-day stock snapshot table exists — this estimates a past day's usage by
      // working backward from TODAY's live stock. Not an exact historical record.
      const { data: currentStock } = await supabase
        .from("stock")
        .select("item_name, quantity")
        .eq("venue_id", clubId)
        .eq("category", "flavour");

      const items: StockItem[] = (currentStock || []).map(item => {
        const expectedUsage = Math.round((sales * AVG_GRAMS_PER_CHILLUM) / (currentStock?.length || 1));
        const closing = item.quantity;
        const opening = closing + expectedUsage;
        const difference = opening - closing;

        const tolerance = expectedUsage * 0.15;
        let status: "match" | "mismatch" | "unknown" = "unknown";

        if (Math.abs(difference - expectedUsage) <= tolerance) {
          status = "match";
        } else if (difference > expectedUsage + tolerance) {
          status = "mismatch";
        }

        return { item_name: item.item_name, opening, closing, difference, expectedUsage, status };
      });

      setStockItems(items);
    } catch (error) {
      console.error("Error fetching historical stock:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    const exportData = stockItems.map(item => ({
      Item: item.item_name,
      "Opening (g, estimated)": item.opening,
      "Closing (g)": item.closing,
      "Actual Usage (g, estimated)": item.difference,
      "Expected Usage (g)": item.expectedUsage,
      Status: item.status === "match" ? "OK" : item.status === "mismatch" ? "Mismatch" : "Unknown",
    }));

    await exportToXlsx(exportData, `${clubName}_Stock_${session.session_date}.xlsx`, "Stock");
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

      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Estimated — not an exact historical snapshot. Worked backward from today's live stock using{" "}
          {totalSales} hookahs sold on this day @ {AVG_GRAMS_PER_CHILLUM}g/chillum.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg bg-muted/30 text-center">
          <div className="text-lg font-bold">{stockItems.length}</div>
          <p className="text-[9px] text-muted-foreground">Stock Items</p>
        </div>
        <div className={`p-2.5 rounded-lg text-center ${mismatchCount > 0 ? 'bg-warning/10' : 'bg-muted/30'}`}>
          <div className={`text-lg font-bold ${mismatchCount > 0 ? 'text-warning' : ''}`}>{mismatchCount}</div>
          <p className="text-[9px] text-muted-foreground">Mismatches</p>
        </div>
      </div>

      <div className="border rounded-lg max-h-[280px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs sticky left-0 top-0 bg-background z-10">Item</TableHead>
              <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Est. Opening → Closing</TableHead>
              <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Expected</TableHead>
              <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockItems.map((item, idx) => (
              <TableRow key={idx} className={item.status === "mismatch" ? "bg-warning/5" : ""}>
                <TableCell className="text-xs font-medium sticky left-0 bg-background">{item.item_name}</TableCell>
                <TableCell className="text-xs text-center text-muted-foreground">
                  {item.opening}g → {item.closing}g
                </TableCell>
                <TableCell className="text-xs text-center text-muted-foreground">{item.expectedUsage}g</TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant={item.status === "mismatch" ? "outline" : item.status === "match" ? "secondary" : "outline"}
                    className={`text-[9px] ${item.status === "mismatch" ? "text-warning border-warning" : ""}`}
                  >
                    {item.status === "match" ? "OK" : item.status === "mismatch" ? "Mismatch" : "—"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {stockItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-xs">
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
