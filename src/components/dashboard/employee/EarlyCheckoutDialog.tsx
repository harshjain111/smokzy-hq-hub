import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Info } from "lucide-react";

interface EarlyCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
}

const EarlyCheckoutDialog = ({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: EarlyCheckoutDialogProps) => {
  const handleConfirm = () => {
    // Pass "Early Exit (Declared)" as the reason for audit trail
    onConfirm("Early Exit (Declared) - Morning/Relief Duty");
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-sm mx-4 rounded-2xl">
        <AlertDialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-warning/15 flex items-center justify-center mb-4 border-4 border-warning/30">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>
          <AlertDialogTitle className="text-xl font-bold text-center">
            Confirm Early Checkout
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-muted-foreground">
            You are checking out without completing stock, sales, or closing duties.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-warning hover:bg-warning/90 text-warning-foreground font-semibold"
          >
            {loading ? "Processing..." : "Yes, Confirm Early Checkout"}
          </AlertDialogAction>
          <AlertDialogCancel 
            disabled={loading}
            className="w-full h-12 rounded-xl font-semibold mt-0"
          >
            No, Go Back
          </AlertDialogCancel>
        </AlertDialogFooter>

        {/* Psychological accountability disclaimer */}
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This action is logged and reviewed by management. If found misused, attendance may be corrected as per company policy.
            </p>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default EarlyCheckoutDialog;
