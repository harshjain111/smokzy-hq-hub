import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

interface SalesReportsProps {
  venueId: string;
  venueName: string;
}

interface SalesData {
  category_id: string;
  report_date: string;
  quantity_sold: number;
  venue_hookah_categories?: {
    category_name: string;
  };
}

const SalesReports = ({ venueId, venueName }: SalesReportsProps) => {
  const [sales, setSales] = useState<SalesData[]>([]);
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, [period, venueId]);

  const getDateRange = () => {
    const today = new Date();
    switch (period) {
      case "today":
        return { start: format(today, "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
      case "week":
        return { 
          start: format(startOfWeek(today), "yyyy-MM-dd"), 
          end: format(endOfWeek(today), "yyyy-MM-dd") 
        };
      case "month":
        return { 
          start: format(startOfMonth(today), "yyyy-MM-dd"), 
          end: format(endOfMonth(today), "yyyy-MM-dd") 
        };
    }
  };

  const fetchSales = async () => {
    const { start, end } = getDateRange();
    
    const { data: salesData, error } = await supabase
      .from("sales_reports")
      .select("*, venue_hookah_categories(category_name)")
      .eq("venue_id", venueId)
      .gte("report_date", start)
      .lte("report_date", end)
      .order("report_date", { ascending: false });

    if (!error && salesData) {
      setSales(salesData);
    }
    setLoading(false);
  };

  const totalSales = sales.reduce((sum, sale) => sum + sale.quantity_sold, 0);
  const salesByCategory = sales.reduce((acc, sale) => {
    const categoryName = sale.venue_hookah_categories?.category_name || 'Unknown';
    acc[categoryName] = (acc[categoryName] || 0) + sale.quantity_sold;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sales Reports - {venueName}</h2>
          <p className="text-sm text-muted-foreground">Hookah sales analytics</p>
        </div>
        <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-success" />
            Total Sales
          </CardTitle>
          <CardDescription>
            {period === "today" ? "Today" : period === "week" ? "This Week" : "This Month"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-success">{totalSales}</p>
          <p className="text-sm text-muted-foreground mt-1">Hookahs sold</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales by Category</CardTitle>
          <CardDescription>Breakdown by hookah type</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Quantity Sold</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(salesByCategory).map(([category, quantity]) => (
                <TableRow key={category}>
                  <TableCell className="font-medium">{category}</TableCell>
                  <TableCell className="text-right font-bold">{quantity}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {totalSales > 0 ? ((quantity / totalSales) * 100).toFixed(1) : 0}%
                  </TableCell>
                </TableRow>
              ))}
              {Object.keys(salesByCategory).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No sales data for this period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
          <CardDescription>Daily sales records</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.slice(0, 10).map((sale, idx) => (
                <TableRow key={idx}>
                  <TableCell>{format(new Date(sale.report_date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{sale.venue_hookah_categories?.category_name || 'Unknown'}</TableCell>
                  <TableCell className="text-right font-semibold">{sale.quantity_sold}</TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No sales records found for this period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesReports;
