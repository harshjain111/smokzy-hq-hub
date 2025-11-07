import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface AttendanceOverviewProps {
  venueId: string;
  venueName: string;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  check_in_time: string;
  check_out_time: string | null;
  tasks_completed: boolean;
  full_name: string;
}

const AttendanceOverview = ({ venueId, venueName }: AttendanceOverviewProps) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, [venueId]);

  const fetchAttendance = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    
    const { data: attendanceData, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("venue_id", venueId)
      .gte("check_in_time", today)
      .order("check_in_time", { ascending: false });

    if (!error && attendanceData) {
      const enrichedData = await Promise.all(
        attendanceData.map(async (record) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", record.user_id)
            .single();

          return {
            ...record,
            full_name: profileData?.full_name || "Unknown",
          };
        })
      );

      setAttendance(enrichedData);
    }
    setLoading(false);
  };

  const activeEmployees = attendance.filter(record => !record.check_out_time);
  const completedShifts = attendance.filter(record => record.check_out_time);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Attendance - {venueName}</h2>
        <p className="text-sm text-muted-foreground">Today's employee attendance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-success">Active Now</CardTitle>
            <CardDescription>{activeEmployees.length} employee{activeEmployees.length !== 1 ? 's' : ''} on duty</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-success">{activeEmployees.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed Shifts</CardTitle>
            <CardDescription>{completedShifts.length} shift{completedShifts.length !== 1 ? 's' : ''} today</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{completedShifts.length}</p>
          </CardContent>
        </Card>
      </div>

      {activeEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-success" />
              Currently Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Check-in Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Tasks Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeEmployees.map((record) => {
                  const checkInTime = new Date(record.check_in_time);
                  const duration = Math.floor((new Date().getTime() - checkInTime.getTime()) / (1000 * 60 * 60));
                  
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.full_name}</TableCell>
                      <TableCell>{format(checkInTime, "hh:mm a")}</TableCell>
                      <TableCell>{duration}h {Math.floor(((new Date().getTime() - checkInTime.getTime()) / (1000 * 60)) % 60)}m</TableCell>
                      <TableCell className="text-right">
                        {record.tasks_completed ? (
                          <Badge variant="outline" className="text-success border-success">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {completedShifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Shifts Today</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedShifts.map((record) => {
                  const checkInTime = new Date(record.check_in_time);
                  const checkOutTime = record.check_out_time ? new Date(record.check_out_time) : null;
                  const duration = checkOutTime 
                    ? Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60))
                    : 0;
                  
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.full_name}</TableCell>
                      <TableCell>{format(checkInTime, "hh:mm a")}</TableCell>
                      <TableCell>{checkOutTime ? format(checkOutTime, "hh:mm a") : "-"}</TableCell>
                      <TableCell>{duration}h {checkOutTime ? Math.floor(((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60)) % 60) : 0}m</TableCell>
                      <TableCell className="text-right">
                        {record.tasks_completed ? (
                          <Badge variant="outline" className="text-success border-success">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Incomplete
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {attendance.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No attendance records for today</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceOverview;
