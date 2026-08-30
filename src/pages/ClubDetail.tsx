import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Users, Activity, TrendingUp, TrendingDown, Package } from "lucide-react";
import { ClubOverviewSection, SessionHealth } from "@/components/admin/club/ClubOverviewSection";
import { ClubSalesSection } from "@/components/admin/club/ClubSalesSection";
import { ClubStockSection } from "@/components/admin/club/ClubStockSection";
import { ClubAttendanceSection } from "@/components/admin/club/ClubAttendanceSection";
import { ClubActivitySection } from "@/components/admin/club/ClubActivitySection";
import { DateNavigationStrip, RangeMode } from "@/components/admin/club/DateNavigationStrip";
import { HistoricalDayView } from "@/components/admin/club/HistoricalDayView";
import { PeriodSummaryView } from "@/components/admin/club/PeriodSummaryView";
import { SectionCard, KpiGrid, KpiTile } from "@/components/admin/club/DashboardPrimitives";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export interface ClubSession {
  id: string;
  venue_id: string;
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

type ViewMode = "live" | "history";

interface SalesSummary { today: number; yesterday: number }
interface StockSummary { score: number; lowCount: number; outCount: number }
interface AttendanceSummary { onDuty: number; onBreak: number; rosteredTotal: number | null; notCheckedIn: number }

const ClubDetail = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [clubName, setClubName] = useState("");
  const [currentSession, setCurrentSession] = useState<ClubSession | null>(null);
  const [staffOnDuty, setStaffOnDuty] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<Date>(subDays(new Date(), 1));
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>();

  // Fed by the section components' own callbacks so the KPI strip reuses their existing calculations
  const [sessionHealth, setSessionHealth] = useState<SessionHealth | null>(null);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);

  useEffect(() => {
    if (clubId) {
      fetchClubDetails();
    }
  }, [clubId, refreshKey]);

  const fetchClubDetails = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");

      const [venueRes, sessionRes] = await Promise.all([
        supabase.from("venues").select("name").eq("id", clubId).single(),
        supabase.from("club_sessions").select("*").eq("venue_id", clubId).eq("session_date", today).maybeSingle(),
      ]);

      if (venueRes.data) {
        setClubName(venueRes.data.name);
      }

      setCurrentSession(sessionRes.data);

      if (sessionRes.data?.id) {
        const { data: staffRes } = await supabase
          .from("staff_attendance_blocks")
          .select("id")
          .eq("session_id", sessionRes.data.id)
          .is("check_out_time", null);
        setStaffOnDuty(staffRes?.length || 0);
      } else {
        setStaffOnDuty(0);
      }
    } catch (error) {
      console.error("Error fetching club details:", error);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => setRefreshKey(k => k + 1);

  const jumpToToday = () => {
    setViewMode("live");
    setRangeMode("day");
  };

  const periodRange = (): { from: Date; to: Date } => {
    if (rangeMode === "week") {
      return { from: startOfWeek(selectedHistoryDate, { weekStartsOn: 1 }), to: endOfWeek(selectedHistoryDate, { weekStartsOn: 1 }) };
    }
    if (rangeMode === "month") {
      return { from: startOfMonth(selectedHistoryDate), to: endOfMonth(selectedHistoryDate) };
    }
    return customRange || { from: subDays(new Date(), 7), to: subDays(new Date(), 1) };
  };

  const getSessionStatusBadge = () => {
    if (!currentSession) {
      return <Badge variant="outline" className="text-[10px] font-medium">No Session</Badge>;
    }
    if (currentSession.force_close_reason) {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] font-medium">Force Closed</Badge>;
    }
    if (currentSession.status === 'closed') {
      return <Badge className="bg-muted text-muted-foreground text-[10px] font-medium">Closed</Badge>;
    }
    return <Badge className="bg-success/20 text-success border-success/30 text-[10px] font-medium">Active</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Compact Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-3 py-2.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex flex-col items-center flex-1 min-w-0 px-2">
            <h1 className="text-sm font-semibold truncate max-w-[180px]">{clubName || "Loading..."}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {getSessionStatusBadge()}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Users className="h-3 w-3" />
                <span className="font-medium">{staffOnDuty} on duty</span>
              </div>
            </div>
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={refresh}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Live/History Toggle */}
        <div className="flex border-t border-border">
          <button
            onClick={() => setViewMode("live")}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              viewMode === "live"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            LIVE SESSION
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              viewMode === "history"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            HISTORY
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 pb-8">
        {viewMode === "live" ? (
          <div className="space-y-4">
            <KpiStrip
              sessionHealth={sessionHealth}
              sales={salesSummary}
              stock={stockSummary}
              attendance={attendanceSummary}
            />

            <SectionCard title="Session Status">
              <ClubOverviewSection
                clubId={clubId!}
                session={currentSession}
                loading={loading}
                onHealthChange={setSessionHealth}
              />
            </SectionCard>

            <SectionCard title="Sales Intelligence">
              <ClubSalesSection
                clubId={clubId!}
                clubName={clubName}
                session={currentSession}
                onSummaryChange={setSalesSummary}
              />
            </SectionCard>

            <SectionCard title="Attendance Command Center">
              <ClubAttendanceSection
                clubId={clubId!}
                currentSession={currentSession ? { id: currentSession.id, session_date: currentSession.session_date } : null}
                onSummaryChange={setAttendanceSummary}
              />
            </SectionCard>

            <SectionCard title="Stock & Inventory">
              <ClubStockSection
                clubId={clubId!}
                clubName={clubName}
                session={currentSession}
                onSummaryChange={setStockSummary}
              />
            </SectionCard>

            <SectionCard title="Activity Log">
              <ClubActivitySection
                clubId={clubId!}
                currentSession={currentSession ? { id: currentSession.id, session_date: currentSession.session_date } : null}
              />
            </SectionCard>
          </div>
        ) : (
          <div className="space-y-3">
            <DateNavigationStrip
              mode={rangeMode}
              selectedDate={selectedHistoryDate}
              customRange={customRange}
              onModeChange={setRangeMode}
              onDateChange={setSelectedHistoryDate}
              onCustomRangeChange={setCustomRange}
              onJumpToToday={jumpToToday}
            />
            {rangeMode === "day" ? (
              <HistoricalDayView
                clubId={clubId!}
                clubName={clubName}
                selectedDate={selectedHistoryDate}
              />
            ) : (
              <PeriodSummaryView
                clubId={clubId!}
                clubName={clubName}
                dateRange={periodRange()}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const KpiStrip = ({
  sessionHealth,
  sales,
  stock,
  attendance,
}: {
  sessionHealth: SessionHealth | null;
  sales: SalesSummary | null;
  stock: StockSummary | null;
  attendance: AttendanceSummary | null;
}) => {
  const healthLabel = sessionHealth
    ? sessionHealth.status === 'excellent' ? 'Healthy'
      : sessionHealth.status === 'good' ? 'Good'
      : sessionHealth.status === 'needs_attention' ? 'Needs Attention'
      : 'Critical'
    : 'No Session';

  const salesDelta = sales
    ? sales.yesterday === 0
      ? (sales.today > 0 ? '+100%' : '0%')
      : `${sales.today - sales.yesterday >= 0 ? '+' : ''}${Math.round(((sales.today - sales.yesterday) / sales.yesterday) * 100)}%`
    : null;

  return (
    <KpiGrid>
      <KpiTile
        icon={<Activity className="h-4 w-4" />}
        label="Session Health"
        value={sessionHealth ? `${sessionHealth.score}%` : "—"}
        sub={healthLabel}
        tone={
          !sessionHealth ? 'muted'
            : sessionHealth.status === 'excellent' ? 'success'
            : sessionHealth.status === 'good' ? 'primary'
            : sessionHealth.status === 'needs_attention' ? 'warning'
            : 'destructive'
        }
      />
      <KpiTile
        icon={sales && salesDelta?.startsWith('-') ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
        label="Today's Sales"
        value={sales ? String(sales.today) : "—"}
        sub={salesDelta ? `${salesDelta} vs yesterday` : "No data yet"}
        tone={!sales ? 'muted' : salesDelta?.startsWith('-') ? 'destructive' : 'success'}
      />
      <KpiTile
        icon={<Package className="h-4 w-4" />}
        label="Stock Health"
        value={stock ? `${stock.score}%` : "—"}
        sub={stock ? `${stock.lowCount} low-stock item${stock.lowCount === 1 ? '' : 's'}` : "No data yet"}
        tone={!stock ? 'muted' : stock.score >= 80 ? 'success' : stock.score >= 50 ? 'warning' : 'destructive'}
      />
      <KpiTile
        icon={<Users className="h-4 w-4" />}
        label="Staff On Duty"
        value={attendance ? (attendance.rosteredTotal !== null ? `${attendance.onDuty}/${attendance.rosteredTotal}` : String(attendance.onDuty)) : "—"}
        sub={attendance ? `${attendance.onBreak} break · ${attendance.notCheckedIn} missing` : "No data yet"}
        tone={!attendance ? 'muted' : attendance.notCheckedIn > 0 ? 'warning' : 'success'}
      />
    </KpiGrid>
  );
};

export default ClubDetail;
