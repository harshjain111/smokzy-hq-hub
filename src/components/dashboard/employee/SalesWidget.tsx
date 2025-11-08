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
import AppreciationDialog from "./AppreciationDialog";
import { compressImage } from "@/lib/imageCompression";

interface SalesWidgetProps {
  user: User;
  venueId: string;
}

const SalesWidget = ({ user, venueId }: SalesWidgetProps) => {
  const [open, setOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [hookahCategories, setHookahCategories] = useState<{ id: string; name: string }[]>([]);
  const [showSalesAppreciation, setShowSalesAppreciation] = useState(false);
  const [showPhotoAppreciation, setShowPhotoAppreciation] = useState(false);

  useEffect(() => {
    fetchHookahCategories();
    fetchTodaySales();
  }, [venueId]);

  const fetchHookahCategories = async () => {
    const { data } = await supabase
      .from("venue_hookah_categories")
      .select("id, category_name")
      .eq("venue_id", venueId)
      .order("category_name");

    if (data) {
      setHookahCategories(data.map(cat => ({ id: cat.id, name: cat.category_name })));
      if (data.length > 0 && !categoryId) {
        setCategoryId(data[0].id);
      }
    }
  };

  const fetchTodaySales = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("sales_reports")
      .select("*, venue_hookah_categories(category_name)")
      .eq("venue_id", venueId)
      .eq("report_date", today);

    setTodaySales(data || []);
  };

  const handleSubmitSales = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }

    const today = format(new Date(), "yyyy-MM-dd");

    const { error } = await supabase.from("sales_reports").insert({
      venue_id: venueId,
      reported_by: user.id,
      report_date: today,
      category_id: categoryId,
      quantity_sold: parseInt(quantity),
    });

    if (error) {
      toast.error("Failed to submit sales");
      console.error(error);
    } else {
      toast.success("Sales reported successfully");
      setQuantity("");
      setOpen(false);
      fetchTodaySales();
      setShowSalesAppreciation(true);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        toast.info("Compressing image...");
        const compressedFile = await compressImage(file);
        setPhotoFile(compressedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error("Compression error:", error);
        toast.error("Failed to compress image");
      }
    }
  };

  const handleRetakePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    const fileInput = document.getElementById("closingPhoto") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
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
      setPhotoPreview(null);
      setPhotoOpen(false);
      setShowPhotoAppreciation(true);
    } catch (error) {
      toast.error("Failed to upload photo");
      console.error(error);
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
                {hookahCategories.length > 0 ? (
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {hookahCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                    No hookah categories configured for this venue. Please contact admin.
                  </p>
                )}
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
              <Button type="submit" className="w-full" disabled={hookahCategories.length === 0}>
                Submit Sales
              </Button>
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
              {!photoPreview ? (
                <div className="space-y-2">
                  <Label htmlFor="closingPhoto">Counter Photo</Label>
                  <Input
                    id="closingPhoto"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoSelect}
                    required
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>Photo Preview</Label>
                  <div className="relative rounded-lg overflow-hidden border-2 border-border">
                    <img 
                      src={photoPreview} 
                      alt="Closing photo preview" 
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleRetakePhoto}
                      className="flex-1"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Retake
                    </Button>
                    <Button type="submit" className="flex-1">
                      Confirm & Upload
                    </Button>
                  </div>
                </div>
              )}
              {!photoPreview && (
                <Button type="button" disabled className="w-full">
                  Take Photo First
                </Button>
              )}
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
                  <span className="capitalize">{sale.venue_hookah_categories?.category_name || 'Unknown'}</span>
                  <span className="font-bold">{sale.quantity_sold} units</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AppreciationDialog
        open={showSalesAppreciation}
        onOpenChange={setShowSalesAppreciation}
        taskType="sales"
      />
      
      <AppreciationDialog
        open={showPhotoAppreciation}
        onOpenChange={setShowPhotoAppreciation}
        taskType="photo"
      />
    </div>
  );
};

export default SalesWidget;