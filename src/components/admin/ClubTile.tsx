import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Package, TrendingUp, Camera, Clock, CheckCircle2, ChevronRight } from "lucide-react";
import { ClubTileData } from "@/hooks/useAdminStats";
import { format, formatDistanceToNow } from "date-fns";

interface ClubTileProps {
  club: ClubTileData;
}

export const ClubTile = ({ club }: ClubTileProps) => {
  const navigate = useNavigate();

  const getSessionBadge = () => {
    switch (club.sessionStatus) {
      case "active":
        return (
          <Badge className="bg-success/15 text-success border-0 text-[10px] h-5 px-2 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-success mr-1 animate-pulse" />
            Live
          </Badge>
        );
      case "closed":
        return <Badge variant="secondary" className="text-[10px] h-5 px-2 font-medium border-0">Closed</Badge>;
      case "force_closed":
        return <Badge className="bg-destructive/15 text-destructive border-0 text-[10px] h-5 px-2 font-medium">Force Closed</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] h-5 px-2 font-medium text-muted-foreground">No Session</Badge>;
    }
  };

  const TaskDot = ({ done }: { done: boolean }) => (
    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
      done ? "bg-success/15" : "bg-warning/15"
    }`}>
      {done
        ? <CheckCircle2 className="h-3 w-3 text-success" />
        : <Clock className="h-3 w-3 text-warning" />
      }
    </div>
  );

  const accentBorder =
    club.issueCount > 0 ? "border-l-warning"
    : club.sessionStatus === "force_closed" ? "border-l-destructive"
    : club.sessionStatus === "active" ? "border-l-success"
    : "border-l-muted-foreground/20";

  return (
    <Card
      className={`group cursor-pointer transition-all hover:shadow-md hover:border-primary/20 active:scale-[0.98] border-l-[3px] ${accentBorder}`}
      onClick={() => navigate(`/club/${club.id}`)}
    >
      <CardContent className="p-3.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm leading-tight truncate">{club.name}</h3>
            {club.location && (
              <span className="text-[10px] text-muted-foreground">{club.location}</span>
            )}
          </div>
          {getSessionBadge()}
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-xs mb-2.5">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold">{club.staffOnDuty}</span>
            <span className="text-muted-foreground">on duty</span>
          </div>
          {club.sessionStartTime && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{format(new Date(club.sessionStartTime), "h:mm a")}</span>
            </div>
          )}
        </div>

        {/* Task Progress — active sessions only */}
        {club.sessionStatus === "active" && (
          <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5" title="Stock">
                <Package className="h-3 w-3 text-muted-foreground" />
                <TaskDot done={club.stockStatus === "ok"} />
              </div>
              <div className="flex items-center gap-1.5" title="Sales">
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                <TaskDot done={club.salesStatus === "submitted"} />
              </div>
              <div className="flex items-center gap-1.5" title="Photos">
                <Camera className="h-3 w-3 text-muted-foreground" />
                <TaskDot done={club.photoStatus === "uploaded"} />
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Inactive session — show chevron */}
        {club.sessionStatus !== "active" && (
          <div className="flex justify-end pt-2 border-t border-border/30">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
