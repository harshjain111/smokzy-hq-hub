import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, AlertTriangle, CheckCircle2, XCircle, TrendingUp, Users, Package } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface HistoricalSession {
  id: string;
  session_date: string;
  started_at: string;
  closed_at: string | null;
  status: string;
  stock_submitted: boolean;
  sales_submitted: boolean;
  photo_uploaded: boolean;
  force_close_reason: string | null;
}

interface PeriodSummaryPanelProps {
  sessions: HistoricalSession[];
  clubId: string;
  clubName: string;
  dateRange: { from: Date; to: Date };
}

interface PeriodStats {
  totalSessions: number;
  totalSales: number;
  avgSalesPerSession: number;
  completeSessions: number;
  incompleteSessions: number;
  forceClosedSessions: number;
  missingStock: string[];
  missingSales: string[];
  missingPhotos: string[];
  staffStats: { name: string; sessions: number; totalHours: number; missedCheckouts: number }[];
  categorySales: { name: string; total: number }[];
}

export const PeriodSummaryPanel = ({ sessions, clubId, clubName, dateRange }: PeriodSummaryPanelProps) => {
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessions.length > 0) {
      fetchPeriodStats();
    } else {
      setStats(null);
      setLoading(false);
    }
  }, [sessions, clubId]);

  const fetchPeriodStats = async () => {
    setLoading(true);
    try {
      const sessionIds = sessions.map(s => s.id);
      const sessionDates = sessions.map(s => s.session_date);

      // Fetch sales for all sessions in period
      const { data: salesData } = await supabase
        .from("sales_reports")
        .select("category_id, quantity_sold, report_date")
        .eq("venue_id", clubId)
        .in("report_date", sessionDates);

      // Fetch categories
      const { data: categories } = await supabase
        .from("venue_hookah_categories")
        .select("id, category_name")
        .eq("venue_id", clubId);

      // Fetch attendance for period
      const { data: attendanceData } = await supabase
        .from("staff_attendance_blocks")
        .select("user_id, check_in_time, check_out_time, session_id")
        .in("session_id", sessionIds);

      // Fetch profiles for staff
      const staffIds = [...new Set(attendanceData?.map(a => a.user_id) || [])];
      const { data: profiles } = staffIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", staffIds)
        : { data: [] };

      // Calculate stats
      const totalSales = salesData?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;
      
      const completeSessions = sessions.filter(s => s.stock_submitted && s.sales_submitted && s.photo_uploaded).length;
      const forceClosedSessions = sessions.filter(s => s.force_close_reason).length;
      const incompleteSessions = sessions.length - completeSessions;

      const missingStock = sessions.filter(s => !s.stock_submitted).map(s => format(parseISO(s.session_date), "dd MMM"));
      const missingSales = sessions.filter(s => !s.sales_submitted).map(s => format(parseISO(s.session_date), "dd MMM"));
      const missingPhotos = sessions.filter(s => !s.photo_uploaded).map(s => format(parseISO(s.session_date), "dd MMM"));

      // Category breakdown
      const categorySales = categories?.map(cat => ({
        name: cat.category_name,
        total: salesData?.filter(s => s.category_id === cat.id).reduce((sum, s) => sum + s.quantity_sold, 0) || 0,
      })).filter(c => c.total > 0) || [];

      // Staff stats
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

      const staffStats = Array.from(staffMap.values()).map(s => ({
        name: s.name,
        sessions: s.sessions.size,
        totalHours: Math.round(s.totalMinutes / 60 * 10) / 10,
        missedCheckouts: s.missedCheckouts,
      })).sort((a, b) => b.sessions - a.sessions);

      setStats({
        totalSessions: sessions.length,
        totalSales,
        avgSalesPerSession: sessions.length > 0 ? Math.round(totalSales / sessions.length * 10) / 10 : 0,
        completeSessions,
        incompleteSessions,
        forceClosedSessions,
        missingStock,
        missingSales,
        missingPhotos,
        staffStats,
        categorySales,
      });
    } catch (error) {
      console.error("Error fetching period stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!stats) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(clubName, pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Period Report: ${format(dateRange.from, "dd MMM yyyy")} – ${format(dateRange.to, "dd MMM yyyy")}`,
      pageWidth / 2, y, { align: "center" }
    );
    y += 4;
    doc.setFontSize(8);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, pageWidth / 2, y, { align: "center" });
    y += 10;

    // Divider
    doc.setDrawColor(200);
    doc.line(14, y, pageWidth - 14, y);
    y += 8;

    // KPI Summary
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Performance Summary", 14, y);
    y += 8;

    const complianceRate = stats.totalSessions > 0
      ? Math.round((stats.completeSessions / stats.totalSessions) * 100)
      : 0;

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Total Sessions", String(stats.totalSessions)],
        ["Total Hookahs Sold", String(stats.totalSales)],
        ["Avg Sales / Session", String(stats.avgSalesPerSession)],
        ["Compliance Rate", `${complianceRate}%`],
        ["Complete Sessions", String(stats.completeSessions)],
        ["Incomplete Sessions", String(stats.incompleteSessions)],
        ["Force Closed", String(stats.forceClosedSessions)],
      ],
      theme: "grid",
      headStyles: { fillColor: [41, 37, 36] },
      styles: { fontSize: 9 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Flags section
    if (stats.missingStock.length > 0 || stats.missingSales.length > 0 || stats.missingPhotos.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("⚠ Compliance Flags", 14, y);
      y += 6;

      const flagRows: string[][] = [];
      if (stats.missingStock.length > 0) flagRows.push(["Stock Not Submitted", stats.missingStock.join(", ")]);
      if (stats.missingSales.length > 0) flagRows.push(["Sales Not Submitted", stats.missingSales.join(", ")]);
      if (stats.missingPhotos.length > 0) flagRows.push(["Photo Not Uploaded", stats.missingPhotos.join(", ")]);

      autoTable(doc, {
        startY: y,
        head: [["Issue", "Dates Affected"]],
        body: flagRows,
        theme: "grid",
        headStyles: { fillColor: [220, 38, 38] },
        styles: { fontSize: 9 },
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Sales by category
    if (stats.categorySales.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Sales by Category", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Category", "Total Sold"]],
        body: stats.categorySales.map(c => [c.name, String(c.total)]),
        theme: "grid",
        headStyles: { fillColor: [41, 37, 36] },
        styles: { fontSize: 9 },
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Staff report
    if (stats.staffStats.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Staff Report Card", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Staff Name", "Sessions", "Total Hours", "Missed Checkouts"]],
        body: stats.staffStats.map(s => [
          s.name,
          String(s.sessions),
          String(s.totalHours),
          s.missedCheckouts > 0 ? `⚠ ${s.missedCheckouts}` : "0",
        ]),
        theme: "grid",
        headStyles: { fillColor: [41, 37, 36] },
        styles: { fontSize: 9 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 3 && data.cell.raw !== "0") {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
    }

    doc.save(`${clubName}_Report_${format(dateRange.from, "ddMMM")}-${format(dateRange.to, "ddMMM")}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  if (!stats || sessions.length === 0) return null;

  const complianceRate = stats.totalSessions > 0
    ? Math.round((stats.completeSessions / stats.totalSessions) * 100)
    : 0;

  return (
    <div className="space-y-3 mb-4">
      {/* Period KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-primary/10 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-primary">{stats.totalSales}</div>
          <div className="text-[10px] text-muted-foreground">Total Sold</div>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <div className="text-xl font-bold">{stats.avgSalesPerSession}</div>
          <div className="text-[10px] text-muted-foreground">Avg/Session</div>
        </div>
        <div className={`rounded-lg p-3 text-center ${complianceRate >= 80 ? "bg-success/10" : complianceRate >= 50 ? "bg-warning/10" : "bg-destructive/10"}`}>
          <div className={`text-xl font-bold ${complianceRate >= 80 ? "text-success" : complianceRate >= 50 ? "text-warning" : "text-destructive"}`}>
            {complianceRate}%
          </div>
          <div className="text-[10px] text-muted-foreground">Compliance</div>
        </div>
      </div>

      {/* Flags */}
      {(stats.missingStock.length > 0 || stats.missingSales.length > 0 || stats.missingPhotos.length > 0 || stats.forceClosedSessions > 0) && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Flags
          </div>
          {stats.missingStock.length > 0 && (
            <div className="flex items-start gap-2 text-xs">
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <span><span className="font-medium">Stock missing:</span> {stats.missingStock.join(", ")}</span>
            </div>
          )}
          {stats.missingSales.length > 0 && (
            <div className="flex items-start gap-2 text-xs">
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <span><span className="font-medium">Sales missing:</span> {stats.missingSales.join(", ")}</span>
            </div>
          )}
          {stats.missingPhotos.length > 0 && (
            <div className="flex items-start gap-2 text-xs">
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <span><span className="font-medium">Photo missing:</span> {stats.missingPhotos.join(", ")}</span>
            </div>
          )}
          {stats.forceClosedSessions > 0 && (
            <div className="flex items-start gap-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
              <span><span className="font-medium">{stats.forceClosedSessions} force closed</span> session(s)</span>
            </div>
          )}
        </div>
      )}

      {/* Category breakdown */}
      {stats.categorySales.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            Sales by Category
          </div>
          <div className="space-y-1">
            {stats.categorySales.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span>{cat.name}</span>
                <span className="font-medium">{cat.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff summary */}
      {stats.staffStats.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            Staff ({stats.staffStats.length})
          </div>
          <div className="space-y-1.5">
            {stats.staffStats.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span>{s.name}</span>
                  {s.missedCheckouts > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 text-destructive border-destructive/30">
                      {s.missedCheckouts} missed
                    </Badge>
                  )}
                </div>
                <span className="text-muted-foreground">{s.sessions}d · {s.totalHours}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download PDF Report */}
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={generatePDF}>
        <FileText className="h-4 w-4" />
        Download Report Card (PDF)
      </Button>
    </div>
  );
};
