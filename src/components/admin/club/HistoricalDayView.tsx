import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, Users, Image,
  Activity, CalendarOff, TrendingUp, TrendingDown, Package,
} from "lucide-react";
import { HistoricalSalesSection } from "./HistoricalSalesSection";
import { HistoricalStockSection } from "./HistoricalStockSection";
import { HistoricalAttendanceSection } from "./HistoricalAttendanceSection";
import { HistoricalActivitySection } from "./HistoricalActivitySection";
import { SectionCard, KpiGrid, KpiTile } from "./DashboardPrimitives";
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

interface SalesSummary { today: number; monthlyAvgDaily: number }
interface StockSummary { itemCount: number; mismatchCount: number }
interface AttendanceSummary { count: number; missedCheckouts: number }

export const HistoricalDayView = ({ clubId, clubName, selectedDate }: HistoricalDayViewProps) => {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [counterPhotoUrl, setCounterPhotoUrl] = useState<string | null>(null);
  const [photoZoomed, setPhotoZoomed] = useState(false);
  const [staffCount, setStaffCount] = useState(0);

  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  useEffect(() => {
    fetchSessionData();
    setSalesSummary(null);
    setStockSummary(null);
    setAttendanceSummary(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, clubId]);

  const fetchSessionData = async () => {
    setLoading(true);
    setCounterPhotoUrl(null);
    try {
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
        const { data: staffData } = await supabase
          .from("staff_attendance_blocks")
          .select("id")
          .eq("session_id", sessionData.id);
        setStaffCount(staffData?.length || 0);
      }

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

  // Same scoring formula as the live ClubOverviewSection — degrades correctly for a
  // closed day since the "running long"/"no staff" branches are gated on status === 'open'.
  let healthScore = 100;
  const healthIssues: string[] = [];
  if (!session.stock_submitted) { healthScore -= 20; healthIssues.push("Stock not submitted"); }
  if (!session.sales_submitted) { healthScore -= 20; healthIssues.push("Sales not submitted"); }
  if (!session.photo_uploaded) { healthScore -= 15; healthIssues.push("Counter photo not uploaded"); }
  const hoursRunning = session.closed_at ? 0 : differenceInHours(new Date(), new Date(session.started_at));
  if (hoursRunning > 14 && session.status === 'open') { healthScore -= 15; healthIssues.push(`Session running for ${hoursRunning}+ hours`); }
  if (staffCount === 0 && session.status === 'open') { healthScore -= 20; healthIssues.push("No staff recorded"); }
  if (session.force_close_reason) { healthScore -= 30; healthIssues.push(`Force closed: ${session.force_close_reason}`); }
  healthScore = Math.max(0, healthScore);
  const healthTone = healthScore >= 90 ? 'success' : healthScore >= 70 ? 'primary' : healthScore >= 50 ? 'warning' : 'destructive';

  const salesDelta = salesSummary && salesSummary.monthlyAvgDaily > 0
    ? Math.round(((salesSummary.today - salesSummary.monthlyAvgDaily) / salesSummary.monthlyAvgDaily) * 100)
    : null;

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
    <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/30">
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
    <div className="space-y-4">
      {/* Day-level KPI strip, fed by the section components below */}
      <KpiGrid>
        <KpiTile
          icon={<Activity className="h-4 w-4" />}
          label="Session Health"
          value={`${healthScore}%`}
          sub={format(new Date(session.started_at), "HH:mm") + (session.closed_at ? ` – ${format(new Date(session.closed_at), "HH:mm")}` : " – ongoing")}
          tone={healthTone}
        />
        <KpiTile
          icon={salesDelta !== null && salesDelta < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
          label="Day's Sales"
          value={salesSummary ? String(salesSummary.today) : "—"}
          sub={salesDelta !== null ? `${salesDelta >= 0 ? '+' : ''}${salesDelta}% vs monthly avg` : "No data yet"}
          tone={!salesSummary ? 'muted' : salesDelta !== null && salesDelta < 0 ? 'warning' : 'success'}
        />
        <KpiTile
          icon={<Package className="h-4 w-4" />}
          label="Stock (est.)"
          value={stockSummary ? String(stockSummary.itemCount) : "—"}
          sub={stockSummary ? `${stockSummary.mismatchCount} mismatch${stockSummary.mismatchCount === 1 ? '' : 'es'}` : "No data yet"}
          tone={!stockSummary ? 'muted' : stockSummary.mismatchCount === 0 ? 'success' : 'warning'}
        />
        <KpiTile
          icon={<Users className="h-4 w-4" />}
          label="Staff"
          value={attendanceSummary ? String(attendanceSummary.count) : String(staffCount)}
          sub={attendanceSummary ? `${attendanceSummary.missedCheckouts} missed checkout${attendanceSummary.missedCheckouts === 1 ? '' : 's'}` : "No data yet"}
          tone={!attendanceSummary ? 'muted' : attendanceSummary.missedCheckouts > 0 ? 'warning' : 'success'}
        />
      </KpiGrid>

      <SectionCard title="Session Summary">
        <div className="space-y-3">
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

          {healthIssues.length > 0 && (
            <div className="p-3 rounded-lg border border-warning/30 bg-warning/5 space-y-1">
              {healthIssues.map((issue, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-warning/90">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <TaskCheck label="Stock" done={session.stock_submitted} time={session.stock_submitted_at} />
            <TaskCheck label="Sales" done={session.sales_submitted} time={session.sales_submitted_at} />
            <TaskCheck label="Photo" done={session.photo_uploaded} time={session.photo_uploaded_at} />
          </div>

          {counterPhotoUrl && (
            <button className="block w-full" onClick={() => setPhotoZoomed(true)}>
              <div className="flex items-center gap-2 mb-1.5 text-xs font-medium text-muted-foreground">
                <Image className="h-3.5 w-3.5" />
                Counter Photo
              </div>
              <img
                src={counterPhotoUrl}
                alt="Counter"
                className="rounded-lg w-full max-h-48 object-cover cursor-pointer"
              />
            </button>
          )}
        </div>
      </SectionCard>

      {/* Photo zoom — legitimate full-size media viewing */}
      <Dialog open={photoZoomed} onOpenChange={setPhotoZoomed}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
          {counterPhotoUrl && (
            <img src={counterPhotoUrl} alt="Counter" className="w-full h-full object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      <SectionCard title="Sales">
        <HistoricalSalesSection session={session} clubId={clubId} clubName={clubName} onSummaryChange={setSalesSummary} />
      </SectionCard>

      <SectionCard title="Stock">
        <HistoricalStockSection session={session} clubId={clubId} clubName={clubName} onSummaryChange={setStockSummary} />
      </SectionCard>

      <SectionCard title="Attendance">
        <HistoricalAttendanceSection session={session} clubId={clubId} clubName={clubName} onSummaryChange={setAttendanceSummary} />
      </SectionCard>

      <SectionCard title="Activity Log">
        <HistoricalActivitySection session={session} clubId={clubId} />
      </SectionCard>
    </div>
  );
};
