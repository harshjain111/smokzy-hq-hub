import { Building2, Users, Clock, Package, TrendingUp, AlertTriangle, LucideIcon } from "lucide-react";
import { AdminKPIs } from "@/hooks/useAdminStats";

interface KPIStripProps {
  kpis: AdminKPIs;
  loading?: boolean;
}

interface KPICardConfig {
  key: keyof AdminKPIs;
  icon: LucideIcon;
  label: string;
  variant: string;
  description: string;
}

const kpiConfig: KPICardConfig[] = [
  { key: "activeClubs", icon: Building2, label: "Active Clubs", variant: "success", description: "Staff on duty now" },
  { key: "staffOnDutyNow", icon: Users, label: "Staff On Duty", variant: "primary", description: "Currently checked in" },
  { key: "openSessions", icon: Clock, label: "Open Sessions", variant: "info", description: "Running today" },
  { key: "stockPendingClubs", icon: Package, label: "Stock Pending", variant: "warning", description: "Awaiting submission" },
  { key: "salesPendingClubs", icon: TrendingUp, label: "Sales Pending", variant: "warning", description: "Awaiting submission" },
  { key: "forceClosedToday", icon: AlertTriangle, label: "Force Closed", variant: "danger", description: "Closed by system" },
];

const variantStyles: Record<string, { card: string; icon: string; badge: string }> = {
  success: {
    card: "border-success/20",
    icon: "bg-success/15 text-success",
    badge: "bg-success/10 text-success",
  },
  primary: {
    card: "border-primary/20",
    icon: "bg-primary/15 text-primary",
    badge: "bg-primary/10 text-primary",
  },
  info: {
    card: "border-blue-500/20",
    icon: "bg-blue-500/15 text-blue-500",
    badge: "bg-blue-500/10 text-blue-500",
  },
  warning: {
    card: "border-warning/20",
    icon: "bg-warning/15 text-warning",
    badge: "bg-warning/10 text-warning",
  },
  danger: {
    card: "border-destructive/20",
    icon: "bg-destructive/15 text-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
};

export const KPIStrip = ({ kpis, loading }: KPIStripProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-[104px] rounded-xl bg-card border animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpiConfig.map(({ key, icon: Icon, label, variant, description }) => {
        const val = kpis[key];
        const dynamicVariant =
          key === "stockPendingClubs" || key === "salesPendingClubs"
            ? val > 0 ? "warning" : "success"
            : key === "forceClosedToday"
              ? val > 0 ? "danger" : "success"
              : variant;

        const styles = variantStyles[dynamicVariant];

        return (
          <div
            key={key}
            className={`relative flex flex-col justify-between p-3.5 rounded-xl border bg-card transition-shadow hover:shadow-sm ${styles.card}`}
          >
            <div className="flex items-center justify-between">
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${styles.icon}`}>
                <Icon className="h-4 w-4" />
              </div>
              {(key === "stockPendingClubs" || key === "salesPendingClubs") && val > 0 && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${styles.badge}`}>
                  Action needed
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-bold tracking-tight leading-none">{val}</div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-tight">{label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
