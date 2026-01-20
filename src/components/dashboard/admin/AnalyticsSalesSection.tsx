import { TrendingUp, TrendingDown, Award, AlertCircle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesAnalytics } from "@/hooks/useAnalyticsData";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsSalesSectionProps {
  data: SalesAnalytics | null;
  loading: boolean;
}

export const AnalyticsSalesSection = ({ data, loading }: AnalyticsSalesSectionProps) => {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No sales data available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Monthly Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Monthly Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/10 rounded-lg p-3">
              <div className="text-2xl font-bold text-primary">{data.thisMonthTotal}</div>
              <div className="text-xs text-muted-foreground">This Month</div>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="text-2xl font-bold">{data.averagePerClub}</div>
              <div className="text-xs text-muted-foreground">Avg per Club</div>
            </div>
          </div>

          {data.bestClub && (
            <div className="flex items-center gap-2 p-2 bg-success/10 rounded-lg">
              <Award className="h-4 w-4 text-success" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">Best Performer</div>
                <div className="text-sm font-medium truncate">{data.bestClub.name}</div>
              </div>
              <div className="text-sm font-bold text-success">{data.bestClub.sales}</div>
            </div>
          )}

          {data.lowestClub && (
            <div className="flex items-center gap-2 p-2 bg-warning/10 rounded-lg">
              <AlertCircle className="h-4 w-4 text-warning" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">Needs Focus</div>
                <div className="text-sm font-medium truncate">{data.lowestClub.name}</div>
              </div>
              <div className="text-sm font-bold text-warning">{data.lowestClub.sales}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Yesterday's Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <div className="text-xl font-bold">{data.yesterdayTotal}</div>
              <div className="text-xs text-muted-foreground">Yesterday's Sales</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-muted-foreground">{data.sameWeekdayLastWeekTotal}</div>
              <div className="text-xs text-muted-foreground">Same Day Last Week</div>
            </div>
          </div>

          <div className={`flex items-center gap-2 p-2 rounded-lg ${
            data.percentChange >= 0 ? 'bg-success/10' : 'bg-destructive/10'
          }`}>
            {data.percentChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            <span className={`text-sm font-medium ${
              data.percentChange >= 0 ? 'text-success' : 'text-destructive'
            }`}>
              {data.percentChange >= 0 ? '+' : ''}{data.percentChange}% vs last week
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
