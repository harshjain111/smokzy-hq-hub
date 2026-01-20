import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { AnalyticsSalesSection } from "./AnalyticsSalesSection";
import { ClubPerformanceSection } from "./ClubPerformanceSection";
import { StaffDisciplineSection } from "./StaffDisciplineSection";
import { ComplianceExceptionsSection } from "./ComplianceExceptionsSection";
import { ReportsSection } from "./ReportsSection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TrendingUp, Building2, Users, AlertTriangle, FileSpreadsheet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export const AnalyticsDashboard = () => {
  const { salesAnalytics, clubPerformance, staffDiscipline, exceptions, loading, lastUpdated, refresh } = useAnalyticsData();

  return (
    <div className="space-y-4">
      {/* Real-time indicator */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground">
            Live updates enabled • Last updated: {format(lastUpdated, "h:mm:ss a")}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={refresh}
          disabled={loading}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Accordion type="single" collapsible defaultValue="sales" className="space-y-2">
        {/* Sales Analytics */}
        <AccordionItem value="sales" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-medium">Sales Analytics</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <AnalyticsSalesSection data={salesAnalytics} loading={loading} />
          </AccordionContent>
        </AccordionItem>

        {/* Club Performance */}
        <AccordionItem value="performance" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-medium">Club Performance</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <ClubPerformanceSection data={clubPerformance} loading={loading} />
          </AccordionContent>
        </AccordionItem>

        {/* Attendance & Discipline */}
        <AccordionItem value="discipline" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium">Attendance & Discipline</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <StaffDisciplineSection data={staffDiscipline} loading={loading} />
          </AccordionContent>
        </AccordionItem>

        {/* Compliance & Exceptions */}
        <AccordionItem value="exceptions" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-medium">Compliance & Exceptions</span>
              {exceptions.length > 0 && (
                <span className="ml-2 text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">
                  {exceptions.length}
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <ComplianceExceptionsSection data={exceptions} loading={loading} />
          </AccordionContent>
        </AccordionItem>

        {/* Reports & Exports */}
        <AccordionItem value="reports" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <span className="font-medium">Reports & Exports</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <ReportsSection />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
