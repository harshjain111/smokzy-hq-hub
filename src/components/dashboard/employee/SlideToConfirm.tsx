import { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideToConfirmProps {
  onConfirm: () => void;
  disabled?: boolean;
  loading?: boolean;
  text: string;
  icon: React.ReactNode;
  successText?: string;
}

const SlideToConfirm = ({
  onConfirm,
  disabled = false,
  loading = false,
  text,
  icon,
  successText = "Confirmed",
}: SlideToConfirmProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const maxPosition = containerRef.current
    ? containerRef.current.offsetWidth - (sliderRef.current?.offsetWidth || 0)
    : 0;

  useEffect(() => {
    if (isConfirmed) {
      const timer = setTimeout(() => {
        setIsConfirmed(false);
        setPosition(0);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isConfirmed]);

  const handleStart = (clientX: number) => {
    if (disabled || loading) return;
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || disabled || loading) return;

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const newPosition = Math.min(
      Math.max(0, clientX - containerRect.left - 32),
      maxPosition
    );
    setPosition(newPosition);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (position >= maxPosition * 0.85) {
      setPosition(maxPosition);
      setIsConfirmed(true);
      onConfirm();
    } else {
      setPosition(0);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleEnd);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleEnd);
      };
    }
  }, [isDragging, position, maxPosition]);

  const progressPercentage = maxPosition > 0 ? (position / maxPosition) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-14 rounded-full overflow-hidden select-none transition-opacity",
        disabled && "opacity-50 cursor-not-allowed",
        "bg-muted border-2 border-border"
      )}
    >
      <div
        className="absolute inset-0 bg-primary transition-all duration-300 ease-out"
        style={{
          width: `${progressPercentage}%`,
          opacity: 0.2,
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={cn(
            "text-sm font-medium transition-opacity duration-300",
            progressPercentage > 50 ? "opacity-0" : "opacity-100",
            disabled ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {isConfirmed ? successText : loading ? "Processing..." : text}
        </span>
      </div>

      <div
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
        className={cn(
          "absolute top-1 left-1 h-12 w-12 rounded-full transition-colors duration-200",
          "flex items-center justify-center cursor-grab active:cursor-grabbing",
          disabled
            ? "bg-muted-foreground/50"
            : isConfirmed
            ? "bg-success"
            : "bg-primary shadow-lg"
        )}
        style={{
          transform: `translateX(${position}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease-out",
        }}
      >
        {isConfirmed ? (
          <div className="text-white text-2xl">✓</div>
        ) : (
          <div className={cn("transition-colors", disabled ? "text-background" : "text-primary-foreground")}>
            {icon}
          </div>
        )}
      </div>

      {!disabled && !isConfirmed && (
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            opacity: Math.max(0, 1 - progressPercentage / 50),
          }}
        >
          <ChevronRight className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

export default SlideToConfirm;
