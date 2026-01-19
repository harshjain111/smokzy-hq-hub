import { Building2, Users, Clock, Package, TrendingUp, AlertTriangle } from "lucide-react";
import { AdminKPIs } from "@/hooks/useAdminStats";

interface KPIStripProps {
  kpis: AdminKPIs;
  loading?: boolean;
}

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant: 'success' | 'warning' | 'danger' | 'primary' | 'info';
}

const KPICard = ({ icon, label, value, variant }: KPICardProps) => {
  const variantStyles = {
    success: 'bg-success/10 border-success/30 text-success',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    danger: 'bg-destructive/10 border-destructive/30 text-destructive',
    primary: 'bg-primary/10 border-primary/30 text-primary',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
  };

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${variantStyles[variant]}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
};

export const KPIStrip = ({ kpis, loading }: KPIStripProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      <KPICard
        icon={<Building2 className="h-4 w-4" />}
        label="Active Clubs"
        value={kpis.activeClubs}
        variant="success"
      />
      <KPICard
        icon={<Users className="h-4 w-4" />}
        label="Staff On Duty"
        value={kpis.staffOnDutyNow}
        variant="primary"
      />
      <KPICard
        icon={<Clock className="h-4 w-4" />}
        label="Open Sessions"
        value={kpis.openSessions}
        variant="info"
      />
      <KPICard
        icon={<Package className="h-4 w-4" />}
        label="Stock Pending"
        value={kpis.stockPendingClubs}
        variant={kpis.stockPendingClubs > 0 ? 'warning' : 'success'}
      />
      <KPICard
        icon={<TrendingUp className="h-4 w-4" />}
        label="Sales Pending"
        value={kpis.salesPendingClubs}
        variant={kpis.salesPendingClubs > 0 ? 'warning' : 'success'}
      />
      <KPICard
        icon={<AlertTriangle className="h-4 w-4" />}
        label="Force Closed"
        value={kpis.forceClosedToday}
        variant={kpis.forceClosedToday > 0 ? 'danger' : 'success'}
      />
    </div>
  );
};
