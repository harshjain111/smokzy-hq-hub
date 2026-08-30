import { ArrowLeft, TrendingUp, TrendingDown, Clock, User, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PreviousInspection } from "./types";

interface InspectionContextHeaderProps {
  venues: { id: string; name: string }[];
  selectedVenue: string;
  onVenueChange: (id: string) => void;
  lastInspection: PreviousInspection | null;
  trend: number | null;
  inspectorName: string;
  startedAt: Date | null;
  onBack: () => void;
}

export const InspectionContextHeader = ({
  venues, selectedVenue, onVenueChange, lastInspection, trend, inspectorName, startedAt, onBack,
}: InspectionContextHeaderProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold leading-tight">Club Inspection</h1>
          <p className="text-xs text-muted-foreground">Ensure every club meets Smokzy standards</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-lg border bg-card">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Select Club</span>
          <Select value={selectedVenue} onValueChange={onVenueChange}>
            <SelectTrigger className="h-9 mt-1 border-0 bg-transparent px-0 focus:ring-0">
              <SelectValue placeholder="Choose a club..." />
            </SelectTrigger>
            <SelectContent>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="p-3 rounded-lg border bg-card">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> Last Inspection
          </span>
          {lastInspection ? (
            <>
              <div className="text-sm font-semibold mt-1">
                {new Date(lastInspection.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
              <div className="text-xs text-muted-foreground">{lastInspection.score ?? 0} / 100</div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground mt-1.5">No previous inspection</div>
          )}
        </div>

        <div className="p-3 rounded-lg border bg-card">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Trend</span>
          {trend !== null ? (
            <div className={`flex items-center gap-1 mt-1.5 text-sm font-semibold ${trend >= 0 ? "text-success" : "text-destructive"}`}>
              {trend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {trend >= 0 ? "+" : ""}{trend} pts
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-1.5">Not enough history</div>
          )}
          {trend !== null && <p className="text-[10px] text-muted-foreground mt-0.5">vs previous inspection</p>}
        </div>

        <div className="p-3 rounded-lg border bg-card">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <User className="h-3 w-3" /> Inspector
          </span>
          <div className="text-sm font-semibold mt-1 truncate">{inspectorName || "—"}</div>
          {startedAt && (
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" />
              Started {startedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
