import { useState, useRef, useCallback, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogIn, LogOut, Clock, MapPin, Camera, Loader2, Check, X, Coffee, Play } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { ClubSession, AttendanceBlock, StaffBreak, StaffStatus } from "@/hooks/useClubSession";
import { compressImage } from "@/lib/imageCompression";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CheckoutBlockedDialog from "./CheckoutBlockedDialog";
import EarlyCheckoutDialog from "@/components/dashboard/employee/EarlyCheckoutDialog";
import { TabId } from "./BottomNav";

interface AttendanceModuleProps {
  user: User;
  venueId: string;
  session: ClubSession | null;
  myAttendanceBlock: AttendanceBlock | null;
  isCheckedIn: boolean;
  checkIn: (photoUrl: string, lat: number, lng: number) => Promise<void>;
  checkOut: (photoUrl: string, lat: number, lng: number, dutyCompleted: boolean) => Promise<void>;
  checkoutEligibility: { canCheckout: boolean; reason: string; isMorningShift: boolean };
  // Break management
  staffStatus: StaffStatus;
  currentBreak: StaffBreak | null;
  totalBreakMinutes: number;
  startBreak: () => Promise<void>;
  endBreak: () => Promise<void>;
  isLongBreak: () => boolean;
  // Navigation for blocked checkout
  onNavigateToTab?: (tab: TabId) => void;
}

type FlowState = 'idle' | 'capturing' | 'preview' | 'processing';

