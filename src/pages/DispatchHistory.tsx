import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

interface DispatchRecord {
  id: string;
  venue_id: string;
  venue_name: string;
  date: string;
  flavour_id: string;
  flavour_name: string;
  quantity_sent: number;
  dispatched_by_name: string;
  received_by_name: string;
}

const formatDate = (d: Date): string => d.toISOString().split("T")[0];

const DispatchHistory = () => {
  const [records, setRecords] = useState<DispatchRecord[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [flavours, setFlavours] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterVenue, setFilterVenue] = useState("all");
  const [filterFlavour, setFilterFlavour] = useState("all");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [startDate, endDate, filterVenue, filterFlavour]);

  const fetchBaseData = async () => {
    const [{ data: v }, { data: f }] = await Promise.all([
      supabase.from("venues").select("id, name").order("name"),
      supabase.from("flavours").select("id, name").order("name"),
    ]);
    setVenues(v || []);
    setFlavours(f || []);
  };

  const fetchHistory = async () => {
    setLoading(true);
    let query = supabase
      .from("packet_dispatches")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (filterVenue !== "all") query = query.eq("venue_id", filterVenue);
    if (filterFlavour !== "all") query = query.eq("flavour_id", filterFlavour);

    const { data } = await query;

    if (data && data.length > 0) {
      // Fetch venue names, flavour names, profile names
      const venueMap = new Map(venues.map((v) => [v.id, v.name]));
      const flavourMap = new Map(flavours.map((f) => [f.id, f.name]));

      const userIds = [
        ...new Set([
          ...data.map((d: any) => d.dispatched_by),
          ...data.filter((d: any) => d.received_by_staff_id).map((d: any) => d.received_by_staff_id),
        ]),
      ];

      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

      setRecords(
        data.map((d: any) => ({
          id: d.id,
          venue_id: d.venue_id,
          venue_name: venueMap.get(d.venue_id) || "Unknown",
          date: d.date,
          flavour_id: d.flavour_id,
          flavour_name: flavourMap.get(d.flavour_id) || "Unknown",
          quantity_sent: d.quantity_sent,
          dispatched_by_name: profileMap.get(d.dispatched_by) || "—",
          received_by_name: d.received_by_staff_id
            ? profileMap.get(d.received_by_staff_id) || "—"
            : "—",
        }))
      );
    } else {
      setRecords([]);
    }
    setLoading(false);
  };

  const totalPackets = records.reduce((sum, r) => sum + r.quantity_sent, 0);

  const handleExportCSV = () => {
    const header = "Date,Club,Flavour,Quantity,Dispatched By,Received By\n";
    const rows = records
      .map(
        (r) =>
          `${r.date},${r.venue_name},${r.flavour_name},${r.quantity_sent},${r.dispatched_by_name},${r.received_by_name}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dispatch-history-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageLayout title="Dispatch History" subtitle="View and export past packet dispatches">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-[140px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-[140px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Club</Label>
            <Select value={filterVenue} onValueChange={setFilterVenue}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Clubs</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Flavour</Label>
            <Select value={filterFlavour} onValueChange={setFilterFlavour}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Flavours</SelectItem>
                {flavours.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={records.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          {records.length} records · {totalPackets} total packets
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : records.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No dispatch records found for the selected period
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Date</th>
                      <th className="p-3 text-left font-medium">Club</th>
                      <th className="p-3 text-left font-medium">Flavour</th>
                      <th className="p-3 text-center font-medium">Qty</th>
                      <th className="p-3 text-left font-medium">Dispatched By</th>
                      <th className="p-3 text-left font-medium">Received By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">
                          {new Date(r.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                        <td className="p-3 font-medium">{r.venue_name}</td>
                        <td className="p-3">{r.flavour_name}</td>
                        <td className="p-3 text-center font-semibold">{r.quantity_sent}</td>
                        <td className="p-3">{r.dispatched_by_name}</td>
                        <td className="p-3">{r.received_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default DispatchHistory;
