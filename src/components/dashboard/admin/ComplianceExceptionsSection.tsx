import { AlertTriangle, XCircle, Clock, FileWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ComplianceException } from "@/hooks/useAnalyticsData";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface ComplianceExceptionsSectionProps {
  data: ComplianceException[];
  loading: boolean;
}

export const ComplianceExceptionsSection = ({ data, loading }: ComplianceExceptionsSectionProps) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="bg-success/5 border-success/20">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-success" />
            </div>
            <div className="text-sm font-medium text-success">No exceptions found</div>
            <div className="text-xs text-muted-foreground">All operations running smoothly</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getIcon = (type: ComplianceException['type']) => {
    switch (type) {
      case 'force_closed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'stock_delay':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'sales_mismatch':
        return <FileWarning className="h-4 w-4 text-orange-500" />;
      case 'missing_records':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const getTypeBadge = (type: ComplianceException['type']) => {
    switch (type) {
      case 'force_closed':
        return <Badge variant="destructive" className="text-[10px]">Force Closed</Badge>;
      case 'stock_delay':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">Stock Delay</Badge>;
      case 'sales_mismatch':
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 text-[10px]">Mismatch</Badge>;
      case 'missing_records':
        return <Badge variant="destructive" className="text-[10px]">Missing Records</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Compliance Exceptions
          <Badge variant="destructive" className="ml-auto text-[10px]">
            {data.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[300px]">
          <div className="divide-y">
            {data.map((exception, index) => (
              <div key={index} className="p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-2">
                  {getIcon(exception.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{exception.clubName}</span>
                      {getTypeBadge(exception.type)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(exception.date), "MMM d, yyyy")}
                    </div>
                    {exception.details && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {exception.details}
                      </div>
                    )}
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
