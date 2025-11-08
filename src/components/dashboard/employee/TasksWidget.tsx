import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Camera, Package, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface TasksWidgetProps {
  user: User;
  venueId: string;
}

interface TaskStatus {
  stockReported: boolean;
  salesReported: boolean;
  closingPhoto: boolean;
}

const TasksWidget = ({ user, venueId }: TasksWidgetProps) => {
  const [tasks, setTasks] = useState<TaskStatus>({
    stockReported: false,
    salesReported: false,
    closingPhoto: false,
  });

  useEffect(() => {
    checkTaskStatus();
    
    // Set up realtime subscriptions for all task-related tables
    const stockChannel = supabase
      .channel('stock-updates-tasks')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stock',
          filter: `venue_id=eq.${venueId}`
        },
        () => {
          console.log('Stock updated - refreshing tasks');
          checkTaskStatus();
        }
      )
      .subscribe();

    const salesChannel = supabase
      .channel('sales-updates-tasks')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales_reports',
          filter: `venue_id=eq.${venueId}`
        },
        () => {
          console.log('Sales reported - refreshing tasks');
          checkTaskStatus();
        }
      )
      .subscribe();

    const closingPhotoChannel = supabase
      .channel('closing-photo-updates-tasks')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'closing_photos',
          filter: `venue_id=eq.${venueId}`
        },
        () => {
          console.log('Closing photo uploaded - refreshing tasks');
          checkTaskStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(stockChannel);
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(closingPhotoChannel);
    };
  }, [venueId]);

  const checkTaskStatus = async () => {
    const today = format(new Date(), "yyyy-MM-dd");

    const [stockCheck, salesCheck, closingCheck] = await Promise.all([
      // Check if ALL stock items have been updated today
      supabase
        .from("stock")
        .select("id, quantity, created_at, updated_at")
        .eq("venue_id", venueId),
      supabase
        .from("sales_reports")
        .select("id")
        .eq("venue_id", venueId)
        .eq("report_date", today)
        .maybeSingle(),
      supabase
        .from("closing_photos")
        .select("id")
        .eq("venue_id", venueId)
        .eq("photo_date", today)
        .maybeSingle(),
    ]);

    // Stock is only considered reported if ALL items have been updated today
    let stockReported = false;
    if (stockCheck.data && stockCheck.data.length > 0) {
      const todayDate = format(new Date(), "yyyy-MM-dd");
      
      stockReported = stockCheck.data.every(item => {
        const itemUpdateDate = format(new Date(item.updated_at), "yyyy-MM-dd");
        const itemCreateDate = format(new Date(item.created_at), "yyyy-MM-dd");
        
        // Item must be updated today AND the update must be different from creation
        // (meaning it was actually updated, not just created today)
        return itemUpdateDate === todayDate && item.updated_at !== item.created_at;
      });
    }

    setTasks({
      stockReported,
      salesReported: !!salesCheck.data,
      closingPhoto: !!closingCheck.data,
    });
  };

  const taskList = [
    { name: "Update Stock Inventory", completed: tasks.stockReported, icon: Package },
    { name: "Report Daily Sales", completed: tasks.salesReported, icon: TrendingUp },
    { name: "Upload Closing Photo", completed: tasks.closingPhoto, icon: Camera },
  ];

  const completedCount = Object.values(tasks).filter(Boolean).length;
  const totalTasks = Object.keys(tasks).length;

  return (
    <div className="space-y-3">
      {/* Compact Progress Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{completedCount}/{totalTasks} Complete</span>
            <span className="text-xl font-bold text-primary">{Math.round((completedCount / totalTasks) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
              style={{ width: `${(completedCount / totalTasks) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Compact Task Grid */}
      <div className="grid grid-cols-3 gap-2">
        {taskList.map((task, index) => {
          const Icon = task.icon;
          return (
            <div
              key={index}
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
                task.completed 
                  ? "bg-success/10 border-success/20" 
                  : "bg-muted/50 border-border"
              }`}
            >
              <div className={`p-2 rounded-full ${task.completed ? "bg-success/20" : "bg-background"}`}>
                <Icon className={`h-4 w-4 ${task.completed ? "text-success" : "text-muted-foreground"}`} />
              </div>
              <span className={`text-xs text-center font-medium ${task.completed ? "text-foreground" : "text-muted-foreground"}`}>
                {task.name.replace("Report Daily ", "").replace("Update ", "").replace("Upload ", "")}
              </span>
              {task.completed && (
                <CheckCircle className="absolute -top-1 -right-1 h-4 w-4 text-success bg-background rounded-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* Compact Warning */}
      {completedCount < totalTasks && (
        <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 rounded-lg border border-warning/20">
          <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
          <p className="text-xs text-warning">Complete all tasks to check-out</p>
        </div>
      )}
    </div>
  );
};

export default TasksWidget;