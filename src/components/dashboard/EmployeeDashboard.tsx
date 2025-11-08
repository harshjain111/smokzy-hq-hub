import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AttendanceWidget from "./employee/AttendanceWidget";
import TasksWidget from "./employee/TasksWidget";
import StockWidget from "./employee/StockWidget";
import SalesWidget from "./employee/SalesWidget";
import ClosingPhotoWidget from "./employee/ClosingPhotoWidget";

interface EmployeeDashboardProps {
  user: User;
  venueId: string;
}

const EmployeeDashboard = ({ user, venueId }: EmployeeDashboardProps) => {
  return (
    <div className="space-y-4 md:space-y-6 pb-6">
      {/* Mobile-optimized Tasks Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl md:text-2xl">Your Daily Tasks</CardTitle>
          <CardDescription className="text-sm md:text-base">
            Complete all tasks before clocking out
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <TasksWidget user={user} venueId={venueId} />
        </CardContent>
      </Card>

      {/* Mobile-First Tabs with Larger Touch Targets */}
      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 bg-muted/50 border border-border">
          <TabsTrigger 
            value="attendance" 
            className="h-12 md:h-10 text-sm md:text-base border-r border-border last:border-r-0 md:last:border-r-0 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Attendance
          </TabsTrigger>
          <TabsTrigger 
            value="stock" 
            className="h-12 md:h-10 text-sm md:text-base border-r md:border-r border-border md:last:border-r-0 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Stock
          </TabsTrigger>
          <TabsTrigger 
            value="sales" 
            className="h-12 md:h-10 text-sm md:text-base border-r border-border md:border-r last:border-r-0 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Sales
          </TabsTrigger>
          <TabsTrigger 
            value="photo" 
            className="h-12 md:h-10 text-sm md:text-base data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Photo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          <AttendanceWidget user={user} venueId={venueId} />
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <StockWidget venueId={venueId} />
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <SalesWidget user={user} venueId={venueId} />
        </TabsContent>

        <TabsContent value="photo" className="mt-4">
          <ClosingPhotoWidget user={user} venueId={venueId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeeDashboard;