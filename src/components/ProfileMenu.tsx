import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon, Calendar, LogOut, FileText, Download } from "lucide-react";
import { AppRole } from "@/hooks/useUserRole";
import { usePWAInstall } from "@/hooks/usePWAInstall";

interface ProfileMenuProps {
  user: User;
  role: AppRole;
}

const ProfileMenu = ({ user, role }: ProfileMenuProps) => {
  const navigate = useNavigate();
  const [profileName, setProfileName] = useState<string>("");
  const { isInstallable, install } = usePWAInstall();

  useEffect(() => {
    fetchProfile();
  }, [user.id]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    if (data?.full_name) {
      setProfileName(data.full_name);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn("Sign out error (ignored):", e);
    }
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const getInitials = () => {
    if (profileName) {
      const names = profileName.split(" ");
      return names.map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return user.email?.slice(0, 2).toUpperCase() || "U";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            {profileName && (
              <AvatarImage src={`https://fqtfmhlevdhaitkyoyzr.supabase.co/storage/v1/object/public/avatars/${user.id}/avatar.jpg`} alt={profileName} />
            )}
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-background z-50" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{profileName || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/my-profile")}>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>My Profile</span>
        </DropdownMenuItem>
        {role === "employee" && (
          <>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/attendance-report")}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Attendance Report</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <FileText className="mr-2 h-4 w-4" />
              <span>My Reports</span>
            </DropdownMenuItem>
          </>
        )}
        {isInstallable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-primary font-medium" onClick={install}>
              <Download className="mr-2 h-4 w-4" />
              <span>Install Club App</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileMenu;
