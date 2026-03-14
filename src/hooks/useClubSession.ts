import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMinutes } from "date-fns";

export interface ClubSession {
  id: string;
  venue_id: string;
  session_date: string;
  started_at: string;
  closed_at: string | null;
  status: 'open' | 'closed' | 'force_closed';
  stock_submitted: boolean;
  stock_submitted_by: string | null;
  stock_submitted_at: string | null;
  sales_submitted: boolean;
  sales_submitted_by: string | null;
  sales_submitted_at: string | null;
  photo_uploaded: boolean;
  photo_uploaded_by: string | null;
  photo_uploaded_at: string | null;
  force_close_reason: string | null;
}

export interface VenueSettings {
  morning_cutoff_hour: number;
  force_close_hour: number;
  core_hours_start: number;
  core_hours_end: number;
}

export interface AttendanceBlock {
  id: string;
  session_id: string;
  user_id: string;
  venue_id: string;
  check_in_time: string;
  check_in_lat: number;
  check_in_lng: number;
  check_in_selfie_url: string;
  check_out_time: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_selfie_url: string | null;
  is_break: boolean;
  duty_completed: boolean | null;
}

export interface StaffBreak {
  id: string;
  attendance_block_id: string;
  user_id: string;
  venue_id: string;
  session_id: string;
  break_start_time: string;
  break_end_time: string | null;
  duration_minutes: number | null;
}

export type StaffStatus = 'checked_out' | 'on_duty' | 'on_break';

const DEFAULT_SETTINGS: VenueSettings = {
  morning_cutoff_hour: 10,
  force_close_hour: 7,
  core_hours_start: 18,
  core_hours_end: 4,
};

// Warning threshold for long breaks (in minutes)
const LONG_BREAK_WARNING_MINUTES = 30;

/**
 * Hook to manage club sessions for a venue.
 * Sessions are date-based but can span midnight.
 * Auto-closes when all tasks (stock, sales, photo) are complete.
 */
