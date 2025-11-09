import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval } from "date-fns";
import { CalendarIcon, Download, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import PageLayout from "@/components/PageLayout";
import { toast } from "sonner";

interface DateRange {
  from: Date;
  to: Date;
}

interface StockRecord {
  item_name: string;
  category: string;
  date: string;
  quantity: number;
  updated_at: string;
}

const VenueReports = () => {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const [venueName, setVenueName] = useState("");
  const [dateRangeType, setDateRangeType] = useState<"current" | "last" | "custom">("current");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [stockData, setStockData] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [breakageData, setBreakageData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (venueId) {
      fetchVenueName();
      fetchAllReports();
    }
  }, [venueId, dateRangeType, customRange]);

  const fetchVenueName = async () => {
    const { data } = await supabase
      .from("venues")
      .select("name")
      .eq("id", venueId)
      .maybeSingle();

    if (data) {
      setVenueName(data.name);
    }
  };

  const getDateRange = (): DateRange => {
    const now = new Date();
    if (dateRangeType === "current") {
      return { from: startOfMonth(now), to: endOfMonth(now) };
    } else if (dateRangeType === "last") {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    return customRange || { from: startOfMonth(now), to: endOfMonth(now) };
  };

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const range = getDateRange();
      const fromDate = format(range.from, "yyyy-MM-dd");
      const toDate = format(range.to, "yyyy-MM-dd");

      const [stockRes, salesRes, attendanceRes, breakageRes] = await Promise.all([
        supabase.from("stock").select("*").eq("venue_id", venueId),
        supabase.from("sales_reports").select("*, venue_hookah_categories(category_name)")
          .eq("venue_id", venueId)
          .gte("report_date", fromDate)
          .lte("report_date", toDate),
        supabase.from("attendance").select("*, profiles(full_name)")
          .eq("venue_id", venueId)
          .gte("check_in_time", `${fromDate}T00:00:00`)
          .lte("check_in_time", `${toDate}T23:59:59`),
        supabase.from("breakage_reports").select("*")
          .eq("venue_id", venueId)
          .gte("created_at", `${fromDate}T00:00:00`)
          .lte("created_at", `${toDate}T23:59:59`),
      ]);

      setStockData(stockRes.data || []);
      setSalesData(salesRes.data || []);
      setAttendanceData(attendanceRes.data || []);
      setBreakageData(breakageRes.data || []);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const getStockMatrix = () => {
    const range = getDateRange();
    const dates = eachDayOfInterval({ start: range.from, end: range.to });
    
    // Group stock items by item name
    const itemsMap = new Map();
    stockData.forEach(item => {
      if (!itemsMap.has(item.item_name)) {
        itemsMap.set(item.item_name, {
          name: item.item_name,
          category: item.category,
          unit: item.unit,
          quantities: new Map(),
        });
      }
    });

    return {
      dates,
      items: Array.from(itemsMap.values()),
    };
  };

  const exportStockReport = () => {
    const { dates, items } = getStockMatrix();
    const headers = ["Item Name", "Category", "Unit", ...dates.map(d => format(d, "dd-MM-yyyy"))];
    const rows = items.map(item => [
      item.name,
      item.category,
      item.unit,
      ...dates.map(date => {
        const dateKey = format(date, "yyyy-MM-dd");
        return item.quantities.get(dateKey) || "-";
      }),
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${venueName}-stock-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <PageLayout title={`${venueName} - Detailed Reports`} subtitle="Comprehensive venue analytics and leak prevention">
      <div className="space-y-6">
        <Button
          variant="outline"
          onClick={() => navigate(`/venue/${venueId}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Venue
        </Button>
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Report Period</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Select value={dateRangeType} onValueChange={(v: any) => setDateRangeType(v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Month</SelectItem>
                <SelectItem value="last">Last Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {dateRangeType === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[300px] justify-start text-left font-normal",
                      !customRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customRange?.from ? (
                      customRange.to ? (
                        <>
                          {format(customRange.from, "LLL dd, y")} - {format(customRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(customRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customRange?.from}
                    selected={customRange as any}
                    onSelect={(range: any) => setCustomRange(range)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            )}
          </CardContent>
        </Card>

        {/* Reports Tabs */}
        <Tabs defaultValue="stock" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="stock">Stock Report</TabsTrigger>
            <TabsTrigger value="sales">Sales Analysis</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="breakage">Breakage & Losses</TabsTrigger>
          </TabsList>

          {/* Stock Report Matrix */}
          <TabsContent value="stock">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Stock Movement Matrix</CardTitle>
                <Button onClick={exportStockReport} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-8 text-center">Loading stock data...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background z-20 border-r font-semibold min-w-[150px]">Item Name</TableHead>
                          <TableHead className="sticky left-[150px] bg-background z-20 border-r font-semibold min-w-[100px]">Category</TableHead>
                          <TableHead className="sticky left-[250px] bg-background z-20 border-r font-semibold min-w-[80px]">Unit</TableHead>
                          {getStockMatrix().dates.map((date) => (
                            <TableHead key={date.toISOString()} className="text-center border-r min-w-[100px] font-semibold">
                              <div>{format(date, "dd-MM-yyyy")}</div>
                              <div className="text-[10px] text-muted-foreground font-normal">{format(date, "EEE")}</div>
                            </TableHead>
                          ))}
                          <TableHead className="sticky right-0 bg-background z-20 border-l font-semibold text-center min-w-[100px]">Current</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getStockMatrix().items.map((item, idx) => {
                          const currentStock = stockData.find(s => s.item_name === item.name);
                          return (
                            <TableRow key={idx}>
                              <TableCell className="sticky left-0 bg-background z-10 border-r font-medium">{item.name}</TableCell>
                              <TableCell className="sticky left-[150px] bg-background z-10 border-r capitalize">{item.category}</TableCell>
                              <TableCell className="sticky left-[250px] bg-background z-10 border-r">{item.unit}</TableCell>
                              {getStockMatrix().dates.map((date) => (
                                <TableCell key={date.toISOString()} className="text-center border-r text-muted-foreground">
                                  -
                                </TableCell>
                              ))}
                              <TableCell className="sticky right-0 bg-background z-10 border-l text-center font-semibold">
                                {currentStock?.quantity || 0}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sales Analysis */}
          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <CardTitle>Sales Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Quantity Sold</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesData.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>{format(new Date(sale.report_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>{(sale as any).venue_hookah_categories?.category_name || "N/A"}</TableCell>
                        <TableCell className="text-right font-medium">{sale.quantity_sold}</TableCell>
                      </TableRow>
                    ))}
                    {salesData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">No sales data</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Records</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Tasks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{(record as any).profiles?.full_name || "N/A"}</TableCell>
                        <TableCell>{format(new Date(record.check_in_time), "MMM dd, hh:mm a")}</TableCell>
                        <TableCell>{record.check_out_time ? format(new Date(record.check_out_time), "MMM dd, hh:mm a") : "-"}</TableCell>
                        <TableCell>{record.tasks_completed ? "✓" : "-"}</TableCell>
                      </TableRow>
                    ))}
                    {attendanceData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">No attendance data</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Breakage & Losses */}
          <TabsContent value="breakage">
            <Card>
              <CardHeader>
                <CardTitle>Breakage & Loss Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item Type</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Cause</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakageData.map((breakage) => (
                      <TableRow key={breakage.id}>
                        <TableCell>{format(new Date(breakage.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell>{breakage.item_type}</TableCell>
                        <TableCell className="text-right font-medium">{breakage.quantity}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{breakage.cause}</TableCell>
                      </TableRow>
                    ))}
                    {breakageData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">No breakage reports</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default VenueReports;
