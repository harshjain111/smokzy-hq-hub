import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package } from "lucide-react";

interface StockOverviewProps {
  venueId: string;
  venueName: string;
}

interface StockItem {
  id: string;
  venue_id: string;
  item_name: string;
  category: 'flavour' | 'hookah_pots' | 'accessories';
  quantity: number;
  low_stock_threshold: number;
  unit: string;
}

const StockOverview = ({ venueId, venueName }: StockOverviewProps) => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStock();
  }, [venueId]);

  const fetchStock = async () => {
    const { data: stockData, error } = await supabase
      .from("stock")
      .select("*")
      .eq("venue_id", venueId)
      .order("category")
      .order("quantity");

    if (!error && stockData) {
      setStock(stockData);
    }
    setLoading(false);
  };

  const lowStockItems = stock.filter(item => item.quantity <= item.low_stock_threshold);
  const stockByCategory = {
    flavour: stock.filter(item => item.category === 'flavour'),
    hookah_pots: stock.filter(item => item.category === 'hookah_pots'),
    accessories: stock.filter(item => item.category === 'accessories'),
  };

  if (loading) {
    return <div>Loading stock data...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Stock Overview - {venueName}</h2>
          <p className="text-sm text-muted-foreground">Current inventory status</p>
        </div>
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
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockItems.map((item) => (
                  <TableRow key={item.id} className="bg-warning/5">
                    <TableCell className="font-medium">{item.item_name}</TableCell>
                    <TableCell className="capitalize">{item.category.replace('_', ' ')}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-warning">{item.quantity} {item.unit}</span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.low_stock_threshold}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {Object.entries(stockByCategory).map(([category, items]) => {
        if (items.length === 0) return null;
        
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="capitalize flex items-center gap-2">
                <Package className="h-5 w-5" />
                {category.replace('_', ' ')}
              </CardTitle>
              <CardDescription>{items.length} item{items.length > 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell className="text-right font-bold">{item.quantity}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{item.unit}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity <= item.low_stock_threshold ? (
                          <Badge variant="outline" className="text-warning border-warning">Low</Badge>
                        ) : (
                          <Badge variant="outline" className="text-success border-success">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {stock.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No stock items found for this venue</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StockOverview;