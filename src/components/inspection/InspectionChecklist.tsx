import { useEffect, useRef } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Camera, X, Repeat2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckItem, InspectionCategory, CATEGORY_LABELS } from "@/pages/InspectionSettings";
import { ItemStates, ItemStatus, QUICK_REASONS } from "./types";

interface InspectionChecklistProps {
  items: CheckItem[];
  itemStates: ItemStates;
  onStatusChange: (key: string, status: ItemStatus) => void;
  onReasonChange: (key: string, reason: string) => void;
  onNotesChange: (key: string, notes: string) => void;
  onAddPhoto: (key: string, file: File) => void;
  onRemovePhoto: (key: string, index: number) => void;
  repeatCounts: Record<string, number>;
  focusedKey: string | null;
}

const CATEGORY_ORDER: InspectionCategory[] = ['service_experience', 'operations', 'safety_asset', 'other'];

export const InspectionChecklist = ({
  items, itemStates, onStatusChange, onReasonChange, onNotesChange, onAddPhoto, onRemovePhoto,
  repeatCounts, focusedKey,
}: InspectionChecklistProps) => {
  const groups = CATEGORY_ORDER
    .map((cat) => ({ category: cat, items: items.filter((i) => i.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.category} className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/30">
            <span className="text-sm font-semibold">{CATEGORY_LABELS[group.category].toUpperCase()}</span>
          </div>
          <div className="divide-y">
            {group.items.map((item) => (
              <ChecklistRow
                key={item.key}
                item={item}
                state={itemStates[item.key]}
                onStatusChange={(s) => onStatusChange(item.key, s)}
                onReasonChange={(r) => onReasonChange(item.key, r)}
                onNotesChange={(n) => onNotesChange(item.key, n)}
                onAddPhoto={(f) => onAddPhoto(item.key, f)}
                onRemovePhoto={(i) => onRemovePhoto(item.key, i)}
                repeatCount={repeatCounts[item.key] || 0}
                focused={focusedKey === item.key}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const statusMeta: Record<ItemStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  pass: { label: "Passed", icon: CheckCircle2, className: "bg-success/15 text-success border-success/30" },
  attention: { label: "Attention", icon: AlertTriangle, className: "bg-warning/15 text-warning border-warning/30" },
  fail: { label: "Failed", icon: XCircle, className: "bg-destructive/15 text-destructive border-destructive/30" },
};

const ChecklistRow = ({
  item, state, onStatusChange, onReasonChange, onNotesChange, onAddPhoto, onRemovePhoto, repeatCount, focused,
}: {
  item: CheckItem;
  state: ItemStates[string];
  onStatusChange: (status: ItemStatus) => void;
  onReasonChange: (reason: string) => void;
  onNotesChange: (notes: string) => void;
  onAddPhoto: (file: File) => void;
  onRemovePhoto: (index: number) => void;
  repeatCount: number;
  focused: boolean;
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showDetails = state?.status === 'attention' || state?.status === 'fail';

  useEffect(() => {
    if (focused && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      rowRef.current.classList.add("ring-2", "ring-primary");
      const t = setTimeout(() => rowRef.current?.classList.remove("ring-2", "ring-primary"), 1500);
      return () => clearTimeout(t);
    }
  }, [focused]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onAddPhoto(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div ref={rowRef} id={`inspection-item-${item.key}`} className="p-3 transition-shadow">
      <div className="flex items-center gap-3">
        <span className="text-xl shrink-0">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{item.label}</span>
            {repeatCount > 1 && (
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                <Repeat2 className="h-2.5 w-2.5" /> {repeatCount}x
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(['pass', 'attention', 'fail'] as ItemStatus[]).map((s) => {
            const meta = statusMeta[s];
            const Icon = meta.icon;
            const active = state?.status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onStatusChange(s)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md border text-[11px] font-medium transition-colors touch-manipulation ${
                  active ? meta.className : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 ml-8 space-y-2.5 pl-1 border-l-2 border-warning/30">
          <div className="pl-3 space-y-2.5">
            <Select value={state.reason} onValueChange={onReasonChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="What was wrong? Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {QUICK_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              placeholder="Notes (optional)..."
              value={state.notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="min-h-[60px] text-xs"
            />

            <div className="flex flex-wrap gap-2">
              {state.photos.map((p, i) => (
                <div key={i} className="relative w-16 h-16 shrink-0">
                  <img src={p.preview} alt="Evidence" className="w-full h-full object-cover rounded-md border" />
                  <button
                    type="button"
                    onClick={() => onRemovePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-md border border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors shrink-0"
              >
                <Camera className="h-4 w-4" />
                <span className="text-[8px] mt-0.5">Add Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
