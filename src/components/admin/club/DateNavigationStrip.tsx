import { useState, useRef, useEffect } from "react";
import { format, subDays, isSameDay, isToday } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateNavigationStripProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export const DateNavigationStrip = ({ selectedDate, onDateChange }: DateNavigationStripProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Generate last 14 days (excluding today — that's the LIVE tab)
  const dates = Array.from({ length: 14 }, (_, i) => subDays(new Date(), i + 1));

  useEffect(() => {
    // Scroll to selected date on mount
    const idx = dates.findIndex(d => isSameDay(d, selectedDate));
    if (idx > 0 && scrollRef.current) {
      const chip = scrollRef.current.children[idx] as HTMLElement;
      chip?.scrollIntoView({ inline: "center", behavior: "smooth" });
    }
  }, []);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date && !isToday(date)) {
      onDateChange(date);
      setCalendarOpen(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-2">
      <div className="flex items-center gap-1">
        {/* Calendar picker for older dates */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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

        {/* Scrollable date chips */}
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1 py-0.5"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {dates.map((date) => {
            const isSelected = isSameDay(date, selectedDate);
            return (
              <button
                key={date.toISOString()}
                onClick={() => onDateChange(date)}
                className={cn(
                  "flex flex-col items-center px-2.5 py-1.5 rounded-lg text-center shrink-0 transition-colors min-w-[44px]",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="text-[10px] font-medium uppercase">
                  {format(date, "EEE")}
                </span>
                <span className="text-sm font-bold leading-tight">
                  {format(date, "d")}
                </span>
                <span className="text-[9px] opacity-70">
                  {format(date, "MMM")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date label */}
      <div className="text-center mt-1.5 text-xs text-muted-foreground">
        {format(selectedDate, "EEEE, dd MMMM yyyy")}
      </div>
    </div>
  );
};
