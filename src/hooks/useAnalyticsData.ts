import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, subDays, format, isSameDay } from "date-fns";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface SalesAnalytics {
  thisMonthTotal: number;
  lastMonthTotal: number;
  averagePerClub: number;
  bestClub: { name: string; sales: number } | null;
  lowestClub: { name: string; sales: number } | null;
  yesterdayTotal: number;
  sameWeekdayLastWeekTotal: number;
  percentChange: number;
}

export interface ClubPerformance {
  id: string;
  name: string;
  thisMonthSales: number;
  lastMonthSales: number;
  percentChange: number;
  averageDailySales: number;
}

export interface StaffDiscipline {
  id: string;
  name: string;
  daysAssigned: number;
  daysPresent: number;
  lateCheckIns: number;
  missedCheckouts: number;
  complianceRate: number;
  averageBreakMinutes: number;
  status: 'Disciplined' | 'Needs Attention' | 'Non-Compliant';
}

export interface ComplianceException {
  type: 'force_closed' | 'stock_delay' | 'sales_mismatch' | 'missing_records';
  clubName: string;
  date: string;
  details: string;
}

export const useAnalyticsData = () => {
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [clubPerformance, setClubPerformance] = useState<ClubPerformance[]>([]);
  const [staffDiscipline, setStaffDiscipline] = useState<StaffDiscipline[]>([]);
  const [exceptions, setExceptions] = useState<ComplianceException[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchAnalytics = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));
      const yesterday = subDays(now, 1);
      const sameWeekdayLastWeek = subDays(now, 7);

      // Fetch venues
      const { data: venues } = await supabase
        .from("venues")
        .select("id, name");

      // Fetch all sales reports for analysis
      const { data: allSales } = await supabase
        .from("sales_reports")
        .select("report_date, quantity_sold, venue_id")
        .gte("report_date", format(lastMonthStart, "yyyy-MM-dd"))
        .lte("report_date", format(thisMonthEnd, "yyyy-MM-dd"));

      // Calculate sales analytics
      const thisMonthSales = allSales?.filter(s => {
        const date = new Date(s.report_date);
        return date >= thisMonthStart && date <= thisMonthEnd;
      }) || [];

      const lastMonthSales = allSales?.filter(s => {
        const date = new Date(s.report_date);
        return date >= lastMonthStart && date <= lastMonthEnd;
      }) || [];

      const yesterdaySales = allSales?.filter(s => 
        isSameDay(new Date(s.report_date), yesterday)
      ) || [];

      const sameWeekdaySales = allSales?.filter(s => 
        isSameDay(new Date(s.report_date), sameWeekdayLastWeek)
      ) || [];

      const thisMonthTotal = thisMonthSales.reduce((sum, s) => sum + s.quantity_sold, 0);
      const lastMonthTotal = lastMonthSales.reduce((sum, s) => sum + s.quantity_sold, 0);
      const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + s.quantity_sold, 0);
      const sameWeekdayTotal = sameWeekdaySales.reduce((sum, s) => sum + s.quantity_sold, 0);

      // Calculate per-club performance
      const clubSales: Record<string, { thisMonth: number; lastMonth: number }> = {};
      
      venues?.forEach(venue => {
        clubSales[venue.id] = { thisMonth: 0, lastMonth: 0 };
      });

      thisMonthSales.forEach(s => {
        if (clubSales[s.venue_id]) {
          clubSales[s.venue_id].thisMonth += s.quantity_sold;
        }
      });

      lastMonthSales.forEach(s => {
        if (clubSales[s.venue_id]) {
          clubSales[s.venue_id].lastMonth += s.quantity_sold;
        }
      });

      const clubPerformanceData: ClubPerformance[] = venues?.map(venue => {
        const sales = clubSales[venue.id];
        const daysInMonth = now.getDate();
        return {
          id: venue.id,
          name: venue.name,
          thisMonthSales: sales.thisMonth,
          lastMonthSales: sales.lastMonth,
          percentChange: sales.lastMonth > 0 
            ? Math.round(((sales.thisMonth - sales.lastMonth) / sales.lastMonth) * 100)
            : 0,
          averageDailySales: Math.round(sales.thisMonth / daysInMonth),
        };
      }) || [];

      // Find best and lowest clubs
      const sortedByThisMonth = [...clubPerformanceData].sort((a, b) => b.thisMonthSales - a.thisMonthSales);
      const bestClub = sortedByThisMonth[0] ? { name: sortedByThisMonth[0].name, sales: sortedByThisMonth[0].thisMonthSales } : null;
      const lowestClub = sortedByThisMonth.length > 1 
        ? { name: sortedByThisMonth[sortedByThisMonth.length - 1].name, sales: sortedByThisMonth[sortedByThisMonth.length - 1].thisMonthSales }
        : null;

      setSalesAnalytics({
        thisMonthTotal,
        lastMonthTotal,
        averagePerClub: venues?.length ? Math.round(thisMonthTotal / venues.length) : 0,
        bestClub,
        lowestClub,
        yesterdayTotal,
        sameWeekdayLastWeekTotal: sameWeekdayTotal,
        percentChange: sameWeekdayTotal > 0 
          ? Math.round(((yesterdayTotal - sameWeekdayTotal) / sameWeekdayTotal) * 100)
          : 0,
      });

      setClubPerformance(clubPerformanceData.sort((a, b) => b.thisMonthSales - a.thisMonthSales));

      // Fetch attendance data for discipline tracking
      const thirtyDaysAgo = subDays(now, 30);
      const { data: attendanceBlocks } = await supabase
        .from("staff_attendance_blocks")
        .select("user_id, session_id, check_in_time, check_out_time, is_break")
        .gte("check_in_time", format(thirtyDaysAgo, "yyyy-MM-dd"));

      const { data: breaks } = await supabase
        .from("staff_breaks")
        .select("user_id, duration_minutes")
        .gte("break_start_time", format(thirtyDaysAgo, "yyyy-MM-dd"));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name");

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, venue_id")
        .eq("role", "employee");

      // Calculate staff discipline
      const staffMap: Record<string, StaffDiscipline> = {};

      userRoles?.forEach(role => {
        const profile = profiles?.find(p => p.id === role.user_id);
        if (profile) {
          staffMap[role.user_id] = {
            id: role.user_id,
            name: profile.full_name,
            daysAssigned: 30, // Simplified - assuming all days
            daysPresent: 0,
            lateCheckIns: 0,
            missedCheckouts: 0,
            complianceRate: 0,
            averageBreakMinutes: 0,
            status: 'Disciplined',
          };
        }
      });

      // Count attendance by SESSION (not calendar days)
      // This ensures shifts crossing midnight are counted as one session
      const userSessions: Record<string, Set<string>> = {};
      
      attendanceBlocks?.forEach(block => {
        const userId = block.user_id;
        if (!staffMap[userId]) return;

        // Track unique sessions worked (session_id is the source of truth)
        const sessionId = block.session_id;
        if (!userSessions[userId]) userSessions[userId] = new Set();
        userSessions[userId].add(sessionId);

        // Check for late check-in (after 7 PM / 19:00)
        // This is still time-based but acceptable for discipline tracking
        const checkInHour = new Date(block.check_in_time).getHours();
        if (checkInHour > 19) {
          staffMap[userId].lateCheckIns++;
        }

        // Check for missed checkout (only for non-break blocks)
        if (!block.check_out_time && !block.is_break) {
          // Check if it's been more than 12 hours since check-in
          const hoursSince = (now.getTime() - new Date(block.check_in_time).getTime()) / (1000 * 60 * 60);
          if (hoursSince > 12) {
            staffMap[userId].missedCheckouts++;
          }
        }
      });

      // Calculate sessions present (not days - sessions can span midnight)
      Object.keys(userSessions).forEach(userId => {
        if (staffMap[userId]) {
          staffMap[userId].daysPresent = userSessions[userId].size; // "daysPresent" now means "sessionsPresent"
        }
      });

      // Calculate average break duration
      const userBreaks: Record<string, number[]> = {};
      breaks?.forEach(b => {
        if (!userBreaks[b.user_id]) userBreaks[b.user_id] = [];
        if (b.duration_minutes) {
          userBreaks[b.user_id].push(b.duration_minutes);
        }
      });

      Object.keys(userBreaks).forEach(userId => {
        if (staffMap[userId] && userBreaks[userId].length > 0) {
          const total = userBreaks[userId].reduce((a, b) => a + b, 0);
          staffMap[userId].averageBreakMinutes = Math.round(total / userBreaks[userId].length);
        }
      });

      // Calculate compliance rate and status
      Object.values(staffMap).forEach(staff => {
        const attendanceRate = staff.daysAssigned > 0 ? (staff.daysPresent / staff.daysAssigned) * 100 : 0;
        const issueRate = (staff.lateCheckIns + staff.missedCheckouts) / Math.max(staff.daysPresent, 1);
        
        staff.complianceRate = Math.round(attendanceRate - (issueRate * 10));
        
        if (staff.complianceRate >= 80 && staff.missedCheckouts === 0) {
          staff.status = 'Disciplined';
        } else if (staff.complianceRate >= 60) {
          staff.status = 'Needs Attention';
        } else {
          staff.status = 'Non-Compliant';
        }
      });

      setStaffDiscipline(Object.values(staffMap).sort((a, b) => b.complianceRate - a.complianceRate));

      // Fetch exceptions
      const { data: sessions } = await supabase
        .from("club_sessions")
        .select("venue_id, force_close_reason, session_date")
        .gte("session_date", format(thirtyDaysAgo, "yyyy-MM-dd"));

      const exceptionsList: ComplianceException[] = [];

      sessions?.forEach(session => {
        const venue = venues?.find(v => v.id === session.venue_id);
        const venueName = venue?.name || 'Unknown Club';

        if (session.force_close_reason) {
          exceptionsList.push({
            type: 'force_closed',
            clubName: venueName,
            date: session.session_date,
            details: session.force_close_reason,
          });
        }
      });

      setExceptions(exceptionsList.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));

    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      if (showLoading) setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();

    // Set up real-time subscriptions for auto-refresh
    const channel = supabase
      .channel('analytics-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_reports' },
        () => {
          console.log('Sales data changed, refreshing analytics...');
          // Small delay to ensure DB write is complete
          setTimeout(() => fetchAnalytics(false), 300);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_attendance_blocks' },
        () => {
          console.log('Attendance data changed, refreshing analytics...');
          setTimeout(() => fetchAnalytics(false), 300);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_breaks' },
        () => {
          console.log('Break data changed, refreshing analytics...');
          setTimeout(() => fetchAnalytics(false), 300);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'club_sessions' },
        () => {
          console.log('Session data changed, refreshing analytics...');
          setTimeout(() => fetchAnalytics(false), 300);
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchAnalytics]);

  return { 
    salesAnalytics, 
    clubPerformance, 
    staffDiscipline, 
    exceptions, 
    loading,
    lastUpdated,
    refresh: () => fetchAnalytics(true)
  };
};
