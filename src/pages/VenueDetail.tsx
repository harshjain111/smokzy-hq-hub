import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, AlertTriangle, TrendingUp, Activity, FileText, Camera } from "lucide-react";
import StockOverview from "@/components/dashboard/admin/StockOverview";
import SalesReports from "@/components/dashboard/admin/SalesReports";
import AttendanceOverview from "@/components/dashboard/admin/AttendanceOverview";
import EmployeeActivityReport from "@/components/dashboard/admin/EmployeeActivityReport";
import PageLayout from "@/components/PageLayout";
import { format } from "date-fns";

interface VenueStats {
  totalEmployees: number;
  lowStockCount: number;
  todaySales: number;
  activeStaff: number;
}

const VenueDetail = () => {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const [venueName, setVenueName] = useState("");
  const [counterPhoto, setCounterPhoto] = useState<string | null>(null);
  const [stats, setStats] = useState<VenueStats>({
    totalEmployees: 0,
    lowStockCount: 0,
    todaySales: 0,
    activeStaff: 0,
  });

  useEffect(() => {
    if (venueId) {
      fetchVenueDetails();
      fetchVenueStats();
      fetchCounterPhoto();
    }
  }, [venueId]);

  const fetchVenueDetails = async () => {
    const { data } = await supabase
      .from("venues")
      .select("name")
      .eq("id", venueId)
      .single();

    if (data) {
      setVenueName(data.name);
    }
  };

  const fetchCounterPhoto = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("closing_photos")
      .select("photo_url")
      .eq("venue_id", venueId)
      .eq("photo_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.photo_url) {
      // Extract file path from URL
      const match = data.photo_url.match(/\/closing-photos\/(.+)$/);
      const photoPath = match ? match[1] : null;
      
      if (photoPath) {
        const { data: signedData } = await supabase.storage
          .from("closing-photos")
          .createSignedUrl(photoPath, 3600);
        
        setCounterPhoto(signedData?.signedUrl || null);
      }
    }
  };

  const fetchVenueStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    const [employeesRes, stockRes, salesRes, attendanceRes] = await Promise.all([
      supabase
        .from("user_roles")
        .select("id")
        .eq("venue_id", venueId)
        .eq("role", "employee"),
      supabase
        .from("stock")
        .select("id, quantity, low_stock_threshold")
        .eq("venue_id", venueId),
      supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", venueId)
        .eq("report_date", today),
      supabase
        .from("attendance")
        .select("id")
        .eq("venue_id", venueId)
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

  return (
    <PageLayout title={venueName} subtitle="Detailed venue overview">
      <div className="space-y-6">
        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button onClick={() => navigate(`/venue/${venueId}/reports`)}>
            <FileText className="mr-2 h-4 w-4" />
            Detailed Reports
          </Button>
          <Button variant="outline" onClick={() => navigate("/counter-pictures")}>
            <Camera className="mr-2 h-4 w-4" />
            View All Counter Photos
          </Button>
        </div>

        {/* Counter Photo Card */}
        {counterPhoto && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Today's Counter Photo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full max-w-2xl mx-auto">
                <img
                  src={counterPhoto}
                  alt="Counter photo"
                  className="w-full h-auto rounded-lg border"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999" font-size="24">No Image</text></svg>';
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">Assigned to venue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
              <Activity className="h-4 w-4 text-success" />
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

        {/* Tabs for detailed data */}
        <Tabs defaultValue="stock" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="stock" className="h-10">Stock</TabsTrigger>
            <TabsTrigger value="sales" className="h-10">Sales</TabsTrigger>
            <TabsTrigger value="attendance" className="h-10">Attendance</TabsTrigger>
            <TabsTrigger value="activity" className="h-10">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="space-y-4">
            <StockOverview venueId={venueId!} venueName={venueName} />
          </TabsContent>

          <TabsContent value="sales" className="space-y-4">
            <SalesReports venueId={venueId!} venueName={venueName} />
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <AttendanceOverview venueId={venueId!} venueName={venueName} />
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <EmployeeActivityReport venueId={venueId} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default VenueDetail;
