import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Download, AlertTriangle, Package, Info, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ClubSession } from "@/pages/ClubDetail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ClubStockSectionProps {
  clubId: string;
  clubName: string;
  session: ClubSession | null;
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

export const ClubStockSection = ({ clubId, clubName, session }: ClubStockSectionProps) => {
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [dateRange, setDateRange] = useState<"7" | "30">("7");

  useEffect(() => {
    fetchStock();
  }, [clubId]);

  const fetchStock = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stock")
      .select("*")
      .eq("venue_id", clubId)
      .order("category")
      .order("quantity", { ascending: true });

    setStockData(data || []);
    setLoading(false);
  };

  const lowStockItems = stockData.filter(item => item.quantity <= item.low_stock_threshold);
  const totalItems = stockData.length;

  const exportStock = () => {
    const headers = ["Item Name", "Category", "Unit", "Current Quantity", "Threshold", "Status"];
    const rows = stockData.map(item => [
      item.item_name,
      item.category,
      item.unit,
      item.quantity,
      item.low_stock_threshold,
      item.quantity <= item.low_stock_threshold ? "Low" : "OK"
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

  // No session state
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Info className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No Active Session</p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">
          Stock data will appear once the session is active.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="flex items-center justify-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-semibold">{totalItems}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Total Items</p>
        </div>
        <div className={`p-3 rounded-lg text-center ${lowStockItems.length > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${lowStockItems.length > 0 ? 'text-warning' : 'text-success'}`} />
            <span className="text-lg font-semibold">{lowStockItems.length}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Low Stock Alerts</p>
        </div>
      </div>

      {/* Low Stock Alerts - Exceptions Only */}
      {lowStockItems.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium text-warning">Low Stock Items</span>
          <div className="space-y-1.5">
            {lowStockItems.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center justify-between p-2 bg-warning/5 border border-warning/20 rounded">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
                  <div>
                    <span className="text-xs font-medium">{item.item_name}</span>
                    <p className="text-[10px] text-muted-foreground capitalize">{item.category.replace('_', ' ')}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                  {item.quantity} {item.unit}
                </Badge>
              </div>
            ))}
            {lowStockItems.length > 5 && (
              <p className="text-[10px] text-muted-foreground text-center">
                +{lowStockItems.length - 5} more items
              </p>
            )}
          </div>
        </div>
      )}

      {/* View Detailed Table Button */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            View Detailed Stock Table
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base">Stock Details - {clubName}</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center justify-between gap-2 pb-3 border-b">
            <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportStock} className="h-8 text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </div>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sticky left-0 bg-background">Item</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs text-center">Qty</TableHead>
                  <TableHead className="text-xs text-center">Threshold</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockData.map(item => {
                  const isLow = item.quantity <= item.low_stock_threshold;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs font-medium sticky left-0 bg-background">
                        {item.item_name}
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">
                        {item.category.replace('_', ' ')}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell className="text-xs text-center text-muted-foreground">
                        {item.low_stock_threshold}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={isLow ? "destructive" : "secondary"} 
                          className="text-[9px]"
                        >
                          {isLow ? "Low" : "OK"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Download Button */}
      <Button variant="ghost" size="sm" onClick={exportStock} className="w-full text-muted-foreground">
        <Download className="h-4 w-4 mr-2" />
        Download Stock Report
      </Button>
    </div>
  );
};
