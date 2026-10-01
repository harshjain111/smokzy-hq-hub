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
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { CalendarIcon, Download, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import PageLayout from "@/components/PageLayout";
import { toast } from "sonner";

interface DateRange {
  from: Date;
  to: Date;
}

const VenueReports = () => {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const [venueName, setVenueName] = useState("");
  const [dateRangeType, setDateRangeType] = useState<"current" | "last" | "custom">("current");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [stockDailyData, setStockDailyData] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [breakageData, setBreakageData] = useState<any[]>([]);
  const [gramsPerChillum, setGramsPerChillum] = useState(25);
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
    if (data) setVenueName(data.name);
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

      const [stockDailyRes, salesRes, attendanceRes, breakageRes, settingsRes] = await Promise.all([
        supabase
          .from("venue_stock_daily")
          .select("*")
          .eq("venue_id", venueId)
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date", { ascending: false }),
        supabase
          .from("sales_reports")
          .select("*, venue_hookah_categories(category_name)")
          .eq("venue_id", venueId)
          .gte("report_date", fromDate)
          .lte("report_date", toDate)
          .order("report_date", { ascending: false }),
        supabase
          .from("staff_attendance_blocks")
          .select("*")
          .eq("venue_id", venueId)
          .eq("is_break", false)
          .gte("check_in_time", `${fromDate}T00:00:00`)
          .lte("check_in_time", `${toDate}T23:59:59`)
          .order("check_in_time", { ascending: false }),
        supabase
          .from("breakage_reports")
          .select("*")
          .eq("venue_id", venueId)
          .gte("created_at", `${fromDate}T00:00:00`)
          .lte("created_at", `${toDate}T23:59:59`)
          .order("created_at", { ascending: false }),
        supabase
          .from("global_settings")
          .select("value")
          .eq("key", "grams_per_chillum")
          .maybeSingle(),
      ]);

      setStockDailyData(stockDailyRes.data || []);
      setSalesData(salesRes.data || []);
      setBreakageData(breakageRes.data || []);
      if (settingsRes.data?.value) setGramsPerChillum(Number(settingsRes.data.value) || 25);

      // Fetch profile names for attendance user_ids (no FK exists)
      const rawAttendance = attendanceRes.data || [];
      if (rawAttendance.length > 0) {
        const userIds = [...new Set(rawAttendance.map((a: any) => a.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
        setAttendanceData(rawAttendance.map((a: any) => ({
          ...a,
          profiles: { full_name: profileMap.get(a.user_id) || "Unknown" },
        })));
      } else {
        setAttendanceData([]);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const exportStockCSV = () => {
    const headers = ["Date", "Closing Stock (g)"];
    const rows = stockDailyData.map(d => [
      d.date,
      d.closing_stock ?? "",
    ]);
    downloadCSV(headers, rows, `${venueName}-stock-daily`);
  };

  const exportSalesCSV = () => {
    const salesByDate = new Map<string, { total: number; categories: Record<string, number> }>();
    salesData.forEach((s: any) => {
      const dateKey = s.report_date;
      if (!salesByDate.has(dateKey)) salesByDate.set(dateKey, { total: 0, categories: {} });
      const entry = salesByDate.get(dateKey)!;
      const catName = s.venue_hookah_categories?.category_name || "Other";
      entry.categories[catName] = (entry.categories[catName] || 0) + s.quantity_sold;
      entry.total += s.quantity_sold;
    });

    const allCategories = [...new Set(salesData.map((s: any) => s.venue_hookah_categories?.category_name || "Other"))];
    const headers = ["Date", ...allCategories, "Total"];
    const rows = [...salesByDate.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => [
        date,
        ...allCategories.map(c => data.categories[c] || 0),
        data.total,
      ]);
    downloadCSV(headers, rows, `${venueName}-sales`);
  };

  const exportAttendanceCSV = () => {
    const headers = ["Date", "Employee", "Check In", "Check Out", "Hours"];
    const rows = attendanceData.map((r: any) => {
      const checkIn = new Date(r.check_in_time);
      const checkOut = r.check_out_time ? new Date(r.check_out_time) : null;
      const hours = checkOut ? ((checkOut.getTime() - checkIn.getTime()) / 3600000).toFixed(1) : "—";
      return [
        format(checkIn, "yyyy-MM-dd"),
        r.profiles?.full_name || "Unknown",
        format(checkIn, "hh:mm a"),
        checkOut ? format(checkOut, "hh:mm a") : "—",
        hours,
      ];
    });
    downloadCSV(headers, rows, `${venueName}-attendance`);
  };

  const downloadCSV = (headers: string[], rows: any[][], prefix: string) => {
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefix}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const getSalesByDate = () => {
    const grouped = new Map<string, { total: number; categories: Record<string, number> }>();
    salesData.forEach((s: any) => {
      const dateKey = s.report_date;
      if (!grouped.has(dateKey)) grouped.set(dateKey, { total: 0, categories: {} });
      const entry = grouped.get(dateKey)!;
      const catName = s.venue_hookah_categories?.category_name || "Other";
      entry.categories[catName] = (entry.categories[catName] || 0) + s.quantity_sold;
      entry.total += s.quantity_sold;
    });
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  };

  return (
    <PageLayout title={`${venueName} — Reports`} subtitle="Monthly stock, sales & attendance reports">
      <div className="space-y-4 md:space-y-6">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
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

          {/* Stock Daily Report */}
          <TabsContent value="stock">
            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0 pb-3">
                <CardTitle className="text-base md:text-xl">Daily Stock Report</CardTitle>
                <Button onClick={exportStockCSV} variant="outline" size="sm" className="w-full md:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
                  ) : stockDailyData.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">No daily stock data for this period</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-semibold min-w-[120px]">Date</TableHead>
                          <TableHead className="text-xs text-center font-semibold min-w-[120px]">Closing Stock (g)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockDailyData.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="text-xs font-medium">
                              {format(new Date(d.date + "T00:00:00"), "dd MMM, EEE")}
                            </TableCell>
                            <TableCell className="text-xs text-center font-medium">{d.closing_stock ?? "—"}</TableCell>
                          </TableRow>
                        ))}
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
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0 pb-3">
                <CardTitle className="text-base md:text-xl">Daily Sales Report</CardTitle>
                <Button onClick={exportSalesCSV} variant="outline" size="sm" className="w-full md:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {loading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
                ) : getSalesByDate().length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No sales data for this period</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs min-w-[90px] font-semibold">Date</TableHead>
                        <TableHead className="text-xs min-w-[150px] font-semibold">Category Breakdown</TableHead>
                        <TableHead className="text-right text-xs min-w-[70px] font-semibold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getSalesByDate().map(([date, data]) => (
                        <TableRow key={date}>
                          <TableCell className="text-xs font-medium">
                            {format(new Date(date + "T00:00:00"), "dd MMM, EEE")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {Object.entries(data.categories).map(([cat, qty]) => `${cat}: ${qty}`).join(" · ")}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-xs">{data.total}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 bg-muted/50 font-semibold">
                        <TableCell className="text-xs">TOTAL</TableCell>
                        <TableCell className="text-xs"></TableCell>
                        <TableCell className="text-right text-xs font-bold">
                          {getSalesByDate().reduce((s, [, d]) => s + d.total, 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0 pb-3">
                <CardTitle className="text-base md:text-xl">Punch In / Punch Out Report</CardTitle>
                <Button onClick={exportAttendanceCSV} variant="outline" size="sm" className="w-full md:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {loading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
                ) : attendanceData.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No attendance data for this period</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs min-w-[90px] font-semibold">Date</TableHead>
                        <TableHead className="text-xs min-w-[100px] font-semibold">Employee</TableHead>
                        <TableHead className="text-xs min-w-[80px] font-semibold">Punch In</TableHead>
                        <TableHead className="text-xs min-w-[80px] font-semibold">Punch Out</TableHead>
                        <TableHead className="text-xs text-right min-w-[60px] font-semibold">Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceData.map((record: any) => {
                        const checkIn = new Date(record.check_in_time);
                        const checkOut = record.check_out_time ? new Date(record.check_out_time) : null;
                        const hours = checkOut ? ((checkOut.getTime() - checkIn.getTime()) / 3600000).toFixed(1) : null;
                        return (
                          <TableRow key={record.id}>
                            <TableCell className="text-xs font-medium">
                              {format(checkIn, "dd MMM")}
                            </TableCell>
                            <TableCell className="text-xs">{record.profiles?.full_name || "Unknown"}</TableCell>
                            <TableCell className="text-xs">{format(checkIn, "hh:mm a")}</TableCell>
                            <TableCell className="text-xs">{checkOut ? format(checkOut, "hh:mm a") : "—"}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{hours ? `${hours}h` : "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
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
                {loading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
                ) : breakageData.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No breakage reports for this period</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs min-w-[90px] font-semibold">Date</TableHead>
                        <TableHead className="text-xs min-w-[100px] font-semibold">Item</TableHead>
                        <TableHead className="text-right text-xs min-w-[50px] font-semibold">Qty</TableHead>
                        <TableHead className="text-xs min-w-[150px] hidden md:table-cell font-semibold">Cause</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakageData.map((breakage) => (
                        <TableRow key={breakage.id}>
                          <TableCell className="text-xs whitespace-nowrap">{format(new Date(breakage.created_at), "dd MMM")}</TableCell>
                          <TableCell className="text-xs">{breakage.item_type}</TableCell>
                          <TableCell className="text-right font-medium text-xs">{breakage.quantity}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate hidden md:table-cell">{breakage.cause}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default VenueReports;
