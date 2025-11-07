import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Calendar } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

interface SalesData {
  venue_id: string;
  hookah_category: string;
  total_quantity: number;
  venue_name: string;
}

const SalesReports = () => {
  const [sales, setSales] = useState<SalesData[]>([]);
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, [period]);

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
      .select("*")
      .gte("report_date", start)
      .lte("report_date", end);

    if (!error && salesData) {
      const aggregated: Record<string, SalesData> = {};

      for (const sale of salesData) {
        const key = `${sale.venue_id}-${sale.hookah_category}`;
        
        if (!aggregated[key]) {
          const { data: venueData } = await supabase
            .from("venues")
            .select("name")
            .eq("id", sale.venue_id)
            .single();

          aggregated[key] = {
            venue_id: sale.venue_id,
            hookah_category: sale.hookah_category,
            total_quantity: sale.quantity_sold,
            venue_name: venueData?.name || "Unknown",
          };
        } else {
          aggregated[key].total_quantity += sale.quantity_sold;
        }
      }

      setSales(Object.values(aggregated));
    }
    setLoading(false);
  };

  const totalSales = sales.reduce((sum, item) => sum + item.total_quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Sales Reports</h2>
        <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-success">
            <TrendingUp className="h-5 w-5" />
            Total Sales
          </CardTitle>
          <CardDescription>
            {period === "today" ? "Today's" : period === "week" ? "This week's" : "This month's"} performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">{totalSales}</p>
          <p className="text-sm text-muted-foreground">Hookahs sold</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sales.map((item, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{item.venue_name}</CardTitle>
              <CardDescription className="capitalize">{item.hookah_category} Category</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-success">{item.total_quantity}</p>
              <p className="text-sm text-muted-foreground">Units sold</p>
            </CardContent>
          </Card>
        ))}
        {sales.length === 0 && !loading && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No sales data for this period</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SalesReports;