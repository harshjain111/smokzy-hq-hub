import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Hook to get the "business date" for the current shift.
 * If an employee is on an active shift (checked in but not out), 
 * the business date is the check-in date, even if it's past midnight.
 * This ensures reports filed at 2 AM for a shift starting at 4 PM the previous day
 * are recorded against the correct business day.
 */
export const useBusinessDate = (userId: string, venueId: string) => {
  const [businessDate, setBusinessDate] = useState<string | null>(null);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveShift = useCallback(async () => {
    if (!userId || !venueId) {
      setBusinessDate(format(new Date(), "yyyy-MM-dd"));
      setLoading(false);
      return;
    }

    try {
      // Look for an active shift (checked in but not checked out) within last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .eq("venue_id", venueId)
        .gte("check_in_time", twentyFourHoursAgo)
        .is("check_out_time", null)
        .order("check_in_time", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const activeShift = data[0];
        setCurrentShift(activeShift);
        // Use the check-in date as the business date
        const checkInDate = format(new Date(activeShift.check_in_time), "yyyy-MM-dd");
        setBusinessDate(checkInDate);
      } else {
        // No active shift, use today's date
        setBusinessDate(format(new Date(), "yyyy-MM-dd"));
        setCurrentShift(null);
      }
    } catch (error) {
      console.error("Error fetching active shift:", error);
      setBusinessDate(format(new Date(), "yyyy-MM-dd"));
    } finally {
      setLoading(false);
    }
  }, [userId, venueId]);

  useEffect(() => {
    fetchActiveShift();

    // Set up realtime subscription for attendance changes
    const channel = supabase
      .channel(`business-date-attendance-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchActiveShift();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, venueId, fetchActiveShift]);

  // Provide a refresh function for manual updates
  const refresh = useCallback(() => {
    fetchActiveShift();
  }, [fetchActiveShift]);

  return { businessDate, currentShift, loading, refresh };
};
