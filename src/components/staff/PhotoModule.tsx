import { useState, useRef, useCallback, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, Check, Loader2, RotateCcw, Image } from "lucide-react";
import { ClubSession } from "@/hooks/useClubSession";
import { compressImage } from "@/lib/imageCompression";

interface PhotoModuleProps {
  user: User;
  venueId: string;
  session: ClubSession | null;
  updateSessionTask: (task: 'stock' | 'sales' | 'photo', submittedBy: string) => Promise<void>;
}

type FlowState = 'idle' | 'capturing' | 'preview' | 'uploading';

const PhotoModule = ({ user, venueId, session, updateSessionTask }: PhotoModuleProps) => {
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitterName, setSubmitterName] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchSubmitterInfo = useCallback(async () => {
    if (!session?.photo_uploaded_by || !session?.photo_uploaded_at) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.photo_uploaded_by)
      .single();

    if (profile) {
      setSubmitterName(profile.full_name);
      setSubmittedAt(new Date(session.photo_uploaded_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }));
    }
  }, [session]);

  useEffect(() => {
    if (session?.photo_uploaded) {
      fetchSubmitterInfo();
    }
  }, [session, fetchSubmitterInfo]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Back camera for counter photos
        audio: false,
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFlowState('capturing');
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Failed to access camera");
      setFlowState('idle');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) throw new Error("Could not get canvas context");
      
      ctx.drawImage(videoRef.current, 0, 0);
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], "counter.jpg", { type: "image/jpeg" });
          const compressed = await compressImage(file, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.85,
          });
          
          setPhotoBlob(compressed);
          setPhotoPreview(URL.createObjectURL(compressed));
          stopCamera();
          setFlowState('preview');
        }
      }, "image/jpeg", 0.95);
    } catch (error) {
      console.error("Capture error:", error);
      toast.error("Failed to capture photo");
    }
  };

  const handleRetake = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null);
    setPhotoPreview(null);
    startCamera();
  };

  const handleUpload = async () => {
    if (!photoBlob || !session) return;

    setFlowState('uploading');
    try {
      const fileName = `${venueId}/${session.session_date}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("closing-photos")
        .upload(fileName, photoBlob, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("closing-photos")
        .getPublicUrl(fileName);

      // Insert closing photo record
      const { error: insertError } = await supabase.from("closing_photos").insert({
        venue_id: venueId,
        uploaded_by: user.id,
        photo_url: publicUrl,
        photo_date: session.session_date,
      });

      if (insertError) throw insertError;

      // Update session
      await updateSessionTask('photo', user.id);
      
      toast.success("Counter photo received. Looks well maintained! 📸");
      
      // Cleanup
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoBlob(null);
      setPhotoPreview(null);
      setFlowState('idle');
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload photo");
      setFlowState('preview');
    }
  };

  const cancelFlow = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null);
    setPhotoPreview(null);
    stopCamera();
    setFlowState('idle');
    toast.info("Cancelled");
  };

  // Already uploaded state
  if (session?.photo_uploaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 space-y-6">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
          <Check className="w-10 h-10 text-success" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Photo Uploaded</h2>
          {submitterName && submittedAt && (
            <p className="text-muted-foreground">
              By {submitterName} at {submittedAt}
            </p>
          )}
        </div>
        <div className="bg-success/5 border border-success/20 rounded-2xl p-4 text-center max-w-xs">
          <p className="text-sm text-success font-medium">
            Looks well maintained!
          </p>
        </div>
      </div>
    );
  }

  // Idle state - show CTA
  if (flowState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 space-y-8">
        {/* Example overlay / guide */}
        <div className="relative w-full max-w-xs aspect-[4/3] bg-muted rounded-2xl overflow-hidden border-2 border-dashed border-muted-foreground/20">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2 p-4">
              <Image className="w-12 h-12 text-muted-foreground/50 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Take a clear photo of the cleaned counter
              </p>
            </div>
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Counter Photo Required</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            This photo confirms the counter is clean and ready for the next day
          </p>
        </div>

        <Button
          size="lg"
          onClick={startCamera}
          className="w-full max-w-xs h-16 text-lg font-semibold rounded-2xl bg-primary hover:bg-primary/90 shadow-lg"
        >
          <Camera className="w-6 h-6 mr-3" />
          Take Counter Photo
        </Button>
      </div>
    );
  }

  // Capturing state
  if (flowState === 'capturing') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          
          {/* Guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[80%] aspect-[4/3] border-2 border-white/50 rounded-lg">
              <div className="absolute top-4 left-0 right-0 text-center">
                <span className="bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                  Align counter in frame
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-black/80 flex items-center justify-center gap-6">
          <Button
            variant="ghost"
            size="lg"
            onClick={cancelFlow}
            className="text-white hover:bg-white/10 h-14 px-6"
          >
            Cancel
          </Button>
          <Button
            size="lg"
            onClick={capturePhoto}
            className="h-16 w-16 rounded-full bg-white hover:bg-white/90 text-black"
          >
            <Camera className="w-8 h-8" />
          </Button>
        </div>
      </div>
    );
  }

  // Preview state
  if (flowState === 'preview') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex-1 relative">
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Counter preview"
              className="w-full h-full object-contain bg-black"
            />
          )}
        </div>

        <div className="p-6 bg-black/80 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={handleRetake}
            className="flex-1 h-14 text-white border-white/30 hover:bg-white/10"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Retake
          </Button>
          <Button
            size="lg"
            onClick={handleUpload}
            className="flex-1 h-14 bg-success hover:bg-success/90 text-white"
          >
            <Check className="w-5 h-5 mr-2" />
            Confirm & Upload
          </Button>
        </div>
      </div>
    );
  }

  // Uploading state
  if (flowState === 'uploading') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-lg font-medium text-foreground">Uploading photo...</p>
      </div>
    );
  }

  return null;
};

export default PhotoModule;
