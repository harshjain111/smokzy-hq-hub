import { useState, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showPhotoAppreciation, setShowPhotoAppreciation] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

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
                  <Button onClick={startCamera} className="w-full">
                    <Camera className="mr-2 h-4 w-4" />
                    Start Camera
                  </Button>
                )}

                {isCameraActive && !photoPreview && (
                  <Button onClick={capturePhoto} className="w-full">
                    <Camera className="mr-2 h-4 w-4" />
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
                        className="flex-1"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Retake
                      </Button>
                      <Button onClick={handleUploadClosingPhoto} className="flex-1">
                        Confirm & Upload
                      </Button>
                    </div>
                  </div>
                )}
              </div>
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
