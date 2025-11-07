import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AttendanceWidget from "./employee/AttendanceWidget";
import TasksWidget from "./employee/TasksWidget";
import StockWidget from "./employee/StockWidget";
import SalesWidget from "./employee/SalesWidget";

interface EmployeeDashboardProps {
  user: User;
  venueId: string;
}

const EmployeeDashboard = ({ user, venueId }: EmployeeDashboardProps) => {
  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <CardHeader>
          <CardTitle>Your Daily Tasks</CardTitle>
          <CardDescription>
            Complete all tasks before clocking out
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TasksWidget user={user} venueId={venueId} />
        </CardContent>
      </Card>

      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <AttendanceWidget user={user} venueId={venueId} />
        </TabsContent>

        <TabsContent value="stock">
          <StockWidget venueId={venueId} />
        </TabsContent>

        <TabsContent value="sales">
          <SalesWidget user={user} venueId={venueId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeeDashboard;