import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, MapPin, Image as ImageIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AttendanceRecord {
  id: string;
  user_id: string;
  venue_id: string;
  check_in_time: string;
  check_out_time: string | null;
  check_in_lat: number;
  check_in_lng: number;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_in_selfie_url: string;
  check_out_selfie_url: string | null;
  tasks_completed: boolean;
  profiles: { full_name: string } | null;
  venues: { name: string } | null;
}

interface DateRange {
  from: Date;
  to: Date;
}

export default function AttendanceReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dateRangeType, setDateRangeType] = useState<"current" | "last" | "custom">("current");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchAttendanceData();

    // Setup real-time subscription
    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance'
        },
        () => {
          fetchAttendanceData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRangeType, customRange, selectedEmployee, selectedVenue]);

  const fetchFilters = async () => {
    try {
      const [employeesRes, venuesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name").order("full_name"),
        supabase.from("venues").select("id, name").order("name"),
      ]);

      if (employeesRes.data) setEmployees(employeesRes.data);
      if (venuesRes.data) setVenues(venuesRes.data);
    } catch (error) {
      console.error("Error fetching filters:", error);
      toast.error("Failed to load filters");
    }
  };

  const getDateRange = (): DateRange => {
    const now = new Date();
    if (dateRangeType === "current") {
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      };
    } else if (dateRangeType === "last") {
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0),
      };
    } else if (customRange) {
      return customRange;
    }
    return { from: now, to: now };
  };

  const fetchAttendanceData = useCallback(async () => {
    setLoading(true);
    try {
      const range = getDateRange();
      let query = supabase
        .from("attendance")
        .select("*")
        .gte("check_in_time", range.from.toISOString())
        .lte("check_in_time", range.to.toISOString())
        .order("check_in_time", { ascending: false });

      if (selectedEmployee !== "all") {
        query = query.eq("user_id", selectedEmployee);
      }

      if (selectedVenue !== "all") {
        query = query.eq("venue_id", selectedVenue);
      }

      const { data: attendanceRecords, error } = await query;

      if (error) throw error;

      // Manually fetch related profiles and venues
      if (attendanceRecords && attendanceRecords.length > 0) {
        const userIds = [...new Set(attendanceRecords.map(r => r.user_id))];
        const venueIds = [...new Set(attendanceRecords.map(r => r.venue_id))];

        const [profilesRes, venuesRes] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", userIds),
          supabase.from("venues").select("id, name").in("id", venueIds),
        ]);

        const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]) || []);
        const venuesMap = new Map(venuesRes.data?.map(v => [v.id, v]) || []);

        const enrichedData = attendanceRecords.map(record => ({
          ...record,
          profiles: profilesMap.get(record.user_id) || null,
          venues: venuesMap.get(record.venue_id) || null,
        }));

        setAttendanceData(enrichedData as any);
      } else {
        setAttendanceData([]);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast.error("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }, [dateRangeType, customRange, selectedEmployee, selectedVenue]);

  const calculateWorkingHours = (checkIn: string, checkOut: string | null) => {
    if (!checkOut) return "In Progress";
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getDaysPresent = () => {
    const uniqueDays = new Set(
      attendanceData.map((record) =>
        format(new Date(record.check_in_time), "yyyy-MM-dd")
      )
    );
    return uniqueDays.size;
  };

  const exportToCSV = () => {
    const headers = ["Date", "Employee", "Venue", "Check In", "Check Out", "Working Hours", "Tasks Completed"];
    const rows = attendanceData.map((record) => [
      format(new Date(record.check_in_time), "yyyy-MM-dd"),
      record.profiles?.full_name || "N/A",
      record.venues?.name || "N/A",
      format(new Date(record.check_in_time), "HH:mm:ss"),
      record.check_out_time ? format(new Date(record.check_out_time), "HH:mm:ss") : "N/A",
      calculateWorkingHours(record.check_in_time, record.check_out_time),
      record.tasks_completed ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold">Attendance Report</h1>
          </div>
          <Button onClick={exportToCSV} variant="outline" size="sm" className="w-full sm:w-auto">
            <Download className="mr-2 h-3 w-3 md:h-4 md:w-4" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Date Range Type */}
            <Select value={dateRangeType} onValueChange={(v: any) => setDateRangeType(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Month</SelectItem>
                <SelectItem value="last">Last Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Date Range */}
            {dateRangeType === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-sm",
                      !customRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                    {customRange?.from ? (
                      customRange.to ? (
                        <span className="truncate">
                          {format(customRange.from, "MMM dd")} - {format(customRange.to, "MMM dd, y")}
                        </span>
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
                    selected={{ from: customRange?.from, to: customRange?.to }}
                    onSelect={(range: any) => {
                      if (range?.from && range?.to) {
                        setCustomRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Employee Filter */}
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Venue Filter */}
            <Select value={selectedVenue} onValueChange={setSelectedVenue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Venues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Venues</SelectItem>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Reports Tabs */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 border-b border-border h-auto">
            <TabsTrigger value="summary" className="border-r border-border data-[state=active]:border-b-2 data-[state=active]:border-primary text-xs md:text-sm py-2">Summary</TabsTrigger>
            <TabsTrigger value="daily" className="border-r md:border-r border-border data-[state=active]:border-b-2 data-[state=active]:border-primary text-xs md:text-sm py-2">Daily Punching</TabsTrigger>
            <TabsTrigger value="images" className="border-r border-border data-[state=active]:border-b-2 data-[state=active]:border-primary text-xs md:text-sm py-2">Images</TabsTrigger>
            <TabsTrigger value="hours" className="data-[state=active]:border-b-2 data-[state=active]:border-primary text-xs md:text-sm py-2">Hours</TabsTrigger>
          </TabsList>

          {/* Summary Report */}
          <TabsContent value="summary" className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Days Present</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{getDaysPresent()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Records</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{attendanceData.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Tasks Completion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">
                    {attendanceData.length > 0
                      ? Math.round(
                          (attendanceData.filter((r) => r.tasks_completed).length /
                            attendanceData.length) *
                            100
                        )
                      : 0}
                    %
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Daily Punching Report */}
          <TabsContent value="daily">
            <Card>
              <CardContent className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap">Date</TableHead>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap">Employee</TableHead>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap hidden sm:table-cell">Venue</TableHead>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap">Check In</TableHead>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap hidden md:table-cell">Check Out</TableHead>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap hidden lg:table-cell">Hours</TableHead>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                        </TableRow>
                      ) : attendanceData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">No records found</TableCell>
                        </TableRow>
                      ) : (
                        attendanceData.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">{format(new Date(record.check_in_time), "MMM dd")}</TableCell>
                            <TableCell className="text-xs md:text-sm">{record.profiles?.full_name || "N/A"}</TableCell>
                            <TableCell className="text-xs md:text-sm hidden sm:table-cell">{record.venues?.name || "N/A"}</TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">{format(new Date(record.check_in_time), "hh:mm a")}</TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap hidden md:table-cell">
                              {record.check_out_time
                                ? format(new Date(record.check_out_time), "hh:mm a")
                                : "In Progress"}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm hidden lg:table-cell">
                              {calculateWorkingHours(record.check_in_time, record.check_out_time)}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm">
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[10px] md:text-xs whitespace-nowrap",
                                  record.tasks_completed
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                )}
                              >
                                {record.tasks_completed ? "Done" : "Pending"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Images & Location Report */}
          <TabsContent value="images">
            <div className="grid grid-cols-1 gap-3 md:gap-4">
              {loading ? (
                <p>Loading...</p>
              ) : attendanceData.length === 0 ? (
                <p>No records found</p>
              ) : (
                attendanceData.map((record) => (
                  <Card key={record.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base md:text-lg">
                        {record.profiles?.full_name || "N/A"} - {format(new Date(record.check_in_time), "MMM dd, yyyy")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 md:space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Check In */}
                        <div className="space-y-1.5 md:space-y-2">
                          <p className="font-semibold text-xs md:text-sm">Check In</p>
                          {record.check_in_selfie_url && (
                            <img
                              src={record.check_in_selfie_url}
                              alt="Check in"
                              className="w-full h-32 md:h-40 object-cover rounded border"
                            />
                          )}
                          <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                            <span className="truncate">{record.check_in_lat.toFixed(4)}, {record.check_in_lng.toFixed(4)}</span>
                          </div>
                          <p className="text-[10px] md:text-xs">{format(new Date(record.check_in_time), "hh:mm a")}</p>
                        </div>

                        {/* Check Out */}
                        <div className="space-y-1.5 md:space-y-2">
                          <p className="font-semibold text-xs md:text-sm">Check Out</p>
                          {record.check_out_selfie_url ? (
                            <>
                              <img
                                src={record.check_out_selfie_url}
                                alt="Check out"
                                className="w-full h-32 md:h-40 object-cover rounded border"
                              />
                              {record.check_out_lat && record.check_out_lng && (
                                <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground">
                                  <MapPin className="h-2.5 w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                                  <span className="truncate">{record.check_out_lat.toFixed(4)}, {record.check_out_lng.toFixed(4)}</span>
                                </div>
                              )}
                              {record.check_out_time && (
                                <p className="text-[10px] md:text-xs">{format(new Date(record.check_out_time), "hh:mm a")}</p>
                              )}
                            </>
                          ) : (
                            <div className="w-full h-32 md:h-40 flex items-center justify-center border rounded bg-muted">
                              <ImageIcon className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Working Hours Report */}
          <TabsContent value="hours">
            <Card>
              <CardContent className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap">Employee</TableHead>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap hidden sm:table-cell">Venue</TableHead>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap">Days</TableHead>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap">Total</TableHead>
                        <TableHead className="text-xs md:text-sm whitespace-nowrap hidden md:table-cell">Avg/Day</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                        </TableRow>
                      ) : attendanceData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center">No records found</TableCell>
                        </TableRow>
                      ) : (
                        (() => {
                          const groupedData = attendanceData.reduce((acc, record) => {
                            const key = `${record.user_id}-${record.venue_id}`;
                            if (!acc[key]) {
                              acc[key] = {
                                employee: record.profiles?.full_name || "N/A",
                                venue: record.venues?.name || "N/A",
                                days: 0,
                                totalMinutes: 0,
                              };
                            }
                            acc[key].days += 1;
                            if (record.check_out_time) {
                              const diff = new Date(record.check_out_time).getTime() - new Date(record.check_in_time).getTime();
                              acc[key].totalMinutes += diff / (1000 * 60);
                            }
                            return acc;
                          }, {} as Record<string, any>);

                          return Object.values(groupedData).map((data: any, idx) => {
                            const totalHours = Math.floor(data.totalMinutes / 60);
                            const avgHours = (data.totalMinutes / 60 / data.days).toFixed(1);
                            return (
                              <TableRow key={idx}>
                                <TableCell className="text-xs md:text-sm">{data.employee}</TableCell>
                                <TableCell className="text-xs md:text-sm hidden sm:table-cell">{data.venue}</TableCell>
                                <TableCell className="text-xs md:text-sm">{data.days}</TableCell>
                                <TableCell className="text-xs md:text-sm">{totalHours}h</TableCell>
                                <TableCell className="text-xs md:text-sm hidden md:table-cell">{avgHours}h</TableCell>
                              </TableRow>
                            );
                          });
                        })()
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
