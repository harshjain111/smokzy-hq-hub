import { useState, useEffect } from "react";
import { MapPin, Map as MapIcon } from "lucide-react";
import { reverseGeocode } from "@/lib/geocoding";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationDisplayProps {
  lat: number;
  lng: number;
  label?: string;
}

const LocationDisplay = ({ lat, lng, label }: LocationDisplayProps) => {
  const [address, setAddress] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    reverseGeocode(lat, lng).then((addr) => {
      if (addr) setAddress(addr);
    });
  }, [lat, lng]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1 text-[10px] md:text-xs text-muted-foreground">
        <MapPin className="h-2.5 w-2.5 md:h-3 md:w-3 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          {address ? (
            <span className="block leading-tight">{address}</span>
          ) : (
            <span className="truncate">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
          )}
        </div>
      </div>
      <button
        onClick={() => setShowMap(!showMap)}
        className="flex items-center gap-1 text-[10px] text-primary hover:underline"
      >
        <MapIcon className="h-2.5 w-2.5" />
        {showMap ? "Hide map" : "Show map"}
      </button>
      {showMap && (
        <div className="w-full h-32 rounded-md overflow-hidden border">
          <MapContainer
            center={[lat, lng]}
            zoom={15}
            scrollWheelZoom={false}
            dragging={false}
            style={{ height: "100%", width: "100%" }}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[lat, lng]} icon={markerIcon}>
              {label && <Popup>{label}</Popup>}
            </Marker>
          </MapContainer>
        </div>
      )}
    </div>
  );
};

export default LocationDisplay;
