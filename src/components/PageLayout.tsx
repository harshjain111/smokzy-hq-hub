import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import ProfileMenu from "@/components/ProfileMenu";
import AdminSettingsMenu from "@/components/AdminSettingsMenu";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

const PageLayout = ({ children, title, subtitle }: PageLayoutProps) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [venueName, setVenueName] = useState<string>("");
  const { userRole, loading } = useUserRole(user);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
              title="Go to Dashboard"
            >
              <Home className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">
                {title || "Smokzy Operations"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {subtitle || (userRole?.role === "admin" ? "Multi-Venue Management" : venueName || "Loading...")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userRole?.role === "admin" && <AdminSettingsMenu />}
            {user && <ProfileMenu user={user} role={userRole?.role || "employee"} />}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default PageLayout;
