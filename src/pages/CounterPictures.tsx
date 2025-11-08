import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Download, ImageIcon, MapPin } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PhotoRecord {
  id: string;
  photo_date: string;
  venue_id: string;
  uploaded_by: string;
  photo_url: string | null;
  venues?: { name: string } | null;
  profiles?: { full_name: string } | null;
  signed_url?: string | null;
}

export default function CounterPictures() {
  const [dateRangeType, setDateRangeType] = useState<"current" | "last" | "custom">("current");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);
  const [venue, setVenue] = useState<string>("all");
  const [venues, setVenues] = useState<any[]>([]);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("venues").select("id, name").order("name");
      setVenues(data || []);
    })();
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [dateRangeType, customRange, venue]);

  const getDateRange = () => {
    const now = new Date();
    if (dateRangeType === "current") {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
    }
    if (dateRangeType === "last") {
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0) };
    }
    return customRange || { from: now, to: now };
  };

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const range = getDateRange();
      let query = supabase.from("closing_photos").select("*").gte("photo_date", format(range.from, "yyyy-MM-dd")).lte("photo_date", format(range.to, "yyyy-MM-dd")).order("photo_date", { ascending: false });
      if (venue !== "all") query = query.eq("venue_id", venue);
      const { data, error } = await query;
      if (error) throw error;

      const venueIds = [...new Set((data || []).map((r) => r.venue_id))];
      const userIds = [...new Set((data || []).map((r) => r.uploaded_by))];
      const [venuesRes, profilesRes] = await Promise.all([
        supabase.from("venues").select("id, name").in("id", venueIds),
        supabase.from("profiles").select("id, full_name").in("id", userIds),
      ]);
      const venuesMap = new Map(venuesRes.data?.map((v) => [v.id, v]) || []);
      const profilesMap = new Map(profilesRes.data?.map((p) => [p.id, p]) || []);

      const withSigned = await Promise.all((data || []).map(async (r) => ({
        ...r,
        venues: venuesMap.get(r.venue_id) || null,
        profiles: profilesMap.get(r.uploaded_by) || null,
        signed_url: r.photo_url ? (await supabase.storage.from("closing-photos").createSignedUrl(r.photo_url, 3600)).data?.signedUrl || null : null,
      })));

      setPhotos(withSigned);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    const headers = ["Date", "Venue", "Uploaded By", "Photo Present"]; 
    const rows = photos.map((p) => [p.photo_date, p.venues?.name || "N/A", p.profiles?.full_name || "N/A", p.photo_url ? "Yes" : "No"]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `counter-pictures-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 p-3 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Counter Pictures</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Select value={dateRangeType} onValueChange={(v: any) => setDateRangeType(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Month</SelectItem>
              <SelectItem value="last">Last Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {dateRangeType === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customRange?.from ? `${format(customRange.from, "MMM dd")} - ${format(customRange?.to || customRange.from, "MMM dd, yyyy")}` : "Pick range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  selected={{ from: customRange?.from, to: customRange?.to }}
                  onSelect={(range: any) => range?.from && range?.to && setCustomRange({ from: range.from, to: range.to })}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}

          <Select value={venue} onValueChange={setVenue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Venues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {loading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : photos.length === 0 ? (
          <div className="p-8 text-center">No photos</div>
        ) : (
          photos.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {p.venues?.name || "N/A"} • {format(new Date(p.photo_date), "MMM dd, yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {p.signed_url ? (
                  <img
                    src={p.signed_url}
                    alt="Counter"
                    className="w-full h-48 object-cover rounded border"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">No Image</text></svg>';
                    }}
                  />
                ) : (
                  <div className="w-full h-48 flex items-center justify-center border rounded bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>Uploaded by {p.profiles?.full_name || "Unknown"}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
