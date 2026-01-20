import { Users, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaffDiscipline } from "@/hooks/useAnalyticsData";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StaffDisciplineSectionProps {
  data: StaffDiscipline[];
  loading: boolean;
}

export const StaffDisciplineSection = ({ data, loading }: StaffDisciplineSectionProps) => {
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
          No staff data available
        </CardContent>
      </Card>
    );
  }

  // Summary stats
  const disciplined = data.filter(s => s.status === 'Disciplined').length;
  const needsAttention = data.filter(s => s.status === 'Needs Attention').length;
  const nonCompliant = data.filter(s => s.status === 'Non-Compliant').length;

  const getStatusBadge = (status: StaffDiscipline['status']) => {
    switch (status) {
      case 'Disciplined':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px]">Disciplined</Badge>;
      case 'Needs Attention':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">Needs Attention</Badge>;
      case 'Non-Compliant':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">Non-Compliant</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-success/10 border-success/30">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-success">{disciplined}</div>
            <div className="text-[10px] text-muted-foreground">Disciplined</div>
          </CardContent>
        </Card>
        <Card className="bg-warning/10 border-warning/30">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-warning">{needsAttention}</div>
            <div className="text-[10px] text-muted-foreground">Needs Attention</div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-destructive">{nonCompliant}</div>
            <div className="text-[10px] text-muted-foreground">Non-Compliant</div>
          </CardContent>
        </Card>
      </div>

      {/* Staff List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Staff Attendance & Discipline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y">
              {data.map((staff) => (
                <div key={staff.id} className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{staff.name}</div>
                      {getStatusBadge(staff.status)}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold">{staff.complianceRate}%</div>
                      <div className="text-[10px] text-muted-foreground">Compliance</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-muted/50 rounded p-1.5">
                      <div className="text-xs font-semibold">{staff.daysPresent}/{staff.daysAssigned}</div>
                      <div className="text-[9px] text-muted-foreground">Days</div>
                    </div>
                    <div className={`rounded p-1.5 ${staff.lateCheckIns > 0 ? 'bg-warning/10' : 'bg-muted/50'}`}>
                      <div className={`text-xs font-semibold ${staff.lateCheckIns > 0 ? 'text-warning' : ''}`}>
                        {staff.lateCheckIns}
                      </div>
                      <div className="text-[9px] text-muted-foreground">Late</div>
                    </div>
                    <div className={`rounded p-1.5 ${staff.missedCheckouts > 0 ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                      <div className={`text-xs font-semibold ${staff.missedCheckouts > 0 ? 'text-destructive' : ''}`}>
                        {staff.missedCheckouts}
                      </div>
                      <div className="text-[9px] text-muted-foreground">Missed</div>
                    </div>
                    <div className="bg-muted/50 rounded p-1.5">
                      <div className="text-xs font-semibold">{staff.averageBreakMinutes}m</div>
                      <div className="text-[9px] text-muted-foreground">Avg Break</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
