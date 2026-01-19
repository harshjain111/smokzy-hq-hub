import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ClubOverviewSection } from "@/components/admin/club/ClubOverviewSection";
import { ClubSalesSection } from "@/components/admin/club/ClubSalesSection";
import { ClubStockSection } from "@/components/admin/club/ClubStockSection";
import { ClubAttendanceSection } from "@/components/admin/club/ClubAttendanceSection";
import { ClubActivitySection } from "@/components/admin/club/ClubActivitySection";
import { SessionHistoryList } from "@/components/admin/club/SessionHistoryList";
import { HistoricalSessionDetail } from "@/components/admin/club/HistoricalSessionDetail";
import { format } from "date-fns";

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

type ViewMode = "live" | "history";

const ClubDetail = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [clubName, setClubName] = useState("");
  const [currentSession, setCurrentSession] = useState<ClubSession | null>(null);
  const [staffOnDuty, setStaffOnDuty] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string>("overview");
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [selectedHistoricalSession, setSelectedHistoricalSession] = useState<HistoricalSession | null>(null);

  useEffect(() => {
    if (clubId) {
      fetchClubDetails();
    }
  }, [clubId, refreshKey]);

  const fetchClubDetails = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");

      const [venueRes, sessionRes, staffRes] = await Promise.all([
        supabase.from("venues").select("name").eq("id", clubId).single(),
        supabase.from("club_sessions").select("*").eq("venue_id", clubId).eq("session_date", today).maybeSingle(),
        supabase.from("staff_attendance_blocks").select("id").eq("venue_id", clubId).is("check_out_time", null),
      ]);

      if (venueRes.data) {
        setClubName(venueRes.data.name);
      }

      setCurrentSession(sessionRes.data);
      setStaffOnDuty(staffRes.data?.length || 0);
    } catch (error) {
      console.error("Error fetching club details:", error);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => setRefreshKey(k => k + 1);

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

  const handleSelectHistoricalSession = (session: HistoricalSession) => {
    setSelectedHistoricalSession(session);
  };

  const handleBackFromHistoricalDetail = () => {
    setSelectedHistoricalSession(null);
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
            onClick={() => { setViewMode("live"); setSelectedHistoricalSession(null); }}
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
          /* Live Session View */
          <Accordion
            type="single"
            collapsible
            value={expandedSection}
            onValueChange={(value) => setExpandedSection(value)}
            className="space-y-2"
          >
            <AccordionItem value="overview" className="border rounded-lg overflow-hidden bg-card">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <span className="text-sm font-medium">Overview</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ClubOverviewSection clubId={clubId!} session={currentSession} loading={loading} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sales" className="border rounded-lg overflow-hidden bg-card">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <span className="text-sm font-medium">Sales</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ClubSalesSection clubId={clubId!} clubName={clubName} session={currentSession} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="stock" className="border rounded-lg overflow-hidden bg-card">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <span className="text-sm font-medium">Stock</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ClubStockSection clubId={clubId!} clubName={clubName} session={currentSession} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="attendance" className="border rounded-lg overflow-hidden bg-card">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <span className="text-sm font-medium">Attendance</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ClubAttendanceSection clubId={clubId!} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="activity" className="border rounded-lg overflow-hidden bg-card">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <span className="text-sm font-medium">Activity Log</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ClubActivitySection clubId={clubId!} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : (
          /* History View */
          selectedHistoricalSession ? (
            <HistoricalSessionDetail
              session={selectedHistoricalSession}
              clubId={clubId!}
              clubName={clubName}
              onBack={handleBackFromHistoricalDetail}
            />
          ) : (
            <SessionHistoryList
              clubId={clubId!}
              clubName={clubName}
              onSelectSession={handleSelectHistoricalSession}
            />
          )
        )}
      </div>
    </div>
  );
};

export default ClubDetail;
