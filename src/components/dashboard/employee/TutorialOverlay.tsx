import { useState, useEffect } from "react";
import { X, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";

const TutorialOverlay = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if user has seen the tutorial
    const hasSeenTutorial = localStorage.getItem("hasSeenSliderTutorial");
    if (!hasSeenTutorial) {
      // Show tutorial after a short delay
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("hasSeenSliderTutorial", "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-10 w-10"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="max-w-md space-y-6 animate-scale-in">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <Hand className="h-16 w-16 text-primary relative z-10" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Welcome to Smokzy!
            </h2>
            <p className="text-base md:text-lg text-muted-foreground">
              To check-in or check-out, simply slide the button to the right
            </p>
          </div>

          <div className="bg-muted/50 rounded-2xl p-6 border border-border space-y-4">
            <div className="relative h-14 rounded-full bg-muted border-2 border-border overflow-hidden">
              {/* Animated slider demonstration */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-sm font-medium text-muted-foreground">
                  Slide to Check-In
                </span>
              </div>
              
              <div 
                className="absolute top-1 left-1 h-12 w-12 rounded-full bg-primary shadow-lg flex items-center justify-center animate-[slide-in-right_2s_ease-in-out_infinite]"
              >
                <Hand className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>Try it when you're ready</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>

          <Button
            onClick={handleDismiss}
            className="w-full h-12 text-base font-medium"
          >
            Got it, thanks!
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