export const useClubSession = (userId: string, venueId: string) => {
  const [session, setSession] = useState<ClubSession | null>(null);
  const [settings, setSettings] = useState<VenueSettings>(DEFAULT_SETTINGS);
  const [myAttendanceBlock, setMyAttendanceBlock] = useState<AttendanceBlock | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentBreak, setCurrentBreak] = useState<StaffBreak | null>(null);
  const [staffStatus, setStaffStatus] = useState<StaffStatus>('checked_out');
  const [totalBreakMinutes, setTotalBreakMinutes] = useState(0);

  // Get today's business date (or yesterday if before force_close_hour)
  const getSessionDate = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    
    // If it's before force_close_hour, we might be in yesterday's session
    if (hour < settings.force_close_hour) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return format(yesterday, "yyyy-MM-dd");
    }
    return format(now, "yyyy-MM-dd");
  }, [settings.force_close_hour]);

  const fetchSettings = useCallback(async () => {
    if (!venueId) return;

    const { data } = await supabase
      .from("venue_settings")
      .select("*")
      .eq("venue_id", venueId)
      .single();

    if (data) {
      setSettings({
        morning_cutoff_hour: data.morning_cutoff_hour,
        force_close_hour: data.force_close_hour,
        core_hours_start: data.core_hours_start,
        core_hours_end: data.core_hours_end,
      });
    }
  }, [venueId]);

  // Force-close any stale open sessions from previous business dates
  const forceCloseStaleSessionsClient = useCallback(async () => {
    if (!venueId) return;

    const now = new Date();
    const hour = now.getHours();
    // Calculate today's business date
    const businessDate = hour < settings.force_close_hour
      ? format(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), "yyyy-MM-dd")
      : format(now, "yyyy-MM-dd");

    // Find all open sessions for this venue that are older than the current business date
    const { data: staleSessions } = await supabase
      .from("club_sessions")
      .select("id, session_date")
      .eq("venue_id", venueId)
      .eq("status", "open")
      .lt("session_date", businessDate);

    if (staleSessions && staleSessions.length > 0) {
      for (const stale of staleSessions) {
        console.log(`Force-closing stale session ${stale.id} from ${stale.session_date}`);
        await supabase
          .from("club_sessions")
          .update({
            status: "force_closed",
            closed_at: new Date().toISOString(),
            force_close_reason: "Auto-closed: session exceeded daily boundary (client)",
          })
          .eq("id", stale.id);

        // Auto-checkout any staff still checked in on this session
        await supabase
          .from("staff_attendance_blocks")
          .update({
            check_out_time: new Date().toISOString(),
            duty_completed: false,
          })
          .eq("session_id", stale.id)
          .is("check_out_time", null);
      }
    }
  }, [venueId, settings.force_close_hour]);

  const fetchSession = useCallback(async () => {
    if (!venueId) {
      setLoading(false);
      return;
    }

    try {
      // First, clean up any stale sessions from previous business dates
      await forceCloseStaleSessionsClient();

      const now = new Date();
      const hour = now.getHours();

      // Calculate business date: before force_close_hour → yesterday, otherwise today
      const businessDate = hour < settings.force_close_hour
        ? format(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), "yyyy-MM-dd")
        : format(now, "yyyy-MM-dd");

      // Look for an OPEN session for the current business date
      const { data: openSession } = await supabase
        .from("club_sessions")
        .select("*")
        .eq("venue_id", venueId)
        .eq("session_date", businessDate)
        .eq("status", "open")
        .single();

      if (openSession) {
        setSession(openSession as ClubSession);
      } else {
        // Also check for a closed/force_closed session for today's business date (read-only view)
        const { data: closedSession } = await supabase
          .from("club_sessions")
          .select("*")
          .eq("venue_id", venueId)
          .eq("session_date", businessDate)
          .in("status", ["closed", "force_closed"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (closedSession) {
          setSession(closedSession as ClubSession);
        } else {
          setSession(null);
        }
      }
    } catch (error) {
      console.error("Error fetching session:", error);
    } finally {
      setLoading(false);
    }
  }, [venueId, settings.force_close_hour, forceCloseStaleSessionsClient]);

  const fetchMyAttendance = useCallback(async () => {
    if (!userId || !session) return;

    const { data } = await supabase
      .from("staff_attendance_blocks")
      .select("*")
      .eq("session_id", session.id)
      .eq("user_id", userId)
      .is("check_out_time", null)
      .order("check_in_time", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setMyAttendanceBlock(data[0] as AttendanceBlock);
      setIsCheckedIn(true);
    } else {
      setMyAttendanceBlock(null);
      setIsCheckedIn(false);
      setStaffStatus('checked_out');
      setCurrentBreak(null);
    }
  }, [userId, session]);

  // Fetch current break status and total break time
  const fetchBreakStatus = useCallback(async () => {
    if (!myAttendanceBlock || !session) {
      setCurrentBreak(null);
      setTotalBreakMinutes(0);
      return;
    }

    // Check for active break (no end time)
    const { data: activeBreak } = await supabase
      .from("staff_breaks")
      .select("*")
      .eq("attendance_block_id", myAttendanceBlock.id)
      .eq("user_id", userId)
      .is("break_end_time", null)
      .single();

    if (activeBreak) {
      setCurrentBreak(activeBreak as StaffBreak);
      setStaffStatus('on_break');
    } else {
      setCurrentBreak(null);
      setStaffStatus('on_duty');
    }

    // Calculate total break time for this attendance block
    const { data: allBreaks } = await supabase
      .from("staff_breaks")
      .select("duration_minutes")
      .eq("attendance_block_id", myAttendanceBlock.id)
      .not("break_end_time", "is", null);

    if (allBreaks) {
      const total = allBreaks.reduce((sum, b) => sum + (b.duration_minutes || 0), 0);
      setTotalBreakMinutes(total);
    }
  }, [myAttendanceBlock, session, userId]);

  // Start a break
  const startBreak = useCallback(async (): Promise<void> => {
    if (!myAttendanceBlock || !session) {
      throw new Error("Not checked in");
    }

    if (staffStatus === 'on_break') {
      throw new Error("Already on break");
    }

    const { error } = await supabase
      .from("staff_breaks")
      .insert({
        attendance_block_id: myAttendanceBlock.id,
        user_id: userId,
        venue_id: venueId,
        session_id: session.id,
      });

    if (error) throw error;
    
    await fetchBreakStatus();
  }, [myAttendanceBlock, session, userId, venueId, staffStatus, fetchBreakStatus]);

  // End a break
  const endBreak = useCallback(async (): Promise<void> => {
    if (!currentBreak) {
      throw new Error("Not on break");
    }

    const breakStartTime = new Date(currentBreak.break_start_time);
    const now = new Date();
    const durationMinutes = differenceInMinutes(now, breakStartTime);

    const { error } = await supabase
      .from("staff_breaks")
      .update({
        break_end_time: now.toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq("id", currentBreak.id);

    if (error) throw error;
    
    await fetchBreakStatus();
  }, [currentBreak, fetchBreakStatus]);

  // Check if break is unusually long
  const isLongBreak = useCallback((): boolean => {
    if (!currentBreak) return false;
    
    const breakStartTime = new Date(currentBreak.break_start_time);
    const now = new Date();
    const durationMinutes = differenceInMinutes(now, breakStartTime);
    
    return durationMinutes >= LONG_BREAK_WARNING_MINUTES;
  }, [currentBreak]);

  // Create or join a session when staff checks in
  const getOrCreateSession = useCallback(async (): Promise<ClubSession> => {
    const sessionDate = format(new Date(), "yyyy-MM-dd");

    // Check for existing open session
    const { data: existing } = await supabase
      .from("club_sessions")
      .select("*")
      .eq("venue_id", venueId)
      .eq("session_date", sessionDate)
      .single();

    if (existing) {
      return existing as ClubSession;
    }

    // Create new session
    const { data: newSession, error } = await supabase
      .from("club_sessions")
      .insert({
        venue_id: venueId,
        session_date: sessionDate,
        status: "open",
      })
      .select()
      .single();

    if (error) throw error;
    return newSession as ClubSession;
  }, [venueId]);

  // Check in to the current session
  const checkIn = useCallback(async (
    photoUrl: string,
    lat: number,
    lng: number
  ): Promise<void> => {
    const currentSession = await getOrCreateSession();
    
    const { error } = await supabase
      .from("staff_attendance_blocks")
      .insert({
        session_id: currentSession.id,
        user_id: userId,
        venue_id: venueId,
        check_in_selfie_url: photoUrl,
        check_in_lat: lat,
        check_in_lng: lng,
      });

    if (error) throw error;
    
    await fetchSession();
    await fetchMyAttendance();
  }, [userId, venueId, getOrCreateSession, fetchSession, fetchMyAttendance]);

  // Check out from the current session
  const checkOut = useCallback(async (
    photoUrl: string,
    lat: number,
    lng: number,
    dutyCompleted: boolean
  ): Promise<void> => {
    if (!myAttendanceBlock) throw new Error("Not checked in");

    const { error } = await supabase
      .from("staff_attendance_blocks")
      .update({
        check_out_selfie_url: photoUrl,
        check_out_lat: lat,
        check_out_lng: lng,
        check_out_time: new Date().toISOString(),
        is_break: !dutyCompleted,
        duty_completed: dutyCompleted,
      })
      .eq("id", myAttendanceBlock.id);

    if (error) throw error;
    
    await fetchMyAttendance();
  }, [myAttendanceBlock, fetchMyAttendance]);

  // Update session task status
  const updateSessionTask = useCallback(async (
    task: 'stock' | 'sales' | 'photo',
    submittedBy: string
  ): Promise<void> => {
    if (!session) return;

    const updateData: any = {};
    
    if (task === 'stock') {
      updateData.stock_submitted = true;
      updateData.stock_submitted_by = submittedBy;
      updateData.stock_submitted_at = new Date().toISOString();
    } else if (task === 'sales') {
      updateData.sales_submitted = true;
      updateData.sales_submitted_by = submittedBy;
      updateData.sales_submitted_at = new Date().toISOString();
    } else if (task === 'photo') {
      updateData.photo_uploaded = true;
      updateData.photo_uploaded_by = submittedBy;
      updateData.photo_uploaded_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("club_sessions")
      .update(updateData)
      .eq("id", session.id);

    if (error) throw error;

    // Check if all tasks are now complete and auto-close
    await checkAndAutoClose();
  }, [session]);

  // Auto-close session if all tasks complete
  const checkAndAutoClose = useCallback(async () => {
    if (!session) return;

    // Refetch current session state
    const { data: currentSession } = await supabase
      .from("club_sessions")
      .select("*")
      .eq("id", session.id)
      .single();

    if (!currentSession) return;

    const allComplete = 
      currentSession.stock_submitted && 
      currentSession.sales_submitted && 
      currentSession.photo_uploaded;

    if (allComplete && currentSession.status === 'open') {
      const { error } = await supabase
        .from("club_sessions")
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      if (error) {
        console.error("Failed to auto-close session:", error);
      } else {
        await fetchSession();
      }
    }
  }, [session, fetchSession]);

  // Check if user can checkout (morning shift logic + break check)
  const getCheckoutEligibility = useCallback((): { 
    canCheckout: boolean; 
    reason: string;
    isMorningShift: boolean;
  } => {
    if (!myAttendanceBlock || !session) {
      return { canCheckout: false, reason: "Not checked in", isMorningShift: false };
    }

    // Cannot checkout while on break
    if (staffStatus === 'on_break') {
      return { canCheckout: false, reason: "Resume duty before checkout", isMorningShift: false };
    }

    const checkInTime = new Date(myAttendanceBlock.check_in_time);
    const checkInHour = checkInTime.getHours();
    const now = new Date();
    const currentHour = now.getHours();

    // Check if this is a morning shift (checked in before morning cutoff)
    const isMorningShift = checkInHour < settings.morning_cutoff_hour;

    // If session is closed or force-closed, checkout is allowed
    if (session.status === 'closed' || session.status === 'force_closed') {
      return { canCheckout: true, reason: "Session completed", isMorningShift };
    }

    // If all tasks are complete, checkout is allowed
    const allTasksComplete = session.stock_submitted && session.sales_submitted && session.photo_uploaded;
    if (allTasksComplete) {
      return { canCheckout: true, reason: "All tasks completed", isMorningShift };
    }

    // Morning shift can checkout early if before core hours
    if (isMorningShift && currentHour < settings.core_hours_start) {
      return { 
        canCheckout: true, 
        reason: "Morning shift - early checkout allowed before core hours",
        isMorningShift 
      };
    }

    // Otherwise, tasks must be completed
    const pendingTasks = [];
    if (!session.stock_submitted) pendingTasks.push("Stock");
    if (!session.sales_submitted) pendingTasks.push("Sales");
    if (!session.photo_uploaded) pendingTasks.push("Counter photo");

    return { 
      canCheckout: false, 
      reason: `Pending: ${pendingTasks.join(", ")}`,
      isMorningShift 
    };
  }, [myAttendanceBlock, session, settings, staffStatus]);

  // Setup realtime subscriptions
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      fetchSession();
    }
  }, [fetchSession, settings]);

  useEffect(() => {
    if (session) {
      fetchMyAttendance();
    }
  }, [session, fetchMyAttendance]);

  // Fetch break status when attendance block changes
  useEffect(() => {
    if (myAttendanceBlock) {
      fetchBreakStatus();
    }
  }, [myAttendanceBlock, fetchBreakStatus]);

  // Realtime subscription for session updates
  useEffect(() => {
    if (!venueId) return;

    const sessionChannel = supabase
      .channel(`club-session-${venueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_sessions',
          filter: `venue_id=eq.${venueId}`
        },
        () => {
          fetchSession();
        }
      )
      .subscribe();

    const attendanceChannel = supabase
      .channel(`staff-attendance-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_attendance_blocks',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchMyAttendance();
        }
      )
      .subscribe();

    // Subscribe to breaks table for realtime updates
    const breaksChannel = supabase
      .channel(`staff-breaks-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_breaks',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchBreakStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(breaksChannel);
    };
  }, [venueId, userId, fetchSession, fetchMyAttendance, fetchBreakStatus]);

  return {
    session,
    settings,
    myAttendanceBlock,
    loading,
    isCheckedIn,
    checkIn,
    checkOut,
    updateSessionTask,
    getCheckoutEligibility,
    refresh: fetchSession,
    // Break management
    staffStatus,
    currentBreak,
    totalBreakMinutes,
    startBreak,
    endBreak,
    isLongBreak,
  };
};
