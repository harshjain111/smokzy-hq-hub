import { useState, useRef, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import AppreciationDialog from "./AppreciationDialog";
import { compressImage } from "@/lib/imageCompression";
import { format } from "date-fns";

interface ClosingPhotoWidgetProps {
  user: User;
  venueId: string;
}

interface TaskStatus {
  stockReported: boolean;
  salesReported: boolean;
  closingPhoto: boolean;
}

const ClosingPhotoWidget = ({ user, venueId }: ClosingPhotoWidgetProps) => {
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showPhotoAppreciation, setShowPhotoAppreciation] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({
    stockReported: false,
    salesReported: false,
    closingPhoto: false,
  });

  useEffect(() => {
    checkTaskStatus();
    checkPhotoStatus();
  }, [venueId]);

  const checkPhotoStatus = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("closing_photos")
      .select("id")
      .eq("venue_id", venueId)
      .eq("photo_date", today)
      .limit(1);

    setPhotoUploaded(!!(data && data.length > 0));
  };

  const checkTaskStatus = async () => {
    const today = format(new Date(), "yyyy-MM-dd");

    const [stockCheck, salesCheck, closingCheck] = await Promise.all([
      supabase
        .from("stock")
        .select("id, quantity, created_at, updated_at")
        .eq("venue_id", venueId),
      supabase
        .from("sales_reports")
        .select("id")
        .eq("venue_id", venueId)
        .eq("report_date", today)
        .limit(1),
      supabase
        .from("closing_photos")
        .select("id")
        .eq("venue_id", venueId)
        .eq("photo_date", today)
        .limit(1),
    ]);

    let stockReported = false;
    if (stockCheck.data && stockCheck.data.length > 0) {
      const todayDate = format(new Date(), "yyyy-MM-dd");
      stockReported = stockCheck.data.every((item: any) => {
        const itemUpdateDate = format(new Date(item.updated_at), "yyyy-MM-dd");
        return itemUpdateDate === todayDate && item.updated_at !== item.created_at;
      });
    }

    setTaskStatus({
      stockReported,
      salesReported: !!(salesCheck.data && salesCheck.data.length > 0),
      closingPhoto: !!(closingCheck.data && closingCheck.data.length > 0),
    });
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Failed to access camera");
      setIsCameraActive(false);
    }
  };

  const capturePhoto = async () => {
    try {
      const canvas = document.createElement("canvas");
      const video = videoRef.current;
      
      if (!video) {
        throw new Error("Video element not found");
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            // Convert blob to File for compression
            const file = new File([blob], "closing-photo.jpg", { type: "image/jpeg" });
            
            // Compress the image
            toast.info("Compressing image...");
            const compressedFile = await compressImage(file, {
              maxWidth: 1920,
              maxHeight: 1920,
              quality: 0.85
            });
            
            setPhotoBlob(compressedFile);
            
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
              setPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(compressedFile);
            
            // Stop camera
            if (stream) {
              stream.getTracks().forEach((track) => track.stop());
              setStream(null);
            }
            setIsCameraActive(false);
          } catch (error) {
            console.error("Compression error:", error);
            toast.error("Failed to compress image");
          }
        }
      }, "image/jpeg", 0.95);
    } catch (error) {
      console.error("Capture error:", error);
      toast.error("Failed to capture photo");
    }
  };

  const handleRetakePhoto = () => {
    setPhotoBlob(null);
    setPhotoPreview(null);
    startCamera();
  };

  const handleUploadClosingPhoto = async () => {
    if (!photoBlob) {
      toast.error("Please capture a photo");
      return;
    }

    try {
      const fileName = `${venueId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("closing-photos")
        .upload(fileName, photoBlob);

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
      setPhotoBlob(null);
      setPhotoPreview(null);
      setPhotoOpen(false);
      setPhotoUploaded(true);
      setShowPhotoAppreciation(true);
      checkTaskStatus(); // Refresh task status
      // Notify other components immediately
      window.dispatchEvent(new CustomEvent('tasks:updated', { detail: { venueId, source: 'closing_photo' } }));
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
          <CardDescription>
            {photoUploaded 
              ? "Closing photo uploaded for today ✓" 
              : "Upload photo of the cleaned counter"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {photoUploaded ? (
            <div className="text-center py-6 space-y-2">
              <div className="text-4xl">✓</div>
              <p className="text-sm font-medium text-foreground">Photo Uploaded</p>
              <p className="text-xs text-muted-foreground">Your team has uploaded the closing photo for today</p>
            </div>
          ) : (
            <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full border-2 min-h-[52px] text-base hover:bg-primary/5">
                  <Camera className="mr-2 h-5 w-5" />
                  Upload Closing Photo
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Capture Closing Photo</DialogTitle>
                <DialogDescription>Take a photo of the cleaned counter</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Hidden video element for camera */}
                <video
                  ref={videoRef}
                  className={isCameraActive ? "w-full rounded-lg" : "hidden"}
                  playsInline
                  muted
                />

                {!photoPreview && !isCameraActive && (
                  <Button onClick={startCamera} className="w-full border-2 border-primary/20 hover:border-primary/40 min-h-[52px] text-base">
                    <Camera className="mr-2 h-5 w-5" />
                    Start Camera
                  </Button>
                )}

                {isCameraActive && !photoPreview && (
                  <Button onClick={capturePhoto} className="w-full border-2 border-primary/20 hover:border-primary/40 min-h-[52px] text-base bg-primary hover:bg-primary/90">
                    <Camera className="mr-2 h-5 w-5" />
                    Capture Photo
                  </Button>
                )}

                {photoPreview && (
                  <div className="space-y-3">
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
                        className="flex-1 border-2 min-h-[52px] text-base"
                      >
                        <Camera className="mr-2 h-5 w-5" />
                        Retake
                      </Button>
                      <Button onClick={handleUploadClosingPhoto} className="flex-1 border-2 border-primary/20 min-h-[52px] text-base">
                        Confirm & Upload
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          )}
        </CardContent>
      </Card>

      <AppreciationDialog
        open={showPhotoAppreciation}
        onOpenChange={setShowPhotoAppreciation}
        taskType="photo"
        taskStatus={taskStatus}
      />
    </>
  );
};

export default ClosingPhotoWidget;
