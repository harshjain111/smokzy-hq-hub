import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle, AlertCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import type { AlertNotification, AlertSeverity } from "./AlertBar";

interface AlertDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: AlertNotification[];
  filter: AlertSeverity | "all";
  onFilterChange: (f: AlertSeverity | "all") => void;
  onDismiss: (id: string) => void;
}

const tabs: { key: AlertSeverity | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warnings" },
  { key: "pending", label: "Pending" },
];

const severityIcon: Record<AlertSeverity, React.ReactNode> = {
  critical: <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />,
  pending: <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />,
};

export const AlertDrawer = ({ open, onOpenChange, alerts, filter, onFilterChange, onDismiss }: AlertDrawerProps) => {
  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);

  // Group by severity
  const grouped = {
    critical: filtered.filter((a) => a.severity === "critical"),
    warning: filtered.filter((a) => a.severity === "warning"),
    pending: filtered.filter((a) => a.severity === "pending"),
  };

  const renderGroup = (severity: AlertSeverity, items: AlertNotification[]) => {
    if (items.length === 0) return null;
    return (
      <div key={severity} className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-2">
          {severity === "critical" ? "Critical" : severity === "warning" ? "Warnings" : "Pending"}
        </h3>
        {items.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-2 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors group"
          >
            {severityIcon[alert.severity]}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight truncate">{alert.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {format(new Date(alert.created_at), "MMM dd, hh:mm a")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={() => onDismiss(alert.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-lg">Alerts</SheetTitle>
          <SheetDescription className="sr-only">View and manage active alerts</SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onFilterChange(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                filter === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No alerts in this category</p>
          ) : filter === "all" ? (
            <>
              {renderGroup("critical", grouped.critical)}
              {renderGroup("warning", grouped.warning)}
              {renderGroup("pending", grouped.pending)}
            </>
          ) : (
            renderGroup(filter, filtered)
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
