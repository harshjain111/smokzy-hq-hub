import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Package, TrendingUp, AlertTriangle, BarChart3, Activity, CheckCircle2, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import VenueManagement from "./admin/VenueManagement";
import EmployeeManagement from "./admin/EmployeeManagement";
import StockOverview from "./admin/StockOverview";
import SalesReports from "./admin/SalesReports";
import AttendanceOverview from "./admin/AttendanceOverview";
import HookahCategoryManagement from "./admin/HookahCategoryManagement";
import EmployeeActivityReport from "./admin/EmployeeActivityReport";
import AdminNotifications from "./admin/AdminNotifications";

interface AdminDashboardProps {
  user: User;
}

interface Venue {
  id: string;
  name: string;
}

interface VenueSalesData {
  venue_name: string;
  total_sales: number;
  active_staff: number;
  low_stock: number;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("all");
  const [venueSalesData, setVenueSalesData] = useState<VenueSalesData[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalVenues: 0,
    totalEmployees: 0,
    totalLowStock: 0,
    totalSales: 0,
  });
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
    if (selectedVenueId === "all") {
      fetchOverallStats();
    } else if (selectedVenueId) {
      fetchVenueStats();
    }
  }, [selectedVenueId, venues]);

  const fetchVenues = async () => {
    const { data } = await supabase
      .from("venues")
      .select("*")
      .order("name");

    if (data && data.length > 0) {
      setVenues(data);
    }
  };

  const fetchOverallStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Fetch sales data for all venues with venue names
    const salesByVenue: VenueSalesData[] = [];
    
    for (const venue of venues) {
      const [employeesRes, stockRes, salesRes, attendanceRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("id")
          .eq("venue_id", venue.id)
          .eq("role", "employee"),
        supabase
          .from("stock")
          .select("id, quantity, low_stock_threshold")
          .eq("venue_id", venue.id),
        supabase
          .from("sales_reports")
          .select("quantity_sold")
          .eq("venue_id", venue.id)
          .eq("report_date", today),
        supabase
          .from("attendance")
          .select("id")
          .eq("venue_id", venue.id)
          .gte("check_in_time", `${today}T00:00:00`)
          .is("check_out_time", null),
      ]);

      const lowStock = stockRes.data?.filter(
        item => item.quantity <= item.low_stock_threshold
      ).length || 0;

      const totalSales = salesRes.data?.reduce(
        (sum, sale) => sum + sale.quantity_sold, 0
      ) || 0;

      salesByVenue.push({
        venue_name: venue.name,
        total_sales: totalSales,
        active_staff: attendanceRes.data?.length || 0,
        low_stock: lowStock,
      });
    }

    setVenueSalesData(salesByVenue);

    // Calculate overall totals
    const totalEmployees = await supabase
      .from("user_roles")
      .select("id", { count: "exact" })
      .eq("role", "employee");

    setOverallStats({
      totalVenues: venues.length,
      totalEmployees: totalEmployees.count || 0,
      totalLowStock: salesByVenue.reduce((sum, v) => sum + v.low_stock, 0),
      totalSales: salesByVenue.reduce((sum, v) => sum + v.total_sales, 0),
    });
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
      {/* Admin Notifications - Early Checkout Alerts */}
      <AdminNotifications />

      {/* Hero Section - Quick Stats Grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardHeader className="pb-2 md:pb-3">
            <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-success" />
              <span className="truncate">Today's Sales</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-success">{overallStats.totalSales}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Hookahs sold</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2 md:pb-3">
            <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
              <Building2 className="h-3 w-3 md:h-4 md:w-4 text-primary" />
              <span className="truncate">Total Venues</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-primary">{overallStats.totalVenues}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Active locations</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardHeader className="pb-2 md:pb-3">
            <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
              <Users className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
              <span className="truncate">Total Staff</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-blue-500">{overallStats.totalEmployees}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Employees</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
          <CardHeader className="pb-2 md:pb-3">
            <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-warning" />
              <span className="truncate">Low Stock</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-warning">{overallStats.totalLowStock}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Items need restocking</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Breakdown Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-xl">
            <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
            Sales Breakdown by Venue
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Today's performance across all locations</CardDescription>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <div className="w-full overflow-x-auto -mx-2 md:mx-0">
            <div className="min-w-[500px] md:min-w-0">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={venueSalesData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="venue_name" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 10 }}
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    width={30}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      fontSize: '11px',
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--background))'
                    }}
                  />
                  <Bar 
                    dataKey="total_sales" 
                    fill="hsl(var(--primary))" 
                    name="Sales" 
                    radius={[8, 8, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Venue Cards Grid */}
      {venues.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-xl md:text-2xl font-semibold">Venues</h3>
            <p className="text-xs md:text-sm text-muted-foreground">{venues.length} total</p>
          </div>
          
          <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => {
              const venueData = venueSalesData.find(v => v.venue_name === venue.name);
              return (
                <Card 
                  key={venue.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50"
                  onClick={() => window.location.href = `/venue/${venue.id}`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <Building2 className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                      <span className="truncate">{venue.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 md:space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs md:text-sm text-muted-foreground">Today's Sales</span>
                      <span className="text-lg md:text-xl font-bold text-success">{venueData?.total_sales || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs md:text-sm text-muted-foreground">Active Staff</span>
                      <span className="text-base md:text-lg font-semibold text-primary">{venueData?.active_staff || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs md:text-sm text-muted-foreground">Low Stock</span>
                      <span className="text-base md:text-lg font-semibold text-warning">{venueData?.low_stock || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {venues.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center text-sm md:text-base px-4">No venues found. Use the settings menu to create your first venue.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;
