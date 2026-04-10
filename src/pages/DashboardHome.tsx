import { lazy, Suspense } from "react";
import { User } from "@supabase/supabase-js";
import { UserRole } from "@/hooks/useUserRole";
import LoadingSpinner from "@/components/LoadingSpinner";

const AdminDashboard = lazy(() => import("@/components/dashboard/AdminDashboard"));
const ClubManagementDashboard = lazy(() => import("@/components/dashboard/ClubManagementDashboard"));

interface DashboardHomeProps {
  user: User;
  role: UserRole;
}

const DashboardHome = ({ user, role }: DashboardHomeProps) => {
  if (role.role === "admin") {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <AdminDashboard user={user} />
      </Suspense>
    );
  }

  if (role.role === "club_management") {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <ClubManagementDashboard user={user} venueIds={role.venueIds} />
      </Suspense>
    );
  }

  return (
    <div className="text-center py-12 text-muted-foreground">
      <p>No dashboard available for your role.</p>
    </div>
  );
};

export default DashboardHome;
