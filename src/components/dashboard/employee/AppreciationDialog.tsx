import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { CheckCircle, Trophy, Star, XCircle, Package, TrendingUp, Camera } from "lucide-react";

interface TaskStatus {
  stockReported: boolean;
  salesReported: boolean;
  closingPhoto: boolean;
}

interface AppreciationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskType: "stock" | "sales" | "photo";
  taskStatus?: TaskStatus;
}

const AppreciationDialog = ({ open, onOpenChange, taskType, taskStatus }: AppreciationDialogProps) => {
  const messages = {
    stock: {
      title: "Excellent Work!",
      description: "You've successfully updated all stock items. Your dedication keeps operations running smoothly!",
      icon: Trophy,
    },
    sales: {
      title: "Great Job!",
      description: "Sales report submitted successfully. Your attention to detail is appreciated!",
      icon: Star,
    },
    photo: {
      title: "Well Done!",
      description: "Closing photo uploaded successfully. Thank you for maintaining quality standards!",
      icon: CheckCircle,
    },
  };

  const { title, description, icon: Icon } = messages[taskType];

  const remainingTasks = taskStatus ? [
    { name: "Update Stock Inventory", completed: taskStatus.stockReported, icon: Package },
    { name: "Report Daily Sales", completed: taskStatus.salesReported, icon: TrendingUp },
    { name: "Upload Closing Photo", completed: taskStatus.closingPhoto, icon: Camera },
  ].filter(task => !task.completed) : [];

  const allTasksComplete = taskStatus ? 
    taskStatus.stockReported && taskStatus.salesReported && taskStatus.closingPhoto : false;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div className="mb-4 p-4 rounded-full bg-success/10 w-fit">
            <Icon className="h-12 w-12 text-success" />
          </div>
          <AlertDialogTitle className="text-2xl">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {taskStatus && !allTasksComplete && (
          <div className="space-y-3 px-6 pb-4">
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3 text-center">What's Next?</h4>
              <div className="space-y-2">
                {remainingTasks.map((task, index) => {
                  const TaskIcon = task.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <TaskIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm flex-1">{task.name}</span>
                      <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Complete all tasks to enable check-out
              </p>
            </div>
          </div>
        )}

        {taskStatus && allTasksComplete && (
          <div className="px-6 pb-4">
            <div className="border-t pt-4">
              <div className="flex items-center justify-center gap-2 p-3 bg-success/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-success" />
                <p className="text-sm font-medium text-success">All tasks completed! You can check-out now.</p>
              </div>
            </div>
          </div>
        )}

        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction className="px-8">Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AppreciationDialog;
