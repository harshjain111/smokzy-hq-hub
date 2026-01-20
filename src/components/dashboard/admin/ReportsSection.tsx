import { useState } from "react";
import { FileSpreadsheet, Download, Building2, Users, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth, differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const reports: ReportType[] = [
  {
    id: "sales",
    title: "Sales Report",
    description: "Daily, weekly, or monthly sales across all clubs",
    icon: <FileSpreadsheet className="h-5 w-5 text-primary" />,
  },
  {
    id: "club_comparison",
    title: "Club Comparison",
    description: "Side-by-side performance comparison across venues",
    icon: <Building2 className="h-5 w-5 text-primary" />,
  },
  {
    id: "attendance",
    title: "Attendance & Discipline",
    description: "Staff attendance grouped by session (not calendar date)",
    icon: <Users className="h-5 w-5 text-primary" />,
  },
  {
    id: "stock_variance",
    title: "Stock Variance",
    description: "Expected vs actual consumption analysis",
    icon: <Package className="h-5 w-5 text-primary" />,
  },
];

export const ReportsSection = () => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>("7days");
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [generating, setGenerating] = useState(false);

  const fetchVenues = async () => {
    const { data } = await supabase.from("venues").select("id, name").order("name");
    if (data) setVenues(data);
  };

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    const now = new Date();
    switch (value) {
      case "7days":
        setStartDate(format(subDays(now, 7), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "30days":
        setStartDate(format(subDays(now, 30), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "thisMonth":
        setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
        break;
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      let data: Record<string, unknown>[] = [];
      let filename = "";

      switch (selectedReport) {
        case "sales": {
          let query = supabase
            .from("sales_reports")
            .select(`
              *,
              venue:venues(name),
              category:venue_hookah_categories(category_name)
            `)
            .gte("report_date", startDate)
            .lte("report_date", endDate)
            .order("report_date", { ascending: false });

          if (clubFilter !== "all") {
            query = query.eq("venue_id", clubFilter);
          }

          const { data: salesData } = await query;
          data = (salesData || []).map(s => ({
            Date: s.report_date,
            Club: (s.venue as { name: string })?.name || "Unknown",
            Category: (s.category as { category_name: string })?.category_name || "Unknown",
            "Quantity Sold": s.quantity_sold,
          }));
          filename = `Sales_Report_${startDate}_to_${endDate}.xlsx`;
          break;
        }

        case "club_comparison": {
          const { data: salesData } = await supabase
            .from("sales_reports")
            .select(`*, venue:venues(name)`)
            .gte("report_date", startDate)
            .lte("report_date", endDate);

          const clubTotals: Record<string, number> = {};
          salesData?.forEach(s => {
            const venueName = (s.venue as { name: string })?.name || "Unknown";
            clubTotals[venueName] = (clubTotals[venueName] || 0) + s.quantity_sold;
          });

          data = Object.entries(clubTotals).map(([club, total]) => ({
            Club: club,
            "Total Sales": total,
          })).sort((a, b) => (b["Total Sales"] as number) - (a["Total Sales"] as number));
          filename = `Club_Comparison_${startDate}_to_${endDate}.xlsx`;
          break;
        }

        case "attendance": {
          // SESSION-BASED ATTENDANCE REPORT
          // First, fetch sessions within the date range
          let sessionQuery = supabase
            .from("club_sessions")
            .select("id, venue_id, session_date, started_at, closed_at, status")
            .gte("session_date", startDate)
            .lte("session_date", endDate)
            .order("session_date", { ascending: false });

          if (clubFilter !== "all") {
            sessionQuery = sessionQuery.eq("venue_id", clubFilter);
          }

          const { data: sessions } = await sessionQuery;

          if (!sessions || sessions.length === 0) {
            toast.info("No sessions found for the selected date range");
            setGenerating(false);
            return;
          }

          const sessionIds = sessions.map(s => s.id);
          const venueIds = [...new Set(sessions.map(s => s.venue_id))];

          // Fetch venues for names
          const { data: venueData } = await supabase
            .from("venues")
            .select("id, name")
            .in("id", venueIds);

          const venueMap: Record<string, string> = {};
          venueData?.forEach(v => { venueMap[v.id] = v.name; });

          // Fetch attendance blocks by session_id
          const { data: attendanceData } = await supabase
            .from("staff_attendance_blocks")
            .select("*")
            .in("session_id", sessionIds);

          // Fetch profiles
          const userIds = [...new Set(attendanceData?.map(a => a.user_id) || [])];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);
          
          const profileMap: Record<string, string> = {};
          profiles?.forEach(p => { profileMap[p.id] = p.full_name; });

          // Fetch breaks for these sessions
          const { data: breaks } = await supabase
            .from("staff_breaks")
            .select("*")
            .in("session_id", sessionIds);

          // Build session map
          const sessionMap: Record<string, { session_date: string; venue_id: string }> = {};
          sessions.forEach(s => { 
            sessionMap[s.id] = { session_date: s.session_date, venue_id: s.venue_id }; 
          });
          
          data = (attendanceData || []).map(a => {
            const sessionInfo = sessionMap[a.session_id];
            const blockBreaks = breaks?.filter(b => b.attendance_block_id === a.id) || [];
            const totalBreakMinutes = blockBreaks.reduce((sum, b) => sum + (b.duration_minutes || 0), 0);
            
            const checkIn = new Date(a.check_in_time);
            const checkOut = a.check_out_time ? new Date(a.check_out_time) : null;
            const totalMinutes = checkOut ? differenceInMinutes(checkOut, checkIn) - totalBreakMinutes : 0;
            const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

            return {
              "Session Date": sessionInfo?.session_date || "Unknown",
              "Club": venueMap[sessionInfo?.venue_id] || "Unknown",
              "Staff": profileMap[a.user_id] || "Unknown",
              "Check In": format(checkIn, "yyyy-MM-dd HH:mm"),
              "Check Out": checkOut ? format(checkOut, "yyyy-MM-dd HH:mm") : "Active/Missed",
              "Break (min)": totalBreakMinutes,
              "Total Hours": checkOut ? totalHours : "-",
              "Crosses Midnight": checkOut && checkIn.getDate() !== checkOut.getDate() ? "Yes" : "No",
            };
          });

          // Sort by session date
          data.sort((a, b) => 
            new Date(b["Session Date"] as string).getTime() - new Date(a["Session Date"] as string).getTime()
          );

          filename = `Attendance_By_Session_${startDate}_to_${endDate}.xlsx`;
          break;
        }

        case "stock_variance": {
          let query = supabase
            .from("stock")
            .select(`*, venue:venues(name)`);

          if (clubFilter !== "all") {
            query = query.eq("venue_id", clubFilter);
          }

          const { data: stockData } = await query;
          data = (stockData || []).map(s => ({
            Club: (s.venue as { name: string })?.name || "Unknown",
            Item: s.item_name,
            Category: s.category,
            Quantity: s.quantity,
            Unit: s.unit,
            "Low Stock Threshold": s.low_stock_threshold,
            Status: s.quantity <= s.low_stock_threshold ? "Low Stock" : "OK",
          }));
          filename = `Stock_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
          break;
        }
      }

      if (data.length === 0) {
        toast.info("No data found for the selected filters");
        return;
      }

      // Generate Excel file
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
      XLSX.writeFile(workbook, filename);

      toast.success("Report downloaded successfully");
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <Dialog 
          key={report.id} 
          onOpenChange={(open) => {
            if (open) {
              setSelectedReport(report.id);
              fetchVenues();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 h-auto py-4 px-4 min-h-[64px] rounded-xl border-border/60 hover:bg-muted/50 active:scale-[0.98] transition-all"
            >
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                {report.icon}
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="font-medium text-sm">{report.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{report.description}</div>
              </div>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm mx-auto rounded-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-base">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  {report.icon}
                </div>
                {report.title}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date Range</Label>
                <Select value={dateRange} onValueChange={handleDateRangeChange}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                    <SelectItem value="30days">Last 30 Days</SelectItem>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateRange === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Start Date</Label>
                    <Input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">End Date</Label>
                    <Input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-12"
                    />
                  </div>
                </div>
              )}

              {report.id !== "stock_variance" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Club Filter</Label>
                  <Select value={clubFilter} onValueChange={setClubFilter}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="All Clubs" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="all">All Clubs</SelectItem>
                      {venues.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button 
                onClick={generateReport} 
                disabled={generating}
                className="w-full h-12 text-base font-medium mt-2"
              >
                <Download className="h-5 w-5 mr-2" />
                {generating ? "Generating..." : "Download Excel"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
};
