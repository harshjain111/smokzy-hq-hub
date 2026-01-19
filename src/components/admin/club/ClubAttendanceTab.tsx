import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMinutes, differenceInHours, startOfDay, subDays } from "date-fns";
import { AlertTriangle, Clock, Coffee } from "lucide-react";

interface ClubAttendanceTabProps {
  clubId: string;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  full_name: string;
  check_in_time: string;
  check_out_time: string | null;
  total_break_minutes: number;
  total_hours: number;
  is_morning_only: boolean;
  has_long_break: boolean;
  missed_checkout: boolean;
}

export const ClubAttendanceTab = ({ clubId }: ClubAttendanceTabProps) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, [clubId]);

  const fetchAttendance = async () => {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

    try {
      // Fetch attendance blocks with profiles
      const { data: blocks } = await supabase
        .from("staff_attendance_blocks")
        .select("*, profiles:user_id(full_name)")
        .eq("venue_id", clubId)
        .gte("check_in_time", `${weekAgo}T00:00:00`)
        .order("check_in_time", { ascending: false });

      // Fetch breaks
      const { data: breaks } = await supabase
        .from("staff_breaks")
        .select("*")
        .eq("venue_id", clubId)
        .gte("break_start_time", `${weekAgo}T00:00:00`);

      if (blocks) {
        const records: AttendanceRecord[] = blocks.map((block: any) => {
          const checkInDate = new Date(block.check_in_time);
          const checkOutDate = block.check_out_time ? new Date(block.check_out_time) : null;
          
          // Calculate breaks for this block
          const blockBreaks = breaks?.filter(b => b.attendance_block_id === block.id) || [];
          const totalBreakMinutes = blockBreaks.reduce((sum, b) => sum + (b.duration_minutes || 0), 0);

          // Calculate total hours
          let totalMinutes = 0;
          if (checkOutDate) {
            totalMinutes = differenceInMinutes(checkOutDate, checkInDate) - totalBreakMinutes;
          }
          const totalHours = totalMinutes / 60;

          // Flags
          const isMorningOnly = checkInDate.getHours() < 12 && (!checkOutDate || checkOutDate.getHours() < 14);
          const hasLongBreak = blockBreaks.some(b => (b.duration_minutes || 0) > 45);
          const missedCheckout = !block.check_out_time && differenceInHours(new Date(), checkInDate) > 12;

          return {
            id: block.id,
            user_id: block.user_id,
            full_name: block.profiles?.full_name || "Unknown",
            check_in_time: block.check_in_time,
            check_out_time: block.check_out_time,
            total_break_minutes: totalBreakMinutes,
            total_hours: Math.max(0, totalHours),
            is_morning_only: isMorningOnly,
            has_long_break: hasLongBreak,
            missed_checkout: missedCheckout,
          };
        });

        setAttendance(records);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  if (loading) {
    return <div className="h-64 bg-muted animate-pulse rounded-lg" />;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Attendance (Last 7 Days)</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs min-w-[100px]">Staff</TableHead>
                <TableHead className="text-xs min-w-[100px]">Check-in</TableHead>
                <TableHead className="text-xs min-w-[60px] text-center">Breaks</TableHead>
                <TableHead className="text-xs min-w-[100px]">Check-out</TableHead>
                <TableHead className="text-xs min-w-[80px] text-right">Hours</TableHead>
                <TableHead className="text-xs min-w-[80px]">Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.map(record => (
                <TableRow key={record.id}>
                  <TableCell className="text-xs font-medium">{record.full_name}</TableCell>
                  <TableCell className="text-xs">{format(new Date(record.check_in_time), "MMM dd, hh:mm a")}</TableCell>
                  <TableCell className="text-xs text-center">
                    {record.total_break_minutes > 0 ? (
                      <span className={record.has_long_break ? "text-warning" : ""}>
                        {record.total_break_minutes}m
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {record.check_out_time ? format(new Date(record.check_out_time), "hh:mm a") : (
                      <Badge variant="outline" className="text-[10px]">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right font-medium">
                    {record.check_out_time ? formatDuration(record.total_hours) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {record.is_morning_only && (
                        <Badge variant="outline" className="text-[9px] px-1">Morning</Badge>
                      )}
                      {record.has_long_break && (
                        <Badge variant="outline" className="text-[9px] px-1 text-warning border-warning">
                          <Coffee className="h-2.5 w-2.5" />
                        </Badge>
                      )}
                      {record.missed_checkout && (
                        <Badge variant="destructive" className="text-[9px] px-1">
                          <AlertTriangle className="h-2.5 w-2.5" />
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {attendance.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No attendance records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
