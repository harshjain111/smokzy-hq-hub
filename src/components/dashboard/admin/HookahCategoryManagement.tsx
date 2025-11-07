import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Package } from "lucide-react";

interface Venue {
  id: string;
  name: string;
}

interface HookahCategory {
  id: string;
  venue_id: string;
  category_name: string;
  venue_name?: string;
}

const HookahCategoryManagement = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [categories, setCategories] = useState<HookahCategory[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [categoryName, setCategoryName] = useState("");

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

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVenueId) {
      toast.error("Please select a venue");
      return;
    }

    const { error } = await supabase
      .from("venue_hookah_categories")
      .insert({
        venue_id: selectedVenueId,
        category_name: categoryName
      });

    if (error) {
      toast.error("Failed to add category");
      console.error(error);
    } else {
      toast.success("Category added successfully");
      setCategoryName("");
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

  // Group categories by venue
  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.venue_id]) {
      acc[cat.venue_id] = [];
    }
    acc[cat.venue_id].push(cat);
    return acc;
  }, {} as Record<string, HookahCategory[]>);

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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Hookah Category</DialogTitle>
              <DialogDescription>Add a new hookah category for a venue</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddCategory} className="space-y-4">
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
                <Label htmlFor="categoryName">Category Name</Label>
                <Input
                  id="categoryName"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g., Premium, Standard, Budget"
                  required
                />
              </div>
              <Button type="submit" className="w-full">Add Category</Button>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
