import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingDown, TrendingUp, Package, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getBusinessDate } from "@/lib/businessDate";

interface StaffStockViewProps {
  venueId: string;
}

interface StockItem {
  item_name: string;
  quantity: number;
  unit: string;
}

interface DailySnapshot {
  date: string;
  closing_stock: number | null;
  packets_received: number | null;
}

const StaffStockView = ({ venueId }: StaffStockViewProps) => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [history, setHistory] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const todayStr = getBusinessDate();
      const sevenDaysAgo = new Date(todayStr + "T00:00:00");
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fromDate = format(sevenDaysAgo, "yyyy-MM-dd");

      const [stockRes, historyRes] = await Promise.all([
        supabase
          .from("stock")
          .select("item_name, quantity, unit")
          .eq("venue_id", venueId)
          .eq("category", "flavour")
          .order("item_name"),
        supabase
          .from("venue_stock_daily")
          .select("date, closing_stock, packets_received")
          .eq("venue_id", venueId)
          .gte("date", fromDate)
          .order("date", { ascending: false }),
      ]);

      setStockItems(stockRes.data || []);
      setHistory(historyRes.data || []);
      setLoading(false);
    };

    fetchData();
  }, [venueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const totalStock = stockItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Total stock card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-gradient-start/10 to-gradient-end/10 border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Flavour Stock</p>
            <p className="text-2xl font-bold text-foreground">{totalStock}g</p>
          </div>
        </div>
      </div>

      {/* Per-item stock */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Item-wise Stock
        </h3>
        <div className="rounded-xl border border-border/50 overflow-hidden">
          {stockItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No flavour items found
            </div>
          ) : (
            stockItems.map((item, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5",
                  idx < stockItems.length - 1 && "border-b border-border/30"
                )}
              >
                <span className="text-sm font-medium text-foreground truncate pr-3">{item.item_name}</span>
                <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                  {item.quantity}{item.unit === 'grams' ? 'g' : ` ${item.unit}`}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stock history accordion */}
      {history.length > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex items-center justify-between w-full px-1 py-1.5"
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Stock History
            </h3>
            <motion.div
              animate={{ rotate: historyExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </button>

          <AnimatePresence>
            {historyExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center px-4 py-2 bg-muted/30 border-b border-border/30">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase flex-1">Date</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase w-20 text-center">Stock</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase w-16 text-right">Change</span>
                  </div>

                  {history.map((day, idx) => {
                    const nextDay = history[idx + 1];
                    const change = (day.closing_stock !== null && nextDay?.closing_stock !== null)
                      ? day.closing_stock - nextDay.closing_stock
                      : null;

                    const dateObj = new Date(day.date + "T00:00:00");
                    const dateStr = dateObj.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    });
                    const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });

                    return (
                      <div
                        key={day.date}
                        className={cn(
                          "flex items-center px-4 py-2.5",
                          idx < history.length - 1 && "border-b border-border/30"
                        )}
                      >
                        <div className="flex-1">
                          <span className="text-sm font-medium text-foreground">{dateStr}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">{dayName}</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground w-20 text-center tabular-nums">
                          {day.closing_stock !== null ? `${day.closing_stock}g` : '—'}
                        </span>
                        <div className="w-16 flex items-center justify-end gap-1">
                          {change !== null && change !== 0 ? (
                            <>
                              {change < 0 ? (
                                <TrendingDown className="w-3 h-3 text-destructive" />
                              ) : (
                                <TrendingUp className="w-3 h-3 text-success" />
                              )}
                              <span className={cn(
                                "text-xs font-medium tabular-nums",
                                change < 0 ? "text-destructive" : "text-success"
                              )}>
                                {change > 0 ? '+' : ''}{change}g
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default StaffStockView;
