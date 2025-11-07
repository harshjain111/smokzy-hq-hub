import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Clock, CheckCircle, Package, TrendingUp, Camera } from "lucide-react";
import { format } from "date-fns";

interface EmployeeActivityReportProps {
  venueId?: string;
}

interface EmployeeActivity {
  employee_id: string;
  employee_name: string;
  venue_name: string;
  is_on_duty: boolean;
  check_in_time: string | null;
  stock_updates_count: number;
  sales_reports_count: number;
  closing_photo_uploaded: boolean;
  tasks_completed: boolean;
  last_activity: string;
  activity_type: string;
}

const EmployeeActivityReport = ({ venueId }: EmployeeActivityReportProps) => {
  const [activities, setActivities] = useState<EmployeeActivity[]>([]);
  const [selectedVenueFilter, setSelectedVenueFilter] = useState<string>(venueId || "all");
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVenues();
  }, []);

  useEffect(() => {
    fetchEmployeeActivities();
  }, [selectedVenueFilter]);

  const fetchVenues = async () => {
    const { data } = await supabase
      .from("venues")
      .select("id, name")
      .order("name");

    if (data) {
      setVenues(data);
    }
  };

  const fetchEmployeeActivities = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    
    // Get all employees
    const { data: employeeRoles } = await supabase
      .from("user_roles")
      .select("user_id, venue_id")
      .eq("role", "employee");

    if (!employeeRoles) {
      setLoading(false);
      return;
    }

    const employeeActivities: EmployeeActivity[] = [];

    for (const role of employeeRoles) {
      // Filter by venue if specified
      if (selectedVenueFilter !== "all" && role.venue_id !== selectedVenueFilter) {
        continue;
      }

      // Get employee profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", role.user_id)
        .single();

      // Get venue name
      const { data: venue } = await supabase
        .from("venues")
        .select("name")
        .eq("id", role.venue_id)
        .single();

      // Get attendance
      const { data: attendance } = await supabase
        .from("attendance")
        .select("check_in_time, check_out_time, tasks_completed")
        .eq("user_id", role.user_id)
        .eq("venue_id", role.venue_id)
        .gte("check_in_time", `${today}T00:00:00`)
        .maybeSingle();

      // Count stock updates today
      const { data: stockUpdates } = await supabase
        .from("stock")
        .select("id, updated_at")
        .eq("venue_id", role.venue_id)
        .gte("updated_at", `${today}T00:00:00`);

      // Count sales reports today
      const { data: salesReports } = await supabase
        .from("sales_reports")
        .select("id, created_at")
        .eq("venue_id", role.venue_id)
        .eq("reported_by", role.user_id)
        .eq("report_date", today);

      // Check closing photo
      const { data: closingPhoto } = await supabase
        .from("closing_photos")
        .select("id, created_at")
        .eq("venue_id", role.venue_id)
        .eq("uploaded_by", role.user_id)
        .eq("photo_date", today)
        .maybeSingle();

      // Determine last activity
      const activities = [
        { type: "Stock Update", time: stockUpdates?.[0]?.updated_at },
        { type: "Sales Report", time: salesReports?.[0]?.created_at },
        { type: "Closing Photo", time: closingPhoto?.created_at },
        { type: "Check In", time: attendance?.check_in_time },
      ].filter(a => a.time);

      const lastActivity = activities.sort((a, b) => 
        new Date(b.time!).getTime() - new Date(a.time!).getTime()
      )[0];

      employeeActivities.push({
        employee_id: role.user_id,
        employee_name: profile?.full_name || "Unknown",
        venue_name: venue?.name || "Unknown",
        is_on_duty: !!attendance && !attendance.check_out_time,
        check_in_time: attendance?.check_in_time || null,
        stock_updates_count: stockUpdates?.length || 0,
        sales_reports_count: salesReports?.length || 0,
        closing_photo_uploaded: !!closingPhoto,
        tasks_completed: attendance?.tasks_completed || false,
        last_activity: lastActivity?.time || "No activity",
        activity_type: lastActivity?.type || "None",
      });
    }

    setActivities(employeeActivities);
    setLoading(false);
  };

  const onDutyEmployees = activities.filter(a => a.is_on_duty);
  const activeEmployees = activities.filter(a => a.last_activity !== "No activity");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Employee Activity Report</h2>
          <p className="text-sm text-muted-foreground">Track employee performance and activities</p>
        </div>
        {!venueId && (
          <Select value={selectedVenueFilter} onValueChange={setSelectedVenueFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All Venues</SelectItem>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-success">On Duty Now</CardTitle>
            <CardDescription>Currently working</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-success">{onDutyEmployees.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Today</CardTitle>
            <CardDescription>Performed activities</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{activeEmployees.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks Completed</CardTitle>
            <CardDescription>All tasks done</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">
              {activities.filter(a => a.tasks_completed).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Detailed Activity Log
          </CardTitle>
          <CardDescription>Real-time employee activities and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead className="text-center">
                  <Package className="h-4 w-4 inline mr-1" />
                  Stock
                </TableHead>
                <TableHead className="text-center">
                  <TrendingUp className="h-4 w-4 inline mr-1" />
                  Sales
                </TableHead>
                <TableHead className="text-center">
                  <Camera className="h-4 w-4 inline mr-1" />
                  Photo
                </TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => (
                <TableRow key={activity.employee_id}>
                  <TableCell className="font-medium">{activity.employee_name}</TableCell>
                  <TableCell>{activity.venue_name}</TableCell>
                  <TableCell>
                    {activity.is_on_duty ? (
                      <Badge variant="outline" className="text-success border-success">
                        <Clock className="h-3 w-3 mr-1" />
                        On Duty
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Off Duty
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {activity.check_in_time 
                      ? format(new Date(activity.check_in_time), "hh:mm a")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={activity.stock_updates_count > 0 ? "default" : "outline"}>
                      {activity.stock_updates_count}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={activity.sales_reports_count > 0 ? "default" : "outline"}>
                      {activity.sales_reports_count}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {activity.closing_photo_uploaded ? (
                      <CheckCircle className="h-4 w-4 text-success inline" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{activity.activity_type}</span>
                      <span className="text-xs text-muted-foreground">
                        {activity.last_activity !== "No activity" 
                          ? format(new Date(activity.last_activity), "hh:mm a")
                          : "No activity"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {activity.tasks_completed ? (
                      <Badge variant="outline" className="text-success border-success">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {activities.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No employee activities found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeActivityReport;
