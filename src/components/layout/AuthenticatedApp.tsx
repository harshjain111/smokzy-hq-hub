import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import AppShell from "./AppShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const EmployeeDashboard = lazy(() => import("@/components/dashboard/EmployeeDashboard"));
const DashboardHome = lazy(() => import("@/pages/DashboardHome"));
const DailySummary = lazy(() => import("@/pages/DailySummary"));
const WeeklySummary = lazy(() => import("@/pages/WeeklySummary"));
const ClubDetail = lazy(() => import("@/pages/ClubDetail"));
const VenueDetail = lazy(() => import("@/pages/VenueDetail"));
const VenueReports = lazy(() => import("@/pages/VenueReports"));
const ManageVenues = lazy(() => import("@/pages/ManageVenues"));
const ManageEmployees = lazy(() => import("@/pages/ManageEmployees"));
const ManageCategories = lazy(() => import("@/pages/ManageCategories"));
const ManageFlavours = lazy(() => import("@/pages/ManageFlavours"));
const AttendanceReport = lazy(() => import("@/pages/AttendanceReport"));
const CounterPictures = lazy(() => import("@/pages/CounterPictures"));
const WeeklyRoster = lazy(() => import("@/pages/WeeklyRoster"));
const DailyRoster = lazy(() => import("@/pages/DailyRoster"));
const PacketDispatch = lazy(() => import("@/pages/PacketDispatch"));
const DispatchHistory = lazy(() => import("@/pages/DispatchHistory"));
const DailyClubReport = lazy(() => import("@/pages/DailyClubReport"));
const InspectionForm = lazy(() => import("@/pages/InspectionForm"));
const InspectionHistory = lazy(() => import("@/pages/InspectionHistory"));
const StaffPerformance = lazy(() => import("@/pages/StaffPerformance"));
const AccessoryTracker = lazy(() => import("@/pages/AccessoryTracker"));
const InspectionSettings = lazy(() => import("@/pages/InspectionSettings"));
const MyProfile = lazy(() => import("@/pages/MyProfile"));
const NotFound = lazy(() => import("@/pages/NotFound"));

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
      <Suspense fallback={<LoadingSpinner />}>
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

          <Route path="/manage-employees" element={guard([...ADMIN_ONLY], <ManageEmployees />)} />

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
      </Suspense>
    </AppShell>
  );
};

export default AuthenticatedApp;
