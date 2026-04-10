import { useState, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Activity, 
  Users, 
  TrendingUp, 
  Clock, 
  Download,
  Calendar,
  BarChart3,
  RefreshCw,
  Loader2
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface ClubManagementDashboardProps {
  user: User;
  venueIds: string[];
}

interface Venue {
  id: string;
  name: string;
  location: string;
}

interface AttendanceBlock {
  id: string;
  user_id: string;
  check_in_time: string;
  check_out_time: string | null;
  session_id: string;
  profiles?: { full_name: string };
}

interface ActiveBreak {
  user_id: string;
  break_start_time: string;
}

interface SalesData {
  date: string;
  total: number;
}

type DateRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'this_month' | 'last_month';

const ClubManagementDashboard = ({ user, venueIds }: ClubManagementDashboardProps) => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(venueIds[0] || "");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Live status data
  const [activeSession, setActiveSession] = useState<any>(null);
  const [staffOnDuty, setStaffOnDuty] = useState<AttendanceBlock[]>([]);
  const [activeBreaks, setActiveBreaks] = useState<ActiveBreak[]>([]);
  
  // Sales data
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [todaySales, setTodaySales] = useState(0);
  const [yesterdaySales, setYesterdaySales] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch venues
  useEffect(() => {
    const fetchVenues = async () => {
      const query = supabase
        .from("venues")
        .select("id, name, location")
        .order("name");

      const { data } = venueIds.length > 0
        ? await query.in("id", venueIds)
        : await query;
      
      if (data) {
        setVenues(data);
        if (data.length > 0 && !selectedVenueId) {
          setSelectedVenueId(data[0].id);
        }
      }

      setLoading(false);
    };
    
    fetchVenues();
  }, [venueIds]);

  // Get date range for query
  const getDateRange = useCallback((range: DateRange) => {
    const now = new Date();
    switch (range) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case 'last7':
        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
      case 'last30':
        return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
      case 'this_month':
        return { start: startOfMonth(now), end: endOfDay(now) };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  }, []);

  // Fetch live status
  const fetchLiveStatus = useCallback(async () => {
    if (!selectedVenueId) {
      setActiveSession(null);
      setStaffOnDuty([]);
      setActiveBreaks([]);
      return;
    }

    const { data: sessionData } = await supabase
      .from("club_sessions")
      .select("id, started_at")
      .eq("venue_id", selectedVenueId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setActiveSession(sessionData);

    if (!sessionData) {
      setStaffOnDuty([]);
      setActiveBreaks([]);
      return;
    }

    const [{ data: attendanceData }, { data: breaksData }] = await Promise.all([
      supabase
        .from("staff_attendance_blocks")
        .select("id, user_id, check_in_time, check_out_time, session_id")
        .eq("session_id", sessionData.id)
        .eq("is_break", false),
      supabase
        .from("staff_breaks")
        .select("user_id, break_start_time")
        .eq("session_id", sessionData.id)
        .is("break_end_time", null),
    ]);

    const attendanceRows = attendanceData || [];
    setActiveBreaks(breaksData || []);

    if (attendanceRows.length === 0) {
      setStaffOnDuty([]);
      return;
    }

    const userIds = [...new Set(attendanceRows.map((attendance) => attendance.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map((profile) => [profile.id, profile.full_name]) || []);

    setStaffOnDuty(
      attendanceRows.map((attendance) => ({
        ...attendance,
        profiles: { full_name: profileMap.get(attendance.user_id) || "Unknown" },
      }))
    );
  }, [selectedVenueId]);

  // Fetch sales snapshot
  const fetchSalesSnapshot = useCallback(async () => {
    if (!selectedVenueId) {
      setTodaySales(0);
      setYesterdaySales(0);
      setMonthSales(0);
      return;
    }

    const todayRange = getDateRange('today');
    const yesterdayRange = getDateRange('yesterday');
    const monthRange = getDateRange('this_month');

    const [todayResponse, yesterdayResponse, monthResponse] = await Promise.all([
      supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", selectedVenueId)
        .gte("created_at", todayRange.start.toISOString())
        .lte("created_at", todayRange.end.toISOString()),
      supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", selectedVenueId)
        .gte("created_at", yesterdayRange.start.toISOString())
        .lte("created_at", yesterdayRange.end.toISOString()),
      supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", selectedVenueId)
        .gte("created_at", monthRange.start.toISOString())
        .lte("created_at", monthRange.end.toISOString()),
    ]);

    setTodaySales(todayResponse.data?.reduce((sum, row) => sum + row.quantity_sold, 0) || 0);
    setYesterdaySales(yesterdayResponse.data?.reduce((sum, row) => sum + row.quantity_sold, 0) || 0);
    setMonthSales(monthResponse.data?.reduce((sum, row) => sum + row.quantity_sold, 0) || 0);
  }, [selectedVenueId, getDateRange]);

  // Fetch sales report data
  const fetchSalesReport = useCallback(async () => {
    if (!selectedVenueId) return;

    const { start, end } = getDateRange(dateRange);
    
    const { data } = await supabase
      .from("sales_reports")
      .select("report_date, quantity_sold")
      .eq("venue_id", selectedVenueId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("report_date", { ascending: true });

    if (data) {
      // Group by date
      const grouped: Record<string, number> = {};
      data.forEach(row => {
        const date = row.report_date;
        grouped[date] = (grouped[date] || 0) + row.quantity_sold;
      });

      setSalesData(
        Object.entries(grouped).map(([date, total]) => ({ date, total }))
      );
    }
  }, [selectedVenueId, dateRange, getDateRange]);

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      if (!selectedVenueId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      await Promise.all([
        fetchLiveStatus(),
        fetchSalesSnapshot(),
        fetchSalesReport(),
      ]);
      setLastUpdated(new Date());
      setLoading(false);
    };

    fetchAll();
  }, [selectedVenueId, fetchLiveStatus, fetchSalesSnapshot, fetchSalesReport]);

  // Refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchLiveStatus(),
      fetchSalesSnapshot(),
      fetchSalesReport(),
    ]);
    setLastUpdated(new Date());
    setRefreshing(false);
    toast.success("Data refreshed");
  };

  // Export to Excel
  const exportToExcel = (reportType: 'daily' | 'weekly' | 'monthly' | 'custom') => {
    const venueName = venues.find(v => v.id === selectedVenueId)?.name || "Unknown";
    
    let filename = '';
    let data = salesData;
    
    switch (reportType) {
      case 'daily':
        filename = `${venueName}_Daily_Sales_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        break;
      case 'weekly':
        filename = `${venueName}_Weekly_Sales_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        break;
      case 'monthly':
        filename = `${venueName}_Monthly_Sales_${format(new Date(), 'yyyy-MM')}.xlsx`;
        break;
      case 'custom':
        filename = `${venueName}_Sales_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        break;
    }

    const worksheetData = [
      ["Date", "Total Shishas Sold"],
      ...data.map(row => [row.date, row.total]),
      ["", ""],
      ["Total", data.reduce((sum, row) => sum + row.total, 0)],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");
    XLSX.writeFile(workbook, filename);
    
    toast.success(`Report downloaded: ${filename}`);
  };

  // Get staff status
  const getStaffStatus = (staff: AttendanceBlock) => {
    if (staff.check_out_time) {
      return { label: "Checked Out", color: "bg-muted text-muted-foreground" };
    }
    const isOnBreak = activeBreaks.some(b => b.user_id === staff.user_id);
    if (isOnBreak) {
      return { label: "On Break", color: "bg-warning/20 text-warning" };
    }
    return { label: "On Duty", color: "bg-success/20 text-success" };
  };

  const selectedVenue = venues.find(v => v.id === selectedVenueId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Venue Selector & Refresh */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {venues.length > 1 && (
          <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
            <SelectTrigger className="w-full sm:w-[250px] h-12 sm:h-10">
              <SelectValue placeholder="Select venue" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {venues.map(venue => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            Updated: {format(lastUpdated, 'HH:mm:ss')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-10 sm:h-9"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Live Status Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Session Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSession ? (
              <div>
                <Badge className="bg-success/20 text-success border-success/30 mb-2">
                  Session Active
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Started: {format(new Date(activeSession.started_at), 'MMM d, h:mm a')}
                </p>
              </div>
            ) : (
              <Badge variant="secondary">No Active Session</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Staff On Duty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {staffOnDuty.filter(s => !s.check_out_time).length}
            </div>
            <p className="text-sm text-muted-foreground">
              {activeBreaks.length > 0 && `${activeBreaks.length} on break`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Session Start Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeSession 
                ? format(new Date(activeSession.started_at), 'h:mm a')
                : '--:--'
              }
            </div>
            <p className="text-sm text-muted-foreground">
              {activeSession 
                ? format(new Date(activeSession.started_at), 'MMM d, yyyy')
                : 'No session'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{todaySales}</div>
            <p className="text-sm text-muted-foreground">shishas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Yesterday's Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{yesterdaySales}</div>
            <p className="text-sm text-muted-foreground">shishas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{monthSales}</div>
            <p className="text-sm text-muted-foreground">shishas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Attendance & Sales */}
      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="w-full md:w-auto h-12 p-1">
          <TabsTrigger value="attendance" className="flex-1 md:flex-none h-10 text-sm">
            <Users className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Live </span>Attendance
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex-1 md:flex-none h-10 text-sm">
            <BarChart3 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Sales </span>Reports
          </TabsTrigger>
        </TabsList>

        {/* Live Attendance Tab */}
        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today's Staff Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              {staffOnDuty.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No staff checked in for current session
                </p>
              ) : (
                <div className="divide-y">
                  {staffOnDuty.map(staff => {
                    const status = getStaffStatus(staff);
                    return (
                      <div key={staff.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{staff.profiles?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Check-in: {format(new Date(staff.check_in_time), 'h:mm a')}
                            {staff.check_out_time && (
                              <> • Check-out: {format(new Date(staff.check_out_time), 'h:mm a')}</>
                            )}
                          </p>
                        </div>
                        <Badge className={status.color}>{status.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Reports Tab */}
        <TabsContent value="sales" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:space-y-0 pb-4">
              <CardTitle className="text-lg">Sales Report</CardTitle>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="w-full sm:w-[180px] h-11 sm:h-10">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="last7">Last 7 Days</SelectItem>
                  <SelectItem value="last30">Last 30 Days</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {salesData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No sales data for selected period
                </p>
              ) : (
                <>
                  <div className="divide-y mb-4">
                    {salesData.map(row => (
                      <div key={row.date} className="py-3 flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {format(new Date(row.date), 'EEE, MMM d, yyyy')}
                        </span>
                        <span className="font-semibold">{row.total} shishas</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t font-semibold">
                    <span>Total</span>
                    <span className="text-primary text-lg">
                      {salesData.reduce((sum, row) => sum + row.total, 0)} shishas
                    </span>
                  </div>
                </>
              )}

              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => exportToExcel('custom')}
                disabled={salesData.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Excel
              </Button>
            </CardContent>
          </Card>

          {/* Quick Downloads */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Downloads</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button variant="outline" onClick={() => {
                setDateRange('today');
                setTimeout(() => exportToExcel('daily'), 500);
              }}>
                <Download className="w-4 h-4 mr-2" />
                Daily Report
              </Button>
              <Button variant="outline" onClick={() => {
                setDateRange('last7');
                setTimeout(() => exportToExcel('weekly'), 500);
              }}>
                <Download className="w-4 h-4 mr-2" />
                Weekly Report
              </Button>
              <Button variant="outline" onClick={() => {
                setDateRange('this_month');
                setTimeout(() => exportToExcel('monthly'), 500);
              }}>
                <Download className="w-4 h-4 mr-2" />
                Monthly Report
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClubManagementDashboard;
