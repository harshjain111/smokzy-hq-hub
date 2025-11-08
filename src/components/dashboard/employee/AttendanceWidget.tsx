import { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, MapPin, Clock, LogIn, LogOut } from "lucide-react";
import { format } from "date-fns";
import SlideToConfirm from "./SlideToConfirm";
import TasksCompletionDialog from "./TasksCompletionDialog";

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
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskStatus>({
    stockReported: false,
    salesReported: false,
    closingPhoto: false,
  });
  const [showTasksDialog, setShowTasksDialog] = useState(false);
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
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("check_in_time", today)
      .maybeSingle();

    setTodayAttendance(data);
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
        .maybeSingle(),
      supabase
        .from("closing_photos")
        .select("id")
        .eq("venue_id", venueId)
        .eq("photo_date", today)
        .maybeSingle(),
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
      salesReported: !!salesCheck.data,
      closingPhoto: !!closingCheck.data,
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
    return new Promise((resolve, reject) => {
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
        
        canvas.toBlob((blob) => {
          if (blob) {
            // Stop camera
            mediaStream.getTracks().forEach((track) => track.stop());
            setStream(null);
            resolve(blob);
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
      
      toast.info("Uploading photo...");
      const photoUrl = await uploadPhoto(photoBlob);

      const { error } = await supabase.from("attendance").insert({
        user_id: user.id,
        venue_id: venueId,
        check_in_selfie_url: photoUrl,
        check_in_lat: location.lat,
        check_in_lng: location.lng,
      });

      if (error) throw error;

      toast.success("Checked in successfully!");
      fetchTodayAttendance();
    } catch (error: any) {
      console.error("Check-in error:", error);
      toast.error(error.message || "Failed to check in");
      // Stop camera on error
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
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
      
      toast.info("Uploading photo...");
      const photoUrl = await uploadPhoto(photoBlob);

      const { error } = await supabase
        .from("attendance")
        .update({
          check_out_selfie_url: photoUrl,
          check_out_lat: location.lat,
          check_out_lng: location.lng,
          check_out_time: new Date().toISOString(),
        })
        .eq("id", todayAttendance.id);

      if (error) throw error;

      toast.success("Checked out successfully!");
      fetchTodayAttendance();
    } catch (error: any) {
      console.error("Check-out error:", error);
      toast.error(error.message || "Failed to check out");
      // Stop camera on error
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
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
            {todayAttendance?.check_out_time
              ? "You've completed your shift"
              : todayAttendance
              ? "You're currently on duty"
              : "Slide to check in"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayAttendance && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Check In:</span>
                <span className="font-medium">
                  {format(new Date(todayAttendance.check_in_time), "hh:mm a")}
                </span>
              </div>
              {todayAttendance.check_out_time && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Check Out:</span>
                  <span className="font-medium">
                    {format(new Date(todayAttendance.check_out_time), "hh:mm a")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Hidden video element for camera capture */}
          <video
            ref={videoRef}
            className="hidden"
            playsInline
            muted
          />

          {(!todayAttendance || !todayAttendance.check_out_time) && (
            <div className="space-y-4">
              {!todayAttendance ? (
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
          )}
        </CardContent>
      </Card>

      <TasksCompletionDialog
        open={showTasksDialog}
        onOpenChange={setShowTasksDialog}
        tasks={tasks}
      />
    </>
  );
};

export default AttendanceWidget;