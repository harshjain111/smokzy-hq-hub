import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Leaf } from "lucide-react";

interface Flavour {
  id: string;
  name: string;
  packet_weight_grams: number;
  is_active: boolean;
}

const ManageFlavours = () => {
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(28);

  useEffect(() => {
    fetchFlavours();
  }, []);

  const fetchFlavours = async () => {
    const { data } = await supabase
      .from("flavours")
      .select("*")
      .order("name");
    setFlavours((data as Flavour[]) || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const { error } = await supabase
        .from("flavours")
        .update({ name, packet_weight_grams: weight })
        .eq("id", editingId);
      if (error) {
        toast.error("Failed to update flavour");
      } else {
        toast.success("Flavour updated");
      }
    } else {
      const { error } = await supabase
        .from("flavours")
        .insert({ name, packet_weight_grams: weight });
      if (error) {
        toast.error(error.message.includes("duplicate") ? "Flavour already exists" : "Failed to add flavour");
      } else {
        toast.success("Flavour added");
      }
    }
    resetForm();
    fetchFlavours();
  };

  const resetForm = () => {
    setName("");
    setWeight(28);
    setEditingId(null);
    setOpen(false);
  };

  const handleEdit = (f: Flavour) => {
    setEditingId(f.id);
    setName(f.name);
    setWeight(f.packet_weight_grams);
    setOpen(true);
  };

  const toggleActive = async (f: Flavour) => {
    const { error } = await supabase
      .from("flavours")
      .update({ is_active: !f.is_active })
      .eq("id", f.id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(f.is_active ? "Flavour deactivated" : "Flavour activated");
      fetchFlavours();
    }
  };

  const active = flavours.filter((f) => f.is_active);
  const inactive = flavours.filter((f) => !f.is_active);

  return (
    <PageLayout title="Manage Flavours" subtitle="Master list of shisha flavours for packet tracking">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {active.length} active · {inactive.length} inactive
          </p>
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Flavour
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Flavour" : "Add Flavour"}</DialogTitle>
                <DialogDescription>
                  {editingId ? "Update flavour details" : "Add a new shisha flavour"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fname">Flavour Name</Label>
                  <Input
                    id="fname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Blueberry Mint"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fweight">Packet Weight (grams)</Label>
                  <Input
                    id="fweight"
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    min={1}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingId ? "Save Changes" : "Add Flavour"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="h-5 w-5" />
              All Flavours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flavours.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No flavours added yet
              </p>
            ) : (
              <div className="grid gap-2">
                {flavours.map((f) => (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      f.is_active ? "bg-muted" : "bg-muted/50 opacity-60"
                    }`}
                  >
                    <div>
                      <span className="font-medium">{f.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {f.packet_weight_grams}g
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={f.is_active}
                        onCheckedChange={() => toggleActive(f)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(f)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
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

export default ManageFlavours;
