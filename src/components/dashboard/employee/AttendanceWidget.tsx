import { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, MapPin, Clock, LogIn, LogOut } from "lucide-react";
import { format } from "date-fns";
import SlideToConfirm from "./SlideToConfirm";
import TasksCompletionDialog from "./TasksCompletionDialog";
import AttendancePreview from "./AttendancePreview";
import CheckoutAppreciationDialog from "./CheckoutAppreciationDialog";
import { compressImage } from "@/lib/imageCompression";

interface AttendanceWidgetProps {
  user: User;
  venueId: string;
}

interface TaskStatus {
  stockReported: boolean;
  salesReported: boolean;
  closingPhoto: boolean;
}

const AttendanceWidget = ({ user, venueId }: AttendanceWidgetProps) => {
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskStatus>({
    stockReported: false,
    salesReported: false,
    closingPhoto: false,
  });
  const [showTasksDialog, setShowTasksDialog] = useState(false);
  const [showAppreciationDialog, setShowAppreciationDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    photoBlob: Blob;
    photoUrl: string;
    location: { lat: number; lng: number };
    isCheckOut: boolean;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    fetchTodayAttendance();
    checkTaskStatus();

    // Set up realtime subscriptions to refresh task status
    const stockChannel = supabase
      .channel('stock-updates-attendance')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stock',
          filter: `venue_id=eq.${venueId}`
        },
        () => {
          console.log('Stock updated - refreshing attendance tasks');
          checkTaskStatus();
        }
      )
      .subscribe();

    const salesChannel = supabase
      .channel('sales-updates-attendance')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales_reports',
          filter: `venue_id=eq.${venueId}`
        },
        () => {
          console.log('Sales reported - refreshing attendance tasks');
          checkTaskStatus();
        }
      )
      .subscribe();

    const closingPhotoChannel = supabase
      .channel('closing-photo-updates-attendance')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'closing_photos',
          filter: `venue_id=eq.${venueId}`
        },
        () => {
          console.log('Closing photo uploaded - refreshing attendance tasks');
          checkTaskStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(stockChannel);
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(closingPhotoChannel);
    };
  }, [venueId]);

  const fetchTodayAttendance = async () => {
    // Fetch all attendance records from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("check_in_time", twentyFourHoursAgo)
      .order("check_in_time", { ascending: false });

    setAttendanceRecords(data || []);
    
    // Find the current active shift (checked in but not checked out)
    const activeShift = data?.find(record => !record.check_out_time);
    setCurrentShift(activeShift || null);
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
      stockReported = stockCheck.data.every((item) => {
        const itemUpdateDate = format(new Date(item.updated_at), "yyyy-MM-dd");
        return itemUpdateDate === todayDate && item.updated_at !== item.created_at;
      });
    }

    setTasks({
      stockReported,
      salesReported: !!(salesCheck.data && salesCheck.data.length > 0),
      closingPhoto: !!(closingCheck.data && closingCheck.data.length > 0),
    });
  };

  const startCamera = async (): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
          
          // Auto-capture after 2 seconds
          setTimeout(() => {
            capturePhoto(mediaStream)
              .then(resolve)
              .catch(reject);
          }, 2000);
        }
      } catch (error) {
        reject(error);
      }
    });
  };

  const capturePhoto = async (mediaStream: MediaStream): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        const video = videoRef.current;
        
        if (!video) {
          reject(new Error("Video element not found"));
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(video, 0, 0);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              // Convert blob to File for compression
              const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
              
              // Compress the image
              const compressedFile = await compressImage(file, {
                maxWidth: 1280,
                maxHeight: 1280,
                quality: 0.85
              });
              
              // Stop camera
              mediaStream.getTracks().forEach((track) => track.stop());
              setStream(null);
              
              resolve(compressedFile);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        }, "image/jpeg", 0.95);
      } catch (error) {
        reject(error);
      }
    });
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const uploadPhoto = async (blob: Blob) => {
    const fileName = `${user.id}/${Date.now()}.jpg`;
    
    const { data, error } = await supabase.storage
      .from("attendance-photos")
      .upload(fileName, blob, {
        contentType: "image/jpeg",
      });

    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from("attendance-photos")
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      toast.info("Starting camera...");
      const photoBlob = await startCamera();
      
      toast.info("Getting location...");
      const location = await getCurrentLocation();
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(photoBlob);
      
      // Show preview
      setPreviewData({
        photoBlob,
        photoUrl: previewUrl,
        location,
        isCheckOut: false,
      });
      setShowPreview(true);
      setLoading(false);
    } catch (error: any) {
      console.error("Check-in error:", error);
      toast.error(error.message || "Failed to check in");
      // Stop camera on error
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setLoading(false);
    }
  };

  const handleRetake = () => {
    // Clean up preview URL
    if (previewData?.photoUrl) {
      URL.revokeObjectURL(previewData.photoUrl);
    }
    setShowPreview(false);
    setPreviewData(null);
  };

  const handleSubmitCheckIn = async () => {
    if (!previewData) return;
    
    setLoading(true);
    try {
      toast.info("Uploading photo...");
      const photoUrl = await uploadPhoto(previewData.photoBlob);

      const { error } = await supabase.from("attendance").insert({
        user_id: user.id,
        venue_id: venueId,
        check_in_selfie_url: photoUrl,
        check_in_lat: previewData.location.lat,
        check_in_lng: previewData.location.lng,
      });

      if (error) throw error;

      toast.success("Checked in successfully!");
      
      // Clean up
      URL.revokeObjectURL(previewData.photoUrl);
      setShowPreview(false);
      setPreviewData(null);
      
      fetchTodayAttendance();
    } catch (error: any) {
      console.error("Check-in error:", error);
      toast.error(error.message || "Failed to check in");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    const allTasksComplete = tasks.stockReported && tasks.salesReported && tasks.closingPhoto;
    
    if (!allTasksComplete) {
      setShowTasksDialog(true);
      return;
    }

    setLoading(true);
    try {
      toast.info("Starting camera...");
      const photoBlob = await startCamera();
      
      toast.info("Getting location...");
      const location = await getCurrentLocation();
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(photoBlob);
      
      // Show preview
      setPreviewData({
        photoBlob,
        photoUrl: previewUrl,
        location,
        isCheckOut: true,
      });
      setShowPreview(true);
      setLoading(false);
    } catch (error: any) {
      console.error("Check-out error:", error);
      toast.error(error.message || "Failed to check out");
      // Stop camera on error
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setLoading(false);
    }
  };

  const handleSubmitCheckOut = async () => {
    if (!previewData || !currentShift) return;
    
    setLoading(true);
    try {
      toast.info("Uploading photo...");
      const photoUrl = await uploadPhoto(previewData.photoBlob);

      const { error } = await supabase
        .from("attendance")
        .update({
          check_out_selfie_url: photoUrl,
          check_out_lat: previewData.location.lat,
          check_out_lng: previewData.location.lng,
          check_out_time: new Date().toISOString(),
          tasks_completed: true,
        })
        .eq("id", currentShift.id);

      if (error) throw error;

      toast.success("Checked out successfully!");
      
      // Clean up
      URL.revokeObjectURL(previewData.photoUrl);
      setShowPreview(false);
      setPreviewData(null);
      setCurrentShift(null);
      
      // Refresh attendance data to update UI
      await fetchTodayAttendance();
      
      // Show appreciation dialog
      setShowAppreciationDialog(true);
    } catch (error: any) {
      console.error("Check-out error:", error);
      toast.error(error.message || "Failed to check out");
    } finally {
      setLoading(false);
    }
  };

  const allTasksComplete = tasks.stockReported && tasks.salesReported && tasks.closingPhoto;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance
          </CardTitle>
          <CardDescription>
            {currentShift
              ? "You're currently on duty"
              : attendanceRecords.length > 0
              ? "Ready for next shift"
              : "Slide to check in"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Active Shift */}
          {currentShift && (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-primary">Current Shift</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(currentShift.check_in_time), "MMM dd")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Check In:</span>
                <span className="font-medium">
                  {format(new Date(currentShift.check_in_time), "hh:mm a")}
                </span>
              </div>
            </div>
          )}

          {/* Recent Completed Shifts (last 24 hours) */}
          {attendanceRecords.filter(r => r.check_out_time).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Recent Shifts</h4>
              {attendanceRecords.filter(r => r.check_out_time).slice(0, 3).map((record) => (
                <div key={record.id} className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{format(new Date(record.check_in_time), "MMM dd, yyyy")}</span>
                    <span className="text-green-600 dark:text-green-400">✓ Completed</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>{format(new Date(record.check_in_time), "hh:mm a")}</span>
                    <span>→</span>
                    <span>{format(new Date(record.check_out_time), "hh:mm a")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hidden video element for camera capture */}
          <video
            ref={videoRef}
            className="hidden"
            playsInline
            muted
          />

          <div className="space-y-4">
            {!currentShift ? (
              <SlideToConfirm
                onConfirm={handleCheckIn}
                loading={loading}
                text="Slide to Check In"
                icon={<LogIn className="h-5 w-5" />}
                successText="Checked In!"
              />
            ) : (
              <>
                {!allTasksComplete && (
                  <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
                    <p className="text-sm text-warning text-center">
                      Complete all tasks to enable check-out
                    </p>
                  </div>
                )}
                <SlideToConfirm
                  onConfirm={handleCheckOut}
                  disabled={!allTasksComplete}
                  loading={loading}
                  text="Slide to Check Out"
                  icon={<LogOut className="h-5 w-5" />}
                  successText="Checked Out!"
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <TasksCompletionDialog
        open={showTasksDialog}
        onOpenChange={setShowTasksDialog}
        tasks={tasks}
      />

      <CheckoutAppreciationDialog
        open={showAppreciationDialog}
        onOpenChange={setShowAppreciationDialog}
      />

      {showPreview && previewData && (
        <AttendancePreview
          photoUrl={previewData.photoUrl}
          location={previewData.location}
          onRetake={handleRetake}
          onSubmit={previewData.isCheckOut ? handleSubmitCheckOut : handleSubmitCheckIn}
          loading={loading}
        />
      )}
    </>
  );
};

export default AttendanceWidget;