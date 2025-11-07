import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface AttendanceRecord {
  id: string;
  user_id: string;
  venue_id: string;
  check_in_time: string;
  check_out_time: string | null;
  tasks_completed: boolean;
  full_name: string;
  venue_name: string;
}

const AttendanceOverview = () => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    
    const { data: attendanceData, error } = await supabase
      .from("attendance")
      .select("*")
      .gte("check_in_time", today)
      .order("check_in_time", { ascending: false });

    if (!error && attendanceData) {
      const enrichedData = await Promise.all(
        attendanceData.map(async (record) => {
          const [profileResult, venueResult] = await Promise.all([
            supabase.from("profiles").select("full_name").eq("id", record.user_id).single(),
            supabase.from("venues").select("name").eq("id", record.venue_id).single(),
          ]);

          return {
            ...record,
            full_name: profileResult.data?.full_name || "Unknown",
            venue_name: venueResult.data?.name || "Unknown",
          };
        })
      );
      setAttendance(enrichedData);
    }
    setLoading(false);
  };

  const activeEmployees = attendance.filter(a => !a.check_out_time).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold">Today's Attendance</h2>
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          {activeEmployees} Active
        </Badge>
      </div>

      <div className="grid gap-4">
        {attendance.map((record) => (
          <Card key={record.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{record.full_name}</CardTitle>
                  <CardDescription>{record.venue_name}</CardDescription>
                </div>
                {record.check_out_time ? (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Completed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    On Duty
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Check In</p>
                  <p className="font-medium">{format(new Date(record.check_in_time), "hh:mm a")}</p>
                </div>
                {record.check_out_time && (
                  <div>
                    <p className="text-muted-foreground">Check Out</p>
                    <p className="font-medium">{format(new Date(record.check_out_time), "hh:mm a")}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-muted-foreground">Tasks Status</p>
                  <div className="flex items-center gap-1 mt-1">
                    {record.tasks_completed ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-success font-medium">All tasks completed</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-warning" />
                        <span className="text-warning font-medium">Tasks pending</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {attendance.length === 0 && !loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No attendance records for today</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AttendanceOverview;