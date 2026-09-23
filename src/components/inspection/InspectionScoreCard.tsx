import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface InspectionScoreCardProps {
  scorePercent: number;
  completed: number;
  total: number;
  passCount: number;
  attentionCount: number;
  failCount: number;
}

const scoreLabel = (score: number) => {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs Attention";
  return "Poor";
};

const scoreTone = (score: number) => {
  if (score >= 90) return "text-success";
  if (score >= 75) return "text-primary";
  if (score >= 50) return "text-warning";
  return "text-destructive";
};

export const InspectionScoreCard = ({
  scorePercent, completed, total, passCount, attentionCount, failCount,
}: InspectionScoreCardProps) => {
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-center">
        <div>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Inspection Score</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={`text-3xl font-bold ${scoreTone(scorePercent)}`}>{scorePercent}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <span className={`text-xs font-medium ${scoreTone(scorePercent)}`}>{scoreLabel(scorePercent)}</span>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{completed} / {total} Completed</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="font-semibold">{passCount}</span>
              <span className="text-muted-foreground text-xs">Passed</span>
            </span>
            <span className="flex items-center gap-1.5 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-semibold">{attentionCount}</span>
              <span className="text-muted-foreground text-xs">Attention</span>
            </span>
            <span className="flex items-center gap-1.5 text-sm">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="font-semibold">{failCount}</span>
              <span className="text-muted-foreground text-xs">Failed</span>
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center justify-center relative w-[88px] h-[88px]">
          <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
            <circle cx="44" cy="44" r="38" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle
              cx="44" cy="44" r="38" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 38}`}
              strokeDashoffset={`${2 * Math.PI * 38 * (1 - scorePercent / 100)}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className={`text-lg font-bold ${scoreTone(scorePercent)}`}>{scorePercent}%</div>
            <div className="text-[9px] text-muted-foreground">Score</div>
          </div>
        </div>
      </div>
    </div>
  );
};
