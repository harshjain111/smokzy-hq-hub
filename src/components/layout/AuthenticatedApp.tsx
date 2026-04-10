import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import AppShell from "./AppShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";

// Page imports
import DashboardHome from "@/pages/DashboardHome";
import DailySummary from "@/pages/DailySummary";
import WeeklySummary from "@/pages/WeeklySummary";
import ClubDetail from "@/pages/ClubDetail";
import VenueDetail from "@/pages/VenueDetail";
import VenueReports from "@/pages/VenueReports";
import ManageVenues from "@/pages/ManageVenues";
import ManageEmployees from "@/pages/ManageEmployees";
import ManageCategories from "@/pages/ManageCategories";
import ManageFlavours from "@/pages/ManageFlavours";
import AttendanceReport from "@/pages/AttendanceReport";
import CounterPictures from "@/pages/CounterPictures";
import WeeklyRoster from "@/pages/WeeklyRoster";
import DailyRoster from "@/pages/DailyRoster";
import PacketDispatch from "@/pages/PacketDispatch";
import DispatchHistory from "@/pages/DispatchHistory";
import DailyClubReport from "@/pages/DailyClubReport";
import InspectionForm from "@/pages/InspectionForm";
import InspectionHistory from "@/pages/InspectionHistory";
import StaffPerformance from "@/pages/StaffPerformance";
import AccessoryTracker from "@/pages/AccessoryTracker";
import InspectionSettings from "@/pages/InspectionSettings";
import MyProfile from "@/pages/MyProfile";
import NotFound from "@/pages/NotFound";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const INCHARGE_ROLES = ["admin", "club_incharge"] as const;
const ADMIN_ONLY = ["admin"] as const;

const AuthenticatedApp = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const { userRole, loading } = useUserRole(user);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (initializing || loading) return <LoadingSpinner />;

  if (!user) return <Navigate to="/auth" replace />;

  // Employees get their own full-screen portal
  if (userRole?.role === "employee" && userRole.venueId) {
    return <EmployeeDashboard user={user} venueId={userRole.venueId} />;
  }

  // No role assigned
  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <h2 className="text-2xl font-bold mb-4">Access Pending</h2>
          <p className="text-muted-foreground mb-6">Your account hasn't been assigned a role yet.</p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={async () => {
              const { data, error } = await supabase.rpc('bootstrap_admin');
              if (error) { toast.error(error.message); return; }
              if (data === true) { toast.success('Admin access granted.'); window.location.reload(); }
              else { toast.info('Contact an administrator.'); }
            }}>Grant Admin Access</Button>
            <Button variant="outline" onClick={async () => {
              try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
              navigate("/auth");
            }}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Role-based route guard helper
  const guard = (allowedRoles: readonly string[], element: React.ReactNode) => {
    if (!allowedRoles.includes(userRole.role)) return <Navigate to="/dashboard" replace />;
    return element;
  };

  return (
    <AppShell user={user} role={userRole.role}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={
          userRole.role === "club_incharge" ? <DailySummary /> : <DashboardHome user={user} role={userRole} />
        } />
        <Route path="/daily-summary" element={guard([...INCHARGE_ROLES], <DailySummary />)} />
        <Route path="/weekly-summary" element={guard([...INCHARGE_ROLES], <WeeklySummary />)} />
        <Route path="/club/:clubId" element={<ClubDetail />} />
        <Route path="/venue/:venueId" element={<VenueDetail />} />
        <Route path="/venue/:venueId/reports" element={<VenueReports />} />

        {/* Admin-only */}
        <Route path="/manage-employees" element={guard([...ADMIN_ONLY], <ManageEmployees />)} />

        {/* Admin + Club Incharge */}
        <Route path="/manage-venues" element={guard([...INCHARGE_ROLES], <ManageVenues />)} />
        <Route path="/manage-categories" element={guard([...INCHARGE_ROLES], <ManageCategories />)} />
        <Route path="/manage-flavours" element={guard([...INCHARGE_ROLES], <ManageFlavours />)} />
        <Route path="/attendance-report" element={guard([...INCHARGE_ROLES], <AttendanceReport />)} />
        <Route path="/counter-pictures" element={guard([...INCHARGE_ROLES], <CounterPictures />)} />
        <Route path="/roster/weekly" element={guard([...INCHARGE_ROLES], <WeeklyRoster />)} />
        <Route path="/roster/daily" element={guard([...INCHARGE_ROLES], <DailyRoster />)} />
        <Route path="/packet-dispatch" element={guard([...INCHARGE_ROLES], <PacketDispatch />)} />
        <Route path="/packet-dispatch/history" element={guard([...INCHARGE_ROLES], <DispatchHistory />)} />
        <Route path="/daily-report" element={guard([...INCHARGE_ROLES], <DailyClubReport />)} />
        <Route path="/inspections" element={guard([...INCHARGE_ROLES], <InspectionHistory />)} />
        <Route path="/inspections/new" element={guard([...INCHARGE_ROLES], <InspectionForm />)} />
        <Route path="/inspections/settings" element={guard([...INCHARGE_ROLES], <InspectionSettings />)} />
        <Route path="/staff-performance" element={guard([...INCHARGE_ROLES], <StaffPerformance />)} />
        <Route path="/accessories" element={guard([...INCHARGE_ROLES], <AccessoryTracker />)} />

        <Route path="/my-profile" element={<MyProfile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
};

export default AuthenticatedApp;
