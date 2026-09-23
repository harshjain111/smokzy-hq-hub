import { ReactNode } from "react";

// Shared building blocks for the ClubDetail dashboard — used by both the Live
// view (src/pages/ClubDetail.tsx) and the History views (HistoricalDayView,
// PeriodSummaryView) so they stay visually consistent.

export const SectionCard = ({
  title, action, children,
}: { title: string; action?: ReactNode; children: ReactNode }) => (
  <div className="rounded-lg border bg-card overflow-hidden">
    <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between gap-2">
      <span className="text-sm font-semibold">{title}</span>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

export type KpiTone = 'success' | 'warning' | 'destructive' | 'primary' | 'muted';

export const kpiToneClasses: Record<KpiTone, string> = {
  success: 'border-success/20 bg-success/5 text-success',
  warning: 'border-warning/20 bg-warning/5 text-warning',
  destructive: 'border-destructive/20 bg-destructive/5 text-destructive',
  primary: 'border-primary/20 bg-primary/5 text-primary',
  muted: 'border-border bg-muted/30 text-muted-foreground',
};

export const KpiGrid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">{children}</div>
);

export const KpiTile = ({
  icon, label, value, sub, tone,
}: { icon: ReactNode; label: string; value: string; sub: string; tone: KpiTone }) => (
  <div className={`p-3 rounded-lg border ${kpiToneClasses[tone]}`}>
    <div className="flex items-center gap-1.5 mb-1.5">
      {icon}
      <span className="text-[11px] font-medium opacity-90">{label}</span>
    </div>
    <div className="text-xl font-bold text-foreground">{value}</div>
    <p className="text-[10px] mt-0.5 opacity-80">{sub}</p>
  </div>
);
