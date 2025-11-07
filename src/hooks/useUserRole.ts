import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export interface UserRole {
  role: "admin" | "employee";
  venueId: string | null;
}

export const useUserRole = (user: User | null) => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      setLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, venue_id")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user role:", error);
        setUserRole(null);
      } else {
        setUserRole({
          role: data.role as "admin" | "employee",
          venueId: data.venue_id,
        });
      }
      setLoading(false);
    };

    fetchUserRole();
  }, [user]);

  return { userRole, loading };
};