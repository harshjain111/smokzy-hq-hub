import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HistoricalSummarySection } from "./HistoricalSummarySection";
import { HistoricalSalesSection } from "./HistoricalSalesSection";
import { HistoricalStockSection } from "./HistoricalStockSection";
import { HistoricalAttendanceSection } from "./HistoricalAttendanceSection";
import { HistoricalActivitySection } from "./HistoricalActivitySection";

interface HistoricalSession {
  id: string;
  session_date: string;
  started_at: string;
  closed_at: string | null;
  status: string;
  stock_submitted: boolean;
  stock_submitted_at: string | null;
  sales_submitted: boolean;
  sales_submitted_at: string | null;
  photo_uploaded: boolean;
  photo_uploaded_at: string | null;
  force_close_reason: string | null;
}

interface HistoricalSessionDetailProps {
  session: HistoricalSession;
  clubId: string;
  clubName: string;
  onBack: () => void;
}

export const HistoricalSessionDetail = ({ 
  session, 
  clubId, 
  clubName, 
  onBack 
}: HistoricalSessionDetailProps) => {
  const [expandedSection, setExpandedSection] = useState<string>("summary");

  const getSessionBadge = () => {
    if (session.force_close_reason) {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">Force Closed</Badge>;
    }
    if (session.status === "closed") {
      const completed = [session.stock_submitted, session.sales_submitted, session.photo_uploaded].filter(Boolean).length;
      if (completed === 3) {
        return <Badge className="bg-success/20 text-success border-success/30 text-[10px]">Complete</Badge>;
      }
      return <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">Incomplete</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]">Open</Badge>;
  };

  return (
    <div className="space-y-3">
      {/* Session Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {format(parseISO(session.session_date), "EEEE, dd MMM yyyy")}
            </span>
            {getSessionBadge()}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(session.started_at), "HH:mm")}
            {session.closed_at && ` - ${format(new Date(session.closed_at), "HH:mm")}`}
          </div>
        </div>
      </div>

      {/* Historical Data Sections */}
      <Accordion
        type="single"
        collapsible
        value={expandedSection}
        onValueChange={(value) => setExpandedSection(value)}
        className="space-y-2"
      >
        {/* Summary Section */}
        <AccordionItem value="summary" className="border rounded-lg overflow-hidden bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <span className="text-sm font-medium">Summary</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <HistoricalSummarySection session={session} clubId={clubId} />
          </AccordionContent>
        </AccordionItem>

        {/* Sales Section */}
        <AccordionItem value="sales" className="border rounded-lg overflow-hidden bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <span className="text-sm font-medium">Sales</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <HistoricalSalesSection session={session} clubId={clubId} clubName={clubName} />
          </AccordionContent>
        </AccordionItem>

        {/* Stock Section */}
        <AccordionItem value="stock" className="border rounded-lg overflow-hidden bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <span className="text-sm font-medium">Stock</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <HistoricalStockSection session={session} clubId={clubId} clubName={clubName} />
          </AccordionContent>
        </AccordionItem>

        {/* Attendance Section */}
        <AccordionItem value="attendance" className="border rounded-lg overflow-hidden bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <span className="text-sm font-medium">Attendance</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <HistoricalAttendanceSection session={session} clubId={clubId} clubName={clubName} />
          </AccordionContent>
        </AccordionItem>

        {/* Activity Section */}
        <AccordionItem value="activity" className="border rounded-lg overflow-hidden bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <span className="text-sm font-medium">Activity Log</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <HistoricalActivitySection session={session} clubId={clubId} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
