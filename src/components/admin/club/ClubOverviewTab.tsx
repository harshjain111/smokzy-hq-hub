import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { Clock, Users, Package, TrendingUp, Camera, CheckCircle2, AlertCircle } from "lucide-react";
import { ClubSession } from "@/pages/ClubDetail";

interface ClubOverviewTabProps {
  clubId: string;
  session: ClubSession | null;
  loading: boolean;
}

interface StaffOnDuty {
  id: string;
  user_id: string;
  check_in_time: string;
  full_name: string;
}

export const ClubOverviewTab = ({ clubId, session, loading }: ClubOverviewTabProps) => {
  const [staffOnDuty, setStaffOnDuty] = useState<StaffOnDuty[]>([]);
  const [counterPhoto, setCounterPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (clubId) {
      fetchStaffOnDuty();
      fetchCounterPhoto();
    }
  }, [clubId, session]);

  const fetchStaffOnDuty = async () => {
    const { data } = await supabase
      .from("staff_attendance_blocks")
      .select("id, user_id, check_in_time, profiles:user_id(full_name)")
      .eq("venue_id", clubId)
      .is("check_out_time", null);

    if (data) {
      setStaffOnDuty(data.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        check_in_time: d.check_in_time,
        full_name: d.profiles?.full_name || "Unknown",
      })));
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

  const getSessionStatusBadge = () => {
    if (!session) return <Badge variant="outline">No Active Session</Badge>;
    if (session.force_close_reason) return <Badge variant="destructive">Force Closed</Badge>;
    if (session.status === 'closed') return <Badge variant="secondary">Closed</Badge>;
    return <Badge className="bg-success text-success-foreground">Active</Badge>;
  };

  const TaskStatus = ({ completed, label, time }: { completed: boolean; label: string; time: string | null }) => (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${completed ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'}`}>
      <div className="flex items-center gap-2">
        {completed ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <AlertCircle className="h-4 w-4 text-warning" />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-xs text-muted-foreground">
        {completed && time ? formatDistanceToNow(new Date(time), { addSuffix: true }) : 'Pending'}
      </span>
    </div>
  );

  if (loading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Session Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Session Status
            </CardTitle>
            {getSessionStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          {session ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started</span>
                <span>{format(new Date(session.started_at), "hh:mm a, MMM dd")}</span>
              </div>
              {session.closed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Closed</span>
                  <span>{format(new Date(session.closed_at), "hh:mm a, MMM dd")}</span>
                </div>
              )}
              {session.force_close_reason && (
                <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive text-xs">
                  Force close: {session.force_close_reason}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No session started today</p>
          )}
        </CardContent>
      </Card>

      {/* Staff On Duty */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Staff On Duty
            <Badge variant="secondary" className="ml-auto">{staffOnDuty.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staffOnDuty.length > 0 ? (
            <div className="space-y-2">
              {staffOnDuty.map(staff => (
                <div key={staff.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                  <span>{staff.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    Since {format(new Date(staff.check_in_time), "hh:mm a")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No staff currently on duty</p>
          )}
        </CardContent>
      </Card>

      {/* Task Checklist */}
      {session && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <TaskStatus completed={session.stock_submitted} label="Stock Submitted" time={session.stock_submitted_at} />
            <TaskStatus completed={session.sales_submitted} label="Sales Submitted" time={session.sales_submitted_at} />
            <TaskStatus completed={session.photo_uploaded} label="Counter Photo" time={session.photo_uploaded_at} />
          </CardContent>
        </Card>
      )}

      {/* Counter Photo */}
      {counterPhoto && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Today's Counter Photo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <img
              src={counterPhoto}
              alt="Counter"
              className="w-full max-w-md mx-auto rounded-lg border"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
