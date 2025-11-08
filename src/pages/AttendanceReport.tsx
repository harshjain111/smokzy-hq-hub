import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, MapPin, Image as ImageIcon } from "lucide-react";
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
import PageLayout from "@/components/PageLayout";

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

        const [profilesRes, venuesRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", userIds),
          supabase.from("venues").select("id, name").in("id", venueIds),
          supabase.from("user_roles").select("user_id, role, venue_id").in("user_id", userIds),
        ]);

        const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]) || []);
        const venuesMap = new Map(venuesRes.data?.map(v => [v.id, v]) || []);
        const rolesMap = new Map(rolesRes.data?.map(r => [r.user_id, r]) || []);

        // Create signed URLs for private bucket images
        const enrichedData = await Promise.all(attendanceRecords.map(async (record) => {
          // Extract file path from URL (remove the base URL part)
          const extractPath = (url: string | null) => {
            if (!url) return null;
            const match = url.match(/\/attendance-photos\/(.+)$/);
            return match ? match[1] : null;
          };

          const checkInPath = extractPath(record.check_in_selfie_url);
          const checkOutPath = extractPath(record.check_out_selfie_url);

          const checkInUrl = checkInPath
            ? (await supabase.storage.from('attendance-photos').createSignedUrl(checkInPath, 3600)).data?.signedUrl
            : null;
          const checkOutUrl = checkOutPath
            ? (await supabase.storage.from('attendance-photos').createSignedUrl(checkOutPath, 3600)).data?.signedUrl
            : null;

          return {
            ...record,
            profiles: profilesMap.get(record.user_id) || null,
            venues: venuesMap.get(record.venue_id) || null,
            user_role: rolesMap.get(record.user_id) || null,
            check_in_signed_url: checkInUrl,
            check_out_signed_url: checkOutUrl,
          };
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

  const isLateCheckIn = (checkInTime: string) => {
    const checkIn = new Date(checkInTime);
    const hour = checkIn.getHours();
    const minute = checkIn.getMinutes();
    // Consider late if after 12:00 PM (noon)
    return hour > 12 || (hour === 12 && minute > 0);
  };

  const isEarlyCheckOut = (checkOutTime: string | null) => {
    if (!checkOutTime) return false;
    const checkOut = new Date(checkOutTime);
    const hour = checkOut.getHours();
    // Consider early if before 8:00 PM (20:00)
    return hour < 20;
  };

  const getDateColumns = () => {
    const range = getDateRange();
    const dates: Date[] = [];
    const current = new Date(range.from);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    // Only show dates up to today
    const endDate = range.to > today ? today : range.to;
    
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };

  const getEmployeeAttendanceMatrix = () => {
    // Group attendance by employee
    const employeeMap = new Map<string, {
      employee: any;
      venue: any;
      role: any;
      attendanceByDate: Map<string, any>;
    }>();

    attendanceData.forEach(record => {
      if (!employeeMap.has(record.user_id)) {
        employeeMap.set(record.user_id, {
          employee: record.profiles,
          venue: record.venues,
          role: (record as any).user_role,
          attendanceByDate: new Map(),
        });
      }
      
      const dateKey = format(new Date(record.check_in_time), "yyyy-MM-dd");
      employeeMap.get(record.user_id)!.attendanceByDate.set(dateKey, record);
    });

    return Array.from(employeeMap.values());
  };

  const getTotalWorkingHours = (employeeData: any) => {
    let totalMinutes = 0;
    employeeData.attendanceByDate.forEach((record: any) => {
      if (record.check_out_time) {
        const diff = new Date(record.check_out_time).getTime() - new Date(record.check_in_time).getTime();
        totalMinutes += diff / (1000 * 60);
      }
    });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    return `${hours}h ${minutes}m`;
  };

  const getAverageWorkingHours = (employeeData: any) => {
    let totalMinutes = 0;
    let daysWithCheckout = 0;
    employeeData.attendanceByDate.forEach((record: any) => {
      if (record.check_out_time) {
        const diff = new Date(record.check_out_time).getTime() - new Date(record.check_in_time).getTime();
        totalMinutes += diff / (1000 * 60);
        daysWithCheckout++;
      }
    });
    if (daysWithCheckout === 0) return "N/A";
    const avgMinutes = totalMinutes / daysWithCheckout;
    const hours = Math.floor(avgMinutes / 60);
    const minutes = Math.floor(avgMinutes % 60);
    return `${hours}h ${minutes}m`;
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
    <PageLayout title="Attendance Report" subtitle="View and analyze attendance records">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-3">
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
            <TabsTrigger value="hours" className="data-[state=active]:border-b-2 data-[state=active]:border-primary text-xs md:text-sm py-2">Working Hours</TabsTrigger>
          </TabsList>

          {/* Summary Report - P/A Matrix */}
          <TabsContent value="summary" className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Total Days Present</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{getDaysPresent()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Total Records</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{attendanceData.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Tasks Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
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
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Unique Employees</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{getEmployeeAttendanceMatrix().length}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-8 text-center">Loading...</div>
                  ) : attendanceData.length === 0 ? (
                    <div className="p-8 text-center">No records found</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-background z-20 text-xs md:text-sm whitespace-nowrap border-r font-semibold">ID</TableHead>
                            <TableHead className="sticky left-[50px] md:left-[60px] bg-background z-20 text-xs md:text-sm whitespace-nowrap border-r font-semibold min-w-[120px]">Name</TableHead>
                            {getDateColumns().map((date) => (
                              <TableHead key={date.toISOString()} className="text-xs md:text-sm text-center border-r min-w-[80px] font-semibold">
                                <div>{format(date, "dd-MM")}</div>
                                <div className="text-[10px] md:text-xs text-muted-foreground font-normal">{format(date, "EEE")}</div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getEmployeeAttendanceMatrix().map((employeeData, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="sticky left-0 bg-background z-10 text-xs md:text-sm border-r font-medium">{idx + 1}</TableCell>
                              <TableCell className="sticky left-[50px] md:left-[60px] bg-background z-10 text-xs md:text-sm whitespace-nowrap border-r font-medium">
                                {employeeData.employee?.full_name || "N/A"}
                              </TableCell>
                              {getDateColumns().map((date) => {
                                const dateKey = format(date, "yyyy-MM-dd");
                                const attendance = employeeData.attendanceByDate.get(dateKey);
                                
                                return (
                                  <TableCell key={dateKey} className="text-center border-r p-2">
                                    <span className={cn(
                                      "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded text-xs md:text-sm font-bold",
                                      attendance 
                                        ? "bg-green-100 text-green-800" 
                                        : "bg-red-100 text-red-800"
                                    )}>
                                      {attendance ? "P" : "A"}
                                    </span>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Daily Punching Report - Matrix Format */}
          <TabsContent value="daily">
            <Card>
              <CardContent className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-8 text-center">Loading...</div>
                  ) : attendanceData.length === 0 ? (
                    <div className="p-8 text-center">No records found</div>
                  ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-background z-20 text-xs md:text-sm whitespace-nowrap border-r font-semibold w-[40px] md:w-[50px]">ID</TableHead>
                            <TableHead className="sticky left-[40px] md:left-[50px] bg-background z-20 text-xs md:text-sm whitespace-nowrap border-r font-semibold w-[120px] md:w-[150px]">Name</TableHead>
                            <TableHead className="sticky left-[160px] md:left-[200px] bg-background z-20 text-xs md:text-sm whitespace-nowrap border-r font-semibold hidden sm:table-cell w-[100px] md:w-[120px]">Venue</TableHead>
                            
                            {getDateColumns().map((date) => (
                              <TableHead key={date.toISOString()} className="text-xs md:text-sm text-center border-r min-w-[100px] md:min-w-[120px] font-semibold">
                                <div>{format(date, "dd-MM-yyyy")}</div>
                                <div className="text-[10px] md:text-xs text-muted-foreground font-normal">{format(date, "EEEE")}</div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getEmployeeAttendanceMatrix().map((employeeData, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="sticky left-0 bg-background z-10 text-xs md:text-sm border-r font-medium w-[40px] md:w-[50px]">{idx + 1}</TableCell>
                              <TableCell className="sticky left-[40px] md:left-[50px] bg-background z-10 text-xs md:text-sm whitespace-nowrap border-r font-medium w-[120px] md:w-[150px]">
                                {employeeData.employee?.full_name || "N/A"}
                              </TableCell>
                              <TableCell className="sticky left-[160px] md:left-[200px] bg-background z-10 text-xs md:text-sm whitespace-nowrap border-r hidden sm:table-cell w-[100px] md:w-[120px]">
                                {employeeData.venue?.name || "N/A"}
                              </TableCell>
                            {getDateColumns().map((date, idx) => {
                              const dateKey = format(date, "yyyy-MM-dd");
                              const attendance = employeeData.attendanceByDate.get(dateKey);
                              
                              if (!attendance) {
                                return (
                                  <TableCell key={dateKey} className="text-center text-xs md:text-sm border-r">
                                    -
                                  </TableCell>
                                );
                              }

                              const isLate = isLateCheckIn(attendance.check_in_time);
                              const isEarly = isEarlyCheckOut(attendance.check_out_time);

                              return (
                                <TableCell key={dateKey} className="text-center border-r p-2">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-center gap-1 text-[10px] md:text-xs">
                                      <span>{format(new Date(attendance.check_in_time), "hh:mm a")}</span>
                                      {isLate && (
                                        <span className="text-orange-500" title="Late check-in">⚠️</span>
                                      )}
                                    </div>
                                    {attendance.check_out_time && (
                                      <div className="flex items-center justify-center gap-1 text-[10px] md:text-xs text-muted-foreground">
                                        <span>{format(new Date(attendance.check_out_time), "hh:mm a")}</span>
                                        {isEarly && (
                                          <span className="text-orange-500" title="Early check-out">⚠️</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Images & Location Report */}
          <TabsContent value="images">
            <div className="grid grid-cols-1 gap-3 md:gap-4">
              {loading ? (
                <div className="p-8 text-center">Loading...</div>
              ) : attendanceData.length === 0 ? (
                <div className="p-8 text-center">No records found</div>
              ) : (
                attendanceData.map((record) => {
                  // Use signed URLs created during fetch
                  const checkInImageUrl = (record as any).check_in_signed_url || null;
                  const checkOutImageUrl = (record as any).check_out_signed_url || null;

                  return (
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
                          {checkInImageUrl && (
                            <img
                              src={checkInImageUrl}
                              alt="Check in"
                              className="w-full h-32 md:h-40 object-cover rounded border"
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">No Image</text></svg>';
                              }}
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
                          {checkOutImageUrl ? (
                            <>
                              <img
                                src={checkOutImageUrl}
                                alt="Check out"
                                className="w-full h-32 md:h-40 object-cover rounded border"
                                onError={(e) => {
                                  e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">No Image</text></svg>';
                                }}
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
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Working Hours Report - Matrix Format */}
          <TabsContent value="hours">
            <Card>
              <CardContent className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-8 text-center">Loading...</div>
                  ) : attendanceData.length === 0 ? (
                    <div className="p-8 text-center">No records found</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background z-20 text-xs md:text-sm whitespace-nowrap border-r font-semibold w-[40px] md:w-[50px]">ID</TableHead>
                          <TableHead className="sticky left-[40px] md:left-[50px] bg-background z-20 text-xs md:text-sm whitespace-nowrap border-r font-semibold w-[120px] md:w-[150px]">Name</TableHead>
                          <TableHead className="sticky left-[160px] md:left-[200px] bg-background z-20 text-xs md:text-sm whitespace-nowrap border-r font-semibold hidden sm:table-cell w-[100px] md:w-[120px]">Venue</TableHead>
                          {getDateColumns().map((date) => (
                            <TableHead key={date.toISOString()} className="text-xs md:text-sm text-center border-r min-w-[80px] font-semibold">
                              <div>{format(date, "dd-MM")}</div>
                              <div className="text-[10px] md:text-xs text-muted-foreground font-normal">{format(date, "EEE")}</div>
                            </TableHead>
                          ))}
                          <TableHead className="sticky right-0 bg-background z-20 text-xs md:text-sm text-center border-l font-semibold w-[100px]">Total</TableHead>
                          <TableHead className="sticky right-[100px] bg-background z-20 text-xs md:text-sm text-center border-l font-semibold w-[100px] hidden md:table-cell">Avg/Day</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getEmployeeAttendanceMatrix().map((employeeData, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="sticky left-0 bg-background z-10 text-xs md:text-sm border-r font-medium w-[40px] md:w-[50px]">{idx + 1}</TableCell>
                            <TableCell className="sticky left-[40px] md:left-[50px] bg-background z-10 text-xs md:text-sm whitespace-nowrap border-r font-medium w-[120px] md:w-[150px]">
                              {employeeData.employee?.full_name || "N/A"}
                            </TableCell>
                            <TableCell className="sticky left-[160px] md:left-[200px] bg-background z-10 text-xs md:text-sm whitespace-nowrap border-r hidden sm:table-cell w-[100px] md:w-[120px]">
                              {employeeData.venue?.name || "N/A"}
                            </TableCell>
                            {getDateColumns().map((date) => {
                              const dateKey = format(date, "yyyy-MM-dd");
                              const attendance = employeeData.attendanceByDate.get(dateKey);
                              
                              if (!attendance || !attendance.check_out_time) {
                                return (
                                  <TableCell key={dateKey} className="text-center text-xs md:text-sm border-r">
                                    -
                                  </TableCell>
                                );
                              }

                              const hours = calculateWorkingHours(attendance.check_in_time, attendance.check_out_time);
                              return (
                                <TableCell key={dateKey} className="text-center text-xs md:text-sm border-r">
                                  {hours}
                                </TableCell>
                              );
                            })}
                            <TableCell className="sticky right-0 bg-background z-10 text-center text-xs md:text-sm border-l font-semibold">
                              {getTotalWorkingHours(employeeData)}
                            </TableCell>
                            <TableCell className="sticky right-[100px] bg-background z-10 text-center text-xs md:text-sm border-l font-semibold hidden md:table-cell">
                              {getAverageWorkingHours(employeeData)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};
