import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DailyData {
  date: string;
  dateLabel: string;
  dispatched: number;
  used: number;
  sold: number;
  mismatch: number;
  inspections: number;
}

interface VenueWeeklySummary {
  venue_id: string;
  venue_name: string;
  total_dispatched: number;
  total_used: number;
  total_sold: number;
  mismatch: number;
  inspections: number;
  avg_score: number;
}

const getWeekDates = (weekOffset: number) => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const fmt = (d: Date) => d.toISOString().split("T")[0];

const WeeklySummary = () => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [venueData, setVenueData] = useState<VenueWeeklySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = fmt(weekDates[0]);
  const weekEnd = fmt(weekDates[6]);
  const weekLabel = `${weekDates[0].toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — ${weekDates[6].toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  useEffect(() => {
    fetchWeekData();
  }, [weekOffset]);

  const fetchWeekData = async () => {
    setLoading(true);

    const [
      { data: dispatches },
      { data: stockDaily },
      { data: sales },
      { data: trackableCats },
      { data: inspections },
      { data: venues },
    ] = await Promise.all([
      supabase.from("packet_dispatches").select("*").gte("date", weekStart).lte("date", weekEnd),
      supabase.from("venue_stock_daily").select("*").gte("date", weekStart).lte("date", weekEnd),
      supabase.from("sales_reports").select("*").gte("report_date", weekStart).lte("report_date", weekEnd),
      supabase.from("venue_hookah_categories").select("id").eq("is_packet_trackable", true),
      supabase.from("inspections").select("id, venue_id, date, score").gte("date", weekStart).lte("date", weekEnd),
      supabase.from("venues").select("id, name").order("name"),
    ]);

    const trackableIds = new Set((trackableCats || []).map((c) => c.id));

    // Daily aggregation
    const daily: DailyData[] = weekDates.map((d) => {
      const dateStr = fmt(d);
      const dayDispatches = (dispatches || []).filter((p) => p.date === dateStr);
      const dayStock = (stockDaily || []).filter((s) => s.date === dateStr);
      const daySales = (sales || []).filter((s) => s.report_date === dateStr && trackableIds.has(s.category_id));
      const dayInspections = (inspections || []).filter((i) => i.date === dateStr);

      const dispatched = dayDispatches.reduce((s, p) => s + p.quantity_sent, 0);
      const used = dayStock.reduce((s, p) => s + p.packets_used, 0);
      const sold = daySales.reduce((s, p) => s + p.quantity_sold, 0);

      return {
        date: dateStr,
        dateLabel: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
        dispatched,
        used,
        sold,
        mismatch: used - sold,
        inspections: dayInspections.length,
      };
    });

    // Venue aggregation
    const venueSummaries: VenueWeeklySummary[] = (venues || []).map((v: any) => {
      const vDispatches = (dispatches || []).filter((p) => p.venue_id === v.id);
      const vStock = (stockDaily || []).filter((s) => s.venue_id === v.id);
      const vSales = (sales || []).filter((s) => s.venue_id === v.id && trackableIds.has(s.category_id));
      const vInspections = (inspections || []).filter((i) => i.venue_id === v.id);

      const totalDispatched = vDispatches.reduce((s, p) => s + p.quantity_sent, 0);
      const totalUsed = vStock.reduce((s, p) => s + p.packets_used, 0);
      const totalSold = vSales.reduce((s, p) => s + p.quantity_sold, 0);
      const avgScore = vInspections.length > 0
        ? Math.round(vInspections.reduce((s, i) => s + (i.score || 0), 0) / vInspections.length)
        : 0;

      return {
        venue_id: v.id,
        venue_name: v.name,
        total_dispatched: totalDispatched,
        total_used: totalUsed,
        total_sold: totalSold,
        mismatch: totalUsed - totalSold,
        inspections: vInspections.length,
        avg_score: avgScore,
      };
    });

    setDailyData(daily);
    setVenueData(venueSummaries);
    setLoading(false);
  };

  // Totals
  const totals = useMemo(() => ({
    dispatched: dailyData.reduce((s, d) => s + d.dispatched, 0),
    used: dailyData.reduce((s, d) => s + d.used, 0),
    sold: dailyData.reduce((s, d) => s + d.sold, 0),
    mismatch: dailyData.reduce((s, d) => s + d.mismatch, 0),
    inspections: dailyData.reduce((s, d) => s + d.inspections, 0),
    flaggedClubs: venueData.filter((v) => v.mismatch !== 0).length,
  }), [dailyData, venueData]);

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text("Smokzy Weekly Summary", 14, 20);
    doc.setFontSize(11);
    doc.text(weekLabel, 14, 28);

    // KPI summary
    doc.setFontSize(10);
    doc.text(
      `Dispatched: ${totals.dispatched} | Used: ${totals.used} | Sold: ${totals.sold} | Mismatch: ${totals.mismatch} | Inspections: ${totals.inspections} | Flagged: ${totals.flaggedClubs}`,
      14, 36
    );

    // Daily breakdown table
    autoTable(doc, {
      startY: 42,
      head: [["Day", "Dispatched", "Used", "Sold", "Mismatch", "Inspections"]],
      body: dailyData.map((d) => [
        d.dateLabel,
        d.dispatched.toString(),
        d.used.toString(),
        d.sold.toString(),
        (d.mismatch > 0 ? "+" : "") + d.mismatch.toString(),
        d.inspections.toString(),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 65, 214] },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 4) {
          const val = parseInt(data.cell.raw);
          if (val > 0) data.cell.styles.textColor = [220, 38, 38];
          else if (val < 0) data.cell.styles.textColor = [234, 138, 0];
          else data.cell.styles.textColor = [22, 163, 74];
        }
      },
    });

    // Club performance matrix
    let currentY = (doc as any).lastAutoTable?.finalY + 10 || 100;
    if (currentY > 200) { doc.addPage(); currentY = 20; }
    doc.setFontSize(12);
    doc.text("Club Performance Matrix", 14, currentY);
    currentY += 4;

    autoTable(doc, {
      startY: currentY,
      head: [["Club", "Dispatched", "Used", "Sold", "Mismatch", "Inspections", "Avg Score"]],
      body: venueData
        .filter((v) => v.total_dispatched > 0 || v.total_used > 0 || v.inspections > 0)
        .map((v) => [
          v.venue_name,
          v.total_dispatched.toString(),
          v.total_used.toString(),
          v.total_sold.toString(),
          (v.mismatch > 0 ? "+" : "") + v.mismatch.toString(),
          v.inspections.toString(),
          v.avg_score > 0 ? `${v.avg_score}%` : "—",
        ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [99, 65, 214] },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 4) {
          const val = parseInt(data.cell.raw);
          if (val > 0) { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = "bold"; }
          else if (val < 0) { data.cell.styles.textColor = [234, 138, 0]; }
          else data.cell.styles.textColor = [22, 163, 74];
        }
      },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.text(`Generated on ${new Date().toLocaleString("en-IN")} | Page ${i}/${pageCount}`, 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`Smokzy_Weekly_${weekStart}_${weekEnd}.pdf`);
    toast.success("Weekly PDF downloaded");
  };

  return (
    <PageLayout title="Weekly Summary" subtitle={weekLabel}>
      <div className="space-y-5">
        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
              This Week
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleExportPDF} size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading weekly data...
          </div>
        ) : (
          <>
            {/* KPI Strip */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <KPICard label="Dispatched" value={totals.dispatched} />
              <KPICard label="Used" value={totals.used} />
              <KPICard label="Sold" value={totals.sold} />
              <KPICard
                label="Mismatch"
                value={totals.mismatch}
                className={totals.mismatch > 0 ? "text-destructive" : "text-success"}
              />
              <KPICard label="Inspections" value={totals.inspections} />
              <KPICard
                label="Flagged"
                value={totals.flaggedClubs}
                className={totals.flaggedClubs > 0 ? "text-destructive" : "text-success"}
              />
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Daily Mismatch Trend</CardTitle>
                </CardHeader>
                <CardContent className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="mismatch"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Mismatch"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Daily Packets Dispatched</CardTitle>
                </CardHeader>
                <CardContent className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip />
                      <Bar dataKey="dispatched" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Dispatched" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Club Performance Matrix */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Club Performance Matrix</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Club</th>
                        <th className="p-3 text-center font-medium">Dispatched</th>
                        <th className="p-3 text-center font-medium">Used</th>
                        <th className="p-3 text-center font-medium">Sold</th>
                        <th className="p-3 text-center font-medium">Mismatch</th>
                        <th className="p-3 text-center font-medium">Inspections</th>
                        <th className="p-3 text-center font-medium">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {venueData.map((v) => (
                        <tr
                          key={v.venue_id}
                          className={`border-b ${v.mismatch > 0 ? "bg-destructive/5" : v.mismatch < 0 ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}
                        >
                          <td className="p-3 font-medium">{v.venue_name}</td>
                          <td className="p-3 text-center">{v.total_dispatched}</td>
                          <td className="p-3 text-center">{v.total_used}</td>
                          <td className="p-3 text-center">{v.total_sold}</td>
                          <td className={`p-3 text-center font-bold ${
                            v.mismatch > 0 ? "text-destructive" : v.mismatch < 0 ? "text-orange-500" : "text-success"
                          }`}>
                            {v.mismatch > 0 ? "+" : ""}{v.mismatch}
                          </td>
                          <td className="p-3 text-center">{v.inspections}</td>
                          <td className={`p-3 text-center ${
                            v.avg_score >= 80 ? "text-success" : v.avg_score >= 50 ? "text-warning" : v.avg_score > 0 ? "text-destructive" : "text-muted-foreground"
                          }`}>
                            {v.avg_score > 0 ? `${v.avg_score}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageLayout>
  );
};

const KPICard = ({ label, value, className }: { label: string; value: number; className?: string }) => (
  <Card>
    <CardContent className="p-3 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${className || "text-foreground"}`}>{value}</div>
    </CardContent>
  </Card>
);

export default WeeklySummary;
