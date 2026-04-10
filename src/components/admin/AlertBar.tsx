import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertDrawer } from "./AlertDrawer";
import { ChevronRight } from "lucide-react";

export type AlertSeverity = "critical" | "warning" | "pending";

export interface AlertNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  venue_id: string | null;
  is_read: boolean;
  created_at: string;
  severity: AlertSeverity;
}

function classifySeverity(type: string, priority: string): AlertSeverity {
  if (priority === "high" || ["force_closed", "mismatch", "stock_mismatch"].includes(type)) return "critical";
  if (["overdue_task", "low_stock", "late_checkin"].includes(type)) return "warning";
  return "pending";
}

export const AlertBar = () => {
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFilter, setDrawerFilter] = useState<AlertSeverity | "all">("all");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("admin_notifications")
        .select("*")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(100);

      if (data) {
        setAlerts(
          data.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            venue_id: n.venue_id,
            is_read: n.is_read ?? false,
            created_at: n.created_at,
            severity: classifySeverity(n.type, n.priority),
          }))
        );
      }
    };
    fetch();

    const channel = supabase
      .channel("alert-bar")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, (payload) => {
        const n = payload.new as any;
        setAlerts((prev) => [
          {
            id: n.id, type: n.type, title: n.title, message: n.message,
            venue_id: n.venue_id, is_read: false, created_at: n.created_at,
            severity: classifySeverity(n.type, n.priority),
          },
          ...prev,
        ]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const counts = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    pending: alerts.filter((a) => a.severity === "pending").length,
  };

  const openWith = (filter: AlertSeverity | "all") => {
    setDrawerFilter(filter);
    setDrawerOpen(true);
  };

  const handleDismiss = async (id: string) => {
    await supabase.from("admin_notifications").update({ is_read: true }).eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const total = alerts.length;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[52px] rounded-lg border border-success/30 bg-success/5 text-sm text-muted-foreground">
        ✅ No active alerts
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between h-[52px] px-4 rounded-lg border bg-muted/50">
        <div className="flex items-center gap-4 text-sm font-medium">
          {counts.critical > 0 && (
            <button onClick={() => openWith("critical")} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-destructive" />
              <span>{counts.critical} Critical</span>
            </button>
          )}
          {counts.warning > 0 && (
            <button onClick={() => openWith("warning")} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-warning" />
              <span>{counts.warning} Warnings</span>
            </button>
          )}
          {counts.pending > 0 && (
            <button onClick={() => openWith("pending")} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span>{counts.pending} Pending</span>
            </button>
          )}
        </div>
        <button
          onClick={() => openWith("all")}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View All <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <AlertDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        alerts={alerts}
        filter={drawerFilter}
        onFilterChange={setDrawerFilter}
        onDismiss={handleDismiss}
      />
    </>
  );
};
