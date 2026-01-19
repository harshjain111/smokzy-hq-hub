import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, subDays } from "date-fns";
import { User, Calendar, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ClubStaffTabProps {
  clubId: string;
}

interface StaffMember {
  id: string;
  user_id: string;
  full_name: string;
  last_active: string | null;
  days_since_active: number;
  total_shifts_month: number;
  avg_break_minutes: number;
  consistency: 'good' | 'moderate' | 'poor';
}

export const ClubStaffTab = ({ clubId }: ClubStaffTabProps) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaff();
  }, [clubId]);

  const fetchStaff = async () => {
    setLoading(true);
    const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

    try {
      // Get all employees assigned to this venue
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(full_name)")
        .eq("venue_id", clubId)
        .eq("role", "employee");

      if (!roles) {
        setLoading(false);
        return;
      }

      // Get attendance data for the last 30 days
      const { data: attendance } = await supabase
        .from("staff_attendance_blocks")
        .select("*")
        .eq("venue_id", clubId)
        .gte("check_in_time", `${thirtyDaysAgo}T00:00:00`);

      // Get breaks data
      const { data: breaks } = await supabase
        .from("staff_breaks")
        .select("*")
        .eq("venue_id", clubId)
        .gte("break_start_time", `${thirtyDaysAgo}T00:00:00`);

      const staffData: StaffMember[] = roles.map((role: any) => {
        const userAttendance = attendance?.filter(a => a.user_id === role.user_id) || [];
        const userBreaks = breaks?.filter(b => b.user_id === role.user_id) || [];

        // Last active
        const lastShift = userAttendance.sort((a, b) => 
          new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime()
        )[0];
        const lastActive = lastShift?.check_in_time || null;
        const daysSinceActive = lastActive ? differenceInDays(new Date(), new Date(lastActive)) : 999;

        // Total shifts this month
        const totalShifts = userAttendance.length;

        // Average break duration
        const totalBreakMinutes = userBreaks.reduce((sum, b) => sum + (b.duration_minutes || 0), 0);
        const avgBreak = userBreaks.length > 0 ? totalBreakMinutes / userBreaks.length : 0;

        // Consistency (shifts per week in last month)
        const shiftsPerWeek = totalShifts / 4;
        let consistency: 'good' | 'moderate' | 'poor' = 'good';
        if (shiftsPerWeek < 2) consistency = 'poor';
        else if (shiftsPerWeek < 4) consistency = 'moderate';

        return {
          id: role.user_id,
          user_id: role.user_id,
          full_name: role.profiles?.full_name || "Unknown",
          last_active: lastActive,
          days_since_active: daysSinceActive,
          total_shifts_month: totalShifts,
          avg_break_minutes: Math.round(avgBreak),
          consistency,
        };
      });

      // Sort by last active (most recent first)
      staffData.sort((a, b) => a.days_since_active - b.days_since_active);
      setStaff(staffData);
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const getConsistencyBadge = (consistency: 'good' | 'moderate' | 'poor') => {
    switch (consistency) {
      case 'good':
        return <Badge className="bg-success/20 text-success border-success/30 text-[9px]">Good</Badge>;
      case 'moderate':
        return <Badge className="bg-warning/20 text-warning border-warning/30 text-[9px]">Moderate</Badge>;
      case 'poor':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[9px]">Poor</Badge>;
    }
  };

  if (loading) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            Assigned Staff
            <Badge variant="secondary">{staff.length}</Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {staff.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No staff assigned to this club
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {staff.map(member => (
            <Card key={member.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {member.last_active 
                          ? `Active ${member.days_since_active === 0 ? 'today' : `${member.days_since_active}d ago`}`
                          : 'Never active'
                        }
                      </p>
                    </div>
                  </div>
                  {getConsistencyBadge(member.consistency)}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="flex items-center gap-1 text-xs">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{member.total_shifts_month} shifts/mo</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{member.avg_break_minutes}m avg break</span>
                  </div>
                </div>

                {member.days_since_active > 7 && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Inactive for over a week
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
