import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import ProfileMenu from "@/components/ProfileMenu";
import AdminSettingsMenu from "@/components/AdminSettingsMenu";
import smokzyLogo from "@/assets/smokzy-logo.png";
import LoadingSpinner from "@/components/LoadingSpinner";

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
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
              title="Go to Dashboard"
              className="hover:bg-secondary"
            >
              <Home className="h-5 w-5" />
            </Button>
            <img 
              src={smokzyLogo} 
              alt="Smokzy" 
              className="h-10 w-auto object-contain"
            />
            <div className="border-l pl-3 ml-1">
              <h1 className="text-xl font-semibold text-foreground">
                {title || "Operations"}
              </h1>
              <p className="text-xs text-muted-foreground">
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
