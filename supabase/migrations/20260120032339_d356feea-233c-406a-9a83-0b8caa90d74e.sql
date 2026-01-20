-- Create a function to check if user is club management
CREATE OR REPLACE FUNCTION public.is_club_management(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = p_user_id AND role = 'club_management'
  )
$$;

-- Create a function to get club management user's venues (can have multiple)
CREATE OR REPLACE FUNCTION public.get_user_venues(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT venue_id FROM public.user_roles
  WHERE user_id = p_user_id AND venue_id IS NOT NULL
$$;

-- Add RLS policies for club_management role

-- Venues: Club management can view their assigned venues
CREATE POLICY "Club management can view their venues"
ON public.venues FOR SELECT
USING (id IN (SELECT get_user_venues(auth.uid())));

-- Club sessions: Club management can view their venue sessions
CREATE POLICY "Club management can view their venue sessions"
ON public.club_sessions FOR SELECT
USING (venue_id IN (SELECT get_user_venues(auth.uid())));

-- Staff attendance blocks: Club management can view attendance for their venues
CREATE POLICY "Club management can view venue attendance"
ON public.staff_attendance_blocks FOR SELECT
USING (venue_id IN (SELECT get_user_venues(auth.uid())));

-- Staff breaks: Club management can view breaks for their venues
CREATE POLICY "Club management can view venue breaks"
ON public.staff_breaks FOR SELECT
USING (venue_id IN (SELECT get_user_venues(auth.uid())));

-- Sales reports: Club management can view sales for their venues
CREATE POLICY "Club management can view venue sales"
ON public.sales_reports FOR SELECT
USING (venue_id IN (SELECT get_user_venues(auth.uid())));

-- Venue hookah categories: Club management can view categories for their venues
CREATE POLICY "Club management can view venue categories"
ON public.venue_hookah_categories FOR SELECT
USING (venue_id IN (SELECT get_user_venues(auth.uid())));

-- Venue settings: Club management can view settings for their venues
CREATE POLICY "Club management can view their venue settings"
ON public.venue_settings FOR SELECT
USING (venue_id IN (SELECT get_user_venues(auth.uid())));