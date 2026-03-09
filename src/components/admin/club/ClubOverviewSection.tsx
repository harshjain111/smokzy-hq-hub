import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, differenceInMinutes, differenceInHours, subDays } from "date-fns";
import { 
  Clock, Users, CheckCircle2, AlertCircle, Camera, Info, TrendingUp, 
  TrendingDown, Activity, AlertTriangle, Eye, ChevronRight 
} from "lucide-react";
import { ClubSession } from "@/pages/ClubDetail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ClubOverviewSectionProps {
  clubId: string;
  session: ClubSession | null;
  loading: boolean;
}

interface StaffOnDuty {
  id: string;
  user_id: string;
  check_in_time: string;
  check_out_time: string | null;
  full_name: string;
  total_break_minutes: number;
  is_on_break: boolean;
}

interface SessionHealth {
  score: number; // 0-100
  issues: string[];
  status: 'excellent' | 'good' | 'needs_attention' | 'critical';
}

interface SessionComparison {
  yesterdayStaffCount: number;
  yesterdaySales: number;
  lastWeekSameDay: { staffCount: number; sales: number };
}

export const ClubOverviewSection = ({ clubId, session, loading }: ClubOverviewSectionProps) => {
  const [staffOnDuty, setStaffOnDuty] = useState<StaffOnDuty[]>([]);
  const [allSessionStaff, setAllSessionStaff] = useState<StaffOnDuty[]>([]);
  const [counterPhoto, setCounterPhoto] = useState<string | null>(null);
  const [sessionHealth, setSessionHealth] = useState<SessionHealth | null>(null);
  const [comparison, setComparison] = useState<SessionComparison | null>(null);
  const [showStaffDetail, setShowStaffDetail] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  useEffect(() => {
    if (clubId) {
      fetchStaffOnDuty();
      fetchCounterPhoto();
      if (session) {
        calculateSessionHealth();
        fetchComparison();
      }
    }
  }, [clubId, session]);

  const fetchStaffOnDuty = async () => {
    if (!session?.id) {
      setStaffOnDuty([]);
      setAllSessionStaff([]);
      return;
    }

    // Fetch all attendance blocks for this session
    const { data: blocks } = await supabase
      .from("staff_attendance_blocks")
      .select("id, user_id, check_in_time, check_out_time, profiles:user_id(full_name)")
      .eq("session_id", session.id)
      .order("check_in_time", { ascending: true });

    // Fetch breaks for this session
    const { data: breaks } = await supabase
      .from("staff_breaks")
      .select("*")
      .eq("session_id", session.id);

    if (blocks) {
      const mapped = blocks.map((d: any) => {
        const staffBreaks = breaks?.filter(b => b.user_id === d.user_id) || [];
        const totalBreakMinutes = staffBreaks.reduce((sum, b) => sum + (b.duration_minutes || 0), 0);
        const isOnBreak = staffBreaks.some(b => !b.break_end_time);
        
        return {
          id: d.id,
          user_id: d.user_id,
          check_in_time: d.check_in_time,
          check_out_time: d.check_out_time,
          full_name: d.profiles?.full_name || "Unknown",
          total_break_minutes: totalBreakMinutes,
          is_on_break: isOnBreak,
        };
      });

      setAllSessionStaff(mapped);
      setStaffOnDuty(mapped.filter(s => !s.check_out_time));
    }
  };

  const fetchCounterPhoto = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("closing_photos")
      .select("photo_url")
      .eq("venue_id", clubId)
      .eq("photo_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.photo_url) {
      const match = data.photo_url.match(/\/closing-photos\/(.+)$/);
      const photoPath = match ? match[1] : null;
      
      if (photoPath) {
        const { data: signedData } = await supabase.storage
          .from("closing-photos")
          .createSignedUrl(photoPath, 3600);
        
        setCounterPhoto(signedData?.signedUrl || null);
      }
    }
  };

  const calculateSessionHealth = () => {
    if (!session) return;

    let score = 100;
    const issues: string[] = [];

    // Check tasks completion
    if (!session.stock_submitted) {
      score -= 20;
      issues.push("Stock not submitted");
    }
    if (!session.sales_submitted) {
      score -= 20;
      issues.push("Sales not submitted");
    }
    if (!session.photo_uploaded) {
      score -= 15;
      issues.push("Counter photo not uploaded");
    }

    // Check session duration (if running too long without closure)
    const sessionStart = new Date(session.started_at);
    const hoursRunning = differenceInHours(new Date(), sessionStart);
    if (hoursRunning > 14 && session.status === 'open') {
      score -= 15;
      issues.push(`Session running for ${hoursRunning}+ hours`);
    }

    // Check staff presence
    if (staffOnDuty.length === 0 && session.status === 'open') {
      score -= 20;
      issues.push("No staff currently on duty");
    }

    // Force close check
    if (session.force_close_reason) {
      score -= 30;
      issues.push(`Force closed: ${session.force_close_reason}`);
    }

    let status: SessionHealth['status'] = 'excellent';
    if (score < 50) status = 'critical';
    else if (score < 70) status = 'needs_attention';
    else if (score < 90) status = 'good';

    setSessionHealth({ score: Math.max(0, score), issues, status });
  };

  const fetchComparison = async () => {
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const lastWeekSameDay = format(subDays(new Date(), 7), "yyyy-MM-dd");

    // Get yesterday's session
    const { data: yesterdaySession } = await supabase
      .from("club_sessions")
      .select("id")
      .eq("venue_id", clubId)
      .eq("session_date", yesterday)
      .maybeSingle();

    // Get last week same day session
    const { data: lastWeekSession } = await supabase
      .from("club_sessions")
      .select("id")
      .eq("venue_id", clubId)
      .eq("session_date", lastWeekSameDay)
      .maybeSingle();

    let yesterdayStaffCount = 0;
    let yesterdaySales = 0;
    let lastWeekStaffCount = 0;
    let lastWeekSales = 0;

    if (yesterdaySession?.id) {
      const [{ count: staffCount }, { data: sales }] = await Promise.all([
        supabase.from("staff_attendance_blocks").select("*", { count: 'exact', head: true }).eq("session_id", yesterdaySession.id),
        supabase.from("sales_reports").select("quantity_sold").eq("venue_id", clubId).eq("report_date", yesterday),
      ]);
      yesterdayStaffCount = staffCount || 0;
      yesterdaySales = sales?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
    }

    if (lastWeekSession?.id) {
      const [{ count: staffCount }, { data: sales }] = await Promise.all([
        supabase.from("staff_attendance_blocks").select("*", { count: 'exact', head: true }).eq("session_id", lastWeekSession.id),
        supabase.from("sales_reports").select("quantity_sold").eq("venue_id", clubId).eq("report_date", lastWeekSameDay),
      ]);
      lastWeekStaffCount = staffCount || 0;
      lastWeekSales = sales?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
    }

    setComparison({
      yesterdayStaffCount,
      yesterdaySales,
      lastWeekSameDay: { staffCount: lastWeekStaffCount, sales: lastWeekSales },
    });
  };

  useEffect(() => {
    if (session && staffOnDuty.length >= 0) {
      calculateSessionHealth();
    }
  }, [staffOnDuty, session]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  // No session state
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Info className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No Active Session</p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">
          Data will appear here once a staff member checks in and starts today's session.
        </p>
      </div>
    );
  }

  const getHealthColor = (status: SessionHealth['status']) => {
    switch (status) {
      case 'excellent': return 'text-success bg-success/10 border-success/20';
      case 'good': return 'text-primary bg-primary/10 border-primary/20';
      case 'needs_attention': return 'text-warning bg-warning/10 border-warning/20';
      case 'critical': return 'text-destructive bg-destructive/10 border-destructive/20';
    }
  };

  const formatShiftDuration = (checkIn: string, checkOut: string | null) => {
    const start = new Date(checkIn);
    const end = checkOut ? new Date(checkOut) : new Date();
    const mins = differenceInMinutes(end, start);
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return checkOut ? `${hours}h ${minutes}m` : `${hours}h ${minutes}m (active)`;
  };

  return (
    <div className="space-y-4">
      {/* Session Health Score - Primary Decision Metric */}
      {sessionHealth && (
        <div className={`p-4 rounded-lg border ${getHealthColor(sessionHealth.status)}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <span className="font-semibold">Session Health</span>
            </div>
            <div className="text-2xl font-bold">{sessionHealth.score}%</div>
          </div>
          {sessionHealth.issues.length > 0 && (
            <div className="space-y-1 mt-3 pt-3 border-t border-current/20">
              {sessionHealth.issues.map((issue, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session Status + Duration */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Session Duration</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold">
            {format(new Date(session.started_at), "HH:mm")} - {session.closed_at ? format(new Date(session.closed_at), "HH:mm") : "ongoing"}
          </span>
          <p className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(session.started_at))} running
          </p>
        </div>
      </div>

      {session.force_close_reason && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive font-medium">Force Closed</p>
          <p className="text-xs text-destructive/80 mt-0.5">{session.force_close_reason}</p>
        </div>
      )}

      {/* Staff On Duty - Tap to see details */}
      <Dialog open={showStaffDetail} onOpenChange={setShowStaffDetail}>
        <DialogTrigger asChild>
          <button className="w-full text-left">
            <div className="space-y-2 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Staff ({allSessionStaff.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {staffOnDuty.length} on duty
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              
              {/* Quick preview of staff */}
              {allSessionStaff.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {allSessionStaff.slice(0, 4).map(staff => (
                    <span 
                      key={staff.id} 
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        staff.check_out_time 
                          ? 'bg-muted text-muted-foreground' 
                          : staff.is_on_break 
                            ? 'bg-warning/20 text-warning' 
                            : 'bg-success/20 text-success'
                      }`}
                    >
                      {staff.full_name.split(' ')[0]}
                    </span>
                  ))}
                  {allSessionStaff.length > 4 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      +{allSessionStaff.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Staff Details - Today's Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {allSessionStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No staff has worked this session</p>
            ) : (
              allSessionStaff.map(staff => (
                <div key={staff.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{staff.full_name}</span>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] ${
                        staff.check_out_time 
                          ? 'text-muted-foreground' 
                          : staff.is_on_break 
                            ? 'text-warning border-warning' 
                            : 'text-success border-success'
                      }`}
                    >
                      {staff.check_out_time ? 'Checked Out' : staff.is_on_break ? 'On Break' : 'On Duty'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide">Check-in</span>
                      <span className="text-foreground">{format(new Date(staff.check_in_time), "hh:mm a")}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide">Check-out</span>
                      <span className="text-foreground">
                        {staff.check_out_time ? format(new Date(staff.check_out_time), "hh:mm a") : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide">Duration</span>
                      <span className="text-foreground">{formatShiftDuration(staff.check_in_time, staff.check_out_time)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide">Breaks</span>
                      <span className="text-foreground">{staff.total_break_minutes}m</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Completion Status */}
      <div className="space-y-2">
        <span className="text-sm font-medium">Task Completion</span>
        <div className="space-y-1.5">
          <TaskItem 
            completed={session.stock_submitted} 
            label="Stock Submitted" 
            time={session.stock_submitted_at} 
          />
          <TaskItem 
            completed={session.sales_submitted} 
            label="Sales Submitted" 
            time={session.sales_submitted_at} 
          />
          <TaskItem 
            completed={session.photo_uploaded} 
            label="Counter Photo" 
            time={session.photo_uploaded_at} 
          />
        </div>
      </div>

      {/* Quick Comparison */}
      {comparison && (
        <div className="space-y-2">
          <span className="text-sm font-medium text-muted-foreground">Quick Comparison</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="flex items-center justify-center gap-1">
                {allSessionStaff.length > comparison.yesterdayStaffCount ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : allSessionStaff.length < comparison.yesterdayStaffCount ? (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                ) : null}
                <span className="text-sm font-semibold">{allSessionStaff.length}</span>
              </div>
              <p className="text-[9px] text-muted-foreground">Staff (Y: {comparison.yesterdayStaffCount})</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="text-[9px] text-muted-foreground">Last {format(new Date(), "EEE")}</span>
              </div>
              <p className="text-[9px] text-muted-foreground">
                {comparison.lastWeekSameDay.staffCount} staff, {comparison.lastWeekSameDay.sales} sales
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Counter Photo */}
      {counterPhoto && (
        <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
          <DialogTrigger asChild>
            <button className="w-full">
              <div className="space-y-2 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Counter Photo</span>
                  </div>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
                <img
                  src={counterPhoto}
                  alt="Counter"
                  className="w-full rounded-lg border aspect-video object-cover"
                />
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-base">Today's Counter Photo</DialogTitle>
            </DialogHeader>
            <img
              src={counterPhoto}
              alt="Counter"
              className="w-full rounded-lg"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const TaskItem = ({ completed, label, time }: { completed: boolean; label: string; time: string | null }) => (
  <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
    completed 
      ? 'bg-success/5 border-success/20' 
      : 'bg-warning/5 border-warning/20'
  }`}>
    <div className="flex items-center gap-2">
      {completed ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5 text-warning" />
      )}
      <span className="text-xs font-medium">{label}</span>
    </div>
    <span className="text-[10px] text-muted-foreground">
      {completed && time ? format(new Date(time), "HH:mm") : 'Pending'}
    </span>
  </div>
);
