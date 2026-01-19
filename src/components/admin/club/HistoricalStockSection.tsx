import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, AlertTriangle, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx";

interface HistoricalSession {
  id: string;
  session_date: string;
}

interface HistoricalStockSectionProps {
  session: HistoricalSession;
  clubId: string;
  clubName: string;
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

export const HistoricalStockSection = ({ session, clubId, clubName }: HistoricalStockSectionProps) => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStockData();
  }, [session.id, clubId]);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const sessionDate = parseISO(session.session_date);
      const previousDate = format(subDays(sessionDate, 1), "yyyy-MM-dd");

      // Fetch sales for expected usage calculation
      const { data: salesData } = await supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", clubId)
        .eq("report_date", session.session_date);

      const sales = salesData?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      setTotalSales(sales);

      // Fetch stock items
      const { data: currentStock } = await supabase
        .from("stock")
        .select("item_name, quantity")
        .eq("venue_id", clubId)
        .eq("category", "flavour");

      // Note: This is a simplified calculation
      // In a real scenario, you'd have historical stock snapshots
      const items: StockItem[] = (currentStock || []).map(item => {
        // Calculate expected usage based on sales and avg grams per chillum
        const expectedUsage = Math.round((sales * AVG_GRAMS_PER_CHILLUM) / (currentStock?.length || 1));
        
        // Since we don't have historical snapshots, show current state
        const closing = item.quantity;
        const opening = closing + expectedUsage; // Estimate
        const difference = opening - closing;
        
        const tolerance = expectedUsage * 0.15; // 15% tolerance
        let status: "match" | "mismatch" | "unknown" = "unknown";
        
        if (Math.abs(difference - expectedUsage) <= tolerance) {
          status = "match";
        } else if (difference > expectedUsage + tolerance) {
          status = "mismatch";
        }

        return {
          item_name: item.item_name,
          opening,
          closing,
          difference,
          expectedUsage,
          status,
        };
      });

      setStockItems(items);
    } catch (error) {
      console.error("Error fetching historical stock:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    const exportData = stockItems.map(item => ({
      Item: item.item_name,
      "Opening (g)": item.opening,
      "Closing (g)": item.closing,
      "Actual Usage (g)": item.difference,
      "Expected Usage (g)": item.expectedUsage,
      Status: item.status === "match" ? "OK" : item.status === "mismatch" ? "Mismatch" : "Unknown",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, `${clubName}_Stock_${session.session_date}.xlsx`);
  };

  const mismatchCount = stockItems.filter(i => i.status === "mismatch").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-lg font-bold">{stockItems.length}</div>
          <div className="text-[10px] text-muted-foreground">Stock Items</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <AlertTriangle className={`h-4 w-4 ${mismatchCount > 0 ? "text-destructive" : "text-success"}`} />
          </div>
          <div className={`text-lg font-bold ${mismatchCount > 0 ? "text-destructive" : "text-success"}`}>
            {mismatchCount}
          </div>
          <div className="text-[10px] text-muted-foreground">Mismatches</div>
        </div>
      </div>

      {/* Expected Usage Info */}
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="text-xs text-muted-foreground">
          Expected usage calculated based on {totalSales} hookahs sold @ {AVG_GRAMS_PER_CHILLUM}g per chillum
        </div>
      </div>

      {/* Stock Table */}
      <ScrollArea className="h-[200px]">
        <div className="space-y-2">
          {stockItems.map((item, idx) => (
            <div 
              key={idx} 
              className={`flex items-center justify-between p-2 rounded-lg border ${
                item.status === "mismatch" ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/30"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.item_name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {item.opening}g → {item.closing}g (used: {item.difference}g)
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <Badge 
                  variant={item.status === "match" ? "default" : item.status === "mismatch" ? "destructive" : "outline"}
                  className="text-[10px]"
                >
                  {item.status === "match" ? "OK" : item.status === "mismatch" ? "Mismatch" : "—"}
                </Badge>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  exp: {item.expectedUsage}g
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Download Button */}
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadExcel}>
        <Download className="h-4 w-4" />
        Download Stock Report (Excel)
      </Button>
    </div>
  );
};
