import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { CheckCircle2, XCircle, AlertTriangle, Clock, Users, Image } from "lucide-react";

interface HistoricalSession {
  id: string;
  session_date: string;
  started_at: string;
  closed_at: string | null;
  status: string;
  stock_submitted: boolean;
  stock_submitted_at: string | null;
  sales_submitted: boolean;
  sales_submitted_at: string | null;
  photo_uploaded: boolean;
  photo_uploaded_at: string | null;
  force_close_reason: string | null;
}

interface HistoricalSummarySectionProps {
  session: HistoricalSession;
  clubId: string;
}

interface StaffMember {
  id: string;
  full_name: string;
  check_in_time: string;
  check_out_time: string | null;
}

export const HistoricalSummarySection = ({ session, clubId }: HistoricalSummarySectionProps) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [counterPhotoUrl, setCounterPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [session.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch staff who worked this session
      const { data: attendanceData } = await supabase
        .from("staff_attendance_blocks")
        .select("id, user_id, check_in_time, check_out_time")
        .eq("session_id", session.id);

      if (attendanceData && attendanceData.length > 0) {
        const userIds = [...new Set(attendanceData.map(a => a.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        const staffList = attendanceData.map(a => ({
          id: a.id,
          full_name: profilesData?.find(p => p.id === a.user_id)?.full_name || "Unknown",
          check_in_time: a.check_in_time,
          check_out_time: a.check_out_time,
        }));
        setStaff(staffList);
      }

      // Fetch counter photo
      const { data: photoData } = await supabase
        .from("closing_photos")
        .select("photo_url")
        .eq("venue_id", clubId)
        .eq("photo_date", session.session_date)
        .maybeSingle();

      if (photoData?.photo_url) {
        const { data: signedData } = await supabase.storage
          .from("closing-photos")
          .createSignedUrl(photoData.photo_url, 3600);
        setCounterPhotoUrl(signedData?.signedUrl || null);
      }
    } catch (error) {
      console.error("Error fetching historical summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const TaskItem = ({ 
    label, 
    completed, 
    timestamp 
  }: { 
    label: string; 
    completed: boolean; 
    timestamp: string | null;
  }) => (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        {completed ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
        <span className="text-sm">{label}</span>
      </div>
      {timestamp && (
        <span className="text-xs text-muted-foreground">
          {format(new Date(timestamp), "HH:mm")}
        </span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Session Duration */}
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Session Duration</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {format(new Date(session.started_at), "HH:mm")} - 
          {session.closed_at ? format(new Date(session.closed_at), "HH:mm") : " Not Closed"}
        </div>
      </div>

      {/* Force Close Warning */}
      {session.force_close_reason && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">Force Closed</span>
          </div>
          <div className="mt-1 text-xs text-destructive/80">
            {session.force_close_reason}
          </div>
        </div>
      )}

      {/* Staff Who Worked */}
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm mb-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Staff ({staff.length})</span>
        </div>
        {staff.length === 0 ? (
          <div className="text-xs text-muted-foreground">No staff records</div>
        ) : (
          <div className="space-y-1">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span>{s.full_name}</span>
                <span className="text-muted-foreground">
                  {format(new Date(s.check_in_time), "HH:mm")} - 
                  {s.check_out_time ? format(new Date(s.check_out_time), "HH:mm") : "?"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Completion */}
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="text-sm font-medium mb-2">Task Completion</div>
        <TaskItem 
          label="Stock Submitted" 
          completed={session.stock_submitted} 
          timestamp={session.stock_submitted_at} 
        />
        <TaskItem 
          label="Sales Submitted" 
          completed={session.sales_submitted} 
          timestamp={session.sales_submitted_at} 
        />
        <TaskItem 
          label="Counter Photo" 
          completed={session.photo_uploaded} 
          timestamp={session.photo_uploaded_at} 
        />
      </div>

      {/* Counter Photo */}
      {counterPhotoUrl && (
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm mb-2">
            <Image className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Counter Photo</span>
          </div>
          <img 
            src={counterPhotoUrl} 
            alt="Counter photo" 
            className="rounded-lg w-full max-h-48 object-cover"
          />
        </div>
      )}
    </div>
  );
};
