import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Package, TrendingUp, AlertTriangle, BarChart3, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import VenueManagement from "./admin/VenueManagement";
import EmployeeManagement from "./admin/EmployeeManagement";
import StockOverview from "./admin/StockOverview";
import SalesReports from "./admin/SalesReports";
import AttendanceOverview from "./admin/AttendanceOverview";
import HookahCategoryManagement from "./admin/HookahCategoryManagement";
import EmployeeActivityReport from "./admin/EmployeeActivityReport";

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
      {/* Hero Section - Today's Total Sales */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-success" />
            Today's Total Sales
          </CardTitle>
          <CardDescription className="text-base">Across all venues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-5xl font-bold text-success">{overallStats.totalSales}</div>
          <p className="text-sm text-muted-foreground mt-2">Hookahs sold today</p>
        </CardContent>
      </Card>

      {/* Sales Breakdown Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Sales Breakdown by Venue
          </CardTitle>
          <CardDescription>Today's performance across all locations</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={venueSalesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="venue_name" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total_sales" fill="hsl(var(--primary))" name="Sales" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Venue Cards Grid */}
      {venues.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-semibold">Venues</h3>
            <p className="text-sm text-muted-foreground">{venues.length} total</p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => {
              const venueData = venueSalesData.find(v => v.venue_name === venue.name);
              return (
                <Card 
                  key={venue.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50"
                  onClick={() => window.location.href = `/venue/${venue.id}`}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {venue.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Today's Sales</span>
                      <span className="text-xl font-bold text-success">{venueData?.total_sales || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Active Staff</span>
                      <span className="text-lg font-semibold text-primary">{venueData?.active_staff || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Low Stock</span>
                      <span className="text-lg font-semibold text-warning">{venueData?.low_stock || 0}</span>
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
            <p className="text-muted-foreground">No venues found. Use the settings menu to create your first venue.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;