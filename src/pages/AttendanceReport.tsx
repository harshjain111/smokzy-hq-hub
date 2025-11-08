import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar as CalendarIcon, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format, differenceInHours, differenceInMinutes, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface AttendanceRecord {
  id: string;
  check_in_time: string;
  check_out_time: string | null;
  check_in_selfie_url: string;
  check_out_selfie_url: string | null;
  tasks_completed: boolean;
  venue_id: string;
}

const AttendanceReport = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceDates, setAttendanceDates] = useState<Date[]>([]);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user && selectedDate) {
      fetchAttendanceData();
    }
  }, [user, selectedDate]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchAttendanceData = async () => {
    if (!user || !selectedDate) return;

    setLoading(true);
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("check_in_time", monthStart.toISOString())
      .lte("check_in_time", monthEnd.toISOString())
      .order("check_in_time", { ascending: false });

    if (error) {
      toast.error("Failed to fetch attendance data");
      console.error(error);
    } else {
      setAttendanceRecords(data || []);
      
      // Extract dates with attendance
      const dates = (data || []).map(record => new Date(record.check_in_time));
      setAttendanceDates(dates);
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
              <p className="text-muted-foreground">View your attendance history and statistics</p>
            </div>
          </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Select Month
              </CardTitle>
              <CardDescription>View attendance for specific dates</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
                modifiers={{
                  attended: attendanceDates
                }}
                modifiersStyles={{
                  attended: {
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
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
                {selectedDate && `Showing records for ${format(selectedDate, "MMMM yyyy")}`}
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
