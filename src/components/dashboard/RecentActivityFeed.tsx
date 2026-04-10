import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ClipboardCheck, AlertTriangle, CalendarDays, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: "dispatch" | "inspection" | "violation" | "roster";
  description: string;
  timestamp: string;
}

const iconMap = {
  dispatch: Package,
  inspection: ClipboardCheck,
  violation: AlertTriangle,
  roster: CalendarDays,
};

const colorMap = {
  dispatch: "text-primary",
  inspection: "text-success",
  violation: "text-destructive",
  roster: "text-accent-foreground",
};

const RecentActivityFeed = () => {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    fetchRecentActivity();
  }, []);

  const fetchRecentActivity = async () => {
    const [
      { data: dispatches },
      { data: inspections },
      { data: violations },
      { data: roster },
    ] = await Promise.all([
      supabase
        .from("packet_dispatches")
        .select("id, quantity_sent, created_at, venue_id, venues(name)")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("inspections")
        .select("id, score, created_at, venue_id, venues(name)")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("staff_violations")
        .select("id, type, severity, created_at, venue_id, venues(name)")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("roster_assignments")
        .select("id, created_at, venue_id, venues(name)")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const all: Activity[] = [];

    (dispatches || []).forEach((d: any) => {
      all.push({
        id: `d-${d.id}`,
        type: "dispatch",
        description: `${d.quantity_sent} packets dispatched to ${d.venues?.name || "venue"}`,
        timestamp: d.created_at,
      });
    });

    (inspections || []).forEach((i: any) => {
      all.push({
        id: `i-${i.id}`,
        type: "inspection",
        description: `Inspection at ${i.venues?.name || "venue"} — Score: ${i.score || 0}%`,
        timestamp: i.created_at,
      });
    });

    (violations || []).forEach((v: any) => {
      all.push({
        id: `v-${v.id}`,
        type: "violation",
        description: `${v.severity} violation (${v.type}) at ${v.venues?.name || "venue"}`,
        timestamp: v.created_at,
      });
    });

    (roster || []).forEach((r: any) => {
      all.push({
        id: `r-${r.id}`,
        type: "roster",
        description: `Roster updated for ${r.venues?.name || "venue"}`,
        timestamp: r.created_at,
      });
    });

    all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivities(all.slice(0, 5));
  };

  if (activities.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {activities.map((a) => {
          const Icon = iconMap[a.type];
          return (
            <div key={a.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${colorMap[a.type]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight">{a.description}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default RecentActivityFeed;
