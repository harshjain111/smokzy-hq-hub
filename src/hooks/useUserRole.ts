import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "employee" | "club_management" | "club_incharge";

export interface UserRole {
  role: AppRole;
  venueId: string | null;
  venueIds: string[]; // For club_management who can have multiple venues
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

    setLoading(true);
    let cancelled = false;

    const fetchUserRole = async (attempt = 1) => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role, venue_id")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching user role:", error);
          if (attempt < 3 && !cancelled) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
            return fetchUserRole(attempt + 1);
          }
          setUserRole(null);
        } else if (data && data.length > 0) {
          const adminRole = data.find(r => r.role === 'admin');
          const clubInchargeRole = data.find(r => r.role === 'club_incharge');
          const clubMgmtRoles = data.filter(r => r.role === 'club_management');
          const employeeRole = data.find(r => r.role === 'employee');

          if (adminRole) {
            setUserRole({
              role: 'admin',
              venueId: adminRole.venue_id,
              venueIds: data.filter(r => r.venue_id).map(r => r.venue_id as string),
            });
          } else if (clubInchargeRole) {
            setUserRole({
              role: 'club_incharge',
              venueId: null,
              venueIds: [],
            });
          } else if (clubMgmtRoles.length > 0) {
            const scopedVenueIds = clubMgmtRoles
              .map((r) => r.venue_id)
              .filter((venueId): venueId is string => Boolean(venueId));

            setUserRole({
              role: 'club_management',
              venueId: scopedVenueIds[0] ?? null,
              venueIds: scopedVenueIds,
            });
          } else if (employeeRole) {
            setUserRole({
              role: 'employee',
              venueId: employeeRole.venue_id,
              venueIds: employeeRole.venue_id ? [employeeRole.venue_id] : [],
            });
          } else {
            setUserRole(null);
          }
        } else {
          setUserRole(null);
        }
      } catch (err) {
        console.error("Failed to fetch user role:", err);
        setUserRole(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUserRole();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { userRole, loading };
};
