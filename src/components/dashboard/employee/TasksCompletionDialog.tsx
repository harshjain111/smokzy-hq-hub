import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { CheckCircle, XCircle, Package, TrendingUp, Camera } from "lucide-react";

interface TasksCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: {
    stockReported: boolean;
    salesReported: boolean;
    closingPhoto: boolean;
  };
}

const TasksCompletionDialog = ({ open, onOpenChange, tasks }: TasksCompletionDialogProps) => {
  const taskList = [
    { name: "Update Stock Inventory", completed: tasks.stockReported, icon: Package },
    { name: "Report Daily Sales", completed: tasks.salesReported, icon: TrendingUp },
    { name: "Upload Closing Photo", completed: tasks.closingPhoto, icon: Camera },
  ];

  const incompleteTasks = taskList.filter((task) => !task.completed);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Incomplete Tasks
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>Please complete the following tasks before checking out:</p>
            <div className="space-y-2">
              {incompleteTasks.map((task, index) => {
                const Icon = task.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-destructive/20"
                  >
                    <div className="p-2 rounded-full bg-destructive/10">
                      <Icon className="h-4 w-4 text-destructive" />
                    </div>
                    <span className="flex-1 text-foreground font-medium">{task.name}</span>
                    <XCircle className="h-5 w-5 text-destructive" />
                  </div>
                );
              })}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Got it</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default TasksCompletionDialog;
