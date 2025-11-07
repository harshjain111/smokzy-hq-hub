import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Package, TrendingUp, AlertTriangle } from "lucide-react";
import VenueManagement from "./admin/VenueManagement";
import EmployeeManagement from "./admin/EmployeeManagement";
import StockOverview from "./admin/StockOverview";
import SalesReports from "./admin/SalesReports";
import AttendanceOverview from "./admin/AttendanceOverview";
import HookahCategoryManagement from "./admin/HookahCategoryManagement";

interface AdminDashboardProps {
  user: User;
}

interface Venue {
  id: string;
  name: string;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");
  const [stats, setStats] = useState({
    totalEmployees: 0,
    lowStockCount: 0,
    todaySales: 0,
    activeStaff: 0,
  });

  useEffect(() => {
    fetchVenues();
  }, []);

  useEffect(() => {
    if (selectedVenueId) {
      fetchVenueStats();
    }
  }, [selectedVenueId]);

  const fetchVenues = async () => {
    const { data } = await supabase
      .from("venues")
      .select("*")
      .order("name");

    if (data && data.length > 0) {
      setVenues(data);
      // Auto-select first venue
      if (!selectedVenueId) {
        setSelectedVenueId(data[0].id);
      }
    }
  };

  const fetchVenueStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    const [employeesRes, stockRes, salesRes, attendanceRes] = await Promise.all([
      supabase
        .from("user_roles")
        .select("id")
        .eq("venue_id", selectedVenueId)
        .eq("role", "employee"),
      supabase
        .from("stock")
        .select("id, quantity, low_stock_threshold")
        .eq("venue_id", selectedVenueId),
      supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", selectedVenueId)
        .eq("report_date", today),
      supabase
        .from("attendance")
        .select("id")
        .eq("venue_id", selectedVenueId)
        .gte("check_in_time", `${today}T00:00:00`)
        .is("check_out_time", null),
    ]);

    const lowStock = stockRes.data?.filter(
      item => item.quantity <= item.low_stock_threshold
    ).length || 0;

    const totalSales = salesRes.data?.reduce(
      (sum, sale) => sum + sale.quantity_sold, 0
    ) || 0;

    setStats({
      totalEmployees: employeesRes.data?.length || 0,
      lowStockCount: lowStock,
      todaySales: totalSales,
      activeStaff: attendanceRes.data?.length || 0,
    });
  };

  const selectedVenue = venues.find(v => v.id === selectedVenueId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage your hookah bar operations</p>
        </div>
        
        {venues.length > 0 && (
          <div className="w-64">
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger>
                <SelectValue placeholder="Select venue" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {selectedVenueId && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEmployees}</div>
                <p className="text-xs text-muted-foreground">At {selectedVenue?.name}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
                <Users className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{stats.activeStaff}</div>
                <p className="text-xs text-muted-foreground">Currently on duty</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{stats.lowStockCount}</div>
                <p className="text-xs text-muted-foreground">Items need restock</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{stats.todaySales}</div>
                <p className="text-xs text-muted-foreground">Hookahs sold today</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="stock" className="space-y-4">
            <TabsList>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="venues">All Venues</TabsTrigger>
              <TabsTrigger value="employees">All Employees</TabsTrigger>
              <TabsTrigger value="categories">Hookah Categories</TabsTrigger>
            </TabsList>

            <TabsContent value="stock" className="space-y-4">
              <StockOverview venueId={selectedVenueId} venueName={selectedVenue?.name || ""} />
            </TabsContent>

            <TabsContent value="sales" className="space-y-4">
              <SalesReports venueId={selectedVenueId} venueName={selectedVenue?.name || ""} />
            </TabsContent>

            <TabsContent value="attendance" className="space-y-4">
              <AttendanceOverview venueId={selectedVenueId} venueName={selectedVenue?.name || ""} />
            </TabsContent>

            <TabsContent value="venues" className="space-y-4">
              <VenueManagement />
            </TabsContent>

            <TabsContent value="employees" className="space-y-4">
              <EmployeeManagement />
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <HookahCategoryManagement />
            </TabsContent>
          </Tabs>
        </>
      )}

      {venues.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No venues found. Create your first venue to get started.</p>
            <Tabs defaultValue="venues" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="venues">Venues</TabsTrigger>
                <TabsTrigger value="employees">Employees</TabsTrigger>
              </TabsList>
              <TabsContent value="venues">
                <VenueManagement />
              </TabsContent>
              <TabsContent value="employees">
                <EmployeeManagement />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;