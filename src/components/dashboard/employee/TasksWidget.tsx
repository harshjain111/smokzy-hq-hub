import { useState, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Camera, Package, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useBusinessDate } from "@/hooks/useBusinessDate";

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
  const { businessDate, loading: dateLoading } = useBusinessDate(user.id, venueId);
  const [tasks, setTasks] = useState<TaskStatus>({
    stockReported: false,
    salesReported: false,
    closingPhoto: false,
  });
  const [loading, setLoading] = useState(true);

  const checkTaskStatus = useCallback(async () => {
    if (!businessDate) return;
    
    try {
      const [stockCheck, salesCheck, closingCheck] = await Promise.all([
        // Check if ALL stock items have been updated today (using business date)
        supabase
          .from("stock")
          .select("id, quantity, created_at, updated_at")
          .eq("venue_id", venueId),
        supabase
          .from("sales_reports")
          .select("id")
          .eq("venue_id", venueId)
          .eq("report_date", businessDate)
          .limit(1),
        supabase
          .from("closing_photos")
          .select("id")
          .eq("venue_id", venueId)
          .eq("photo_date", businessDate)
          .limit(1),
      ]);

      // Stock is only considered reported if ALL items have been updated for the business date
      let stockReported = false;
      if (stockCheck.data && stockCheck.data.length > 0) {
        stockReported = stockCheck.data.every(item => {
          const itemUpdateDate = format(new Date(item.updated_at), "yyyy-MM-dd");
          
          // Item must be updated on or after business date AND the update must be different from creation
          return itemUpdateDate === businessDate && item.updated_at !== item.created_at;
        });
      }

      setTasks({
        stockReported,
        salesReported: !!(salesCheck.data && salesCheck.data.length > 0),
        closingPhoto: !!(closingCheck.data && closingCheck.data.length > 0),
      });
    } finally {
      setLoading(false);
    }
  }, [venueId, businessDate]);

  useEffect(() => {
    if (!businessDate) return;
    
    setLoading(true);
    checkTaskStatus();
    
    // Set up realtime subscriptions for all task-related tables
    const stockChannel = supabase
      .channel(`stock-updates-tasks-${venueId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'stock',
          filter: `venue_id=eq.${venueId}`
        },
        () => {
          console.log('Stock changed - refreshing tasks');
          checkTaskStatus();
        }
      )
      .subscribe();

    const salesChannel = supabase
      .channel(`sales-updates-tasks-${venueId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'sales_reports',
          filter: `venue_id=eq.${venueId}`
        },
        () => {
          console.log('Sales changed - refreshing tasks');
          checkTaskStatus();
        }
      )
      .subscribe();

    const closingPhotoChannel = supabase
      .channel(`closing-photo-updates-tasks-${venueId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'closing_photos',
          filter: `venue_id=eq.${venueId}`
        },
        () => {
          console.log('Closing photo changed - refreshing tasks');
          checkTaskStatus();
        }
      )
      .subscribe();

    // Local cross-component event to refresh instantly after actions
    const onTaskEvent = (e: any) => {
      try {
        if (e?.detail?.venueId === venueId) {
          console.log('Tasks event received - refreshing tasks', e.detail);
          // Small delay to ensure database write is complete
          setTimeout(() => checkTaskStatus(), 300);
        }
      } catch (_) {}
    };
    window.addEventListener('tasks:updated', onTaskEvent);

    return () => {
      supabase.removeChannel(stockChannel);
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(closingPhotoChannel);
      window.removeEventListener('tasks:updated', onTaskEvent);
    };
  }, [venueId, businessDate, checkTaskStatus]);

  const taskList = [
    { name: "Update Stock Inventory", completed: tasks.stockReported, icon: Package },
    { name: "Report Daily Sales", completed: tasks.salesReported, icon: TrendingUp },
    { name: "Upload Closing Photo", completed: tasks.closingPhoto, icon: Camera },
  ];

  const completedCount = Object.values(tasks).filter(Boolean).length;
  const totalTasks = Object.keys(tasks).length;

  // Show loading state while business date is being fetched
  if (dateLoading || loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
