import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { TrendingUp, Plus, Camera } from "lucide-react";
import { format } from "date-fns";

interface SalesWidgetProps {
  user: User;
  venueId: string;
}

const SalesWidget = ({ user, venueId }: SalesWidgetProps) => {
  const [open, setOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [category, setCategory] = useState<"premium" | "standard" | "budget">("standard");
  const [quantity, setQuantity] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [todaySales, setTodaySales] = useState<any[]>([]);

  useEffect(() => {
    fetchTodaySales();
  }, [venueId]);

  const fetchTodaySales = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("sales_reports")
      .select("*")
      .eq("venue_id", venueId)
      .eq("report_date", today);

    setTodaySales(data || []);
  };

  const handleSubmitSales = async (e: React.FormEvent) => {
    e.preventDefault();

    const today = format(new Date(), "yyyy-MM-dd");

    const { error } = await supabase.from("sales_reports").upsert(
      {
        venue_id: venueId,
        reported_by: user.id,
        report_date: today,
        hookah_category: category,
        quantity_sold: parseInt(quantity),
      },
      { onConflict: "venue_id,report_date,hookah_category" }
    );

    if (error) {
      toast.error("Failed to submit sales");
    } else {
      toast.success("Sales reported successfully");
      setQuantity("");
      setOpen(false);
      fetchTodaySales();
    }
  };

  const handleUploadClosingPhoto = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!photoFile) {
      toast.error("Please select a photo");
      return;
    }

    try {
      const fileExt = photoFile.name.split(".").pop();
      const fileName = `${venueId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("closing-photos")
        .upload(fileName, photoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("closing-photos")
        .getPublicUrl(fileName);

      const { error } = await supabase.from("closing_photos").insert({
        venue_id: venueId,
        uploaded_by: user.id,
        photo_url: publicUrl,
      });

      if (error) throw error;

      toast.success("Closing photo uploaded successfully");
      setPhotoFile(null);
      setPhotoOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload photo");
    }
  };

  const totalSales = todaySales.reduce((sum, sale) => sum + sale.quantity_sold, 0);

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-success" />
            Today's Sales
          </CardTitle>
          <CardDescription>Total hookahs sold today</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-success">{totalSales}</p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex-1">
              <Plus className="mr-2 h-4 w-4" />
              Report Sales
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report Daily Sales</DialogTitle>
              <DialogDescription>Enter sales by hookah category</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitSales} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Hookah Category</Label>
                <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="budget">Budget</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity Sold</Label>
                <Input
                  id="qty"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">Submit Sales</Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1">
              <Camera className="mr-2 h-4 w-4" />
              Closing Photo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Closing Photo</DialogTitle>
              <DialogDescription>Photo of the cleaned counter</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUploadClosingPhoto} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="closingPhoto">Counter Photo</Label>
                <Input
                  id="closingPhoto"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">Upload Photo</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {todaySales.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Sales Breakdown</h3>
          {todaySales.map((sale) => (
            <Card key={sale.id}>
              <CardContent className="py-3">
                <div className="flex justify-between items-center">
                  <span className="capitalize">{sale.hookah_category}</span>
                  <span className="font-bold">{sale.quantity_sold} units</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesWidget;