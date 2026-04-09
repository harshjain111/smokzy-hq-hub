import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileDown,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Venue {
  id: string;
  name: string;
}

interface FlavourBreakdown {
  flavour_name: string;
  packets_dispatched: number;
  packets_used: number;
  shisha_sold: number;
  mismatch: number;
}

interface VenueReport {
  venue_id: string;
  venue_name: string;
  total_dispatched: number;
  total_used: number;
  total_sold: number;
  mismatch: number;
  flavour_breakdown: FlavourBreakdown[];
}

const formatDate = (d: Date): string => d.toISOString().split("T")[0];

const DailyClubReport = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [reports, setReports] = useState<VenueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set());

  const dateStr = formatDate(selectedDate);

  useEffect(() => {
    fetchReport();
  }, [selectedDate]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [
        { data: venues },
        { data: dispatches },
        { data: stockDaily },
        { data: salesData },
        { data: trackableCategories },
        { data: flavours },
      ] = await Promise.all([
        supabase.from("venues").select("id, name").order("name"),
        supabase.from("packet_dispatches").select("*").eq("date", dateStr),
        supabase.from("venue_stock_daily").select("*").eq("date", dateStr),
        supabase.from("sales_reports").select("*, venue_hookah_categories!inner(id, category_name, is_packet_trackable)").eq("report_date", dateStr),
        supabase.from("venue_hookah_categories").select("id, venue_id, category_name, is_packet_trackable").eq("is_packet_trackable", true),
        supabase.from("flavours").select("id, name").eq("is_active", true),
      ]);

      if (!venues) { setReports([]); return; }

      const flavourMap = new Map((flavours || []).map((f: any) => [f.id, f.name]));
      const trackableCatIds = new Set((trackableCategories || []).map((c: any) => c.id));

      const venueReports: VenueReport[] = venues.map((venue: any) => {
        // Dispatches for this venue grouped by flavour
        const venueDispatches = (dispatches || []).filter((d: any) => d.venue_id === venue.id);
        const dispatchByFlavour = new Map<string, number>();
        venueDispatches.forEach((d: any) => {
          dispatchByFlavour.set(d.flavour_id, (dispatchByFlavour.get(d.flavour_id) || 0) + d.quantity_sent);
        });

        // Stock daily for this venue (packets_used)
        const venueStock = (stockDaily || []).find((s: any) => s.venue_id === venue.id);
        const packetsUsed = venueStock?.packets_used || 0;

        // Sales from trackable categories only
        const venueSales = (salesData || []).filter(
          (s: any) => s.venue_id === venue.id && trackableCatIds.has(s.category_id)
        );
        const totalSold = venueSales.reduce((sum: number, s: any) => sum + s.quantity_sold, 0);

        const totalDispatched = venueDispatches.reduce((sum: number, d: any) => sum + d.quantity_sent, 0);

        // Build flavour breakdown from dispatches
        const flavourBreakdowns: FlavourBreakdown[] = [];
        const allFlavourIds = new Set([...dispatchByFlavour.keys()]);

        allFlavourIds.forEach((fid) => {
          const dispatched = dispatchByFlavour.get(fid) || 0;
          flavourBreakdowns.push({
            flavour_name: flavourMap.get(fid) || "Unknown",
            packets_dispatched: dispatched,
            packets_used: 0, // per-flavour usage not tracked yet
            shisha_sold: 0,  // per-flavour sales not tracked yet
            mismatch: 0,
          });
        });

        // Sort by flavour name
        flavourBreakdowns.sort((a, b) => a.flavour_name.localeCompare(b.flavour_name));

        return {
          venue_id: venue.id,
          venue_name: venue.name,
          total_dispatched: totalDispatched,
          total_used: packetsUsed,
          total_sold: totalSold,
          mismatch: packetsUsed - totalSold,
          flavour_breakdown: flavourBreakdowns,
        };
      });

      setReports(venueReports);
    } catch (err: any) {
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (venueId: string) => {
    setExpandedVenues((prev) => {
      const next = new Set(prev);
      if (next.has(venueId)) next.delete(venueId);
      else next.add(venueId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedVenues(new Set(reports.map((r) => r.venue_id)));
  };

  const collapseAll = () => {
    setExpandedVenues(new Set());
  };

  const navigateDay = (dir: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + dir);
    setSelectedDate(next);
  };

  // Summary stats
  const summary = useMemo(() => {
    const totalDispatched = reports.reduce((s, r) => s + r.total_dispatched, 0);
    const totalUsed = reports.reduce((s, r) => s + r.total_used, 0);
    const totalSold = reports.reduce((s, r) => s + r.total_sold, 0);
    const totalMismatch = totalUsed - totalSold;
    const flaggedClubs = reports.filter((r) => r.mismatch !== 0).length;
    return { totalDispatched, totalUsed, totalSold, totalMismatch, flaggedClubs };
  }, [reports]);

  const getMismatchColor = (val: number) => {
    if (val > 0) return "text-destructive"; // Leakage
    if (val < 0) return "text-warning"; // Data error (using warning from design system)
    return "text-success";
  };

  const getMismatchBg = (val: number) => {
    if (val > 0) return "bg-destructive/10 border-destructive/30";
    if (val < 0) return "bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-700";
    return "bg-success/10 border-success/30";
  };

  const getMismatchLabel = (val: number) => {
    if (val > 0) return "Leakage";
    if (val < 0) return "Data Error";
    return "OK";
  };

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const dateLabel = selectedDate.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Header
    doc.setFontSize(18);
    doc.text("Smokzy Daily Club Report", 14, 20);
    doc.setFontSize(11);
    doc.text(dateLabel, 14, 28);

    // Summary
    doc.setFontSize(10);
    doc.text(`Total Dispatched: ${summary.totalDispatched} | Packets Used: ${summary.totalUsed} | Shisha Sold: ${summary.totalSold} | Net Mismatch: ${summary.totalMismatch}`, 14, 36);
    doc.text(`Flagged Clubs: ${summary.flaggedClubs} / ${reports.length}`, 14, 42);

    // Main table
    const tableData = reports.map((r) => [
      r.venue_name,
      r.total_dispatched.toString(),
      r.total_used.toString(),
      r.total_sold.toString(),
      (r.mismatch > 0 ? "+" : "") + r.mismatch.toString(),
      getMismatchLabel(r.mismatch),
    ]);

    autoTable(doc, {
      startY: 48,
      head: [["Club", "Dispatched", "Packets Used", "Shisha Sold", "Mismatch", "Status"]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 65, 214] },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 4) {
          const val = parseInt(data.cell.raw);
          if (val > 0) {
            data.cell.styles.textColor = [220, 38, 38]; // Red
            data.cell.styles.fontStyle = "bold";
          } else if (val < 0) {
            data.cell.styles.textColor = [234, 138, 0]; // Orange
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [22, 163, 74]; // Green
          }
        }
      },
    });

    // Add flavour breakdowns for flagged clubs
    let currentY = (doc as any).lastAutoTable?.finalY + 10 || 100;
    const flaggedReports = reports.filter((r) => r.mismatch !== 0 && r.flavour_breakdown.length > 0);

    if (flaggedReports.length > 0) {
      doc.setFontSize(12);
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      doc.text("Flagged Clubs — Flavour Breakdown", 14, currentY);
      currentY += 6;

      flaggedReports.forEach((r) => {
        if (currentY > 240) { doc.addPage(); currentY = 20; }
        doc.setFontSize(10);
        doc.text(`${r.venue_name} (Mismatch: ${r.mismatch > 0 ? "+" : ""}${r.mismatch})`, 14, currentY);
        currentY += 4;

        autoTable(doc, {
          startY: currentY,
          head: [["Flavour", "Dispatched"]],
          body: r.flavour_breakdown.map((fb) => [fb.flavour_name, fb.packets_dispatched.toString()]),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [120, 120, 120] },
          margin: { left: 18 },
          tableWidth: 100,
        });
        currentY = (doc as any).lastAutoTable?.finalY + 8 || currentY + 30;
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.text(
        `Generated on ${new Date().toLocaleString("en-IN")} | Page ${i}/${pageCount}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`Smokzy_Daily_Report_${dateStr}.pdf`);
    toast.success("PDF downloaded");
  };

  return (
    <PageLayout
      title="Daily Club Report"
      subtitle={selectedDate.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}
    >
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateDay(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDay(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
            <Button onClick={handleExportPDF} variant="default" size="sm">
              <FileDown className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* KPI Summary Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="Dispatched" value={summary.totalDispatched} unit="packets" />
          <SummaryCard label="Packets Used" value={summary.totalUsed} unit="packets" />
          <SummaryCard label="Shisha Sold" value={summary.totalSold} unit="orders" />
          <SummaryCard
            label="Net Mismatch"
            value={summary.totalMismatch}
            unit={getMismatchLabel(summary.totalMismatch)}
            className={getMismatchColor(summary.totalMismatch)}
          />
          <SummaryCard
            label="Flagged Clubs"
            value={summary.flaggedClubs}
            unit={`/ ${reports.length}`}
            className={summary.flaggedClubs > 0 ? "text-destructive" : "text-success"}
          />
        </div>

        {/* Report Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading report...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium w-8"></th>
                      <th className="p-3 text-left font-medium">Club</th>
                      <th className="p-3 text-center font-medium">Dispatched</th>
                      <th className="p-3 text-center font-medium">Packets Used</th>
                      <th className="p-3 text-center font-medium">Shisha Sold</th>
                      <th className="p-3 text-center font-medium">Mismatch</th>
                      <th className="p-3 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => {
                      const isExpanded = expandedVenues.has(r.venue_id);
                      const hasFlavours = r.flavour_breakdown.length > 0;
                      return (
                        <>
                          <tr
                            key={r.venue_id}
                            className={`border-b cursor-pointer transition-colors hover:bg-muted/30 ${
                              r.mismatch !== 0 ? getMismatchBg(r.mismatch) : ""
                            }`}
                            onClick={() => hasFlavours && toggleExpand(r.venue_id)}
                          >
                            <td className="p-3 text-center">
                              {hasFlavours &&
                                (isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ))}
                            </td>
                            <td className="p-3 font-medium">{r.venue_name}</td>
                            <td className="p-3 text-center">{r.total_dispatched}</td>
                            <td className="p-3 text-center">{r.total_used}</td>
                            <td className="p-3 text-center">{r.total_sold}</td>
                            <td className={`p-3 text-center font-bold ${getMismatchColor(r.mismatch)}`}>
                              {r.mismatch > 0 ? "+" : ""}
                              {r.mismatch}
                            </td>
                            <td className="p-3 text-center">
                              {r.mismatch === 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs text-success">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  OK
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 text-xs font-medium ${getMismatchColor(r.mismatch)}`}>
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  {getMismatchLabel(r.mismatch)}
                                </span>
                              )}
                            </td>
                          </tr>
                          {/* Expanded flavour breakdown */}
                          {isExpanded && hasFlavours && (
                            <tr key={`${r.venue_id}-detail`}>
                              <td colSpan={7} className="p-0">
                                <div className="bg-muted/20 border-l-4 border-primary/40 mx-4 my-2 rounded-lg overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-muted/40">
                                        <th className="p-2 text-left font-medium pl-4">Flavour</th>
                                        <th className="p-2 text-center font-medium">Dispatched</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.flavour_breakdown.map((fb, i) => (
                                        <tr key={i} className="border-t border-muted/30">
                                          <td className="p-2 pl-4">{fb.flavour_name}</td>
                                          <td className="p-2 text-center">{fb.packets_dispatched}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                    {/* Totals row */}
                    <tr className="border-t-2 bg-muted/50 font-semibold">
                      <td className="p-3"></td>
                      <td className="p-3">TOTAL</td>
                      <td className="p-3 text-center">{summary.totalDispatched}</td>
                      <td className="p-3 text-center">{summary.totalUsed}</td>
                      <td className="p-3 text-center">{summary.totalSold}</td>
                      <td className={`p-3 text-center font-bold ${getMismatchColor(summary.totalMismatch)}`}>
                        {summary.totalMismatch > 0 ? "+" : ""}
                        {summary.totalMismatch}
                      </td>
                      <td className="p-3 text-center">
                        {summary.flaggedClubs > 0 ? (
                          <span className="text-xs text-destructive">{summary.flaggedClubs} flagged</span>
                        ) : (
                          <span className="text-xs text-success">All clear</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-destructive/80" />
            Positive mismatch = Leakage (packets used but not sold)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-400" />
            Negative mismatch = Data error (more sold than used)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-success/80" />
            Zero = All clear
          </span>
        </div>
      </div>
    </PageLayout>
  );
};

// Small summary card component
const SummaryCard = ({
  label,
  value,
  unit,
  className,
}: {
  label: string;
  value: number;
  unit: string;
  className?: string;
}) => (
  <Card>
    <CardContent className="p-3 text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-bold ${className || "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{unit}</div>
    </CardContent>
  </Card>
);

export default DailyClubReport;
