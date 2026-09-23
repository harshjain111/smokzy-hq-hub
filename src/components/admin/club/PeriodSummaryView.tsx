import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, AlertTriangle, XCircle, CalendarOff, Activity, TrendingUp, Users, Package } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { SectionCard, KpiGrid, KpiTile } from "./DashboardPrimitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PeriodSummaryViewProps {
  clubId: string;
  clubName: string;
  dateRange: { from: Date; to: Date };
}

interface PeriodSession {
  id: string;
  session_date: string;
  stock_submitted: boolean;
  sales_submitted: boolean;
  photo_uploaded: boolean;
  force_close_reason: string | null;
}

interface StaffStat {
  name: string;
  sessions: number;
  totalHours: number;
  missedCheckouts: number;
}

interface CategoryStat {
  name: string;
  total: number;
}

export const PeriodSummaryView = ({ clubId, clubName, dateRange }: PeriodSummaryViewProps) => {
  const [sessions, setSessions] = useState<PeriodSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [categorySales, setCategorySales] = useState<CategoryStat[]>([]);
  const [staffStats, setStaffStats] = useState<StaffStat[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; sales: number }[]>([]);

  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");

  useEffect(() => {
    fetchPeriodData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, fromStr, toStr]);

  const fetchPeriodData = async () => {
    setLoading(true);
    try {
      const { data: sessionRows } = await supabase
        .from("club_sessions")
        .select("id, session_date, stock_submitted, sales_submitted, photo_uploaded, force_close_reason")
        .eq("venue_id", clubId)
        .gte("session_date", fromStr)
        .lte("session_date", toStr)
        .order("session_date", { ascending: true });

      const periodSessions = sessionRows || [];
      setSessions(periodSessions);

      if (periodSessions.length === 0) {
        setTotalSales(0);
        setCategorySales([]);
        setStaffStats([]);
        setTrendData([]);
        setLoading(false);
        return;
      }

      const sessionIds = periodSessions.map(s => s.id);
      const sessionDates = periodSessions.map(s => s.session_date);

      const [{ data: salesData }, { data: categories }, { data: attendanceData }] = await Promise.all([
        supabase.from("sales_reports").select("category_id, quantity_sold, report_date").eq("venue_id", clubId).in("report_date", sessionDates),
        supabase.from("venue_hookah_categories").select("id, category_name").eq("venue_id", clubId),
        supabase.from("staff_attendance_blocks").select("user_id, check_in_time, check_out_time, session_id").in("session_id", sessionIds),
      ]);

      const total = salesData?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      setTotalSales(total);

      const catStats = (categories || []).map(cat => ({
        name: cat.category_name,
        total: salesData?.filter(s => s.category_id === cat.id).reduce((sum, s) => sum + s.quantity_sold, 0) || 0,
      })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
      setCategorySales(catStats);

      const dailyTotals = new Map<string, number>();
      salesData?.forEach(s => {
        dailyTotals.set(s.report_date, (dailyTotals.get(s.report_date) || 0) + s.quantity_sold);
      });
      setTrendData(
        Array.from(dailyTotals.entries())
          .map(([date, sales]) => ({ date, sales }))
          .sort((a, b) => a.date.localeCompare(b.date))
      );

      const staffIds = [...new Set(attendanceData?.map(a => a.user_id) || [])];
      const { data: profiles } = staffIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", staffIds)
        : { data: [] as { id: string; full_name: string }[] };

      const staffMap = new Map<string, { name: string; sessions: Set<string>; totalMinutes: number; missedCheckouts: number }>();
      attendanceData?.forEach(a => {
        const existing = staffMap.get(a.user_id) || {
          name: profiles?.find(p => p.id === a.user_id)?.full_name || "Unknown",
          sessions: new Set<string>(),
          totalMinutes: 0,
          missedCheckouts: 0,
        };
        existing.sessions.add(a.session_id);
        if (a.check_out_time) {
          existing.totalMinutes += differenceInMinutes(new Date(a.check_out_time), new Date(a.check_in_time));
        } else {
          existing.missedCheckouts += 1;
        }
        staffMap.set(a.user_id, existing);
      });

      setStaffStats(
        Array.from(staffMap.values())
          .map(s => ({
            name: s.name,
            sessions: s.sessions.size,
            totalHours: Math.round((s.totalMinutes / 60) * 10) / 10,
            missedCheckouts: s.missedCheckouts,
          }))
          .sort((a, b) => b.sessions - a.sessions)
      );
    } catch (error) {
      console.error("Error fetching period summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportPeriodReport = () => {
    const lines: string[] = [];
    lines.push(`Period Report — ${clubName}`);
    lines.push(`${format(dateRange.from, "dd MMM yyyy")} to ${format(dateRange.to, "dd MMM yyyy")}`);
    lines.push("");
    lines.push("Category,Total Sold");
    categorySales.forEach(c => lines.push(`${c.name},${c.total}`));
    lines.push(`Total,${totalSales}`);
    lines.push("");
    lines.push("Staff,Sessions,Total Hours,Missed Checkouts");
    staffStats.forEach(s => lines.push(`${s.name},${s.sessions},${s.totalHours},${s.missedCheckouts}`));

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clubName}-period-${fromStr}-to-${toStr}.csv`;
    a.click();
    toast.success("Period report exported");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CalendarOff className="h-10 w-10 mb-3 opacity-40" />
        <div className="text-sm font-medium">No sessions in this period</div>
        <div className="text-xs mt-1">
          {format(dateRange.from, "dd MMM yyyy")} – {format(dateRange.to, "dd MMM yyyy")}
        </div>
      </div>
    );
  }

  const completeSessions = sessions.filter(s => s.stock_submitted && s.sales_submitted && s.photo_uploaded).length;
  const forceClosedSessions = sessions.filter(s => s.force_close_reason).length;
  const complianceRate = Math.round((completeSessions / sessions.length) * 100);
  const avgSalesPerSession = Math.round((totalSales / sessions.length) * 10) / 10;
  const totalStaffHours = Math.round(staffStats.reduce((sum, s) => sum + s.totalHours, 0));

  const missingStock = sessions.filter(s => !s.stock_submitted).map(s => format(new Date(s.session_date), "dd MMM"));
  const missingSales = sessions.filter(s => !s.sales_submitted).map(s => format(new Date(s.session_date), "dd MMM"));
  const missingPhotos = sessions.filter(s => !s.photo_uploaded).map(s => format(new Date(s.session_date), "dd MMM"));
  const hasFlags = missingStock.length > 0 || missingSales.length > 0 || missingPhotos.length > 0 || forceClosedSessions > 0;

  return (
    <div className="space-y-4">
      <KpiGrid>
        <KpiTile
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total Sales"
          value={String(totalSales)}
          sub={`${sessions.length} session${sessions.length === 1 ? '' : 's'}`}
          tone="primary"
        />
        <KpiTile
          icon={<Activity className="h-4 w-4" />}
          label="Avg / Session"
          value={String(avgSalesPerSession)}
          sub="hookahs sold"
          tone="muted"
        />
        <KpiTile
          icon={<Package className="h-4 w-4" />}
          label="Compliance"
          value={`${complianceRate}%`}
          sub={`${completeSessions}/${sessions.length} complete`}
          tone={complianceRate >= 80 ? 'success' : complianceRate >= 50 ? 'warning' : 'destructive'}
        />
        <KpiTile
          icon={<Users className="h-4 w-4" />}
          label="Staff Hours"
          value={`${totalStaffHours}h`}
          sub={`${staffStats.length} staff`}
          tone="muted"
        />
      </KpiGrid>

      <SectionCard
        title="Sales"
        action={
          <Button variant="outline" size="sm" onClick={exportPeriodReport} className="h-7 text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
        }
      >
        <div className="space-y-4">
          {trendData.length > 1 && (
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => format(new Date(d), "dd")}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    labelFormatter={(d) => format(new Date(d), "MMM dd, EEE")}
                    contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                  />
                  <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {categorySales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs text-right">Total Sold</TableHead>
                  <TableHead className="text-xs text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categorySales.map(cat => (
                  <TableRow key={cat.name}>
                    <TableCell className="text-xs font-medium">{cat.name}</TableCell>
                    <TableCell className="text-xs text-right">{cat.total}</TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {totalSales > 0 ? Math.round((cat.total / totalSales) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No sales recorded in this period</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Attendance">
        {staffStats.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Staff</TableHead>
                <TableHead className="text-xs text-center">Sessions</TableHead>
                <TableHead className="text-xs text-center">Hours</TableHead>
                <TableHead className="text-xs text-center">Missed Checkouts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffStats.map(s => (
                <TableRow key={s.name}>
                  <TableCell className="text-xs font-medium">{s.name}</TableCell>
                  <TableCell className="text-xs text-center">{s.sessions}</TableCell>
                  <TableCell className="text-xs text-center">{s.totalHours}h</TableCell>
                  <TableCell className={`text-xs text-center ${s.missedCheckouts > 0 ? 'text-destructive font-medium' : ''}`}>
                    {s.missedCheckouts}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No attendance recorded in this period</p>
        )}
      </SectionCard>

      {hasFlags && (
        <SectionCard title="Exceptions">
          <div className="space-y-1.5">
            {missingStock.length > 0 && (
              <div className="flex items-start gap-2 text-xs">
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <span><span className="font-medium">Stock not submitted:</span> {missingStock.join(", ")}</span>
              </div>
            )}
            {missingSales.length > 0 && (
              <div className="flex items-start gap-2 text-xs">
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <span><span className="font-medium">Sales not submitted:</span> {missingSales.join(", ")}</span>
              </div>
            )}
            {missingPhotos.length > 0 && (
              <div className="flex items-start gap-2 text-xs">
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <span><span className="font-medium">Photo not uploaded:</span> {missingPhotos.join(", ")}</span>
              </div>
            )}
            {forceClosedSessions > 0 && (
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span><span className="font-medium">{forceClosedSessions}</span> force closed session{forceClosedSessions === 1 ? '' : 's'}</span>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {!hasFlags && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/10 text-xs text-success">
          <Badge className="bg-success/20 text-success border-success/30 text-[10px]">✓</Badge>
          No compliance issues in this period
        </div>
      )}
    </div>
  );
};
