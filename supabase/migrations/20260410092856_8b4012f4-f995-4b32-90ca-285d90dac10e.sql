CREATE OR REPLACE FUNCTION public.get_user_venues(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT v.id
  FROM public.venues v
  WHERE EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role = 'club_management'
      AND ur.venue_id IS NULL
  )
  UNION
  SELECT ur.venue_id
  FROM public.user_roles ur
  WHERE ur.user_id = p_user_id
    AND ur.venue_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.get_user_venue(user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ur.venue_id
  FROM public.user_roles ur
  WHERE ur.user_id = $1
    AND ur.role = 'employee'
    AND ur.venue_id IS NOT NULL
  LIMIT 1
$$;