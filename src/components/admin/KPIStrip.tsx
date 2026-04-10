import { Building2, Users, Clock, Package, TrendingUp, AlertTriangle } from "lucide-react";
import { AdminKPIs } from "@/hooks/useAdminStats";

interface KPIStripProps {
  kpis: AdminKPIs;
  loading?: boolean;
}

const kpiConfig = [
  { key: "activeClubs" as const, icon: Building2, label: "ACTIVE CLUBS", variant: "success" },
  { key: "staffOnDutyNow" as const, icon: Users, label: "STAFF ON DUTY", variant: "primary" },
  { key: "openSessions" as const, icon: Clock, label: "OPEN SESSIONS", variant: "info" },
  { key: "stockPendingClubs" as const, icon: Package, label: "STOCK PENDING", variant: "warning" },
  { key: "salesPendingClubs" as const, icon: TrendingUp, label: "SALES PENDING", variant: "warning" },
  { key: "forceClosedToday" as const, icon: AlertTriangle, label: "FORCE CLOSED", variant: "danger" },
];

const variantStyles: Record<string, string> = {
  success: "border-success/30 bg-success/10 text-success",
  primary: "border-primary/30 bg-primary/10 text-primary",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

export const KPIStrip = ({ kpis, loading }: KPIStripProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-[100px] rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpiConfig.map(({ key, icon: Icon, label, variant }) => {
        const val = kpis[key];
        const dynamicVariant =
          key === "stockPendingClubs" || key === "salesPendingClubs"
            ? val > 0 ? "warning" : "success"
            : key === "forceClosedToday"
              ? val > 0 ? "danger" : "success"
              : variant;

        return (
          <div
            key={key}
            className={`flex flex-col items-center justify-center h-[100px] rounded-xl border ${variantStyles[dynamicVariant]}`}
          >
            <Icon className="h-5 w-5 mb-1 opacity-70" />
            <span className="text-[28px] font-bold leading-none">{val}</span>
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground mt-1.5">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
