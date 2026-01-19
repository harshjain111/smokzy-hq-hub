import { useState, useRef, useEffect, useCallback } from "react";
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
  const [shouldShake, setShouldShake] = useState(false);
  const [maxPosition, setMaxPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Calculate max position on mount and window resize
  useEffect(() => {
    const calculateMaxPosition = () => {
      if (containerRef.current && sliderRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const sliderWidth = sliderRef.current.offsetWidth;
        const padding = 4; // Account for padding (left-1 = 0.25rem = 4px)
        const newMaxPosition = containerWidth - sliderWidth - padding * 2;
        setMaxPosition(newMaxPosition);
      }
    };

    // Calculate immediately
    calculateMaxPosition();
    
    // Also calculate after a short delay to ensure DOM is ready
    const timer = setTimeout(calculateMaxPosition, 100);
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateMaxPosition);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateMaxPosition);
    };
  }, []);

  useEffect(() => {
    if (isConfirmed) {
      const timer = setTimeout(() => {
        setIsConfirmed(false);
        setPosition(0);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isConfirmed]);

  useEffect(() => {
    if (shouldShake) {
      const timer = setTimeout(() => setShouldShake(false), 400);
      return () => clearTimeout(timer);
    }
  }, [shouldShake]);

  const handleStart = useCallback((clientX: number) => {
    if (disabled || loading) {
      setShouldShake(true);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      return;
    }
    setIsDragging(true);
  }, [disabled, loading]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || disabled || loading || isConfirmed) return;

    const container = containerRef.current;
    const slider = sliderRef.current;
    if (!container || !slider) return;

    const containerRect = container.getBoundingClientRect();
    const sliderWidth = slider.offsetWidth;
    const padding = 4;
    const currentMaxPosition = containerRect.width - sliderWidth - padding * 2;
    
    // Calculate position relative to container start
    let newPosition = clientX - containerRect.left - sliderWidth / 2;
    
    // Clamp between 0 and current max position
    newPosition = Math.max(0, Math.min(newPosition, currentMaxPosition));

    setMaxPosition(currentMaxPosition);
    setPosition(newPosition);
  }, [isDragging, disabled, loading, isConfirmed]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const container = containerRef.current;
    const slider = sliderRef.current;
    if (!container || !slider) return;

    const containerRect = container.getBoundingClientRect();
    const sliderWidth = slider.offsetWidth;
    const padding = 4;
    const currentMaxPosition = containerRect.width - sliderWidth - padding * 2;

    // Check if slider is at least 70% to the end (more forgiving for mobile)
    const threshold = currentMaxPosition * 0.7;
    
    if (position >= threshold) {
      setPosition(currentMaxPosition);
      setIsConfirmed(true);
      
      // Haptic feedback on success
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
      
      onConfirm();
    } else {
      // Animate back to start
      setPosition(0);
    }
  }, [isDragging, position, onConfirm]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();
    handleStart(e.touches[0].clientX);
  }, [handleStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleStart(e.clientX);
  }, [handleStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX);
  }, [handleMove]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleEnd);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleEnd]);

  const progressPercentage = maxPosition > 0 ? (position / maxPosition) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-14 rounded-full overflow-hidden select-none",
        disabled && "opacity-50 cursor-not-allowed",
        shouldShake && "animate-shake",
        "bg-muted border-2 border-border"
      )}
      style={{ touchAction: "none" }}
    >
      {/* Progress background */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 transition-all duration-150 ease-out"
        style={{
          width: `${progressPercentage}%`,
          opacity: 0.2,
        }}
      />

      {/* Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
        <span
          className={cn(
            "text-sm font-medium transition-all duration-200",
            progressPercentage > 50 ? "opacity-0 scale-95" : "opacity-100 scale-100",
            disabled ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {isConfirmed ? successText : loading ? "Processing..." : text}
        </span>
      </div>

      {/* Slider button */}
      <div
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
        className={cn(
          "absolute top-1 left-1 h-12 w-12 rounded-full",
          "flex items-center justify-center",
          "transition-shadow duration-200",
          disabled
            ? "bg-muted-foreground/50 cursor-not-allowed"
            : isConfirmed
            ? "bg-success cursor-default shadow-lg"
            : "bg-primary shadow-lg cursor-grab active:cursor-grabbing active:shadow-xl hover:shadow-xl"
        )}
        style={{
          transform: `translateX(${position}px)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: isDragging ? "transform" : "auto",
          touchAction: "none",
        }}
      >
        {isConfirmed ? (
          <div className="text-primary-foreground text-2xl font-bold">✓</div>
        ) : (
          <div className={cn("transition-colors", disabled ? "text-background" : "text-primary-foreground")}>
            {icon}
          </div>
        )}
      </div>

      {/* Arrow indicator */}
      {!disabled && !isConfirmed && (
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200"
          style={{
            opacity: Math.max(0, 1 - progressPercentage / 40),
            transform: `translateY(-50%) scale(${1 - progressPercentage / 100})`,
          }}
        >
          <ChevronRight className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

export default SlideToConfirm;
