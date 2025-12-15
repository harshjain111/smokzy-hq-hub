import { useState, useEffect } from "react";
import { Timer } from "lucide-react";

interface ShiftDurationProps {
  checkInTime: string;
}

const ShiftDuration = ({ checkInTime }: ShiftDurationProps) => {
  const [duration, setDuration] = useState("");

  useEffect(() => {
    const calculateDuration = () => {
      const checkIn = new Date(checkInTime);
      const now = new Date();
      const diffMs = now.getTime() - checkIn.getTime();
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        setDuration(`${hours}h ${minutes}m`);
      } else {
        setDuration(`${minutes}m`);
      }
    };

    // Calculate immediately
    calculateDuration();

    // Update every minute
    const interval = setInterval(calculateDuration, 60000);

    return () => clearInterval(interval);
  }, [checkInTime]);

  return (
    <div className="flex items-center gap-2 text-sm font-medium text-primary">
      <Timer className="h-4 w-4 animate-pulse" />
      <span>On duty: {duration}</span>
    </div>
  );
};

export default ShiftDuration;
