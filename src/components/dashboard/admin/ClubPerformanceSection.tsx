import { TrendingUp, TrendingDown, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClubPerformance } from "@/hooks/useAnalyticsData";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClubPerformanceSectionProps {
  data: ClubPerformance[];
  loading: boolean;
}

export const ClubPerformanceSection = ({ data, loading }: ClubPerformanceSectionProps) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No club performance data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Club Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[400px]">
          <div className="divide-y">
            {data.map((club, index) => (
              <div key={club.id} className="p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-success/20 text-success' :
                      index === data.length - 1 ? 'bg-warning/20 text-warning' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{club.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Avg: {club.averageDailySales}/day
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-sm">{club.thisMonthSales}</div>
                    <div className={`flex items-center justify-end gap-1 text-xs ${
                      club.percentChange >= 0 ? 'text-success' : 'text-destructive'
                    }`}>
                      {club.percentChange >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {club.percentChange >= 0 ? '+' : ''}{club.percentChange}%
                    </div>
                  </div>
                </div>

                {/* Progress bar comparing this vs last month */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, (club.thisMonthSales / Math.max(club.lastMonthSales, club.thisMonthSales, 1)) * 100)}%` 
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground w-16 text-right">
                    vs {club.lastMonthSales}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
