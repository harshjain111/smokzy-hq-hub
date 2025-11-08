import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";
import ProfileMenu from "@/components/ProfileMenu";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [venueName, setVenueName] = useState<string>("");
  const { userRole, loading } = useUserRole(user);

  useEffect(() => {
    if (userRole?.venueId) {
      fetchVenueName(userRole.venueId);
    }
  }, [userRole?.venueId]);

  const fetchVenueName = async (venueId: string) => {
    const { data } = await supabase
      .from("venues")
      .select("name")
      .eq("id", venueId)
      .single();

    if (data?.name) {
      setVenueName(data.name);
    }
  };

  useEffect(() => {
    // Check session first before rendering anything
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const handleBootstrapAdmin = async () => {
    const { data, error } = await supabase.rpc('bootstrap_admin');
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data === true) {
      toast.success('Admin access granted. Reloading...');
      window.location.reload();
    } else {
      toast.info('Setup already completed. Please contact an administrator.');
    }
  };

  // Show loading while initializing or fetching role
  if (initializing || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <h2 className="text-2xl font-bold mb-4">Access Pending</h2>
          <p className="text-muted-foreground mb-6">
            Your account hasn't been assigned a role yet. If this is the first time setup, you can grant yourself admin access.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={handleBootstrapAdmin}>
              Grant Admin Access
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-primary">Smokzy Operations</h1>
            <p className="text-sm text-muted-foreground">
              {userRole.role === "admin" ? "Admin Dashboard" : venueName || "Loading..."}
            </p>
          </div>
          <ProfileMenu user={user!} role={userRole.role} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {userRole.role === "admin" ? (
          <AdminDashboard user={user!} />
        ) : (
          <EmployeeDashboard user={user!} venueId={userRole.venueId!} />
        )}
      </main>
    </div>
  );
};

export default Dashboard;