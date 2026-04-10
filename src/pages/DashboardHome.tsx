import { User } from "@supabase/supabase-js";
import { UserRole } from "@/hooks/useUserRole";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import ClubManagementDashboard from "@/components/dashboard/ClubManagementDashboard";

interface DashboardHomeProps {
  user: User;
  role: UserRole;
}

const DashboardHome = ({ user, role }: DashboardHomeProps) => {
  if (role.role === "admin") {
    return <AdminDashboard user={user} />;
  }

  if (role.role === "club_management") {
    return <ClubManagementDashboard user={user} venueIds={role.venueIds} />;
  }

  return (
    <div className="text-center py-12 text-muted-foreground">
      <p>No dashboard available for your role.</p>
    </div>
  );
};

export default DashboardHome;
