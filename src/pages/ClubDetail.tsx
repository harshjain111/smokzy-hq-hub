import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { ClubOverviewTab } from "@/components/admin/club/ClubOverviewTab";
import { ClubStockTab } from "@/components/admin/club/ClubStockTab";
import { ClubSalesTab } from "@/components/admin/club/ClubSalesTab";
import { ClubAttendanceTab } from "@/components/admin/club/ClubAttendanceTab";
import { ClubActivityTab } from "@/components/admin/club/ClubActivityTab";
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

const ClubDetail = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [clubName, setClubName] = useState("");
  const [clubLocation, setClubLocation] = useState("");
  const [currentSession, setCurrentSession] = useState<ClubSession | null>(null);
  const [staffOnDuty, setStaffOnDuty] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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
        supabase.from("venues").select("*").eq("id", clubId).single(),
        supabase.from("club_sessions").select("*").eq("venue_id", clubId).eq("session_date", today).maybeSingle(),
        supabase.from("staff_attendance_blocks").select("id").eq("venue_id", clubId).is("check_out_time", null),
      ]);

      if (venueRes.data) {
        setClubName(venueRes.data.name);
        setClubLocation(venueRes.data.location);
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
      return <Badge variant="outline" className="text-xs">No Session</Badge>;
    }
    if (currentSession.force_close_reason) {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">Force Closed</Badge>;
    }
    if (currentSession.status === 'closed') {
      return <Badge className="bg-muted text-muted-foreground text-xs">Closed</Badge>;
    }
    return <Badge className="bg-success/20 text-success border-success/30 text-xs">Active</Badge>;
  };

  return (
    <PageLayout title={clubName || "Loading..."} subtitle={clubLocation}>
      <div className="space-y-3">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm -mx-4 px-4 py-2 border-b border-border/50">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-center">
              {getSessionStatusBadge()}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="font-medium">{staffOnDuty}</span>
              </div>
            </div>
            
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs - Scrollable on mobile */}
        <Tabs defaultValue="overview" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full h-9 p-1">
              <TabsTrigger value="overview" className="text-xs px-3">Overview</TabsTrigger>
              <TabsTrigger value="sales" className="text-xs px-3">Sales</TabsTrigger>
              <TabsTrigger value="stock" className="text-xs px-3">Stock</TabsTrigger>
              <TabsTrigger value="attendance" className="text-xs px-3">Attendance</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs px-3">Activity</TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-3">
            <TabsContent value="overview" className="m-0">
              <ClubOverviewTab clubId={clubId!} session={currentSession} loading={loading} />
            </TabsContent>

            <TabsContent value="sales" className="m-0">
              <ClubSalesTab clubId={clubId!} clubName={clubName} />
            </TabsContent>

            <TabsContent value="stock" className="m-0">
              <ClubStockTab clubId={clubId!} clubName={clubName} />
            </TabsContent>

            <TabsContent value="attendance" className="m-0">
              <ClubAttendanceTab clubId={clubId!} />
            </TabsContent>

            <TabsContent value="activity" className="m-0">
              <ClubActivityTab clubId={clubId!} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default ClubDetail;
