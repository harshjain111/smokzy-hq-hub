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
    
    // Set up realtime subscription to refresh when stock is updated
    const channel = supabase
      .channel('stock-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stock',
          filter: `venue_id=eq.${venueId}`
        },
        () => {
          checkTaskStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {completedCount} of {totalTasks} tasks completed
        </p>
        <div className="text-right">
          <div className="text-2xl font-bold">{Math.round((completedCount / totalTasks) * 100)}%</div>
          <p className="text-xs text-muted-foreground">Progress</p>
        </div>
      </div>

      <div className="space-y-2">
        {taskList.map((task, index) => {
          const Icon = task.icon;
          return (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                task.completed ? "bg-success/10" : "bg-muted"
              }`}
            >
              <div className={`p-2 rounded-full ${task.completed ? "bg-success/20" : "bg-background"}`}>
                <Icon className={`h-4 w-4 ${task.completed ? "text-success" : "text-muted-foreground"}`} />
              </div>
              <span className={`flex-1 ${task.completed ? "text-foreground" : "text-muted-foreground"}`}>
                {task.name}
              </span>
              {task.completed ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      {completedCount < totalTasks && (
        <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
          <p className="text-sm text-warning">
            Complete all tasks to enable check-out
          </p>
        </div>
      )}
    </div>
  );
};

export default TasksWidget;