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
        return <Badge className="bg-success/20 text-success border-success/30 text-[10px] h-5">Active</Badge>;
      case 'closed':
        return <Badge className="bg-muted text-muted-foreground border-muted text-[10px] h-5">Closed</Badge>;
      case 'force_closed':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] h-5">Force Closed</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] h-5">No Session</Badge>;
    }
  };

  const getStatusIcon = (status: 'ok' | 'pending' | 'submitted' | 'uploaded' | 'overdue') => {
    if (status === 'ok' || status === 'submitted' || status === 'uploaded') {
      return <CheckCircle2 className="h-3 w-3 text-success" />;
    }
    return <Clock className="h-3 w-3 text-warning" />;
  };

  const getBorderColor = () => {
    if (club.issueCount > 0) return 'border-warning/50 hover:border-warning';
    if (club.sessionStatus === 'force_closed') return 'border-destructive/50 hover:border-destructive';
    if (club.sessionStatus === 'active') return 'border-success/30 hover:border-success';
    return 'border-border hover:border-primary/50';
  };

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${getBorderColor()}`}
      onClick={() => navigate(`/club/${club.id}`)}
    >
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{club.name}</h3>
            <p className="text-[10px] text-muted-foreground truncate">{club.location}</p>
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

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Staff On Duty */}
          <div className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            <div>
              <div className="text-sm font-semibold">{club.staffOnDuty}</div>
              <div className="text-[9px] text-muted-foreground">Staff On Duty</div>
            </div>
          </div>

          {/* Session Time */}
          <div className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <div className="text-[10px] font-medium">
                {club.sessionStartTime 
                  ? format(new Date(club.sessionStartTime), "hh:mm a")
                  : "-"
                }
              </div>
              <div className="text-[9px] text-muted-foreground">Started</div>
            </div>
          </div>
        </div>

        {/* Task Status Row */}
        {club.sessionStatus === 'active' && (
          <div className="flex items-center justify-between border-t pt-2">
            <div className="flex items-center gap-1">
              {getStatusIcon(club.stockStatus)}
              <span className="text-[10px]">Stock</span>
            </div>
            <div className="flex items-center gap-1">
              {getStatusIcon(club.salesStatus)}
              <span className="text-[10px]">Sales</span>
            </div>
            <div className="flex items-center gap-1">
              {getStatusIcon(club.photoStatus)}
              <span className="text-[10px]">Photo</span>
            </div>
          </div>
        )}

        {/* Stock Last Update */}
        {club.stockLastUpdate && (
          <div className="text-[9px] text-muted-foreground">
            Stock updated {formatDistanceToNow(new Date(club.stockLastUpdate), { addSuffix: true })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
