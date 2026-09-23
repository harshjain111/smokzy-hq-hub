import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Package, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Venue {
  id: string;
  name: string;
}

interface HookahCategory {
  id: string;
  venue_id: string;
  category_name: string;
  is_packet_trackable: boolean;
  venue_name?: string;
}

const PRESET_CATEGORIES = [
  "Normal Pot Normal Flavour",
  "Normal Pot Premium Flavour",
  "Premium Pot Normal Flavour",
  "Premium Pot Premium Flavour",
];

const HookahCategoryManagement = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [categories, setCategories] = useState<HookahCategory[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVenues();
    fetchCategories();
  }, []);

  const fetchVenues = async () => {
    const { data } = await supabase
      .from("venues")
      .select("*")
      .order("name");

    setVenues(data || []);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("venue_hookah_categories")
      .select("*")
      .order("venue_id, category_name");

    if (data) {
      const enrichedData = await Promise.all(
        data.map(async (cat) => {
          const venue = venues.find(v => v.id === cat.venue_id);
          return {
            ...cat,
            venue_name: venue?.name || "Unknown"
          };
        })
      );
      setCategories(enrichedData);
    }
  };

  const togglePreset = (name: string) => {
    setCategoryNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const addCustomCategory = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (categoryNames.includes(trimmed)) {
      toast.error("Already added");
      return;
    }
    setCategoryNames((prev) => [...prev, trimmed]);
    setCustomInput("");
  };

  const removeCategory = (name: string) => {
    setCategoryNames((prev) => prev.filter((n) => n !== name));
  };

  const handleAddCategories = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVenueId) {
      toast.error("Please select a venue");
      return;
    }

    if (categoryNames.length === 0) {
      toast.error("Please select or add at least one category");
      return;
    }

    setSubmitting(true);
    const rows = categoryNames.map((name) => ({
      venue_id: selectedVenueId,
      category_name: name,
    }));

    const { error } = await supabase
      .from("venue_hookah_categories")
      .upsert(rows, { onConflict: "venue_id,category_name", ignoreDuplicates: true });

    setSubmitting(false);

    if (error) {
      toast.error("Failed to add categories");
      console.error(error);
    } else {
      toast.success(`${categoryNames.length} categor${categoryNames.length === 1 ? "y" : "ies"} added`);
      setCategoryNames([]);
      setCustomInput("");
      setSelectedVenueId("");
      setOpen(false);
      fetchCategories();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase
      .from("venue_hookah_categories")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete category");
    } else {
      toast.success("Category deleted");
      fetchCategories();
    }
  };

  const handleToggleTrackable = async (category: HookahCategory) => {
    const { error } = await supabase
      .from("venue_hookah_categories")
      .update({ is_packet_trackable: !category.is_packet_trackable })
      .eq("id", category.id);

    if (error) {
      toast.error("Failed to update trackable status");
    } else {
      toast.success(
        !category.is_packet_trackable
          ? "Category now counts as packet usage"
          : "Category no longer counts as packet usage"
      );
      fetchCategories();
    }
  };

  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.venue_id]) {
      acc[cat.venue_id] = [];
    }
    acc[cat.venue_id].push(cat);
    return acc;
  }, {} as Record<string, HookahCategory[]>);

  const existingForVenue = selectedVenueId
    ? (groupedCategories[selectedVenueId] || []).map((c) => c.category_name)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Hookah Category Management</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Hookah Categories</DialogTitle>
              <DialogDescription>Select multiple categories or add custom ones</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddCategories} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {venues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quick-add presets</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_CATEGORIES.map((preset) => {
                    const selected = categoryNames.includes(preset);
                    const alreadyExists = existingForVenue.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={alreadyExists}
                        onClick={() => togglePreset(preset)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          alreadyExists
                            ? "border-muted bg-muted text-muted-foreground cursor-not-allowed line-through"
                            : selected
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-card text-foreground hover:border-primary/40"
                        }`}
                      >
                        {preset}
                        {alreadyExists && " (exists)"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Custom category</Label>
                <div className="flex gap-2">
                  <Input
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Type a custom name"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomCategory();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addCustomCategory} className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {categoryNames.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {categoryNames.length} selected
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {categoryNames.map((name) => (
                      <Badge key={name} variant="secondary" className="gap-1 pr-1">
                        {name}
                        <button
                          type="button"
                          onClick={() => removeCategory(name)}
                          className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || categoryNames.length === 0}
              >
                {submitting ? "Adding..." : `Add ${categoryNames.length} Categor${categoryNames.length === 1 ? "y" : "ies"}`}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {venues.map((venue) => {
          const venueCategories = groupedCategories[venue.id] || [];

          return (
            <Card key={venue.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {venue.name}
                </CardTitle>
                <CardDescription>
                  {venueCategories.length} categor{venueCategories.length === 1 ? 'y' : 'ies'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {venueCategories.length > 0 ? (
                  <div className="grid gap-2">
                    {venueCategories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <span className="font-medium">{category.category_name}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={category.is_packet_trackable}
                              onCheckedChange={() => handleToggleTrackable(category)}
                            />
                            <span className="text-xs text-muted-foreground">Packet</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No categories configured for this venue
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {venues.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No venues found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default HookahCategoryManagement;
