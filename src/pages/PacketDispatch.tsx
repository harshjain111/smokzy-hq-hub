import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Venue {
  id: string;
  name: string;
}

interface Flavour {
  id: string;
  name: string;
  is_active: boolean;
}

interface Employee {
  user_id: string;
  full_name: string;
}

// Map key = "venueId_flavourId"
type DispatchGrid = Map<string, { quantity: number; id?: string; received_by?: string }>;

const formatDate = (d: Date): string => d.toISOString().split("T")[0];

const PacketDispatch = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [venues, setVenues] = useState<Venue[]>([]);
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [grid, setGrid] = useState<DispatchGrid>(new Map());
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  const dateStr = formatDate(selectedDate);
  const isToday = dateStr === formatDate(new Date());
  const isPast = selectedDate < new Date(new Date().setHours(0, 0, 0, 0));
  const canEdit = isToday; // Only today's dispatches are editable

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    fetchDispatches();
  }, [selectedDate, venues, flavours]);

  const fetchBaseData = async () => {
    const [{ data: v }, { data: f }, { data: roles }] = await Promise.all([
      supabase.from("venues").select("id, name").order("name"),
      supabase.from("flavours").select("id, name, is_active").eq("is_active", true).order("name"),
      supabase.from("user_roles").select("user_id").eq("role", "employee"),
    ]);

    setVenues(v || []);
    setFlavours((f as Flavour[]) || []);

    if (roles && roles.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", roles.map((r) => r.user_id));
      setEmployees((profiles || []).map((p) => ({ user_id: p.id, full_name: p.full_name })));
    }
  };

  const fetchDispatches = async () => {
    if (venues.length === 0 || flavours.length === 0) return;
    setLoading(true);

    const { data } = await supabase
      .from("packet_dispatches")
      .select("*")
      .eq("date", dateStr);

    const newGrid: DispatchGrid = new Map();
    (data || []).forEach((d: any) => {
      newGrid.set(`${d.venue_id}_${d.flavour_id}`, {
        quantity: d.quantity_sent,
        id: d.id,
        received_by: d.received_by_staff_id,
      });
    });
    setGrid(newGrid);
    setDirty(false);
    setLoading(false);
  };

  const gridKey = (venueId: string, flavourId: string) => `${venueId}_${flavourId}`;

  const setCell = (venueId: string, flavourId: string, qty: number) => {
    const key = gridKey(venueId, flavourId);
    const newGrid = new Map(grid);
    const existing = newGrid.get(key);
    newGrid.set(key, { ...existing, quantity: qty });
    setGrid(newGrid);
    setDirty(true);
  };

  const getCell = (venueId: string, flavourId: string) => {
    return grid.get(gridKey(venueId, flavourId));
  };

  const getVenueTotal = (venueId: string): number => {
    let total = 0;
    flavours.forEach((f) => {
      const cell = getCell(venueId, f.id);
      if (cell) total += cell.quantity;
    });
    return total;
  };

  const getFlavourTotal = (flavourId: string): number => {
    let total = 0;
    venues.forEach((v) => {
      const cell = getCell(v.id, flavourId);
      if (cell) total += cell.quantity;
    });
    return total;
  };

  const grandTotal = useMemo(() => {
    let total = 0;
    grid.forEach((cell) => (total += cell.quantity));
    return total;
  }, [grid]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;

      // Delete existing dispatches for this date
      await supabase.from("packet_dispatches").delete().eq("date", dateStr);

      // Insert all non-zero entries
      const rows: any[] = [];
      grid.forEach((cell, key) => {
        if (cell.quantity > 0) {
          const [venueId, flavourId] = key.split("_");
          rows.push({
            venue_id: venueId,
            flavour_id: flavourId,
            date: dateStr,
            quantity_sent: cell.quantity,
            received_by_staff_id: cell.received_by || null,
            dispatched_by: user?.id || "",
          });
        }
      });

      if (rows.length > 0) {
        const { error } = await supabase.from("packet_dispatches").insert(rows);
        if (error) throw error;
      }

      toast.success(`Saved ${rows.length} dispatch entries`);
      setDirty(false);
      fetchDispatches();
    } catch (err: any) {
      toast.error(err.message || "Failed to save dispatches");
    } finally {
      setSaving(false);
    }
  };

  const navigateDay = (dir: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + dir);
    setSelectedDate(next);
  };

  return (
    <PageLayout
      title="Packet Dispatch"
      subtitle={selectedDate.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}
    >
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateDay(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDay(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              Grand Total: <span className="text-primary">{grandTotal} packets</span>
            </span>
            {canEdit && (
              <Button onClick={handleSave} disabled={!dirty || saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Dispatch
              </Button>
            )}
          </div>
        </div>

        {!canEdit && isPast && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            Past dispatches are locked and cannot be edited.
          </div>
        )}

        {/* Dispatch Grid */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading dispatch data...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="sticky left-0 bg-muted/50 z-10 p-3 text-left font-medium min-w-[160px]">
                        Club
                      </th>
                      {flavours.map((f) => (
                        <th key={f.id} className="p-3 text-center font-medium min-w-[90px]">
                          <div className="text-xs leading-tight">{f.name}</div>
                        </th>
                      ))}
                      <th className="p-3 text-center font-medium min-w-[70px] bg-muted/80">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venues.map((venue) => (
                      <tr key={venue.id} className="border-b hover:bg-muted/30">
                        <td className="sticky left-0 bg-background z-10 p-3 font-medium">
                          {venue.name}
                        </td>
                        {flavours.map((f) => {
                          const cell = getCell(venue.id, f.id);
                          return (
                            <td key={f.id} className="p-1.5 text-center">
                              <Input
                                type="number"
                                min={0}
                                value={cell?.quantity || ""}
                                onChange={(e) =>
                                  setCell(venue.id, f.id, parseInt(e.target.value) || 0)
                                }
                                className="h-8 w-full text-center text-xs"
                                disabled={!canEdit}
                                placeholder="0"
                              />
                            </td>
                          );
                        })}
                        <td className="p-3 text-center font-semibold bg-muted/30">
                          {getVenueTotal(venue.id) || "—"}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="border-t-2 bg-muted/50 font-semibold">
                      <td className="sticky left-0 bg-muted/50 z-10 p-3">Total</td>
                      {flavours.map((f) => (
                        <td key={f.id} className="p-3 text-center">
                          {getFlavourTotal(f.id) || "—"}
                        </td>
                      ))}
                      <td className="p-3 text-center text-primary">{grandTotal || "—"}</td>
                    </tr>
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

export default PacketDispatch;
