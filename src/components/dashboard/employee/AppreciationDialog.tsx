import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { CheckCircle, Trophy, Star } from "lucide-react";

interface AppreciationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskType: "stock" | "sales" | "photo";
}

const AppreciationDialog = ({ open, onOpenChange, taskType }: AppreciationDialogProps) => {
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

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="items-center text-center">
          <div className="mb-4 p-4 rounded-full bg-success/10 w-fit">
            <Icon className="h-12 w-12 text-success" />
          </div>
          <AlertDialogTitle className="text-2xl">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction className="px-8">Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AppreciationDialog;
