import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar as CalendarIcon, Clock, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { format, differenceInHours, differenceInMinutes, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, eachWeekOfInterval, addMonths } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";

interface AttendanceRecord {
  id: string;
  check_in_time: string;
  check_out_time: string | null;
  check_in_selfie_url: string;
  check_out_selfie_url: string | null;
  tasks_completed: boolean;
  venue_id: string;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const AttendanceReport = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [presentDates, setPresentDates] = useState<Date[]>([]);
  const [absentDates, setAbsentDates] = useState<Date[]>([]);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user && dateRange.from && dateRange.to) {
      fetchAttendanceData();
    }
  }, [user, dateRange]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchAttendanceData = async () => {
    if (!user || !dateRange.from || !dateRange.to) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("check_in_time", dateRange.from.toISOString())
      .lte("check_in_time", dateRange.to.toISOString())
      .order("check_in_time", { ascending: false });

    if (error) {
      toast.error("Failed to fetch attendance data");
      console.error(error);
    } else {
      setAttendanceRecords(data || []);
      
      // Get all days in range
      const allDays = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      
      // Extract dates with attendance (present)
      const present = (data || [])
        .filter(r => r.check_out_time)
        .map(record => new Date(record.check_in_time));
      setPresentDates(present);
      
      // Calculate absent dates (excluding weekends/future dates)
      const today = new Date();
      const absent = allDays.filter(day => {
        const isPast = day <= today;
        const isNotPresent = !present.some(p => isSameDay(p, day));
        const isWeekday = day.getDay() !== 0 && day.getDay() !== 6; // Exclude weekends
        return isPast && isNotPresent && isWeekday;
      });
      setAbsentDates(absent);
    }
    setLoading(false);
  };

  const calculateWorkingHours = (checkIn: string, checkOut: string | null) => {
    if (!checkOut) return "In Progress";
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const hours = differenceInHours(end, start);
    const minutes = differenceInMinutes(end, start) % 60;
    
    return `${hours}h ${minutes}m`;
  };

  const calculateTotalHours = () => {
    let totalMinutes = 0;
    attendanceRecords.forEach(record => {
      if (record.check_out_time) {
        const start = new Date(record.check_in_time);
        const end = new Date(record.check_out_time);
        totalMinutes += differenceInMinutes(end, start);
      }
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const getDaysPresent = () => {
    return attendanceRecords.filter(r => r.check_out_time).length;
  };

  const getTaskCompletionRate = () => {
    if (attendanceRecords.length === 0) return "0%";
    const completed = attendanceRecords.filter(r => r.tasks_completed).length;
    return `${Math.round((completed / attendanceRecords.length) * 100)}%`;
  };

  const getWeeklyHoursData = () => {
    if (!dateRange.from || !dateRange.to) return [];
    
    const weeks = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to });
    
    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const weekRecords = attendanceRecords.filter(record => {
        const recordDate = new Date(record.check_in_time);
        return recordDate >= weekStart && recordDate <= weekEnd;
      });
      
      const totalMinutes = weekRecords.reduce((acc, record) => {
        if (record.check_out_time) {
          return acc + differenceInMinutes(new Date(record.check_out_time), new Date(record.check_in_time));
        }
        return acc;
      }, 0);
      
      return {
        week: format(weekStart, "MMM dd"),
        hours: Math.round((totalMinutes / 60) * 10) / 10,
        days: weekRecords.filter(r => r.check_out_time).length
      };
    });
  };

  const getMonthlyComparisonData = () => {
    const months = [];
    for (let i = 2; i >= 0; i--) {
      const monthDate = addMonths(new Date(), -i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      const monthRecords = attendanceRecords.filter(record => {
        const recordDate = new Date(record.check_in_time);
        return recordDate >= monthStart && recordDate <= monthEnd;
      });
      
      const totalMinutes = monthRecords.reduce((acc, record) => {
        if (record.check_out_time) {
          return acc + differenceInMinutes(new Date(record.check_out_time), new Date(record.check_in_time));
        }
        return acc;
      }, 0);
      
      months.push({
        month: format(monthDate, "MMM yyyy"),
        hours: Math.round((totalMinutes / 60) * 10) / 10,
        days: monthRecords.filter(r => r.check_out_time).length
      });
    }
    
    return months;
  };

  const getDailyTrendData = () => {
    return attendanceRecords
      .filter(r => r.check_out_time)
      .map(record => ({
        date: format(new Date(record.check_in_time), "MMM dd"),
        hours: Math.round((differenceInMinutes(new Date(record.check_out_time!), new Date(record.check_in_time)) / 60) * 10) / 10
      }))
      .reverse()
      .slice(-14); // Last 14 days
  };


  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Attendance Report</h1>
              <p className="text-muted-foreground">View your attendance history and analytics</p>
            </div>
          </div>
          
          {/* Date Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
                    }}
                  >
                    This Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const lastMonth = addMonths(new Date(), -1);
                      setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
                    }}
                  >
                    Last Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const threeMonthsAgo = addMonths(new Date(), -3);
                      setDateRange({ from: startOfMonth(threeMonthsAgo), to: new Date() });
                    }}
                  >
                    Last 3 Months
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{calculateTotalHours()}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Days Present</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{getDaysPresent()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{attendanceRecords.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Task Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{getTaskCompletionRate()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Working Hours Trend
              </CardTitle>
              <CardDescription>Last 14 days working hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={getDailyTrendData()}>
                  <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Area type="monotone" dataKey="hours" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorHours)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Weekly Hours */}
          <Card>
            <CardHeader>
              <CardTitle>Average Weekly Hours</CardTitle>
              <CardDescription>Working hours by week</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={getWeeklyHoursData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Comparison */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Monthly Comparison</CardTitle>
              <CardDescription>Compare hours and days worked across months</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getMonthlyComparisonData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={2} name="Total Hours" />
                  <Line yAxisId="right" type="monotone" dataKey="days" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Days Present" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Attendance Calendar
              </CardTitle>
              <CardDescription>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--primary))" }}></div>
                    <span>Present</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-destructive"></div>
                    <span>Absent</span>
                  </div>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
                modifiers={{
                  present: presentDates,
                  absent: absentDates
                }}
                modifiersStyles={{
                  present: {
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    fontWeight: "bold"
                  },
                  absent: {
                    backgroundColor: "hsl(var(--destructive))",
                    color: "hsl(var(--destructive-foreground))",
                    fontWeight: "bold"
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* Attendance Records */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Attendance Records
              </CardTitle>
              <CardDescription>
                {dateRange.from && dateRange.to && 
                  `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : attendanceRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No attendance records found for this month
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {attendanceRecords.map((record) => (
                    <div
                      key={record.id}
                      className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-foreground">
                          {format(new Date(record.check_in_time), "PPP")}
                        </div>
                        <div className="flex items-center gap-2">
                          {record.tasks_completed ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Tasks Done
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Incomplete
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground mb-1">Check In</div>
                          <div className="font-medium text-foreground">
                            {format(new Date(record.check_in_time), "p")}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-muted-foreground mb-1">Check Out</div>
                          <div className="font-medium text-foreground">
                            {record.check_out_time 
                              ? format(new Date(record.check_out_time), "p")
                              : "Not checked out"
                            }
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Working Hours:</span>
                          <span className="font-semibold text-foreground">
                            {calculateWorkingHours(record.check_in_time, record.check_out_time)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AttendanceReport;
