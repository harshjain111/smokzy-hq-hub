import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Download, AlertTriangle, Package, Info,
  AlertCircle, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { ClubSession } from "@/pages/ClubDetail";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ClubStockSectionProps {
  clubId: string;
  clubName: string;
  session: ClubSession | null;
  onSummaryChange?: (data: { score: number; lowCount: number; outCount: number } | null) => void;
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

interface StockInsight {
  type: 'critical' | 'warning' | 'info' | 'positive';
  message: string;
  action?: string;
}

interface CategorySummary {
  name: string;
  totalItems: number;
  lowStockItems: number;
  healthScore: number;
}

export const ClubStockSection = ({ clubId, clubName, session, onSummaryChange }: ClubStockSectionProps) => {
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<StockInsight[]>([]);
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [lastStockUpdate, setLastStockUpdate] = useState<string | null>(null);

  useEffect(() => {
    fetchStock();
  }, [clubId, session]);

  const fetchStock = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stock")
      .select("*")
      .eq("venue_id", clubId)
      .order("category")
      .order("quantity", { ascending: true });

    if (data) {
      setStockData(data);
      analyzeStock(data);

      const latestUpdate = data.reduce((latest, item) => {
        return new Date(item.updated_at) > new Date(latest) ? item.updated_at : latest;
      }, data[0]?.updated_at || '');
      setLastStockUpdate(latestUpdate);
    }
    setLoading(false);
  };

  const analyzeStock = (items: StockItem[]) => {
    const newInsights: StockInsight[] = [];

    const criticalItems = items.filter(item => item.quantity <= item.low_stock_threshold);
    const outOfStock = items.filter(item => item.quantity === 0);

    const categoryMap = new Map<string, { total: number; low: number }>();
    items.forEach(item => {
      const cat = categoryMap.get(item.category) || { total: 0, low: 0 };
      cat.total++;
      if (item.quantity <= item.low_stock_threshold) cat.low++;
      categoryMap.set(item.category, cat);
    });

    if (outOfStock.length > 0) {
      newInsights.push({
        type: 'critical',
        message: `${outOfStock.length} item${outOfStock.length > 1 ? 's' : ''} OUT OF STOCK`,
        action: 'Immediate reorder required'
      });
    }

    if (criticalItems.length > outOfStock.length) {
      const lowOnly = criticalItems.length - outOfStock.length;
      newInsights.push({
        type: 'warning',
        message: `${lowOnly} item${lowOnly > 1 ? 's' : ''} running low`,
        action: 'Plan reorder soon'
      });
    }

    const categorySum: CategorySummary[] = [];
    categoryMap.forEach((stats, name) => {
      const healthScore = stats.total > 0
        ? Math.round(((stats.total - stats.low) / stats.total) * 100)
        : 100;
      categorySum.push({
        name: name.replace('_', ' '),
        totalItems: stats.total,
        lowStockItems: stats.low,
        healthScore
      });

      if (healthScore < 50) {
        newInsights.push({
          type: 'warning',
          message: `${name.replace('_', ' ')} category needs attention (${healthScore}% healthy)`
        });
      }
    });

    categorySum.sort((a, b) => a.healthScore - b.healthScore);
    setCategorySummary(categorySum);

    if (criticalItems.length === 0) {
      newInsights.push({
        type: 'positive',
        message: 'All items well stocked!'
      });
    }

    if (session?.stock_submitted && session.stock_submitted_at) {
      newInsights.push({
        type: 'info',
        message: `Last updated ${format(new Date(session.stock_submitted_at), "hh:mm a")}`
      });
    }

    setInsights(newInsights);
  };

  const lowStockItems = stockData.filter(item => item.quantity <= item.low_stock_threshold);
  const outOfStockItems = stockData.filter(item => item.quantity === 0);
  const totalItems = stockData.length;
  const stockHealthScore = totalItems > 0
    ? Math.round(((totalItems - lowStockItems.length) / totalItems) * 100)
    : 100;

  useEffect(() => {
    onSummaryChange?.(
      totalItems > 0
        ? { score: stockHealthScore, lowCount: lowStockItems.length, outCount: outOfStockItems.length }
        : null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockHealthScore, lowStockItems.length, outOfStockItems.length, totalItems]);

  const exportStock = () => {
    const headers = ["Item Name", "Category", "Unit", "Current Qty", "Threshold", "Status", "Last Updated"];
    const rows = stockData.map(item => [
      item.item_name,
      item.category.replace('_', ' '),
      item.unit,
      item.quantity,
      item.low_stock_threshold,
      item.quantity === 0 ? "OUT OF STOCK" : item.quantity <= item.low_stock_threshold ? "LOW" : "OK",
      format(new Date(item.updated_at), "yyyy-MM-dd HH:mm")
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

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-success bg-success/10 border-success/20';
    if (score >= 50) return 'text-warning bg-warning/10 border-warning/20';
    return 'text-destructive bg-destructive/10 border-destructive/20';
  };

  const getInsightStyle = (type: StockInsight['type']) => {
    switch (type) {
      case 'critical': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'warning': return 'bg-warning/10 text-warning border-warning/20';
      case 'positive': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-muted/50 text-muted-foreground';
    }
  };

  const getInsightIcon = (type: StockInsight['type']) => {
    switch (type) {
      case 'critical': return <AlertCircle className="h-3.5 w-3.5" />;
      case 'warning': return <AlertTriangle className="h-3.5 w-3.5" />;
      case 'positive': return <CheckCircle2 className="h-3.5 w-3.5" />;
      default: return <Info className="h-3.5 w-3.5" />;
    }
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
          <Info className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No Active Session</p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-[220px]">
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

  // Prioritize exceptions: out-of-stock > low stock > healthy
  const sortedInventory = [...stockData].sort((a, b) => {
    const rank = (item: StockItem) => (item.quantity === 0 ? 0 : item.quantity <= item.low_stock_threshold ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <div className="space-y-4">
      {/* Stock Health Score */}
      <div className={`p-4 rounded-lg border ${getHealthColor(stockHealthScore)}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <span className="font-semibold">Stock Health</span>
          </div>
          <div className="text-2xl font-bold">{stockHealthScore}%</div>
        </div>
        <div className="h-2 bg-current/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-current rounded-full transition-all"
            style={{ width: `${stockHealthScore}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs">
          <span>{totalItems} total items</span>
          <span>{totalItems - lowStockItems.length} well stocked</span>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={exportStock} className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Export Stock Report
      </Button>

      {/* Smart Insights */}
      {insights.length > 0 && (
        <div className="space-y-1.5">
          {insights.slice(0, 4).map((insight, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${getInsightStyle(insight.type)}`}
            >
              {getInsightIcon(insight.type)}
              <div className="flex-1">
                <span className="font-medium">{insight.message}</span>
                {insight.action && (
                  <p className="text-[10px] mt-0.5 opacity-80">{insight.action}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category health + full inventory side-by-side on desktop */}
      <div className="grid md:grid-cols-2 gap-3">
        {/* Category Health Summary */}
        {categorySummary.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Category Health</span>
            <div className="space-y-1.5">
              {categorySummary.map(cat => (
                <div key={cat.name} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium capitalize">{cat.name}</span>
                    <span className="text-[10px] text-muted-foreground">({cat.totalItems} items)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {cat.lowStockItems > 0 && (
                      <Badge variant="outline" className="text-[9px] text-warning border-warning/30">
                        {cat.lowStockItems} low
                      </Badge>
                    )}
                    <span className={`text-xs font-bold ${
                      cat.healthScore >= 80 ? 'text-success' :
                      cat.healthScore >= 50 ? 'text-warning' : 'text-destructive'
                    }`}>
                      {cat.healthScore}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full inventory — inline, sorted by severity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Full Inventory</span>
            {lastStockUpdate && (
              <span className="text-[10px] text-muted-foreground">
                Updated {format(new Date(lastStockUpdate), "MMM dd, hh:mm a")}
              </span>
            )}
          </div>
          <div className="border rounded-lg max-h-[320px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sticky left-0 top-0 bg-background z-10">Item</TableHead>
                  <TableHead className="text-xs sticky top-0 bg-background z-10">Category</TableHead>
                  <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Qty</TableHead>
                  <TableHead className="text-xs text-center sticky top-0 bg-background z-10">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedInventory.map(item => {
                  const isOut = item.quantity === 0;
                  const isLow = item.quantity <= item.low_stock_threshold && item.quantity > 0;
                  return (
                    <TableRow key={item.id} className={isOut ? 'bg-destructive/5' : isLow ? 'bg-warning/5' : ''}>
                      <TableCell className="text-xs font-medium sticky left-0 bg-background">
                        {item.item_name}
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">
                        {item.category.replace('_', ' ')}
                      </TableCell>
                      <TableCell className={`text-xs text-center font-medium ${
                        isOut ? 'text-destructive' : isLow ? 'text-warning' : ''
                      }`}>
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={isOut ? "destructive" : isLow ? "outline" : "secondary"}
                          className={`text-[9px] ${isLow && !isOut ? 'text-warning border-warning' : ''}`}
                        >
                          {isOut ? "OUT" : isLow ? "LOW" : "OK"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sortedInventory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-xs">
                      No stock items recorded
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};
