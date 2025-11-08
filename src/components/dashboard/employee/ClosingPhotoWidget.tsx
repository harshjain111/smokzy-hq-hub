import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import AppreciationDialog from "./AppreciationDialog";
import { compressImage } from "@/lib/imageCompression";

interface ClosingPhotoWidgetProps {
  user: User;
  venueId: string;
}

const ClosingPhotoWidget = ({ user, venueId }: ClosingPhotoWidgetProps) => {
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showPhotoAppreciation, setShowPhotoAppreciation] = useState(false);

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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Closing Photo
          </CardTitle>
          <CardDescription>Upload photo of the cleaned counter</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Camera className="mr-2 h-4 w-4" />
                Upload Closing Photo
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
        </CardContent>
      </Card>

      <AppreciationDialog
        open={showPhotoAppreciation}
        onOpenChange={setShowPhotoAppreciation}
        taskType="photo"
      />
    </>
  );
};

export default ClosingPhotoWidget;
