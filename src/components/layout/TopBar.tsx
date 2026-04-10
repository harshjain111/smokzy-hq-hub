import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun, Menu } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import smokzyLogo from "@/assets/smokzy-logo.png";

interface TopBarProps {
  user: User;
  pageTitle?: string;
  onMobileMenuClick?: () => void;
  showSidebarToggle?: boolean;
}

const TopBar = ({ user, pageTitle, onMobileMenuClick, showSidebarToggle }: TopBarProps) => {
  const navigate = useNavigate();
  const [profileName, setProfileName] = useState("");
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (data?.full_name) setProfileName(data.full_name);
    };
    fetchProfile();
  }, [user.id]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    toast.success("Logged out");
    navigate("/auth");
  };

  const getInitials = () => {
    if (profileName) return profileName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    return user.email?.slice(0, 2).toUpperCase() || "U";
  };

  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-card flex items-center px-4 gap-3 shadow-sm">
      {/* Mobile: hamburger */}
      {showSidebarToggle && (
        <Button variant="ghost" size="icon" className="md:hidden touch-target" onClick={onMobileMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Logo + page title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <img
          src={smokzyLogo}
          alt="Smokzy"
          className="h-8 w-auto object-contain hidden md:block cursor-pointer"
          onClick={() => navigate("/dashboard")}
          style={{ filter: "drop-shadow(0 1px 4px rgba(13, 148, 136, 0.25))" }}
        />
        {pageTitle && (
          <>
            <div className="hidden md:block w-px h-6 bg-border" />
            <h1 className="text-base font-semibold text-foreground truncate">{pageTitle}</h1>
          </>
        )}
        {!pageTitle && (
          <h1 className="text-base font-semibold text-foreground md:hidden">Smokzy</h1>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleDarkMode} className="touch-target">
          {darkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </Button>
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-card z-50" align="end">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{profileName || "User"}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/my-profile")}>My Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default TopBar;
