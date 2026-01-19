import { User } from "@supabase/supabase-js";
import { useAdminStats } from "@/hooks/useAdminStats";
import { KPIStrip } from "@/components/admin/KPIStrip";
import { ClubGrid } from "@/components/admin/ClubGrid";
import AdminNotifications from "./admin/AdminNotifications";

interface AdminDashboardProps {
  user: User;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const { kpis, clubs, loading } = useAdminStats();

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Admin Notifications */}
      <AdminNotifications />

      {/* KPI Strip */}
      <KPIStrip kpis={kpis} loading={loading} />

      {/* Club Tiles Grid */}
      <ClubGrid clubs={clubs} loading={loading} />
    </div>
  );
};

export default AdminDashboard;