const AttendanceModule = ({
  user,
  venueId,
  session,
  myAttendanceBlock,
  isCheckedIn,
  checkIn,
  checkOut,
  checkoutEligibility,
  staffStatus,
  currentBreak,
  totalBreakMinutes,
  startBreak,
  endBreak,
  isLongBreak,
  onNavigateToTab,
}: AttendanceModuleProps) => {
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isEarlyExit, setIsEarlyExit] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showDutyDialog, setShowDutyDialog] = useState(false);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [showEarlyExitDialog, setShowEarlyExitDialog] = useState(false);
  const [earlyExitLoading, setEarlyExitLoading] = useState(false);
  const [breakLoading, setBreakLoading] = useState(false);
  const [breakDuration, setBreakDuration] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Update break duration every minute
  useEffect(() => {
    if (currentBreak && staffStatus === 'on_break') {
      const updateDuration = () => {
        const startTime = new Date(currentBreak.break_start_time);
        const minutes = differenceInMinutes(new Date(), startTime);
        setBreakDuration(minutes);
      };
      updateDuration();
      const interval = setInterval(updateDuration, 60000);
      return () => clearInterval(interval);
    } else {
      setBreakDuration(0);
    }
  }, [currentBreak, staffStatus]);

  // Break handlers
  const handleStartBreak = async () => {
    setBreakLoading(true);
    try {
      await startBreak();
      toast.success("Break started. Please resume duty after your break.", {
        icon: "☕",
      });
    } catch (error: any) {
      console.error("Start break error:", error);
      toast.error(error.message || "Failed to start break");
    } finally {
      setBreakLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setBreakLoading(true);
    try {
      await endBreak();
      toast.success("Welcome back! You're back on duty.", {
        icon: "💪",
      });
    } catch (error: any) {
      console.error("End break error:", error);
      toast.error(error.message || "Failed to end break");
    } finally {
      setBreakLoading(false);
    }
  };

  // Fetch location in parallel when starting camera
  const fetchLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    } catch (error) {
      console.error("Location error:", error);
      toast.error("Failed to get location. Please enable location access.");
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const startCamera = async () => {
    try {
      // Start fetching location in parallel
      fetchLocation();
      
      // Set flow state first so video element renders
      setFlowState('capturing');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      
      // Wait for next tick to ensure video element is mounted
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(err => {
            console.error("Video play error:", err);
          });
        }
      }, 100);
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Failed to access camera. Please allow camera access.");
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
      stopCamera();
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
            const compressed = await compressImage(file, {
              maxWidth: 1280,
              maxHeight: 1280,
              quality: 0.85,
            });
            
            setPhotoBlob(compressed);
            setPhotoPreview(URL.createObjectURL(compressed));
            setFlowState('preview');
          } catch (compressError) {
            console.error("Compression error:", compressError);
            toast.error("Failed to process photo");
            setFlowState('idle');
          }
        }
      }, "image/jpeg", 0.95);
    } catch (error) {
      console.error("Capture error:", error);
      toast.error("Failed to capture photo");
      setFlowState('idle');
    }
  };

  const handleRetake = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null);
    setPhotoPreview(null);
    setLocation(null);
    startCamera();
  };

  const uploadPhoto = async (blob: Blob): Promise<string> => {
    const fileName = `${user.id}/${Date.now()}.jpg`;
    
    const { error } = await supabase.storage
      .from("attendance-photos")
      .upload(fileName, blob, { contentType: "image/jpeg" });

    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from("attendance-photos")
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleCheckInStart = () => {
    setIsCheckingOut(false);
    startCamera();
  };

  const handleCheckOutStart = () => {
    if (!checkoutEligibility.canCheckout) {
      // Show the blocked dialog instead of just a toast
      setShowBlockedDialog(true);
      return;
    }
    setIsCheckingOut(true);
    startCamera();
  };

  const handleNavigateToTask = (task: 'stock' | 'sales' | 'photo') => {
    if (onNavigateToTab) {
      onNavigateToTab(task);
    }
  };

  // Early Exit flow handlers
  const handleEarlyExitRequest = () => {
    setShowEarlyExitDialog(true);
  };

  const handleEarlyExitConfirm = async (reason: string) => {
    setEarlyExitLoading(true);
    setIsEarlyExit(true);
    setIsCheckingOut(true);
    
    // Start camera to capture checkout selfie
    startCamera();
    setShowEarlyExitDialog(false);
    setEarlyExitLoading(false);
  };

  const handleConfirmCheckIn = async () => {
    if (!photoBlob || !location) return;

    setFlowState('processing');
    try {
      const photoUrl = await uploadPhoto(photoBlob);
      await checkIn(photoUrl, location.lat, location.lng);
      toast.success("Checked in successfully! 🎉");
      resetFlow();
    } catch (error: any) {
      console.error("Check-in error:", error);
      toast.error(error.message || "Failed to check in");
      setFlowState('preview');
    }
  };

  const handleConfirmPreview = () => {
    if (isCheckingOut) {
      if (isEarlyExit) {
        // Early exit - directly checkout with duty NOT completed
        handleDutyResponse(false);
      } else {
        setShowDutyDialog(true);
      }
    } else {
      handleConfirmCheckIn();
    }
  };

  const handleDutyResponse = async (dutyCompleted: boolean) => {
    setShowDutyDialog(false);
    if (!photoBlob || !location) return;

    setFlowState('processing');
    try {
      const photoUrl = await uploadPhoto(photoBlob);
      await checkOut(photoUrl, location.lat, location.lng, dutyCompleted);
      
      if (isEarlyExit) {
        toast.success("Early checkout recorded. See you next time! 👋");
      } else if (dutyCompleted) {
        toast.success("Checked out successfully! Great work today! 🌟");
      } else {
        toast.success("On break - see you when you return! ☕");
      }
      resetFlow();
    } catch (error: any) {
      console.error("Check-out error:", error);
      toast.error(error.message || "Failed to check out");
      setFlowState('preview');
    }
  };

  const resetFlow = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null);
    setPhotoPreview(null);
    setLocation(null);
    setFlowState('idle');
    setIsCheckingOut(false);
    setIsEarlyExit(false);
    stopCamera();
  };

  const cancelFlow = () => {
    resetFlow();
    toast.info("Cancelled");
  };

  // Render check-in/out buttons (idle state)
  if (flowState === 'idle') {
    // On Break state
    if (staffStatus === 'on_break') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 space-y-8">
          {/* On Break status */}
          <div className="text-center space-y-3">
            <div className="w-24 h-24 rounded-full bg-warning/15 flex items-center justify-center mx-auto border-4 border-warning/30">
              <Coffee className="w-12 h-12 text-warning" />
            </div>
            <h2 className="text-2xl font-bold text-warning">You're On Break</h2>
            <p className="text-muted-foreground">
              Break started at {currentBreak && format(new Date(currentBreak.break_start_time), "h:mm a")}
            </p>
            <div className="text-3xl font-mono font-bold text-foreground">
              {breakDuration} min
            </div>
            {isLongBreak() && (
              <p className="text-sm text-warning bg-warning/10 px-3 py-1.5 rounded-full">
                Break duration is longer than usual
              </p>
            )}
          </div>

          {/* Resume Duty button */}
          <Button
            size="lg"
            onClick={handleEndBreak}
            disabled={breakLoading}
            className="w-full max-w-xs h-16 text-lg font-semibold rounded-2xl bg-success hover:bg-success/90 shadow-lg text-white"
          >
            {breakLoading ? (
              <Loader2 className="w-6 h-6 mr-3 animate-spin" />
            ) : (
              <Play className="w-6 h-6 mr-3" />
            )}
            Resume Duty
          </Button>

          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Resume your duty to continue working or checkout
          </p>
        </div>
      );
    }

    // On Duty or Checked Out states
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 space-y-6">
        {isCheckedIn ? (
          <>
            {/* Checked in / On Duty status */}
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto border-4 border-success/30">
                <Check className="w-10 h-10 text-success" />
              </div>
              <h2 className="text-2xl font-bold text-success">You're On Duty</h2>
              {myAttendanceBlock && (
                <p className="text-muted-foreground">
                  Since {format(new Date(myAttendanceBlock.check_in_time), "h:mm a")}
                </p>
              )}
              {totalBreakMinutes > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total break time today: {totalBreakMinutes} min
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="w-full max-w-xs space-y-3">
              {/* Start Break button */}
              <Button
                size="lg"
                variant="outline"
                onClick={handleStartBreak}
                disabled={breakLoading}
                className="w-full h-14 text-base font-semibold rounded-2xl border-2 border-warning/50 text-warning hover:bg-warning/10"
              >
                {breakLoading ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Coffee className="w-5 h-5 mr-2" />
                )}
                Start Break
              </Button>

              {/* Checkout button - ALWAYS enabled and clickable */}
              <Button
                size="lg"
                variant={checkoutEligibility.canCheckout ? "default" : "outline"}
                onClick={handleCheckOutStart}
                className={cn(
                  "w-full h-14 text-base font-semibold rounded-2xl shadow-lg",
                  checkoutEligibility.canCheckout 
                    ? "bg-primary hover:bg-primary/90" 
                    : "border-2 border-primary/30 text-primary hover:bg-primary/5"
                )}
              >
                <LogOut className="w-5 h-5 mr-2" />
                Check Out
              </Button>
            </div>

            {!checkoutEligibility.canCheckout && (
              <p className="text-sm text-warning text-center max-w-xs font-medium">
                ⚠️ Tap Check Out to see pending tasks
              </p>
            )}

            {/* Checkout Blocked Dialog */}
            <CheckoutBlockedDialog
              open={showBlockedDialog}
              onOpenChange={setShowBlockedDialog}
              session={session}
              onNavigateToTask={handleNavigateToTask}
              onEarlyExit={handleEarlyExitRequest}
              blockReason={checkoutEligibility.reason}
            />

            {/* Early Checkout Confirmation Dialog */}
            <EarlyCheckoutDialog
              open={showEarlyExitDialog}
              onOpenChange={setShowEarlyExitDialog}
              onConfirm={handleEarlyExitConfirm}
              loading={earlyExitLoading}
            />

            {/* Session info */}
            {session && (
              <div className="w-full max-w-xs space-y-2 pt-2">
                <p className="text-xs text-muted-foreground text-center uppercase tracking-wide">
                  Session Tasks
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className={cn(
                    "text-center py-2 rounded-lg",
                    session.stock_submitted ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                  )}>
                    Stock {session.stock_submitted ? "✓" : "○"}
                  </div>
                  <div className={cn(
                    "text-center py-2 rounded-lg",
                    session.sales_submitted ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                  )}>
                    Sales {session.sales_submitted ? "✓" : "○"}
                  </div>
                  <div className={cn(
                    "text-center py-2 rounded-lg",
                    session.photo_uploaded ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                  )}>
                    Photo {session.photo_uploaded ? "✓" : "○"}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Not checked in */}
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto border-4 border-muted-foreground/20">
                <Clock className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Ready to Start?</h2>
              <p className="text-muted-foreground">
                Tap below to check in and start your shift
              </p>
            </div>

            <Button
              size="lg"
              onClick={handleCheckInStart}
              className="w-full max-w-xs h-16 text-lg font-semibold rounded-2xl bg-primary hover:bg-primary/90 shadow-lg"
            >
              <LogIn className="w-6 h-6 mr-3" />
              Check In
            </Button>
          </>
        )}
      </div>
    );
  }

  // Camera capture screen
  if (flowState === 'capturing') {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col">
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          
          {/* Overlay guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-white/50 rounded-full" />
          </div>
        </div>

        <div className="p-6 bg-black/80 flex items-center justify-center gap-6 safe-area-pb">
          <Button
            variant="ghost"
            size="lg"
            onClick={cancelFlow}
            className="text-white hover:bg-white/10 h-14 px-6"
          >
            Cancel
          </Button>
          <button
            type="button"
            onClick={capturePhoto}
            className="h-16 w-16 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center active:scale-95 transition-transform"
          >
            <Camera className="w-8 h-8" />
          </button>
        </div>
      </div>
    );
  }

  // Preview screen
  if (flowState === 'preview') {
    const canConfirm = !!location && !locationLoading;
    
    return (
      <>
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          {/* Photo preview area */}
          <div className="flex-1 relative overflow-hidden min-h-0">
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Location badge */}
            <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-xl p-3 flex items-center gap-2">
              {locationLoading ? (
                <>
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-white text-sm">Getting location...</span>
                </>
              ) : location ? (
                <>
                  <MapPin className="w-4 h-4 text-success" />
                  <span className="text-white text-sm">
                    Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 text-destructive" />
                  <span className="text-white text-sm">Location unavailable - tap Retake</span>
                </>
              )}
            </div>
          </div>

          {/* Action buttons - fixed at bottom with safe area */}
          <div 
            className="shrink-0 p-4 bg-black flex items-center justify-center gap-4"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            <Button
              variant="outline"
              size="lg"
              onClick={handleRetake}
              className="flex-1 h-14 bg-white text-black border-white hover:bg-white/90 font-semibold text-base rounded-xl shadow-lg"
            >
              <Camera className="w-5 h-5 mr-2" />
              Retake
            </Button>
            <Button
              size="lg"
              onClick={handleConfirmPreview}
              disabled={!canConfirm}
              className={cn(
                "flex-1 h-14 text-white font-semibold text-base rounded-xl shadow-lg",
                canConfirm ? "bg-success hover:bg-success/90" : "bg-muted opacity-50"
              )}
            >
              {locationLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Wait...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Duty completion dialog - rendered OUTSIDE the fixed preview div for proper z-index stacking */}
        <AlertDialog open={showDutyDialog} onOpenChange={setShowDutyDialog}>
          <AlertDialogContent className="z-[80]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-center text-xl">
                Is your duty completed for today?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                This helps us track your shift status correctly
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-3 sm:flex-col">
              <Button
                onClick={() => handleDutyResponse(true)}
                className="w-full h-14 text-lg bg-success hover:bg-success/90 text-white"
              >
                <Check className="w-5 h-5 mr-2" />
                YES - Duty Complete
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDutyResponse(false)}
                className="w-full h-14 text-lg"
              >
                <X className="w-5 h-5 mr-2" />
                NO - I Will Return
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Processing state
  if (flowState === 'processing') {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-lg font-medium text-foreground">
          {isCheckingOut ? "Checking out..." : "Checking in..."}
        </p>
      </div>
    );
  }

  return null;
};

export default AttendanceModule;
