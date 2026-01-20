import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Clock, Smile, Coffee, Menu, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeDialogProps {
  userName: string;
  role: string;
}

const WelcomeDialog = ({ userName, role }: WelcomeDialogProps) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (role === "employee") {
      const lastShown = localStorage.getItem("lastWelcomeShown");
      const today = new Date().toDateString();
      
      if (lastShown !== today) {
        setOpen(true);
        localStorage.setItem("lastWelcomeShown", today);
      }
    }
  }, [role]);

  const briefingPoints = [
    {
      icon: Smile,
      title: "Be Polite & Respectful",
      description: "Always talk politely to customers, colleagues and venue partners"
    },
    {
      icon: Clock,
      title: "Punctuality Matters",
      description: "Always be on time for your shift"
    },
    {
      icon: Sparkles,
      title: "Warm Greetings",
      description: "Greet every customer warmly while taking their order"
    },
    {
      icon: Coffee,
      title: "Hookah Service",
      description: "Regularly check hookah and service it every 20 minutes"
    },
    {
      icon: Menu,
      title: "Show the Menu",
      description: "Present the menu to every customer who visits the venue"
    },
    {
      icon: Star,
      title: "Suggest Premium",
      description: "Recommend premium pots and flavours to enhance customer experience"
    }
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Welcome Back, {userName}! 🎉
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Here's your daily briefing to make today amazing!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {briefingPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={index}
                className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">{point.title}</h4>
                  <p className="text-sm text-muted-foreground">{point.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <Button onClick={() => setOpen(false)} className="px-8">
            Let's Get Started!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeDialog;
