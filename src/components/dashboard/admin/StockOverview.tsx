import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package } from "lucide-react";

interface StockItem {
  id: string;
  venue_id: string;
  item_name: string;
  category: 'flavour' | 'hookah_pots' | 'accessories';
  quantity: number;
  low_stock_threshold: number;
  unit: string;
  venue_name: string;
}

const StockOverview = () => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    const { data: stockData, error } = await supabase
      .from("stock")
      .select("*")
      .order("quantity");

    if (!error && stockData) {
      const enrichedData = await Promise.all(
        stockData.map(async (item) => {
          const { data: venueData } = await supabase
            .from("venues")
            .select("name")
            .eq("id", item.venue_id)
            .single();

          return {
            ...item,
            venue_name: venueData?.name || "Unknown",
          };
        })
      );
      setStock(enrichedData);
    }
    setLoading(false);
  };

  const lowStockItems = stock.filter(item => item.quantity <= item.low_stock_threshold);

  if (loading) {
    return <div>Loading stock data...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold">Stock Overview</h2>
        {lowStockItems.length > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {lowStockItems.length} Low Stock Alert{lowStockItems.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {lowStockItems.length > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="text-warning flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>Items that need restocking urgently</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-warning/10 rounded-lg">
                  <div>
                    <p className="font-medium">{item.item_name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{item.category.replace('_', ' ')} • {item.venue_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-warning">{item.quantity} {item.unit}</p>
                    <p className="text-xs text-muted-foreground">Threshold: {item.low_stock_threshold}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stock.map((item) => (
          <Card key={item.id} className={item.quantity <= item.low_stock_threshold ? "border-warning" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{item.item_name}</CardTitle>
                  <CardDescription className="capitalize">{item.category.replace('_', ' ')} • {item.venue_name}</CardDescription>
                </div>
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-bold">{item.quantity}</p>
                  <p className="text-xs text-muted-foreground">{item.unit} available</p>
                </div>
                {item.quantity <= item.low_stock_threshold && (
                  <Badge variant="outline" className="text-warning border-warning">Low</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {stock.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No stock items found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StockOverview;