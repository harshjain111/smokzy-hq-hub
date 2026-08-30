import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ViolationEntry {
  staffId: string;
  type: string;
  severity: string;
  description: string;
}

interface ViolationSectionProps {
  violationNoted: boolean;
  onToggle: () => void;
  violations: ViolationEntry[];
  venueStaff: { id: string; name: string }[];
  onAdd: () => void;
  onUpdate: (index: number, field: keyof ViolationEntry, value: string) => void;
  onRemove: (index: number) => void;
}

// Extracted verbatim from the previous InspectionForm.tsx — same state shape, same writes to
// staff_violations on submit — only relocated for file readability.
export const ViolationSection = ({
  violationNoted, onToggle, violations, venueStaff, onAdd, onUpdate, onRemove,
}: ViolationSectionProps) => {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b bg-muted/30">
        <span className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Staff Violation
        </span>
      </div>
      <div className="p-3 space-y-3">
        <button
          type="button"
          onClick={onToggle}
          className={`w-full p-3 rounded-xl border-2 text-center font-medium transition-all touch-manipulation ${
            violationNoted ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-card"
          }`}
        >
          {violationNoted ? "⚠️ Yes — Violation Found" : "No Violations"}
        </button>

        {violationNoted && (
          <div className="space-y-4 pt-2 border-t">
            {violations.map((v, idx) => (
              <div key={idx} className="space-y-3 p-3 rounded-lg bg-muted/30 relative">
                {violations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <div className="text-xs font-semibold text-muted-foreground">Violation #{idx + 1}</div>
                <Select value={v.staffId} onValueChange={(val) => onUpdate(idx, "staffId", val)}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Staff involved..." />
                  </SelectTrigger>
                  <SelectContent>
                    {venueStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={v.type} onValueChange={(val) => onUpdate(idx, "type", val)}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Violation type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grooming">Grooming</SelectItem>
                    <SelectItem value="behavior">Behavior</SelectItem>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="safety">Safety</SelectItem>
                    <SelectItem value="stock_misuse">Stock Misuse</SelectItem>
                    <SelectItem value="procedure_violation">Procedure Violation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={v.severity} onValueChange={(val) => onUpdate(idx, "severity", val)}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Severity..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Describe the violation..."
                  value={v.description}
                  onChange={(e) => onUpdate(idx, "description", e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={onAdd} className="w-full border-dashed">
              + Add Another Violation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
