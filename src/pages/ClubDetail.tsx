import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { ClubOverviewTab } from "@/components/admin/club/ClubOverviewTab";
import { ClubStockTab } from "@/components/admin/club/ClubStockTab";
import { ClubSalesTab } from "@/components/admin/club/ClubSalesTab";
import { ClubAttendanceTab } from "@/components/admin/club/ClubAttendanceTab";
import { ClubStaffTab } from "@/components/admin/club/ClubStaffTab";
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

      const [venueRes, sessionRes] = await Promise.all([
        supabase.from("venues").select("*").eq("id", clubId).single(),
        supabase.from("club_sessions").select("*").eq("venue_id", clubId).eq("session_date", today).maybeSingle(),
      ]);

      if (venueRes.data) {
        setClubName(venueRes.data.name);
        setClubLocation(venueRes.data.location);
      }

      setCurrentSession(sessionRes.data);
    } catch (error) {
      console.error("Error fetching club details:", error);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <PageLayout title={clubName} subtitle={clubLocation}>
      <div className="space-y-4">
        {/* Top Actions */}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="grid w-full min-w-[600px] md:min-w-0 grid-cols-6 h-10">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="stock" className="text-xs">Stock</TabsTrigger>
              <TabsTrigger value="sales" className="text-xs">Sales</TabsTrigger>
              <TabsTrigger value="attendance" className="text-xs">Attendance</TabsTrigger>
              <TabsTrigger value="staff" className="text-xs">Staff</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <ClubOverviewTab clubId={clubId!} session={currentSession} loading={loading} />
          </TabsContent>

          <TabsContent value="stock">
            <ClubStockTab clubId={clubId!} clubName={clubName} />
          </TabsContent>

          <TabsContent value="sales">
            <ClubSalesTab clubId={clubId!} clubName={clubName} />
          </TabsContent>

          <TabsContent value="attendance">
            <ClubAttendanceTab clubId={clubId!} />
          </TabsContent>

          <TabsContent value="staff">
            <ClubStaffTab clubId={clubId!} />
          </TabsContent>

          <TabsContent value="activity">
            <ClubActivityTab clubId={clubId!} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default ClubDetail;
