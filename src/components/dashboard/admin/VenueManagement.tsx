import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, MapPin, Edit, Trash2 } from "lucide-react";

interface Venue {
  id: string;
  name: string;
  location: string;
}

const VenueManagement = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    fetchVenues();
  }, []);

  const fetchVenues = async () => {
    const { data, error } = await supabase
      .from("venues")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load venues");
    } else {
      setVenues(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingVenue) {
      const { error } = await supabase
        .from("venues")
        .update({ name, location })
        .eq("id", editingVenue.id);

      if (error) {
        toast.error("Failed to update venue");
      } else {
        toast.success("Venue updated successfully");
        setName("");
        setLocation("");
        setEditingVenue(null);
        setOpen(false);
        fetchVenues();
      }
    } else {
      const { error } = await supabase
        .from("venues")
        .insert({ name, location });

      if (error) {
        toast.error("Failed to create venue");
      } else {
        toast.success("Venue created successfully");
        setName("");
        setLocation("");
        setOpen(false);
        fetchVenues();
      }
    }
  };

  const handleEdit = (venue: Venue) => {
    setEditingVenue(venue);
    setName(venue.name);
    setLocation(venue.location);
    setOpen(true);
  };

  const handleDelete = async (venueId: string) => {
    const { error } = await supabase
      .from("venues")
      .delete()
      .eq("id", venueId);

    if (error) {
      toast.error("Failed to delete venue");
    } else {
      toast.success("Venue deleted successfully");
      fetchVenues();
    }
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingVenue(null);
    setName("");
    setLocation("");
  };

  if (loading) {
    return <div>Loading venues...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Venue Management</h2>
        <Dialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) handleCloseDialog();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Venue
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingVenue ? "Edit Venue" : "Add New Venue"}</DialogTitle>
              <DialogDescription>
                {editingVenue ? "Update venue information" : "Create a new club or cafe location"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Venue Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Club Phoenix"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Downtown Mumbai"
                  required
                />
              </div>
              <Button type="submit" className="w-full">{editingVenue ? "Update Venue" : "Create Venue"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {venues.map((venue) => (
          <Card key={venue.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle>{venue.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {venue.location}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(venue)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Venue</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{venue.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(venue.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
        {venues.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <p className="text-muted-foreground">No venues yet. Add your first venue to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VenueManagement;