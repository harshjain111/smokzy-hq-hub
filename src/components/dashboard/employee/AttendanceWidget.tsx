import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Camera, MapPin, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface AttendanceWidgetProps {
  user: User;
  venueId: string;
}

const AttendanceWidget = ({ user, venueId }: AttendanceWidgetProps) => {
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

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

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
        (error) => reject(error)
      );
    });
  };

  const uploadPhoto = async (file: File, folder: string) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from("attendance-photos")
      .upload(fileName, file);

    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from("attendance-photos")
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleCheckIn = async () => {
    if (!photoFile) {
      toast.error("Please capture a selfie first");
      return;
    }

    setLoading(true);
    try {
      const location = await getCurrentLocation();
      const photoUrl = await uploadPhoto(photoFile, "check-in");

      const { error } = await supabase.from("attendance").insert({
        user_id: user.id,
        venue_id: venueId,
        check_in_selfie_url: photoUrl,
        check_in_lat: location.lat,
        check_in_lng: location.lng,
      });

      if (error) throw error;

      toast.success("Checked in successfully!");
      setPhotoFile(null);
      fetchTodayAttendance();
    } catch (error: any) {
      toast.error(error.message || "Failed to check in");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!photoFile) {
      toast.error("Please capture a selfie first");
      return;
    }

    if (!todayAttendance?.tasks_completed) {
      toast.error("Please complete all daily tasks before checking out");
      return;
    }

    setLoading(true);
    try {
      const location = await getCurrentLocation();
      const photoUrl = await uploadPhoto(photoFile, "check-out");

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
      setPhotoFile(null);
      fetchTodayAttendance();
    } catch (error: any) {
      toast.error(error.message || "Failed to check out");
    } finally {
      setLoading(false);
    }
  };

  return (
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
            : "Mark your attendance"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {todayAttendance && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Check In:</span>
              <span className="font-medium">{format(new Date(todayAttendance.check_in_time), "hh:mm a")}</span>
            </div>
            {todayAttendance.check_out_time && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Check Out:</span>
                <span className="font-medium">{format(new Date(todayAttendance.check_out_time), "hh:mm a")}</span>
              </div>
            )}
          </div>
        )}

        {(!todayAttendance || !todayAttendance.check_out_time) && (
          <>
            <div className="space-y-2">
              <Label htmlFor="photo">Selfie *</Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              />
              {photoFile && (
                <p className="text-sm text-success flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Photo ready
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {!todayAttendance ? (
                <Button onClick={handleCheckIn} disabled={loading} className="w-full">
                  <Camera className="mr-2 h-4 w-4" />
                  {loading ? "Checking In..." : "Check In"}
                </Button>
              ) : (
                <Button onClick={handleCheckOut} disabled={loading} className="w-full">
                  <MapPin className="mr-2 h-4 w-4" />
                  {loading ? "Checking Out..." : "Check Out"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceWidget;