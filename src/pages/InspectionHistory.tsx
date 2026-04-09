import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface Inspection {
  id: string;
  venue_id: string;
  venue_name: string;
  date: string;
  time: string;
  score: number | null;
  violation_noted: boolean;
  remarks: string | null;
  checks_passed: number;
  total_checks: number;
}

interface VenueInspectionSummary {
  venue_id: string;
  venue_name: string;
  last_inspection_date: string | null;
  days_since: number | null;
  total_inspections: number;
  avg_score: number;
  inspections: Inspection[];
}

const CHECK_KEYS = [
  "staff_grooming", "venue_cleanliness", "hookah_quality", "music_ambience",
  "inventory_check", "safety_compliance", "customer_feedback", "staff_behavior",
  "billing_accuracy", "opening_procedure", "closing_procedure", "equipment_condition",
];

const InspectionHistory = () => {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<VenueInspectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: venueData }, { data: inspectionData }] = await Promise.all([
      supabase.from("venues").select("id, name").order("name"),
      supabase.from("inspections").select("*").order("date", { ascending: false }).order("time", { ascending: false }),
    ]);

    const venueMap = new Map((venueData || []).map((v: any) => [v.id, v.name]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const byVenue = new Map<string, Inspection[]>();
    (inspectionData || []).forEach((insp: any) => {
      const list = byVenue.get(insp.venue_id) || [];
      const passed = CHECK_KEYS.filter((k) => insp[k] === true).length;
      list.push({
        id: insp.id,
        venue_id: insp.venue_id,
        venue_name: venueMap.get(insp.venue_id) || "Unknown",
        date: insp.date,
        time: insp.time,
        score: insp.score ?? Math.round((passed / CHECK_KEYS.length) * 100),
        violation_noted: insp.violation_noted || false,
        remarks: insp.remarks,
        checks_passed: passed,
        total_checks: CHECK_KEYS.length,
      });
      byVenue.set(insp.venue_id, list);
    });

    const summaries: VenueInspectionSummary[] = (venueData || []).map((v: any) => {
      const inspections = byVenue.get(v.id) || [];
      const lastDate = inspections.length > 0 ? inspections[0].date : null;
      const daysSince = lastDate
        ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const avgScore =
        inspections.length > 0
          ? Math.round(inspections.reduce((s, i) => s + (i.score || 0), 0) / inspections.length)
          : 0;

      return {
        venue_id: v.id,
        venue_name: v.name,
        last_inspection_date: lastDate,
        days_since: daysSince,
        total_inspections: inspections.length,
        avg_score: avgScore,
        inspections,
      };
    });

    // Sort: venues needing inspection first (never inspected, then longest since)
    summaries.sort((a, b) => {
      if (a.days_since === null && b.days_since !== null) return -1;
      if (a.days_since !== null && b.days_since === null) return 1;
      if (a.days_since === null && b.days_since === null) return a.venue_name.localeCompare(b.venue_name);
      return (b.days_since || 0) - (a.days_since || 0);
    });

    setVenues(summaries);
    setLoading(false);
  };

  const toggleExpand = (venueId: string) => {
    setExpandedVenues((prev) => {
      const next = new Set(prev);
      next.has(venueId) ? next.delete(venueId) : next.add(venueId);
      return next;
    });
  };

  const getDaysBadge = (days: number | null) => {
    if (days === null) return { label: "Never", className: "bg-destructive/15 text-destructive border-destructive/30" };
    if (days <= 3) return { label: `${days}d ago`, className: "bg-success/15 text-success border-success/30" };
    if (days <= 7) return { label: `${days}d ago`, className: "bg-warning/15 text-warning border-warning/30" };
    return { label: `${days}d ago`, className: "bg-destructive/15 text-destructive border-destructive/30" };
  };

  return (
    <PageLayout title="Inspections" subtitle="Club audit history & scheduling">
      <div className="space-y-4">
        {/* Action bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{venues.length} clubs tracked</p>
          <Button onClick={() => navigate("/inspections/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Inspection
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="space-y-2">
            {venues.map((v) => {
              const isExpanded = expandedVenues.has(v.venue_id);
              const badge = getDaysBadge(v.days_since);
              return (
                <Card key={v.venue_id} className="overflow-hidden">
                  <button
                    className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors touch-manipulation"
                    onClick={() => toggleExpand(v.venue_id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{v.venue_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {v.total_inspections} inspection{v.total_inspections !== 1 ? "s" : ""}
                        {v.avg_score > 0 && ` · Avg: ${v.avg_score}%`}
                      </div>
                    </div>
                    <div className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.className}`}>
                      <Clock className="inline h-3 w-3 mr-1" />
                      {badge.label}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/inspections/new?venue=${v.venue_id}`);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t">
                      {v.inspections.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No inspections yet
                        </div>
                      ) : (
                        <div className="divide-y">
                          {v.inspections.slice(0, 10).map((insp) => (
                            <div key={insp.id} className="p-3 flex items-center gap-3 text-sm">
                              <div className="flex-1">
                                <div className="font-medium">
                                  {new Date(insp.date).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                  <span className="text-muted-foreground ml-2">{insp.time?.slice(0, 5)}</span>
                                </div>
                                {insp.remarks && (
                                  <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[250px]">
                                    {insp.remarks}
                                  </div>
                                )}
                              </div>
                              <div className={`text-xs font-bold ${
                                (insp.score || 0) >= 80 ? "text-success" :
                                (insp.score || 0) >= 50 ? "text-warning" : "text-destructive"
                              }`}>
                                {insp.score ?? 0}%
                              </div>
                              {insp.violation_noted && (
                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default InspectionHistory;
