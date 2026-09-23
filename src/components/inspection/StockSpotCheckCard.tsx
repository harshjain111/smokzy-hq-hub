import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SpotCheckFlavour {
  id: string;
  name: string;
  reported: string;
  measured: string;
}

interface StockSpotCheckCardProps {
  spotChecks: SpotCheckFlavour[];
  loading: boolean;
  onChange: (index: number, field: 'reported' | 'measured', value: string) => void;
  onRepick: () => void;
}

// Extracted verbatim from the previous InspectionForm.tsx — same state shape, same writes to
// inspection_stock_checks on submit — only relocated for file readability.
export const StockSpotCheckCard = ({ spotChecks, loading, onChange, onRepick }: StockSpotCheckCardProps) => {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b bg-muted/30">
        <span className="text-sm font-semibold">Stock Spot Check (3 Random Flavours)</span>
      </div>
      <div className="p-3 space-y-3">
        {loading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Picking random flavours...</div>
        ) : (
          spotChecks.map((sc, idx) => (
            <div key={sc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <span className="text-sm font-medium flex-1 min-w-0 truncate">{sc.name}</span>
              <div className="flex items-center gap-2">
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Reported</div>
                  <Input
                    type="number"
                    min={0}
                    value={sc.reported}
                    onChange={(e) => onChange(idx, "reported", e.target.value)}
                    className="h-10 w-16 text-center"
                    placeholder="—"
                  />
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Actual</div>
                  <Input
                    type="number"
                    min={0}
                    value={sc.measured}
                    onChange={(e) => onChange(idx, "measured", e.target.value)}
                    className="h-10 w-16 text-center"
                    placeholder="—"
                  />
                </div>
                {sc.reported && sc.measured && (
                  <span className={`text-xs font-bold mt-3 ${sc.reported === sc.measured ? "text-success" : "text-destructive"}`}>
                    {sc.reported === sc.measured ? "✓" : "✗"}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <Button variant="ghost" size="sm" onClick={onRepick} className="text-xs">
          🔄 Re-pick Flavours
        </Button>
      </div>
    </div>
  );
};
