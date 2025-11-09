import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Moon, Sparkles } from "lucide-react";

interface CheckoutAppreciationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CheckoutAppreciationDialog = ({ open, onOpenChange }: CheckoutAppreciationDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-auth-gold/30 to-auth-accent/20 blur-xl rounded-full"></div>
              <Heart className="h-16 w-16 text-auth-gold relative z-10 fill-current" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl font-bold bg-gradient-to-r from-auth-gold to-auth-accent bg-clip-text text-transparent">
            Thank You!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center py-4">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-auth-gold animate-pulse" />
            <p className="text-lg font-semibold text-foreground">
              You did a great job today!
            </p>
            <Sparkles className="h-5 w-5 text-auth-gold animate-pulse" />
          </div>
          
          <p className="text-muted-foreground">
            Your dedication and hard work are truly appreciated. Thank you for making today special for our customers and being an amazing team member.
          </p>

          <div className="flex items-center justify-center gap-2 pt-2">
            <Moon className="h-5 w-5 text-auth-accent" />
            <p className="text-base font-medium text-foreground">
              Good night and rest well!
            </p>
          </div>

          <p className="text-sm text-muted-foreground italic">
            See you tomorrow for another wonderful day! ✨
          </p>
        </div>
        
        <Button
          onClick={() => onOpenChange(false)}
          className="w-full bg-gradient-to-r from-auth-gold to-auth-accent hover:opacity-90 transition-opacity"
        >
          Thank You!
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutAppreciationDialog;
