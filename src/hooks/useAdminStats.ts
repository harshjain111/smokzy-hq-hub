import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface ClubTileData {
  id: string;
  name: string;
  location: string;
  sessionStatus: 'active' | 'closed' | 'force_closed' | 'no_session';
  sessionStartTime: string | null;
  staffOnDuty: number;
  stockStatus: 'ok' | 'pending' | 'overdue';
  stockLastUpdate: string | null;
  salesStatus: 'submitted' | 'pending';
  photoStatus: 'uploaded' | 'pending';
  issueCount: number;
}

export interface AdminKPIs {
  activeClubs: number;
  staffOnDutyNow: number;
  openSessions: number;
  stockPendingClubs: number;
  salesPendingClubs: number;
  forceClosedToday: number;
}

export const useAdminStats = () => {
  const [kpis, setKpis] = useState<AdminKPIs>({
    activeClubs: 0,
    staffOnDutyNow: 0,
    openSessions: 0,
    stockPendingClubs: 0,
    salesPendingClubs: 0,
    forceClosedToday: 0,
  });
  const [clubs, setClubs] = useState<ClubTileData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");

      // Fetch all venues
      const { data: venues } = await supabase
        .from("venues")
        .select("*")
        .order("name");

      if (!venues) {
        setLoading(false);
        return;
      }

      // Fetch all sessions for today
      const { data: sessions } = await supabase
        .from("club_sessions")
        .select("*")
        .eq("session_date", today);

      // Get today's session IDs
      const todaySessionIds = sessions?.map(s => s.id) || [];

      // Fetch active attendance blocks (staff on duty) - only for today's sessions
      const { data: activeBlocks } = todaySessionIds.length > 0
        ? await supabase
            .from("staff_attendance_blocks")
            .select("*")
            .in("session_id", todaySessionIds)
            .is("check_out_time", null)
        : { data: [] };

      // Build club tile data
      const clubData: ClubTileData[] = venues.map(venue => {
        const session = sessions?.find(s => s.venue_id === venue.id);
        const venueStaff = activeBlocks?.filter(b => b.venue_id === venue.id) || [];
        
        let sessionStatus: ClubTileData['sessionStatus'] = 'no_session';
        if (session) {
          if (session.force_close_reason) {
            sessionStatus = 'force_closed';
          } else if (session.status === 'closed') {
            sessionStatus = 'closed';
          } else {
            sessionStatus = 'active';
          }
        }

        // Determine statuses
        const stockStatus: ClubTileData['stockStatus'] = session?.stock_submitted ? 'ok' : 'pending';
        const salesStatus: ClubTileData['salesStatus'] = session?.sales_submitted ? 'submitted' : 'pending';
        const photoStatus: ClubTileData['photoStatus'] = session?.photo_uploaded ? 'uploaded' : 'pending';

        // Count issues
        let issueCount = 0;
        if (session && !session.stock_submitted) issueCount++;
        if (session && !session.sales_submitted) issueCount++;
        if (session && !session.photo_uploaded) issueCount++;

        return {
          id: venue.id,
          name: venue.name,
          location: venue.location,
          sessionStatus,
          sessionStartTime: session?.started_at || null,
          staffOnDuty: venueStaff.length,
          stockStatus,
          stockLastUpdate: session?.stock_submitted_at || null,
          salesStatus,
          photoStatus,
          issueCount: sessionStatus === 'active' ? issueCount : 0,
        };
      });

      setClubs(clubData);

      // Calculate KPIs
      const activeClubs = clubData.filter(c => c.sessionStatus === 'active').length;
      const staffOnDutyNow = activeBlocks?.length || 0;
      const openSessions = sessions?.filter(s => s.status === 'open').length || 0;
      const stockPendingClubs = clubData.filter(c => c.sessionStatus === 'active' && !sessions?.find(s => s.venue_id === c.id)?.stock_submitted).length;
      const salesPendingClubs = clubData.filter(c => c.sessionStatus === 'active' && !sessions?.find(s => s.venue_id === c.id)?.sales_submitted).length;
      const forceClosedToday = sessions?.filter(s => s.force_close_reason).length || 0;

      setKpis({
        activeClubs,
        staffOnDutyNow,
        openSessions,
        stockPendingClubs,
        salesPendingClubs,
        forceClosedToday,
      });

    } catch (error) {
      console.error("Error fetching admin stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { kpis, clubs, loading, refresh: fetchData };
};
