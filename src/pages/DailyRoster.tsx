import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, UserPlus } from "lucide-react";

interface Venue {
  id: string;
  name: string;
}

interface StaffAssignment {
  staff_id: string;
  staff_name: string;
  status: string;
  checked_in: boolean;
  check_in_time?: string;
}

const formatDate = (d: Date): string => d.toISOString().split("T")[0];

const DailyRoster = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueStaff, setVenueStaff] = useState<Map<string, StaffAssignment[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const dateStr = formatDate(selectedDate);

  useEffect(() => {
    fetchVenues();
  }, []);

  useEffect(() => {
    if (venues.length > 0) fetchDailyData();
  }, [selectedDate, venues]);

  const fetchVenues = async () => {
    const { data } = await supabase.from("venues").select("id, name").order("name");
    setVenues(data || []);
  };

  const fetchDailyData = async () => {
    setLoading(true);

    // Fetch roster assignments for this date
    const { data: roster } = await supabase
      .from("roster_assignments")
      .select("staff_id, venue_id, status")
      .eq("date", dateStr)
      .eq("status", "assigned");

    // Fetch today's attendance blocks to check who's checked in
    const todayStart = `${dateStr}T00:00:00`;
    const todayEnd = `${dateStr}T23:59:59`;
    const { data: attendance } = await supabase
      .from("staff_attendance_blocks")
      .select("user_id, check_in_time, check_out_time, venue_id")
      .gte("check_in_time", todayStart)
      .lte("check_in_time", todayEnd);

    // Fetch profiles for staff names
    const staffIds = [
      ...new Set([
        ...(roster || []).map((r: any) => r.staff_id),
        ...(attendance || []).map((a: any) => a.user_id),
      ]),
    ];

    const { data: profiles } = staffIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", staffIds)
      : { data: [] };

    const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));
    const attendanceMap = new Map<string, { checked_in: boolean; check_in_time?: string }>();

    (attendance || []).forEach((a: any) => {
      attendanceMap.set(`${a.user_id}_${a.venue_id}`, {
        checked_in: true,
        check_in_time: a.check_in_time,
      });
    });

    // Also check general attendance (legacy table)
    const { data: legacyAttendance } = await supabase
      .from("attendance")
      .select("user_id, check_in_time, venue_id")
      .gte("check_in_time", todayStart)
      .lte("check_in_time", todayEnd);

    (legacyAttendance || []).forEach((a: any) => {
      const key = `${a.user_id}_${a.venue_id}`;
      if (!attendanceMap.has(key)) {
        attendanceMap.set(key, { checked_in: true, check_in_time: a.check_in_time });
      }
    });

    // Build venue -> staff map
    const map = new Map<string, StaffAssignment[]>();
    venues.forEach((v) => map.set(v.id, []));

    (roster || []).forEach((r: any) => {
      const existing = map.get(r.venue_id) || [];
      const attKey = `${r.staff_id}_${r.venue_id}`;
      const att = attendanceMap.get(attKey);
      existing.push({
        staff_id: r.staff_id,
        staff_name: profileMap.get(r.staff_id) || "Unknown",
        status: r.status,
        checked_in: att?.checked_in || false,
        check_in_time: att?.check_in_time,
      });
      map.set(r.venue_id, existing);
    });

    // Also add staff who checked in but aren't on roster
    (attendance || []).forEach((a: any) => {
      const venueStaffList = map.get(a.venue_id) || [];
      if (!venueStaffList.find((s) => s.staff_id === a.user_id)) {
        venueStaffList.push({
          staff_id: a.user_id,
          staff_name: profileMap.get(a.user_id) || "Unknown",
          status: "unrostered",
          checked_in: true,
          check_in_time: a.check_in_time,
        });
        map.set(a.venue_id, venueStaffList);
      }
    });

    setVenueStaff(map);
    setLoading(false);
  };

  const navigateDay = (dir: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + dir);
    setSelectedDate(next);
  };

  const getStatusDot = (staff: StaffAssignment) => {
    if (staff.checked_in) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
            Checked in
            {staff.check_in_time &&
              ` at ${new Date(staff.check_in_time).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
          </span>
        </div>
      );
    }
    if (staff.status === "unrostered") {
      return (
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-yellow-500" />
          <span className="text-xs text-yellow-600 dark:text-yellow-400">Not on roster</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-gray-600" />
        <span className="text-xs text-muted-foreground">Pending</span>
      </div>
    );
  };

  const totalAssigned = Array.from(venueStaff.values()).reduce((sum, arr) => sum + arr.length, 0);
  const totalCheckedIn = Array.from(venueStaff.values()).reduce(
    (sum, arr) => sum + arr.filter((s) => s.checked_in).length,
    0
  );

  return (
    <PageLayout
      title="Daily Roster"
      subtitle={selectedDate.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}
    >
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateDay(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
            >
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDay(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>{totalCheckedIn} checked in</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span>{totalAssigned - totalCheckedIn} pending</span>
            </div>
          </div>
        </div>

        {/* Venue Cards */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading roster...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => {
              const staff = venueStaff.get(venue.id) || [];
              const checkedInCount = staff.filter((s) => s.checked_in).length;
              const hasIssue = staff.length > 0 && checkedInCount === 0;

              return (
                <Card
                  key={venue.id}
                  className={`${
                    hasIssue ? "border-red-300 dark:border-red-800" : ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{venue.name}</span>
                      <span
                        className={`text-sm font-normal px-2 py-0.5 rounded-full ${
                          staff.length === 0
                            ? "bg-muted text-muted-foreground"
                            : checkedInCount === staff.length
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : hasIssue
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        }`}
                      >
                        {checkedInCount}/{staff.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {staff.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        No staff assigned
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {staff
                          .sort((a, b) => (a.checked_in === b.checked_in ? 0 : a.checked_in ? -1 : 1))
                          .map((s) => (
                            <div
                              key={s.staff_id}
                              className="flex items-center justify-between py-1.5"
                            >
                              <span className="font-medium text-sm">{s.staff_name}</span>
                              {getStatusDot(s)}
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default DailyRoster;
