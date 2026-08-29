import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, Download, CheckCircle2, XCircle, AlertTriangle, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToXlsx } from "@/lib/exportXlsx";
import { PeriodSummaryPanel } from "./PeriodSummaryPanel";

interface HistoricalSession {
  id: string;
  session_date: string;
  started_at: string;
  closed_at: string | null;
  status: string;
  stock_submitted: boolean;
  sales_submitted: boolean;
  photo_uploaded: boolean;
  force_close_reason: string | null;
}

interface SessionHistoryListProps {
  clubId: string;
  clubName: string;
  onSelectSession: (session: HistoricalSession) => void;
}

type DateFilter = "7days" | "30days" | "custom";

export const SessionHistoryList = ({ clubId, clubName, onSelectSession }: SessionHistoryListProps) => {
  const [sessions, setSessions] = useState<HistoricalSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("7days");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  useEffect(() => {
    fetchSessions();
  }, [clubId, dateFilter, customDateRange]);

  const getDateRange = () => {
    const today = new Date();
    switch (dateFilter) {
      case "7days":
        return { from: subDays(today, 7), to: today };
      case "30days":
        return { from: subDays(today, 30), to: today };
      case "custom":
        return { from: customDateRange.from || subDays(today, 7), to: customDateRange.to || today };
      default:
        return { from: subDays(today, 7), to: today };
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange();
      const todayStr = format(new Date(), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("club_sessions")
        .select("*")
        .eq("venue_id", clubId)
        .gte("session_date", format(from, "yyyy-MM-dd"))
        .lte("session_date", format(to, "yyyy-MM-dd"))
        .neq("session_date", todayStr) // Exclude today's session
        .order("session_date", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    const exportData = sessions.map(session => ({
      Date: format(parseISO(session.session_date), "dd MMM yyyy"),
      "Start Time": format(new Date(session.started_at), "HH:mm"),
      "End Time": session.closed_at ? format(new Date(session.closed_at), "HH:mm") : "Not Closed",
      Status: session.status,
      "Stock Submitted": session.stock_submitted ? "Yes" : "No",
      "Sales Submitted": session.sales_submitted ? "Yes" : "No",
      "Photo Uploaded": session.photo_uploaded ? "Yes" : "No",
      "Force Closed": session.force_close_reason ? "Yes" : "No",
      "Force Close Reason": session.force_close_reason || "-",
    }));

    await exportToXlsx(exportData, `${clubName}_Session_History.xlsx`, "Sessions");
  };

  const getCompletionStatus = (session: HistoricalSession) => {
    const completed = [session.stock_submitted, session.sales_submitted, session.photo_uploaded].filter(Boolean).length;
    return { completed, total: 3 };
  };

  const getSessionBadge = (session: HistoricalSession) => {
    if (session.force_close_reason) {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">Force Closed</Badge>;
    }
    if (session.status === "closed") {
      const { completed, total } = getCompletionStatus(session);
      if (completed === total) {
        return <Badge className="bg-success/20 text-success border-success/30 text-[10px]">Complete</Badge>;
      }
      return <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">Incomplete</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]">Open</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 flex-1">
          {(["7days", "30days", "custom"] as DateFilter[]).map((filter) => (
            <Button
              key={filter}
              variant={dateFilter === filter ? "default" : "outline"}
              size="sm"
              className="text-xs h-8 px-3"
              onClick={() => setDateFilter(filter)}
            >
              {filter === "7days" ? "7 Days" : filter === "30days" ? "30 Days" : "Custom"}
            </Button>
          ))}
        </div>
        
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={downloadExcel}>
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>

      {/* Custom Date Range Picker */}
      {dateFilter === "custom" && (
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-8 text-xs justify-start", !customDateRange.from && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-3 w-3" />
                {customDateRange.from ? format(customDateRange.from, "dd MMM") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customDateRange.from}
                onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-8 text-xs justify-start", !customDateRange.to && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-3 w-3" />
                {customDateRange.to ? format(customDateRange.to, "dd MMM") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customDateRange.to}
                onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Period Summary */}
      <PeriodSummaryPanel
        sessions={sessions}
        clubId={clubId}
        clubName={clubName}
        dateRange={getDateRange()}
      />

      {/* Session List */}
      <ScrollArea className="h-[calc(100vh-520px)]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No sessions found for the selected period
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const { completed, total } = getCompletionStatus(session);
              return (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session)}
                  className="w-full p-3 bg-card border rounded-lg text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {format(parseISO(session.session_date), "EEE, dd MMM yyyy")}
                        </span>
                        {getSessionBadge(session)}
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(new Date(session.started_at), "HH:mm")}
                            {session.closed_at && ` - ${format(new Date(session.closed_at), "HH:mm")}`}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-1">
                          {session.stock_submitted ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="text-[10px] text-muted-foreground">Stock</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {session.sales_submitted ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="text-[10px] text-muted-foreground">Sales</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {session.photo_uploaded ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="text-[10px] text-muted-foreground">Photo</span>
                        </div>
                        {session.force_close_reason && (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                            <span className="text-[10px] text-destructive">Force Closed</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
