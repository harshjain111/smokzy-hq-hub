import { Building2, Users, Clock, Package, TrendingUp, AlertTriangle } from "lucide-react";
import { AdminKPIs } from "@/hooks/useAdminStats";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface KPIStripProps {
  kpis: AdminKPIs;
  loading?: boolean;
}

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant: 'success' | 'warning' | 'danger' | 'primary' | 'info';
  primary?: boolean;
}

const KPICard = ({ icon, label, value, variant, primary }: KPICardProps) => {
  const variantStyles = {
    success: 'bg-success/10 border-success/30 text-success',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    danger: 'bg-destructive/10 border-destructive/30 text-destructive',
    primary: 'bg-primary/10 border-primary/30 text-primary',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${variantStyles[variant]} ${primary ? 'min-w-[100px]' : 'min-w-[90px] flex-shrink-0'}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-base font-bold leading-none">{value}</div>
        <div className="text-[9px] text-muted-foreground mt-0.5 truncate leading-tight">{label}</div>
      </div>
    </div>
  );
};

export const KPIStrip = ({ kpis, loading }: KPIStripProps) => {
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-12 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  const primaryKPIs: { icon: React.ReactNode; label: string; value: number; variant: KPICardProps['variant'] }[] = [
    { icon: <Building2 className="h-4 w-4" />, label: "Active Clubs", value: kpis.activeClubs, variant: 'success' },
    { icon: <Users className="h-4 w-4" />, label: "Staff On Duty", value: kpis.staffOnDutyNow, variant: 'primary' },
    { icon: <Clock className="h-4 w-4" />, label: "Open Sessions", value: kpis.openSessions, variant: 'info' },
  ];

  const secondaryKPIs: { icon: React.ReactNode; label: string; value: number; variant: KPICardProps['variant'] }[] = [
    { icon: <Package className="h-3.5 w-3.5" />, label: "Stock Pending", value: kpis.stockPendingClubs, variant: kpis.stockPendingClubs > 0 ? 'warning' : 'success' },
    { icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Sales Pending", value: kpis.salesPendingClubs, variant: kpis.salesPendingClubs > 0 ? 'warning' : 'success' },
    { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "Force Closed", value: kpis.forceClosedToday, variant: kpis.forceClosedToday > 0 ? 'danger' : 'success' },
  ];

  return (
    <div className="space-y-2">
      {/* Primary KPIs - Always visible */}
      <div className="grid grid-cols-3 gap-2">
        {primaryKPIs.map((kpi, i) => (
          <KPICard key={i} {...kpi} primary />
        ))}
      </div>

      {/* Secondary KPIs - Horizontal scroll on mobile */}
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {secondaryKPIs.map((kpi, i) => (
            <KPICard key={i} {...kpi} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
