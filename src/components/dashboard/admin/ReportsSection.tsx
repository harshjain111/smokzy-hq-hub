import { useState } from "react";
import { FileSpreadsheet, Download, Calendar, Building2, Users, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
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
    description: "Staff attendance, breaks, and compliance metrics",
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
          let query = supabase
            .from("staff_attendance_blocks")
            .select(`*, venue:venues(name)`)
            .gte("check_in_time", startDate)
            .lte("check_in_time", endDate + "T23:59:59");

          if (clubFilter !== "all") {
            query = query.eq("venue_id", clubFilter);
          }

          const { data: attendanceData } = await query;
          
          // Fetch profiles separately
          const userIds = [...new Set(attendanceData?.map(a => a.user_id) || [])];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);
          
          const profileMap: Record<string, string> = {};
          profiles?.forEach(p => { profileMap[p.id] = p.full_name; });
          
          data = (attendanceData || []).map(a => ({
            Date: format(new Date(a.check_in_time), "yyyy-MM-dd"),
            Staff: profileMap[a.user_id] || "Unknown",
            Club: (a.venue as { name: string })?.name || "Unknown",
            "Check In": format(new Date(a.check_in_time), "HH:mm"),
            "Check Out": a.check_out_time ? format(new Date(a.check_out_time), "HH:mm") : "Active",
            "Is Break": a.is_break ? "Yes" : "No",
          }));
          filename = `Attendance_Report_${startDate}_to_${endDate}.xlsx`;
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          Reports & Exports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
                className="w-full justify-start gap-3 h-auto py-3"
              >
                {report.icon}
                <div className="text-left">
                  <div className="font-medium">{report.title}</div>
                  <div className="text-xs text-muted-foreground">{report.description}</div>
                </div>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {report.icon}
                  {report.title}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <Select value={dateRange} onValueChange={handleDateRangeChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="thisMonth">This Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dateRange === "custom" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Start Date</Label>
                      <Input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Date</Label>
                      <Input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {report.id !== "stock_variance" && (
                  <div className="space-y-2">
                    <Label>Club Filter</Label>
                    <Select value={clubFilter} onValueChange={setClubFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Clubs" />
                      </SelectTrigger>
                      <SelectContent>
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
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {generating ? "Generating..." : "Download Excel"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ))}
      </CardContent>
    </Card>
  );
};
