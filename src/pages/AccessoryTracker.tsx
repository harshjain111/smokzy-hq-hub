import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";

interface Venue {
  id: string;
  name: string;
}

interface Accessory {
  id: string;
  venue_id: string;
  item_type: string;
  quantity: number;
  condition: string;
  remarks: string | null;
  replacement_needed: boolean;
  dirty?: boolean;
}

const ITEM_TYPES = ["Hose Pipe", "Chillum", "Tong", "Coal Burner", "Base Plate", "Wind Cover", "Mouth Tip", "Cleaning Brush", "Ash Tray", "Charcoal Tray"];
const CONDITIONS = ["good", "fair", "poor", "broken"];

const AccessoryTracker = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("venues").select("id, name").order("name").then(({ data }) => {
      setVenues(data || []);
    });
    fetchAccessories();
  }, []);

  const fetchAccessories = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("venue_accessories")
      .select("*")
      .order("item_type");
    setAccessories((data || []).map((a: any) => ({ ...a, dirty: false })));
    setLoading(false);
  };

  const filtered = selectedVenue === "all"
    ? accessories
    : accessories.filter((a) => a.venue_id === selectedVenue);

  const updateField = (id: string, field: keyof Accessory, value: any) => {
    setAccessories((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value, dirty: true } : a))
    );
  };

  const addRow = (venueId: string) => {
    const newRow: Accessory = {
      id: `new_${Date.now()}`,
      venue_id: venueId,
      item_type: ITEM_TYPES[0],
      quantity: 0,
      condition: "good",
      remarks: null,
      replacement_needed: false,
      dirty: true,
    };
    setAccessories((prev) => [...prev, newRow]);
  };

  const removeRow = (id: string) => {
    setAccessories((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const dirtyRows = accessories.filter((a) => a.dirty);

      for (const row of dirtyRows) {
        const payload = {
          venue_id: row.venue_id,
          item_type: row.item_type,
          quantity: row.quantity,
          condition: row.condition,
          remarks: row.remarks,
          replacement_needed: row.condition === "broken" || row.replacement_needed,
          checked_by: user?.id || null,
          last_checked_date: new Date().toISOString().split("T")[0],
        };

        if (row.id.startsWith("new_")) {
          const { error } = await supabase.from("venue_accessories").insert(payload);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("venue_accessories").update(payload).eq("id", row.id);
          if (error) throw error;
        }
      }

      toast.success(`Saved ${dirtyRows.length} item(s)`);
      fetchAccessories();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const hasDirty = accessories.some((a) => a.dirty);
  const venueMap = new Map(venues.map((v) => [v.id, v.name]));

  return (
    <PageLayout title="Accessory Tracker" subtitle="Equipment inventory across all clubs">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select value={selectedVenue} onValueChange={setSelectedVenue}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Clubs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clubs</SelectItem>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            {selectedVenue !== "all" && (
              <Button variant="outline" size="sm" onClick={() => addRow(selectedVenue)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Item
              </Button>
            )}
            <Button onClick={handleSave} disabled={!hasDirty || saving} size="sm">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading accessories...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No accessories tracked yet.
                {selectedVenue !== "all" && (
                  <Button variant="link" size="sm" onClick={() => addRow(selectedVenue)}>
                    Add the first item
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {selectedVenue === "all" && <th className="p-3 text-left font-medium">Club</th>}
                      <th className="p-3 text-left font-medium">Item</th>
                      <th className="p-3 text-center font-medium w-20">Qty</th>
                      <th className="p-3 text-center font-medium w-28">Condition</th>
                      <th className="p-3 text-left font-medium">Remarks</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => (
                      <tr key={a.id} className={`border-b ${a.dirty ? "bg-primary/5" : ""}`}>
                        {selectedVenue === "all" && (
                          <td className="p-2 text-xs font-medium">{venueMap.get(a.venue_id) || "—"}</td>
                        )}
                        <td className="p-1.5">
                          <Select value={a.item_type} onValueChange={(v) => updateField(a.id, "item_type", v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ITEM_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            min={0}
                            value={a.quantity}
                            onChange={(e) => updateField(a.id, "quantity", parseInt(e.target.value) || 0)}
                            className="h-8 text-center text-xs"
                          />
                        </td>
                        <td className="p-1.5">
                          <Select value={a.condition} onValueChange={(v) => updateField(a.id, "condition", v)}>
                            <SelectTrigger className={`h-8 text-xs ${
                              a.condition === "broken" ? "border-destructive text-destructive" :
                              a.condition === "poor" ? "border-warning text-warning" : ""
                            }`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONDITIONS.map((c) => (
                                <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-1.5">
                          <Input
                            value={a.remarks || ""}
                            onChange={(e) => updateField(a.id, "remarks", e.target.value || null)}
                            className="h-8 text-xs"
                            placeholder="Notes..."
                          />
                        </td>
                        <td className="p-1.5">
                          {a.id.startsWith("new_") && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(a.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </td>
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

export default AccessoryTracker;
