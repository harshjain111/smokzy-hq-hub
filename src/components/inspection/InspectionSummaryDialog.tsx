import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertOctagon } from "lucide-react";
import { Issue } from "./InspectionIssuesPanel";

interface InspectionSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubName: string;
  date: Date;
  scorePercent: number;
  completed: number;
  total: number;
  passCount: number;
  attentionCount: number;
  failCount: number;
  criticalIssues: Issue[];
  photosCount: number;
  notes: string;
  submitting: boolean;
  onConfirm: () => void;
}

export const InspectionSummaryDialog = ({
  open, onOpenChange, clubName, date, scorePercent, completed, total,
  passCount, attentionCount, failCount, criticalIssues, photosCount, notes, submitting, onConfirm,
}: InspectionSummaryDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Inspection Summary</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Club</span>
            <span className="font-medium">{clubName || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Score</span>
            <span className="font-semibold">{scorePercent} / 100</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{completed} / {total} completed</span>
          </div>
          <div className="flex items-center gap-4 py-2 border-y">
            <span className="text-success">{passCount} Passed</span>
            <span className="text-warning">{attentionCount} Attention</span>
            <span className="text-destructive">{failCount} Failed</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Photos</span>
            <span className="font-medium">{photosCount}</span>
          </div>

          {criticalIssues.length > 0 && (
            <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <AlertOctagon className="h-3.5 w-3.5" /> Critical issues
              </span>
              {criticalIssues.map((i) => (
                <div key={i.key} className="text-xs text-destructive/90">• {i.label}{i.reason ? ` — ${i.reason}` : ""}</div>
              ))}
            </div>
          )}

          {notes && (
            <div>
              <span className="text-muted-foreground text-xs">Manager Notes</span>
              <p className="text-xs mt-1 whitespace-pre-wrap">{notes}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Back to Edit</Button>
          <Button onClick={onConfirm} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Complete Inspection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
