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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

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
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (reason.trim().length < 10) {
      return;
    }
    onConfirm(reason.trim());
    setReason("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason("");
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            Early Checkout
          </AlertDialogTitle>
          <AlertDialogDescription>
            You are checking out without completing all tasks. This will be reported to admin immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3 py-2">
          <Label htmlFor="reason" className="text-sm font-medium">
            Reason for early checkout <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="reason"
            placeholder="Please explain why you need to leave early (minimum 10 characters)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[100px] resize-none"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            {reason.length}/10 minimum characters
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={reason.trim().length < 10 || loading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {loading ? "Processing..." : "Confirm Early Checkout"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default EarlyCheckoutDialog;
