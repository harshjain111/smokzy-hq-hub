import { User } from "@supabase/supabase-js";
import StaffPortal from "@/components/staff/StaffPortal";

interface EmployeeDashboardProps {
  user: User;
  venueId: string;
}

const EmployeeDashboard = ({ user, venueId }: EmployeeDashboardProps) => {
  return <StaffPortal user={user} venueId={venueId} />;
};

export default EmployeeDashboard;