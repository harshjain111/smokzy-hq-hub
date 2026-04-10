import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import LoadingSpinner from "@/components/LoadingSpinner";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
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
  if (!userRole || !allowedRoles.includes(userRole.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default RoleGuard;
