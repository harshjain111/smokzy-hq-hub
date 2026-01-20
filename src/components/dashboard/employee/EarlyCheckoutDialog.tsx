import { useState } from "react";
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
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Confirm Early Checkout
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground/80">
            You are requesting to check out without completing stock, sales, or closing duties.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="w-full bg-warning hover:bg-warning/90 text-warning-foreground"
          >
            {loading ? "Processing..." : "Yes, Confirm Early Checkout"}
          </AlertDialogAction>
          <AlertDialogCancel 
            disabled={loading}
            className="w-full mt-0"
          >
            No, Go Back
          </AlertDialogCancel>
        </AlertDialogFooter>

        {/* Psychological accountability disclaimer */}
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              This action is logged and reviewed by management. If found misused, it may result in attendance correction as per company policy.
            </p>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default EarlyCheckoutDialog;
