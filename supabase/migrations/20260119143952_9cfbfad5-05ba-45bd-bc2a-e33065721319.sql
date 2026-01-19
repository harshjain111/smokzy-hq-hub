-- Create venue_settings table for per-venue configuration
CREATE TABLE public.venue_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  morning_cutoff_hour INTEGER NOT NULL DEFAULT 10, -- e.g. 10 AM
  force_close_hour INTEGER NOT NULL DEFAULT 7, -- e.g. 7 AM next day
  core_hours_start INTEGER NOT NULL DEFAULT 18, -- e.g. 6 PM
  core_hours_end INTEGER NOT NULL DEFAULT 4, -- e.g. 4 AM
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(venue_id)
);

-- Create club_sessions table for session tracking
CREATE TABLE public.club_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  session_date DATE NOT NULL, -- The business date this session represents
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'force_closed')),
  stock_submitted BOOLEAN NOT NULL DEFAULT false,
  stock_submitted_by UUID,
  stock_submitted_at TIMESTAMP WITH TIME ZONE,
  sales_submitted BOOLEAN NOT NULL DEFAULT false,
  sales_submitted_by UUID,
  sales_submitted_at TIMESTAMP WITH TIME ZONE,
  photo_uploaded BOOLEAN NOT NULL DEFAULT false,
  photo_uploaded_by UUID,
  photo_uploaded_at TIMESTAMP WITH TIME ZONE,
  force_close_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(venue_id, session_date)
);

-- Create staff_attendance_blocks for multiple check-in/out per session
CREATE TABLE public.staff_attendance_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.club_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  check_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_in_lat NUMERIC NOT NULL,
  check_in_lng NUMERIC NOT NULL,
  check_in_selfie_url TEXT NOT NULL,
  check_out_time TIMESTAMP WITH TIME ZONE,
  check_out_lat NUMERIC,
  check_out_lng NUMERIC,
  check_out_selfie_url TEXT,
  is_break BOOLEAN NOT NULL DEFAULT false, -- true if "NO, I will return"
  duty_completed BOOLEAN, -- null = not checked out yet, true = YES, false = NO
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.venue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance_blocks ENABLE ROW LEVEL SECURITY;

-- RLS for venue_settings
CREATE POLICY "Admins can manage venue settings" ON public.venue_settings FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Employees can view their venue settings" ON public.venue_settings FOR SELECT USING (venue_id = get_user_venue(auth.uid()));

-- RLS for club_sessions
CREATE POLICY "Admins can manage all sessions" ON public.club_sessions FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Employees can view their venue sessions" ON public.club_sessions FOR SELECT USING (venue_id = get_user_venue(auth.uid()));
CREATE POLICY "Employees can insert sessions for their venue" ON public.club_sessions FOR INSERT WITH CHECK (venue_id = get_user_venue(auth.uid()));
CREATE POLICY "Employees can update their venue sessions" ON public.club_sessions FOR UPDATE USING (venue_id = get_user_venue(auth.uid())) WITH CHECK (venue_id = get_user_venue(auth.uid()));

-- RLS for staff_attendance_blocks
CREATE POLICY "Admins can view all attendance blocks" ON public.staff_attendance_blocks FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Employees can view their own attendance blocks" ON public.staff_attendance_blocks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Employees can insert their own attendance blocks" ON public.staff_attendance_blocks FOR INSERT WITH CHECK ((user_id = auth.uid()) AND (venue_id = get_user_venue(auth.uid())));
CREATE POLICY "Employees can update their own attendance blocks" ON public.staff_attendance_blocks FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Enable realtime for sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_attendance_blocks;

-- Create trigger for updated_at
CREATE TRIGGER update_venue_settings_updated_at BEFORE UPDATE ON public.venue_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_club_sessions_updated_at BEFORE UPDATE ON public.club_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();