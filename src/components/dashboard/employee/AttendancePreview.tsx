import { MapPin, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AttendancePreviewProps {
  photoUrl: string;
  location: { lat: number; lng: number };
  onRetake: () => void;
  onSubmit: () => void;
  loading: boolean;
}

const AttendancePreview = ({
  photoUrl,
  location,
  onRetake,
  onSubmit,
  loading,
}: AttendancePreviewProps) => {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-center">Review Your Photo</h3>
          
          {/* Photo Preview */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Your Photo</p>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border">
              <img
                src={photoUrl}
                alt="Attendance selfie"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Location Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Location Captured</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg border border-border">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Latitude</p>
                  <p className="font-mono font-medium">{location.lat.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Longitude</p>
                  <p className="font-mono font-medium">{location.lng.toFixed(6)}</p>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline mt-2 inline-block"
              >
                View on Google Maps →
              </a>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onRetake}
              disabled={loading}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retake
            </Button>
            <Button
              className="flex-1"
              onClick={onSubmit}
              disabled={loading}
            >
              <Check className="h-4 w-4 mr-2" />
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendancePreview;
