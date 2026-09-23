import { AlertOctagon, AlertTriangle, CheckCircle2, Camera, ListChecks, Timer, Repeat2, ChevronRight } from "lucide-react";
import { ItemStatus } from "./types";

export interface Issue {
  key: string;
  label: string;
  icon: string;
  status: Extract<ItemStatus, 'attention' | 'fail'>;
  reason: string;
  photoCount: number;
}

interface QuickStats {
  photosAdded: number;
  checksCompleted: number;
  totalChecks: number;
  timeSpentSeconds: number;
  criticalCount: number;
  repeatIssuesCount: number;
}

interface InspectionIssuesPanelProps {
  issues: Issue[];
  onSelectIssue: (key: string) => void;
  quickStats: QuickStats;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

export const InspectionIssuesPanel = ({ issues, onSelectIssue, quickStats }: InspectionIssuesPanelProps) => {
  const critical = issues.filter((i) => i.status === 'fail');
  const attention = issues.filter((i) => i.status === 'attention');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
          <span className="text-sm font-semibold">Issues Found</span>
          {issues.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">
              {issues.length}
            </span>
          )}
        </div>
        <div className="p-3 space-y-3">
          {issues.length === 0 ? (
            <div className="flex flex-col items-center text-center py-6 text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 text-success mb-2" />
              <p className="text-xs">No issues found so far</p>
            </div>
          ) : (
            <>
              {critical.length > 0 && (
                <IssueGroup title="Critical" count={critical.length} icon={AlertOctagon} tone="destructive" items={critical} onSelect={onSelectIssue} />
              )}
              {attention.length > 0 && (
                <IssueGroup title="Attention" count={attention.length} icon={AlertTriangle} tone="warning" items={attention} onSelect={onSelectIssue} />
              )}
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-muted/30">
          <span className="text-sm font-semibold">Quick Stats</span>
        </div>
        <div className="p-3 space-y-2 text-xs">
          <StatRow icon={Camera} label="Photos Added" value={String(quickStats.photosAdded)} />
          <StatRow icon={ListChecks} label="Checks Completed" value={`${quickStats.checksCompleted} / ${quickStats.totalChecks}`} />
          <StatRow icon={Timer} label="Time Spent" value={formatTime(quickStats.timeSpentSeconds)} />
          <StatRow icon={AlertOctagon} label="Critical Issues" value={String(quickStats.criticalCount)} tone={quickStats.criticalCount > 0 ? "text-destructive" : undefined} />
          <StatRow icon={Repeat2} label="Repeat Issues" value={String(quickStats.repeatIssuesCount)} tone={quickStats.repeatIssuesCount > 0 ? "text-warning" : undefined} />
        </div>
      </div>
    </div>
  );
};

const IssueGroup = ({
  title, count, icon: Icon, tone, items, onSelect,
}: {
  title: string; count: number; icon: typeof AlertOctagon; tone: 'destructive' | 'warning';
  items: Issue[]; onSelect: (key: string) => void;
}) => (
  <div>
    <div className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${tone === 'destructive' ? 'text-destructive' : 'text-warning'}`}>
      <Icon className="h-3.5 w-3.5" />
      {title} ({count})
    </div>
    <div className="space-y-1.5">
      {items.map((issue) => (
        <button
          key={issue.key}
          type="button"
          onClick={() => onSelect(issue.key)}
          className={`w-full text-left p-2.5 rounded-lg border flex items-start gap-2 hover:bg-muted/30 transition-colors ${
            tone === 'destructive' ? 'border-destructive/20 bg-destructive/5' : 'border-warning/20 bg-warning/5'
          }`}
        >
          <span className="text-sm shrink-0">{issue.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium">{issue.label}</div>
            {issue.reason && <div className="text-[10px] text-muted-foreground mt-0.5">{issue.reason}</div>}
            {issue.photoCount > 0 && (
              <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <Camera className="h-2.5 w-2.5" /> {issue.photoCount} photo{issue.photoCount > 1 ? 's' : ''}
              </div>
            )}
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        </button>
      ))}
    </div>
  </div>
);

const StatRow = ({ icon: Icon, label, value, tone }: { icon: typeof Camera; label: string; value: string; tone?: string }) => (
  <div className="flex items-center justify-between">
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
    <span className={`font-semibold ${tone || ""}`}>{value}</span>
  </div>
);
