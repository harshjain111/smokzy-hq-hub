import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertDrawer } from "./AlertDrawer";
import { Bell, ChevronRight, CheckCircle2 } from "lucide-react";

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
      <div className="flex items-center gap-3 p-3.5 rounded-xl border bg-card">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-success/15">
          <CheckCircle2 className="h-5 w-5 text-success" />
        </div>
        <div>
          <div className="text-sm font-medium">All clear</div>
          <div className="text-[11px] text-muted-foreground">No active alerts</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="flex items-center justify-between p-3.5 rounded-xl border bg-card cursor-pointer hover:border-primary/20 transition-colors"
        onClick={() => openWith("all")}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/15">
            <Bell className="h-5 w-5 text-warning" />
          </div>
          <div className="flex items-center gap-3">
            {counts.critical > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); openWith("critical"); }}
                className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
              >
                <span className="w-2 h-2 rounded-full bg-destructive" />
                {counts.critical} Critical
              </button>
            )}
            {counts.warning > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); openWith("warning"); }}
                className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
              >
                <span className="w-2 h-2 rounded-full bg-warning" />
                {counts.warning} Warnings
              </button>
            )}
            {counts.pending > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); openWith("pending"); }}
                className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
              >
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                {counts.pending} Pending
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-primary">
          View <ChevronRight className="h-3.5 w-3.5" />
        </div>
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
