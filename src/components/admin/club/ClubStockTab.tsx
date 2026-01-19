import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ClubStockTabProps {
  clubId: string;
  clubName: string;
}

interface StockItem {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  low_stock_threshold: number;
  unit: string;
  updated_at: string;
}

export const ClubStockTab = ({ clubId, clubName }: ClubStockTabProps) => {
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [dateRange, setDateRange] = useState<"7" | "30" | "custom">("7");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStock();
  }, [clubId, dateRange]);

  const fetchStock = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stock")
      .select("*")
      .eq("venue_id", clubId)
      .order("category")
      .order("item_name");

    setStockData(data || []);
    setLoading(false);
  };

  const getDays = () => {
    const days = parseInt(dateRange === "custom" ? "30" : dateRange);
    const end = new Date();
    const start = subDays(end, days - 1);
    return eachDayOfInterval({ start, end });
  };

  const exportExcel = () => {
    const dates = getDays();
    const headers = ["Item Name", "Category", "Unit", ...dates.map(d => format(d, "dd-MM")), "Current"];
    const rows = stockData.map(item => [
      item.item_name,
      item.category,
      item.unit,
      ...dates.map(() => "-"), // Placeholder - would need historical data
      item.quantity,
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clubName}-stock-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Stock report exported");
  };

  // Calculate expected consumption (placeholder logic - avg grams per chillum)
  const GRAMS_PER_CHILLUM = 20;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-4">
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Download Excel
          </Button>
        </CardContent>
      </Card>

      {/* Stock Matrix */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stock Matrix (Items × Dates)</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-sm">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[120px] text-xs font-semibold">Item</TableHead>
                    <TableHead className="text-xs min-w-[80px]">Category</TableHead>
                    <TableHead className="text-xs min-w-[60px]">Unit</TableHead>
                    {getDays().slice(-7).map(date => (
                      <TableHead key={date.toISOString()} className="text-center text-xs min-w-[60px]">
                        {format(date, "dd/MM")}
                      </TableHead>
                    ))}
                    <TableHead className="sticky right-0 bg-background z-10 text-center text-xs font-semibold min-w-[70px]">Current</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockData.map(item => {
                    const isLow = item.quantity <= item.low_stock_threshold;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="sticky left-0 bg-background z-10 text-xs font-medium">
                          <div className="flex items-center gap-1">
                            {item.item_name}
                            {isLow && <AlertTriangle className="h-3 w-3 text-warning" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{item.category.replace('_', ' ')}</TableCell>
                        <TableCell className="text-xs">{item.unit}</TableCell>
                        {getDays().slice(-7).map(date => (
                          <TableCell key={date.toISOString()} className="text-center text-xs text-muted-foreground">-</TableCell>
                        ))}
                        <TableCell className={`sticky right-0 bg-background z-10 text-center font-semibold text-xs ${isLow ? 'text-warning' : ''}`}>
                          {item.quantity}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {stockData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No stock items found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Consumption Mismatch Alert (placeholder) */}
      <Card className="border-warning/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" />
            Consumption Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Expected consumption is calculated at {GRAMS_PER_CHILLUM}g per chillum. 
            Significant deviations will be flagged here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
