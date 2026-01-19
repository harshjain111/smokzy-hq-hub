import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClubSession } from "@/hooks/useClubSession";
import { Check, Circle, Clock, AlertTriangle, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ClosingModuleProps {
  session: ClubSession | null;
  venueId: string;
}

interface TaskInfo {
  id: string;
  label: string;
  completed: boolean;
  submitterName?: string;
  submittedAt?: string;
}

const ClosingModule = ({ session, venueId }: ClosingModuleProps) => {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTaskDetails = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }

    const taskList: TaskInfo[] = [];

    // Stock task
    if (session.stock_submitted && session.stock_submitted_by) {
      const { data: stockProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.stock_submitted_by)
        .single();

      taskList.push({
        id: 'stock',
        label: 'Stock submitted',
        completed: true,
        submitterName: stockProfile?.full_name || 'Unknown',
        submittedAt: session.stock_submitted_at 
          ? format(new Date(session.stock_submitted_at), "h:mm a")
          : undefined,
      });
    } else {
      taskList.push({
        id: 'stock',
        label: 'Stock submission',
        completed: false,
      });
    }

    // Sales task
    if (session.sales_submitted && session.sales_submitted_by) {
      const { data: salesProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.sales_submitted_by)
        .single();

      taskList.push({
        id: 'sales',
        label: 'Sales logged',
        completed: true,
        submitterName: salesProfile?.full_name || 'Unknown',
        submittedAt: session.sales_submitted_at 
          ? format(new Date(session.sales_submitted_at), "h:mm a")
          : undefined,
      });
    } else {
      taskList.push({
        id: 'sales',
        label: 'Sales submission',
        completed: false,
      });
    }

    // Photo task
    if (session.photo_uploaded && session.photo_uploaded_by) {
      const { data: photoProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.photo_uploaded_by)
        .single();

      taskList.push({
        id: 'photo',
        label: 'Counter photo uploaded',
        completed: true,
        submitterName: photoProfile?.full_name || 'Unknown',
        submittedAt: session.photo_uploaded_at 
          ? format(new Date(session.photo_uploaded_at), "h:mm a")
          : undefined,
      });
    } else {
      taskList.push({
        id: 'photo',
        label: 'Counter photo',
        completed: false,
      });
    }

    setTasks(taskList);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    fetchTaskDetails();
  }, [fetchTaskDetails]);

  const allComplete = tasks.every(t => t.completed);
  const isClosed = session?.status === 'closed';
  const isForceClosed = session?.status === 'force_closed';

  // No session state
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 space-y-6">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <Clock className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">No Active Session</h2>
          <p className="text-muted-foreground">
            Session will start when the first staff checks in
          </p>
        </div>
      </div>
    );
  }

  // Session closed successfully
  if (isClosed && allComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 space-y-6">
        <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center animate-pulse">
          <PartyPopper className="w-12 h-12 text-success" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-success">Perfect Closure Today!</h2>
          <p className="text-muted-foreground">
            All tasks completed. Session closed automatically.
          </p>
          {session.closed_at && (
            <p className="text-sm text-muted-foreground">
              Closed at {format(new Date(session.closed_at), "h:mm a")}
            </p>
          )}
        </div>

        {/* Completed tasks summary */}
        <div className="w-full max-w-sm space-y-2">
          {tasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-xl"
            >
              <Check className="w-5 h-5 text-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{task.label}</p>
                {task.submitterName && (
                  <p className="text-xs text-muted-foreground truncate">
                    {task.submitterName} • {task.submittedAt}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Force closed state
  if (isForceClosed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 space-y-6">
        <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-warning" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-warning">Session Auto-Closed</h2>
          <p className="text-muted-foreground max-w-xs">
            Session was automatically closed due to missing actions.
            {session.force_close_reason && ` Reason: ${session.force_close_reason}`}
          </p>
        </div>

        {/* Tasks summary */}
        <div className="w-full max-w-sm space-y-2">
          {tasks.map(task => (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border",
                task.completed 
                  ? "bg-success/5 border-success/20" 
                  : "bg-destructive/5 border-destructive/20"
              )}
            >
              {task.completed ? (
                <Check className="w-5 h-5 text-success shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-destructive shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-sm",
                  task.completed ? "text-foreground" : "text-destructive"
                )}>
                  {task.label}
                </p>
                {task.completed && task.submitterName && (
                  <p className="text-xs text-muted-foreground truncate">
                    {task.submitterName} • {task.submittedAt}
                  </p>
                )}
                {!task.completed && (
                  <p className="text-xs text-destructive/80">Missing</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Open session - show checklist
  const pendingCount = tasks.filter(t => !t.completed).length;

  return (
    <div className="flex flex-col min-h-[60vh] px-6 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className={cn(
          "w-16 h-16 rounded-full mx-auto flex items-center justify-center",
          allComplete ? "bg-success/10" : "bg-warning/10"
        )}>
          {allComplete ? (
            <Check className="w-8 h-8 text-success" />
          ) : (
            <Clock className="w-8 h-8 text-warning" />
          )}
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {allComplete ? "All Tasks Complete!" : "Session in Progress"}
        </h2>
        {!allComplete && (
          <p className="text-muted-foreground text-sm">
            {pendingCount} task{pendingCount > 1 ? 's' : ''} pending
          </p>
        )}
      </div>

      {/* Checklist */}
      <div className="w-full max-w-sm mx-auto space-y-3">
        {tasks.map(task => (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border transition-colors",
              task.completed 
                ? "bg-success/5 border-success/20" 
                : "bg-card border-border"
            )}
          >
            {task.completed ? (
              <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-medium",
                task.completed ? "text-foreground" : "text-muted-foreground"
              )}>
                {task.label}
              </p>
              {task.completed && task.submitterName && (
                <p className="text-xs text-muted-foreground truncate">
                  {task.submitterName} • {task.submittedAt}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Status message */}
      {allComplete ? (
        <div className="bg-success/5 border border-success/20 rounded-2xl p-4 text-center max-w-sm mx-auto">
          <p className="text-sm text-success font-medium">
            All tasks completed. Session will close automatically.
          </p>
        </div>
      ) : (
        <div className="bg-muted rounded-2xl p-4 text-center max-w-sm mx-auto">
          <p className="text-sm text-muted-foreground">
            Complete all tasks to close the session and enable checkout.
          </p>
        </div>
      )}
    </div>
  );
};

export default ClosingModule;
