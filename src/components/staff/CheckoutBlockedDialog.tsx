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
import { Button } from "@/components/ui/button";
import { Package, TrendingUp, Camera, AlertTriangle, LogOut } from "lucide-react";
import { ClubSession } from "@/hooks/useClubSession";
import { cn } from "@/lib/utils";

interface CheckoutBlockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ClubSession | null;
  onNavigateToTask: (task: 'stock' | 'sales' | 'photo') => void;
  onEarlyExit?: () => void;
  blockReason?: string;
}

interface PendingTask {
  id: 'stock' | 'sales' | 'photo';
  label: string;
  icon: React.ElementType;
}

const CheckoutBlockedDialog = ({
  open,
  onOpenChange,
  session,
  onNavigateToTask,
  onEarlyExit,
  blockReason,
}: CheckoutBlockedDialogProps) => {
  // Determine pending tasks
  const pendingTasks: PendingTask[] = [];
  
  if (session) {
    if (!session.stock_submitted) {
      pendingTasks.push({ id: 'stock', label: 'Stock not submitted', icon: Package });
    }
    if (!session.sales_submitted) {
      pendingTasks.push({ id: 'sales', label: 'Sales not submitted', icon: TrendingUp });
    }
    if (!session.photo_uploaded) {
      pendingTasks.push({ id: 'photo', label: 'Counter photo missing', icon: Camera });
    }
  }

  const firstPendingTask = pendingTasks[0];
  const isOnBreak = blockReason === "Resume duty before checkout";
  const hasPendingTasks = pendingTasks.length > 0 && !isOnBreak;

  const handleGoToTasks = () => {
    if (firstPendingTask) {
      onNavigateToTask(firstPendingTask.id);
    }
    onOpenChange(false);
  };

  const handleEarlyExit = () => {
    onOpenChange(false);
    onEarlyExit?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-warning/15 flex items-center justify-center mb-4 border-4 border-warning/30">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>
          <AlertDialogTitle className="text-xl font-bold text-center">
            Checkout not allowed yet
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-muted-foreground">
            {isOnBreak ? (
              "Please resume your duty before checking out."
            ) : (
              "Please complete the following before checkout:"
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Pending tasks list */}
        {hasPendingTasks && (
          <div className="space-y-2 my-4">
            {pendingTasks.map((task) => {
              const Icon = task.icon;
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl",
                    "bg-destructive/10 border border-destructive/20"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-destructive" />
                  </div>
                  <span className="font-medium text-foreground">{task.label}</span>
                </div>
              );
            })}
          </div>
        )}

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          {/* Primary action - Go to Pending Tasks */}
          {hasPendingTasks && (
            <AlertDialogAction
              onClick={handleGoToTasks}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold"
            >
              Go to Pending Tasks
            </AlertDialogAction>
          )}

          {/* Early Exit option - always visible when tasks are pending */}
          {hasPendingTasks && onEarlyExit && (
            <Button
              variant="outline"
              onClick={handleEarlyExit}
              className="w-full h-12 rounded-xl font-semibold border-2 border-warning/50 text-warning hover:bg-warning/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Early Exit (Morning / Relief Duty)
            </Button>
          )}

          {/* Cancel button */}
          <AlertDialogCancel className="w-full h-12 rounded-xl font-semibold mt-0">
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CheckoutBlockedDialog;
