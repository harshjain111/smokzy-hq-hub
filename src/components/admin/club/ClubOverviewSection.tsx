import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { Clock, Users, CheckCircle2, AlertCircle, Camera, Info } from "lucide-react";
import { ClubSession } from "@/pages/ClubDetail";

interface ClubOverviewSectionProps {
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

export const ClubOverviewSection = ({ clubId, session, loading }: ClubOverviewSectionProps) => {
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

  return (
    <div className="space-y-4">
      {/* Session Status */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Session Started</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {format(new Date(session.started_at), "hh:mm a")}
        </span>
      </div>

      {session.force_close_reason && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive font-medium">Force Closed</p>
          <p className="text-xs text-destructive/80 mt-0.5">{session.force_close_reason}</p>
        </div>
      )}

      {/* Staff On Duty */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Staff On Duty</span>
          </div>
          <Badge variant="secondary" className="text-[10px]">{staffOnDuty.length}</Badge>
        </div>
        
        {staffOnDuty.length > 0 ? (
          <div className="space-y-1.5">
            {staffOnDuty.map(staff => (
              <div key={staff.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
                <span className="font-medium">{staff.full_name}</span>
                <span className="text-muted-foreground">
                  Since {format(new Date(staff.check_in_time), "hh:mm a")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground p-2">No staff currently on duty</p>
        )}
      </div>

      {/* Task Checklist */}
      <div className="space-y-2">
        <span className="text-sm font-medium">Pending Tasks</span>
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

      {/* Counter Photo */}
      {counterPhoto && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Today's Counter Photo</span>
          </div>
          <img
            src={counterPhoto}
            alt="Counter"
            className="w-full rounded-lg border aspect-video object-cover"
          />
        </div>
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
      {completed && time ? formatDistanceToNow(new Date(time), { addSuffix: true }) : 'Pending'}
    </span>
  </div>
);
