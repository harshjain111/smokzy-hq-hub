import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Package, TrendingUp, Camera, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { ClubTileData } from "@/hooks/useAdminStats";
import { format, formatDistanceToNow } from "date-fns";

interface ClubTileProps {
  club: ClubTileData;
}

export const ClubTile = ({ club }: ClubTileProps) => {
  const navigate = useNavigate();

  const getSessionBadge = () => {
    switch (club.sessionStatus) {
      case 'active':
        return <Badge className="bg-success/20 text-success border-success/30 text-[10px] h-5 px-1.5">Active</Badge>;
      case 'closed':
        return <Badge className="bg-muted text-muted-foreground border-muted text-[10px] h-5 px-1.5">Closed</Badge>;
      case 'force_closed':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] h-5 px-1.5">Force Closed</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] h-5 px-1.5">No Session</Badge>;
    }
  };

  const getStatusIcon = (status: 'ok' | 'pending' | 'submitted' | 'uploaded' | 'overdue') => {
    if (status === 'ok' || status === 'submitted' || status === 'uploaded') {
      return <CheckCircle2 className="h-3 w-3 text-success" />;
    }
    return <Clock className="h-3 w-3 text-warning" />;
  };

  const getBorderColor = () => {
    if (club.issueCount > 0) return 'border-l-4 border-l-warning border-warning/30';
    if (club.sessionStatus === 'force_closed') return 'border-l-4 border-l-destructive border-destructive/30';
    if (club.sessionStatus === 'active') return 'border-l-4 border-l-success border-success/30';
    return 'border-l-4 border-l-muted-foreground/30';
  };

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${getBorderColor()}`}
      onClick={() => navigate(`/club/${club.id}`)}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{club.name}</h3>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {getSessionBadge()}
            {club.issueCount > 0 && (
              <div className="flex items-center gap-0.5 bg-warning/20 text-warning px-1.5 py-0.5 rounded text-[10px] font-medium">
                <AlertCircle className="h-3 w-3" />
                {club.issueCount}
              </div>
            )}
          </div>
        </div>

        {/* Stats Row - Compact */}
        <div className="flex items-center gap-3 text-xs">
          {/* Staff */}
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{club.staffOnDuty}</span>
            <span className="text-muted-foreground text-[10px]">staff</span>
          </div>

          {/* Session Time */}
          {club.sessionStartTime && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="text-[10px]">
                {format(new Date(club.sessionStartTime), "hh:mm a")}
              </span>
            </div>
          )}
        </div>

        {/* Task Status Row - Only for active sessions */}
        {club.sessionStatus === 'active' && (
          <div className="flex items-center gap-4 pt-1 border-t border-border/50">
            <div className="flex items-center gap-1">
              <Package className="h-3 w-3 text-muted-foreground" />
              {getStatusIcon(club.stockStatus)}
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              {getStatusIcon(club.salesStatus)}
            </div>
            <div className="flex items-center gap-1">
              <Camera className="h-3 w-3 text-muted-foreground" />
              {getStatusIcon(club.photoStatus)}
            </div>
            {club.stockLastUpdate && (
              <span className="text-[9px] text-muted-foreground ml-auto">
                {formatDistanceToNow(new Date(club.stockLastUpdate), { addSuffix: true })}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
