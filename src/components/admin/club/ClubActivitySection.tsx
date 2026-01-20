import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Search, Clock, User, Package, TrendingUp, Camera, Activity } from "lucide-react";

interface ClubActivitySectionProps {
  clubId: string;
  currentSession?: { id: string; session_date: string } | null;
}

interface ActivityItem {
  id: string;
  timestamp: string;
  type: 'check_in' | 'check_out' | 'break_start' | 'break_end' | 'stock' | 'sales' | 'photo' | 'session';
  actor: string;
  description: string;
}

export const ClubActivitySection = ({ clubId, currentSession }: ClubActivitySectionProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
  }, [clubId, currentSession?.id]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setFilteredActivities(
        activities.filter(a => 
          a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.type.includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredActivities(activities);
    }
  }, [searchQuery, activities]);

  const fetchActivity = async () => {
    setLoading(true);
    const allActivities: ActivityItem[] = [];

    try {
      // If no current session, show nothing - activity is session-based
      if (!currentSession) {
        setActivities([]);
        setFilteredActivities([]);
        setLoading(false);
        return;
      }

      // Fetch attendance blocks for THIS SESSION (not by date)
      const { data: blocks } = await supabase
        .from("staff_attendance_blocks")
        .select("*")
        .eq("session_id", currentSession.id)
        .order("check_in_time", { ascending: false });

      // Fetch profiles for names
      const userIds = [...new Set(blocks?.map(b => b.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => { profileMap[p.id] = p.full_name; });

      blocks?.forEach((block) => {
        const name = profileMap[block.user_id] || "Unknown";
        allActivities.push({
          id: `checkin-${block.id}`,
          timestamp: block.check_in_time,
          type: 'check_in',
          actor: name,
          description: `${name} checked in`,
        });
        if (block.check_out_time) {
          allActivities.push({
            id: `checkout-${block.id}`,
            timestamp: block.check_out_time,
            type: 'check_out',
            actor: name,
            description: `${name} checked out`,
          });
        }
      });

      // Fetch breaks for THIS SESSION
      const { data: breaks } = await supabase
        .from("staff_breaks")
        .select("*")
        .eq("session_id", currentSession.id);

      breaks?.forEach((brk) => {
        const name = profileMap[brk.user_id] || "Unknown";
        allActivities.push({
          id: `break-start-${brk.id}`,
          timestamp: brk.break_start_time,
          type: 'break_start',
          actor: name,
          description: `${name} started break`,
        });
        if (brk.break_end_time) {
          allActivities.push({
            id: `break-end-${brk.id}`,
            timestamp: brk.break_end_time,
            type: 'break_end',
            actor: name,
            description: `${name} ended break (${brk.duration_minutes}m)`,
          });
        }
      });

      // Fetch the session itself
      const { data: session } = await supabase
        .from("club_sessions")
        .select("*")
        .eq("id", currentSession.id)
        .maybeSingle();

      if (session) {
        allActivities.push({
          id: `session-${session.id}`,
          timestamp: session.started_at,
          type: 'session',
          actor: "System",
          description: `Session started (${session.session_date})`,
        });
        if (session.stock_submitted_at) {
          allActivities.push({
            id: `stock-${session.id}`,
            timestamp: session.stock_submitted_at,
            type: 'stock',
            actor: "Staff",
            description: "Stock submitted",
          });
        }
        if (session.sales_submitted_at) {
          allActivities.push({
            id: `sales-${session.id}`,
            timestamp: session.sales_submitted_at,
            type: 'sales',
            actor: "Staff",
            description: "Sales submitted",
          });
        }
        if (session.photo_uploaded_at) {
          allActivities.push({
            id: `photo-${session.id}`,
            timestamp: session.photo_uploaded_at,
            type: 'photo',
            actor: "Staff",
            description: "Counter photo uploaded",
          });
        }
      }

      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(allActivities);
      setFilteredActivities(allActivities);
    } catch (error) {
      console.error("Error fetching activity:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'check_in':
      case 'check_out':
        return <User className="h-3 w-3" />;
      case 'break_start':
      case 'break_end':
        return <Clock className="h-3 w-3" />;
      case 'stock':
        return <Package className="h-3 w-3" />;
      case 'sales':
        return <TrendingUp className="h-3 w-3" />;
      case 'photo':
        return <Camera className="h-3 w-3" />;
      case 'session':
        return <Activity className="h-3 w-3" />;
    }
  };

  const getTypeBadgeColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'check_in': return 'bg-success/20 text-success';
      case 'check_out': return 'bg-muted text-muted-foreground';
      case 'break_start': return 'bg-warning/20 text-warning';
      case 'break_end': return 'bg-primary/20 text-primary';
      case 'stock': return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
      case 'sales': return 'bg-purple-500/20 text-purple-600 dark:text-purple-400';
      case 'photo': return 'bg-pink-500/20 text-pink-600 dark:text-pink-400';
      case 'session': return 'bg-orange-500/20 text-orange-600 dark:text-orange-400';
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        No active session. Activity log will appear once a session starts.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter activities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Activity Count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Session Activity ({currentSession.session_date})
        </span>
        <Badge variant="secondary" className="text-[10px]">{filteredActivities.length}</Badge>
      </div>

      {/* Activity Log */}
      {filteredActivities.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          No activity recorded for this session
        </div>
      ) : (
        <div className="divide-y max-h-[350px] overflow-y-auto rounded-lg border bg-card">
          {filteredActivities.map(activity => (
            <div key={activity.id} className="flex items-start gap-2.5 p-2.5">
              <div className={`p-1.5 rounded ${getTypeBadgeColor(activity.type)}`}>
                {getTypeIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-tight">{activity.description}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(activity.timestamp), "MMM dd, hh:mm a")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
