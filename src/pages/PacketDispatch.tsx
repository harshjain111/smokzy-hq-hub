import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Loader2, Download, Camera, ImageIcon, Package } from "lucide-react";
import { format } from "date-fns";
import { compressImage } from "@/lib/imageCompression";

type DispatchMode = "packet" | "weight";

interface Venue {
  id: string;
  name: string;
}

interface Flavour {
  id: string;
  name: string;
  packet_weight_grams: number;
}

interface RawDispatchRow {
  id: string;
  venue_id: string;
  date: string;
  flavour_id: string;
  quantity_sent: number;
  unit: string;
  received_by_name: string | null;
  photo_url: string | null;
  dispatched_by: string;
  created_at: string;
}

interface DispatchRecord {
  id: string;
  venue_id: string;
  venue_name: string;
  date: string;
  flavour_name: string;
  quantity_sent: number;
  unit: string;
  received_by_name: string | null;
  dispatched_by_name: string;
  photo_url: string | null;
  created_at: string;
}

const formatDate = (d: Date): string => d.toISOString().split("T")[0];

const PacketDispatch = () => {
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>("packet");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [loading, setLoading] = useState(true);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [formVenueId, setFormVenueId] = useState("");
  const [formRecipient, setFormRecipient] = useState("");
  const [formFlavourId, setFormFlavourId] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formWeightUnit, setFormWeightUnit] = useState<"g" | "kg">("g");
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // History state
  const [records, setRecords] = useState<DispatchRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
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

  const fetchBaseData = async () => {
    setLoading(true);
    const [{ data: v }, { data: f }, { data: setting }] = await Promise.all([
      supabase.from("venues").select("id, name").order("name"),
      supabase.from("flavours").select("id, name, packet_weight_grams").eq("is_active", true).order("name"),
      supabase.from("global_settings").select("value").eq("key", "dispatch_mode").maybeSingle(),
    ]);
    setVenues(v || []);
    setFlavours((f as Flavour[]) || []);
    setDispatchMode((setting?.value as DispatchMode) || "packet");
    setLoading(false);
  };

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    let query = supabase
      .from("packet_dispatches")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("created_at", { ascending: false });

    if (filterVenue !== "all") query = query.eq("venue_id", filterVenue);
    if (filterFlavour !== "all") query = query.eq("flavour_id", filterFlavour);

    const { data } = await query;

    if (data && data.length > 0) {
      const rows = data as unknown as RawDispatchRow[];
      const venueMap = new Map(venues.map((v) => [v.id, v.name]));
      const flavourMap = new Map(flavours.map((f) => [f.id, f.name]));

      const userIds = [...new Set(rows.map((d) => d.dispatched_by))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

      setRecords(
        rows.map((d) => ({
          id: d.id,
          venue_id: d.venue_id,
          venue_name: venueMap.get(d.venue_id) || "Unknown",
          date: d.date,
          flavour_name: flavourMap.get(d.flavour_id) || "Unknown",
          quantity_sent: d.quantity_sent,
          unit: d.unit || "packets",
          received_by_name: d.received_by_name,
          dispatched_by_name: profileMap.get(d.dispatched_by) || "—",
          photo_url: d.photo_url,
          created_at: d.created_at,
        }))
      );
    } else {
      setRecords([]);
    }
    setHistoryLoading(false);
  }, [startDate, endDate, filterVenue, filterFlavour, venues, flavours]);

  useEffect(() => {
    if (venues.length > 0 && flavours.length > 0) {
      fetchHistory();
    }
  }, [fetchHistory, venues.length, flavours.length]);

  const resetForm = () => {
    setFormVenueId("");
    setFormRecipient("");
    setFormFlavourId("");
    setFormQuantity("");
    setFormWeightUnit("g");
    setFormPhoto(null);
    setFormPhotoPreview(null);
  };

  const handleFormOpenChange = (open: boolean) => {
    if (!open) resetForm();
    setFormOpen(open);
  };

  const handlePhotoSelect = (file: File | null) => {
    setFormPhoto(file);
    setFormPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSave = async () => {
    if (!formVenueId || !formFlavourId || !formQuantity || Number(formQuantity) <= 0) {
      toast.error("Venue, flavour, and a positive quantity are required");
      return;
    }

    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not signed in");

      const quantity = dispatchMode === "weight"
        ? Number(formQuantity) * (formWeightUnit === "kg" ? 1000 : 1)
        : Number(formQuantity);
      const unit = dispatchMode === "weight" ? "grams" : "packets";

      let photoUrl: string | null = null;
      if (formPhoto) {
        const compressed = await compressImage(formPhoto, {
          maxWidth: 1280,
          maxHeight: 1280,
          quality: 0.7,
          maxSizeMB: 0.5,
        });
        const filename = `${user.id}/${formVenueId}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("dispatch-photos")
          .upload(filename, compressed, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;

        const { data: urlData, error: urlError } = await supabase.storage
          .from("dispatch-photos")
          .createSignedUrl(filename, 60 * 60 * 24 * 365);
        if (urlError || !urlData?.signedUrl) throw urlError || new Error("Failed to get photo URL");
        photoUrl = urlData.signedUrl;
      }

      const { error } = await supabase.from("packet_dispatches").insert({
        venue_id: formVenueId,
        flavour_id: formFlavourId,
        date: formatDate(new Date()),
        quantity_sent: Math.round(quantity),
        unit,
        received_by_name: formRecipient.trim() || null,
        dispatched_by: user.id,
      });
      if (error) throw error;

      toast.success("Dispatch recorded");
      handleFormOpenChange(false);
      fetchHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record dispatch");
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    const header = "Date,Club,Flavour,Quantity,Unit,Received By,Dispatched By\n";
    const rows = records
      .map((r) =>
        `${r.date},${r.venue_name},${r.flavour_name},${r.quantity_sent},${r.unit},${r.received_by_name || "—"},${r.dispatched_by_name}`
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

  const pageTitle = dispatchMode === "weight" ? "Flavour Dispatch" : "Packet Dispatch";
  const totalQuantity = records.reduce((sum, r) => sum + r.quantity_sent, 0);

  if (loading) {
    return (
      <PageLayout title={pageTitle} subtitle="Loading...">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={pageTitle} subtitle="Record and review flavour sent to venues">
      <div className="space-y-4">
        <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Dispatch
          </Button>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{pageTitle}</DialogTitle>
              <DialogDescription>Record flavour handed over to a venue.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Club</Label>
                <Select value={formVenueId} onValueChange={setFormVenueId} disabled={saving}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select club" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Handed over to</Label>
                <Input
                  placeholder="Name of person receiving"
                  value={formRecipient}
                  onChange={(e) => setFormRecipient(e.target.value)}
                  className="h-11"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label>Flavour</Label>
                <Select value={formFlavourId} onValueChange={setFormFlavourId} disabled={saving}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select flavour" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {flavours.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{dispatchMode === "weight" ? "Quantity" : "Packets"}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={dispatchMode === "weight" ? "0.1" : "1"}
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    placeholder={dispatchMode === "weight" ? "e.g. 500" : "e.g. 10"}
                    className="h-11"
                    disabled={saving}
                  />
                  {dispatchMode === "weight" && (
                    <Select value={formWeightUnit} onValueChange={(v) => setFormWeightUnit(v as "g" | "kg")} disabled={saving}>
                      <SelectTrigger className="h-11 w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Photo (optional)</Label>
                {formPhotoPreview ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border">
                    <img src={formPhotoPreview} alt="Dispatch proof" className="w-full h-full object-cover" />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute bottom-2 right-2 h-8"
                      onClick={() => handlePhotoSelect(null)}
                      disabled={saving}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-border cursor-pointer text-sm text-muted-foreground hover:bg-muted/50">
                    <Camera className="h-4 w-4" />
                    Add a photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null)}
                      disabled={saving}
                    />
                  </label>
                )}
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full h-12">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
                Save Dispatch
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* History */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-[140px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-[140px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Club</Label>
            <Select value={filterVenue} onValueChange={setFilterVenue}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Clubs</SelectItem>
                {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Flavour</Label>
            <Select value={filterFlavour} onValueChange={setFilterFlavour}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Flavours</SelectItem>
                {flavours.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={records.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          {records.length} dispatches · {totalQuantity} total {records[0]?.unit === "grams" ? "grams" : "units"}
        </div>

        <Card>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : records.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No dispatches recorded for the selected period
              </div>
            ) : (
              <div className="divide-y">
                {records.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3">
                    {r.photo_url ? (
                      <img src={r.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{r.venue_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {r.flavour_name} · {r.quantity_sent} {r.unit === "grams" ? "g" : "packets"}
                        {r.received_by_name ? ` · to ${r.received_by_name}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{r.dispatched_by_name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default PacketDispatch;
