import { useState } from "react";
import {
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, isToday,
} from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type RangeMode = 'day' | 'week' | 'month' | 'custom';

interface DateNavigationStripProps {
  mode: RangeMode;
  selectedDate: Date;
  customRange?: { from: Date; to: Date };
  onModeChange: (mode: RangeMode) => void;
  onDateChange: (date: Date) => void;
  onCustomRangeChange: (range: { from: Date; to: Date }) => void;
  onJumpToToday: () => void;
}

const PRESETS: { key: RangeMode; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom Range' },
];

export const DateNavigationStrip = ({
  mode, selectedDate, customRange, onModeChange, onDateChange, onCustomRangeChange, onJumpToToday,
}: DateNavigationStripProps) => {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePrev = () => {
    if (mode === 'day') onDateChange(subDays(selectedDate, 1));
    else if (mode === 'week') onDateChange(subWeeks(selectedDate, 1));
    else if (mode === 'month') onDateChange(subMonths(selectedDate, 1));
  };

  const handleNext = () => {
    if (mode === 'day') {
      const next = addDays(selectedDate, 1);
      // Stepping past yesterday lands on today, which is the Live dashboard's job
      if (isToday(next)) onJumpToToday();
      else onDateChange(next);
    } else if (mode === 'week') onDateChange(addWeeks(selectedDate, 1));
    else if (mode === 'month') onDateChange(addMonths(selectedDate, 1));
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date && !isToday(date)) {
      onModeChange('day');
      onDateChange(date);
      setCalendarOpen(false);
    }
  };

  const handleRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      onCustomRangeChange({ from: range.from, to: range.to });
    }
  };

  const rangeLabel = () => {
    if (mode === 'day') return format(selectedDate, "EEEE, dd MMMM yyyy");
    if (mode === 'week') {
      const from = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const to = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return `${format(from, "dd MMM")} – ${format(to, "dd MMM yyyy")}`;
    }
    if (mode === 'month') return format(selectedDate, "MMMM yyyy");
    if (customRange) return `${format(customRange.from, "dd MMM")} – ${format(customRange.to, "dd MMM yyyy")}`;
    return "Select a range";
  };

  return (
    <div className="bg-card border rounded-lg p-2 space-y-2">
      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={onJumpToToday}
          className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
        >
          Today
        </button>
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => onModeChange(p.key)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              mode === p.key ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        {mode !== 'custom' ? (
          <>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="flex-1 text-center text-xs font-medium py-1.5 rounded-md hover:bg-muted/50 transition-colors">
                  {rangeLabel()}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleCalendarSelect}
                  disabled={(date) => date >= new Date() || date < subDays(new Date(), 365)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="flex-1 flex items-center justify-center gap-1.5 text-center text-xs font-medium py-1.5 rounded-md border hover:bg-muted/50 transition-colors">
                <CalendarIcon className="h-3.5 w-3.5" />
                {rangeLabel()}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={handleRangeSelect}
                disabled={(date) => date >= new Date()}
                initialFocus
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};
