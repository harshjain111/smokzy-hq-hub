import { MapPin, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

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
          <h3 className="text-lg font-semibold text-center">Review Your Check-in</h3>
          
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

          {/* Location Map */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Your Location</p>
            </div>
            <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
              <MapContainer
                key={`${location.lat}-${location.lng}`}
                center={[location.lat, location.lng]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[location.lat, location.lng]}>
                  <Popup>Your check-in location</Popup>
                </Marker>
              </MapContainer>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
            </p>
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
