import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Search, Clock, User, Package, TrendingUp, Camera, AlertTriangle } from "lucide-react";

interface ClubActivityTabProps {
  clubId: string;
}

interface ActivityItem {
  id: string;
  timestamp: string;
  type: 'check_in' | 'check_out' | 'break_start' | 'break_end' | 'stock' | 'sales' | 'photo' | 'session';
  actor: string;
  description: string;
}

export const ClubActivityTab = ({ clubId }: ClubActivityTabProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
  }, [clubId]);

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
    const today = format(new Date(), "yyyy-MM-dd");
    const allActivities: ActivityItem[] = [];

    try {
      // Fetch attendance blocks
      const { data: blocks } = await supabase
        .from("staff_attendance_blocks")
        .select("*, profiles:user_id(full_name)")
        .eq("venue_id", clubId)
        .gte("check_in_time", `${today}T00:00:00`)
        .order("check_in_time", { ascending: false });

      blocks?.forEach((block: any) => {
        const name = block.profiles?.full_name || "Unknown";
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

      // Fetch breaks
      const { data: breaks } = await supabase
        .from("staff_breaks")
        .select("*, profiles:user_id(full_name)")
        .eq("venue_id", clubId)
        .gte("break_start_time", `${today}T00:00:00`);

      breaks?.forEach((brk: any) => {
        const name = brk.profiles?.full_name || "Unknown";
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

      // Fetch session events
      const { data: sessions } = await supabase
        .from("club_sessions")
        .select("*")
        .eq("venue_id", clubId)
        .eq("session_date", today);

      sessions?.forEach(session => {
        allActivities.push({
          id: `session-${session.id}`,
          timestamp: session.started_at,
          type: 'session',
          actor: "System",
          description: "Session started",
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
      });

      // Sort by timestamp descending
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
        return <AlertTriangle className="h-3 w-3" />;
    }
  };

  const getTypeBadgeColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'check_in': return 'bg-success/20 text-success';
      case 'check_out': return 'bg-muted text-muted-foreground';
      case 'break_start': return 'bg-warning/20 text-warning';
      case 'break_end': return 'bg-primary/20 text-primary';
      case 'stock': return 'bg-blue-500/20 text-blue-500';
      case 'sales': return 'bg-purple-500/20 text-purple-500';
      case 'photo': return 'bg-pink-500/20 text-pink-500';
      case 'session': return 'bg-orange-500/20 text-orange-500';
    }
  };

  if (loading) {
    return <div className="h-64 bg-muted animate-pulse rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter activities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Activity Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            Today's Activity
            <Badge variant="secondary">{filteredActivities.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredActivities.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No activity recorded today
            </div>
          ) : (
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {filteredActivities.map(activity => (
                <div key={activity.id} className="flex items-start gap-3 p-3">
                  <div className={`p-1.5 rounded ${getTypeBadgeColor(activity.type)}`}>
                    {getTypeIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(activity.timestamp), "hh:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
