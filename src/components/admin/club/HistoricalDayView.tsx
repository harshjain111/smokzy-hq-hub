import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, Users, Image,
  ShoppingCart, Package, Activity, CalendarOff
} from "lucide-react";
import { HistoricalSalesSection } from "./HistoricalSalesSection";
import { HistoricalStockSection } from "./HistoricalStockSection";
import { HistoricalAttendanceSection } from "./HistoricalAttendanceSection";
import { HistoricalActivitySection } from "./HistoricalActivitySection";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface HistoricalDayViewProps {
  clubId: string;
  clubName: string;
  selectedDate: Date;
}

interface SessionData {
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

export const HistoricalDayView = ({ clubId, clubName, selectedDate }: HistoricalDayViewProps) => {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [counterPhotoUrl, setCounterPhotoUrl] = useState<string | null>(null);
  const [photoZoomed, setPhotoZoomed] = useState(false);
  const [staffCount, setStaffCount] = useState(0);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  useEffect(() => {
    fetchSessionData();
  }, [dateStr, clubId]);

  const fetchSessionData = async () => {
    setLoading(true);
    setCounterPhotoUrl(null);
    try {
      // Fetch session for this date
      const { data: sessionData } = await supabase
        .from("club_sessions")
        .select("*")
        .eq("venue_id", clubId)
        .eq("session_date", dateStr)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setSession(sessionData);

      if (sessionData) {
        // Fetch staff count
        const { data: staffData } = await supabase
          .from("staff_attendance_blocks")
          .select("id")
          .eq("session_id", sessionData.id);
        setStaffCount(staffData?.length || 0);
      }

      // Fetch counter photo
      const { data: photoData } = await supabase
        .from("closing_photos")
        .select("photo_url")
        .eq("venue_id", clubId)
        .eq("photo_date", dateStr)
        .maybeSingle();

      if (photoData?.photo_url) {
        const { data: signedData } = await supabase.storage
          .from("closing-photos")
          .createSignedUrl(photoData.photo_url, 3600);
        setCounterPhotoUrl(signedData?.signedUrl || null);
      }
    } catch (error) {
      console.error("Error fetching session data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CalendarOff className="h-10 w-10 mb-3 opacity-40" />
        <div className="text-sm font-medium">No session recorded</div>
        <div className="text-xs mt-1">{format(selectedDate, "EEEE, dd MMMM yyyy")}</div>
      </div>
    );
  }

  const completedTasks = [session.stock_submitted, session.sales_submitted, session.photo_uploaded].filter(Boolean).length;

  const getStatusBadge = () => {
    if (session.force_close_reason) {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">Force Closed</Badge>;
    }
    if (session.status === "closed") {
      if (completedTasks === 3) {
        return <Badge className="bg-success/20 text-success border-success/30 text-[10px]">Complete</Badge>;
      }
      return <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">Incomplete</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]">Open</Badge>;
  };

  const TaskCheck = ({ label, done, time }: { label: string; done: boolean; time: string | null }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-destructive/50" />
        )}
        <span className="text-xs">{label}</span>
      </div>
      {time && <span className="text-[10px] text-muted-foreground">{format(new Date(time), "HH:mm")}</span>}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* ── Session Summary Card ── */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {format(new Date(session.started_at), "HH:mm")}
                {" – "}
                {session.closed_at ? format(new Date(session.closed_at), "HH:mm") : "Not Closed"}
              </span>
            </div>
            {getStatusBadge()}
          </div>

          {session.force_close_reason && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
              <span className="text-xs text-destructive">{session.force_close_reason}</span>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{staffCount} staff</span>
            </div>
            <span>{completedTasks}/3 tasks done</span>
          </div>

          <div className="space-y-1.5">
            <TaskCheck label="Stock" done={session.stock_submitted} time={session.stock_submitted_at} />
            <TaskCheck label="Sales" done={session.sales_submitted} time={session.sales_submitted_at} />
            <TaskCheck label="Photo" done={session.photo_uploaded} time={session.photo_uploaded_at} />
          </div>
        </CardContent>
      </Card>

      {/* ── Counter Photo ── */}
      {counterPhotoUrl && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Image className="h-4 w-4 text-muted-foreground" />
              Counter Photo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <img
              src={counterPhotoUrl}
              alt="Counter photo"
              className="rounded-lg w-full max-h-48 object-cover cursor-pointer"
              onClick={() => setPhotoZoomed(true)}
            />
          </CardContent>
        </Card>
      )}

      {/* Photo zoom dialog */}
      <Dialog open={photoZoomed} onOpenChange={setPhotoZoomed}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
          {counterPhotoUrl && (
            <img src={counterPhotoUrl} alt="Counter photo" className="w-full h-full object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Sales ── */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            Sales
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <HistoricalSalesSection session={session} clubId={clubId} clubName={clubName} />
        </CardContent>
      </Card>

      {/* ── Stock ── */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Stock
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <HistoricalStockSection session={session} clubId={clubId} clubName={clubName} />
        </CardContent>
      </Card>

      {/* ── Attendance ── */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <HistoricalAttendanceSection session={session} clubId={clubId} clubName={clubName} />
        </CardContent>
      </Card>

      {/* ── Activity Log ── */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <HistoricalActivitySection session={session} clubId={clubId} />
        </CardContent>
      </Card>
    </div>
  );
};
