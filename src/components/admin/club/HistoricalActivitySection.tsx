import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  LogIn, LogOut, Coffee, Package, ShoppingCart, Image, 
  AlertTriangle, Search 
} from "lucide-react";

interface HistoricalSession {
  id: string;
  session_date: string;
  started_at: string;
  closed_at: string | null;
  stock_submitted_at: string | null;
  sales_submitted_at: string | null;
  photo_uploaded_at: string | null;
  force_close_reason: string | null;
}

interface HistoricalActivitySectionProps {
  session: HistoricalSession;
  clubId: string;
}

interface ActivityItem {
  id: string;
  type: "check_in" | "check_out" | "break_start" | "break_end" | "stock" | "sales" | "photo" | "session_start" | "session_close" | "force_close";
  timestamp: string;
  actor_name: string;
  description: string;
}

export const HistoricalActivitySection = ({ session, clubId }: HistoricalActivitySectionProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchActivityData();
  }, [session.id]);

  const fetchActivityData = async () => {
    setLoading(true);
    try {
      const activityList: ActivityItem[] = [];

      // Add session start
      activityList.push({
        id: `session-start-${session.id}`,
        type: "session_start",
        timestamp: session.started_at,
        actor_name: "System",
        description: "Session started",
      });

      // Fetch attendance blocks
      const { data: attendanceData } = await supabase
        .from("staff_attendance_blocks")
        .select("id, user_id, check_in_time, check_out_time")
        .eq("session_id", session.id);

      // Fetch breaks
      const { data: breaksData } = await supabase
        .from("staff_breaks")
        .select("id, user_id, break_start_time, break_end_time")
        .eq("session_id", session.id);

      // Get unique user IDs
      const userIds = new Set<string>();
      attendanceData?.forEach(a => userIds.add(a.user_id));
      breaksData?.forEach(b => userIds.add(b.user_id));

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(userIds));

      const getProfileName = (userId: string) => 
        profilesData?.find(p => p.id === userId)?.full_name || "Unknown";

      // Add check-ins and check-outs
      attendanceData?.forEach(a => {
        activityList.push({
          id: `checkin-${a.id}`,
          type: "check_in",
          timestamp: a.check_in_time,
          actor_name: getProfileName(a.user_id),
          description: "Checked in",
        });
        if (a.check_out_time) {
          activityList.push({
            id: `checkout-${a.id}`,
            type: "check_out",
            timestamp: a.check_out_time,
            actor_name: getProfileName(a.user_id),
            description: "Checked out",
          });
        }
      });

      // Add breaks
      breaksData?.forEach(b => {
        activityList.push({
          id: `break-start-${b.id}`,
          type: "break_start",
          timestamp: b.break_start_time,
          actor_name: getProfileName(b.user_id),
          description: "Started break",
        });
        if (b.break_end_time) {
          activityList.push({
            id: `break-end-${b.id}`,
            type: "break_end",
            timestamp: b.break_end_time,
            actor_name: getProfileName(b.user_id),
            description: "Ended break",
          });
        }
      });

      // Add task completions
      if (session.stock_submitted_at) {
        activityList.push({
          id: `stock-${session.id}`,
          type: "stock",
          timestamp: session.stock_submitted_at,
          actor_name: "Staff",
          description: "Stock submitted",
        });
      }
      if (session.sales_submitted_at) {
        activityList.push({
          id: `sales-${session.id}`,
          type: "sales",
          timestamp: session.sales_submitted_at,
          actor_name: "Staff",
          description: "Sales submitted",
        });
      }
      if (session.photo_uploaded_at) {
        activityList.push({
          id: `photo-${session.id}`,
          type: "photo",
          timestamp: session.photo_uploaded_at,
          actor_name: "Staff",
          description: "Counter photo uploaded",
        });
      }

      // Add session close
      if (session.force_close_reason) {
        activityList.push({
          id: `force-close-${session.id}`,
          type: "force_close",
          timestamp: session.closed_at || session.started_at,
          actor_name: "System",
          description: `Force closed: ${session.force_close_reason}`,
        });
      } else if (session.closed_at) {
        activityList.push({
          id: `session-close-${session.id}`,
          type: "session_close",
          timestamp: session.closed_at,
          actor_name: "System",
          description: "Session closed",
        });
      }

      // Sort by timestamp descending
      activityList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivities(activityList);
    } catch (error) {
      console.error("Error fetching historical activity:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "check_in": return <LogIn className="h-3.5 w-3.5 text-success" />;
      case "check_out": return <LogOut className="h-3.5 w-3.5 text-muted-foreground" />;
      case "break_start": return <Coffee className="h-3.5 w-3.5 text-warning" />;
      case "break_end": return <Coffee className="h-3.5 w-3.5 text-muted-foreground" />;
      case "stock": return <Package className="h-3.5 w-3.5 text-primary" />;
      case "sales": return <ShoppingCart className="h-3.5 w-3.5 text-primary" />;
      case "photo": return <Image className="h-3.5 w-3.5 text-primary" />;
      case "session_start": return <LogIn className="h-3.5 w-3.5 text-primary" />;
      case "session_close": return <LogOut className="h-3.5 w-3.5 text-muted-foreground" />;
      case "force_close": return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
      default: return null;
    }
  };

  const filteredActivities = activities.filter(a => 
    a.actor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search activities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Activity List */}
      <ScrollArea className="h-[250px]">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No activities found
          </div>
        ) : (
          <div className="space-y-1">
            {filteredActivities.map((activity) => (
              <div 
                key={activity.id} 
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30"
              >
                <div className="mt-0.5 shrink-0">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{activity.actor_name}</span>
                    <span className="text-muted-foreground"> · {activity.description}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {format(new Date(activity.timestamp), "HH:mm:ss")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
