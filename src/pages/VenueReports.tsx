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
    <PageLayout title={`${venueName} - Reports`} subtitle="Detailed analytics">
      <div className="space-y-4 md:space-y-6">
        <Button
          variant="outline"
          onClick={() => navigate(`/venue/${venueId}`)}
          className="w-full md:w-auto"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Venue
        </Button>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Report Period</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-3 md:gap-4">
            <Select value={dateRangeType} onValueChange={(v: any) => setDateRangeType(v)}>
              <SelectTrigger className="w-full md:w-[200px]">
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
                      "w-full md:w-[300px] justify-start text-left font-normal",
                      !customRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {customRange?.from ? (
                        customRange.to ? (
                          <>
                            {format(customRange.from, "LLL dd")} - {format(customRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(customRange.from, "LLL dd, y")
                        )
                      ) : (
                        "Pick a date range"
                      )}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customRange?.from}
                    selected={customRange as any}
                    onSelect={(range: any) => setCustomRange(range)}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            )}
          </CardContent>
        </Card>

        {/* Reports Tabs */}
        <Tabs defaultValue="stock" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="grid w-full min-w-[500px] md:min-w-0 grid-cols-4">
              <TabsTrigger value="stock" className="text-xs md:text-sm px-2">Stock</TabsTrigger>
              <TabsTrigger value="sales" className="text-xs md:text-sm px-2">Sales</TabsTrigger>
              <TabsTrigger value="attendance" className="text-xs md:text-sm px-2">Attendance</TabsTrigger>
              <TabsTrigger value="breakage" className="text-xs md:text-sm px-2">Breakage</TabsTrigger>
            </TabsList>
          </div>

          {/* Stock Report Matrix */}
          <TabsContent value="stock">
            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0 pb-3">
                <CardTitle className="text-base md:text-xl">Stock Movement</CardTitle>
                <Button onClick={exportStockReport} variant="outline" size="sm" className="w-full md:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-8 text-center text-sm">Loading...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background z-20 border-r font-semibold min-w-[100px] md:min-w-[150px] text-xs">Item</TableHead>
                          <TableHead className="sticky left-[100px] md:left-[150px] bg-background z-20 border-r font-semibold min-w-[70px] md:min-w-[100px] text-xs">Cat</TableHead>
                          <TableHead className="sticky left-[170px] md:left-[250px] bg-background z-20 border-r font-semibold min-w-[50px] md:min-w-[80px] text-xs">Unit</TableHead>
                          {getStockMatrix().dates.map((date) => (
                            <TableHead key={date.toISOString()} className="text-center border-r min-w-[70px] md:min-w-[100px] font-semibold">
                              <div className="text-xs">{format(date, "dd/MM")}</div>
                              <div className="text-[9px] text-muted-foreground font-normal hidden md:block">{format(date, "EEE")}</div>
                            </TableHead>
                          ))}
                          <TableHead className="sticky right-0 bg-background z-20 border-l font-semibold text-center min-w-[70px] md:min-w-[100px] text-xs">Now</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getStockMatrix().items.map((item, idx) => {
                          const currentStock = stockData.find(s => s.item_name === item.name);
                          return (
                            <TableRow key={idx}>
                              <TableCell className="sticky left-0 bg-background z-10 border-r font-medium text-xs">{item.name}</TableCell>
                              <TableCell className="sticky left-[100px] md:left-[150px] bg-background z-10 border-r capitalize text-xs truncate">{item.category.replace('_', ' ')}</TableCell>
                              <TableCell className="sticky left-[170px] md:left-[250px] bg-background z-10 border-r text-xs">{item.unit}</TableCell>
                              {getStockMatrix().dates.map((date) => (
                                <TableCell key={date.toISOString()} className="text-center border-r text-muted-foreground text-xs">
                                  -
                                </TableCell>
                              ))}
                              <TableCell className="sticky right-0 bg-background z-10 border-l text-center font-semibold text-xs">
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
                <CardTitle className="text-base md:text-xl">Sales Summary</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs min-w-[100px]">Date</TableHead>
                      <TableHead className="text-xs min-w-[120px]">Category</TableHead>
                      <TableHead className="text-right text-xs min-w-[80px]">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesData.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-xs">{format(new Date(sale.report_date), "MMM dd")}</TableCell>
                        <TableCell className="text-xs truncate max-w-[150px]">{(sale as any).venue_hookah_categories?.category_name || "N/A"}</TableCell>
                        <TableCell className="text-right font-medium text-xs">{sale.quantity_sold}</TableCell>
                      </TableRow>
                    ))}
                    {salesData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-8">No sales data</TableCell>
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
                <CardTitle className="text-base md:text-xl">Attendance</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs min-w-[100px]">Employee</TableHead>
                      <TableHead className="text-xs min-w-[110px]">Check In</TableHead>
                      <TableHead className="text-xs min-w-[110px] hidden md:table-cell">Check Out</TableHead>
                      <TableHead className="text-xs min-w-[60px] text-center">Done</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-xs font-medium">{(record as any).profiles?.full_name || "N/A"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{format(new Date(record.check_in_time), "MMM dd, hh:mm a")}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap hidden md:table-cell">{record.check_out_time ? format(new Date(record.check_out_time), "hh:mm a") : "-"}</TableCell>
                        <TableCell className="text-xs text-center">{record.tasks_completed ? "✓" : "-"}</TableCell>
                      </TableRow>
                    ))}
                    {attendanceData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-8">No attendance data</TableCell>
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
                <CardTitle className="text-base md:text-xl">Breakage Reports</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs min-w-[90px]">Date</TableHead>
                      <TableHead className="text-xs min-w-[100px]">Item</TableHead>
                      <TableHead className="text-right text-xs min-w-[50px]">Qty</TableHead>
                      <TableHead className="text-xs min-w-[150px] hidden md:table-cell">Cause</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakageData.map((breakage) => (
                      <TableRow key={breakage.id}>
                        <TableCell className="text-xs whitespace-nowrap">{format(new Date(breakage.created_at), "MMM dd")}</TableCell>
                        <TableCell className="text-xs">{breakage.item_type}</TableCell>
                        <TableCell className="text-right font-medium text-xs">{breakage.quantity}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate hidden md:table-cell">{breakage.cause}</TableCell>
                      </TableRow>
                    ))}
                    {breakageData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-8">No breakage reports</TableCell>
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
