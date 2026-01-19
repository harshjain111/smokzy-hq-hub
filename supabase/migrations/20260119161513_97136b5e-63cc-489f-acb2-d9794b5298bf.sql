-- Create staff_breaks table to track individual breaks within a session
CREATE TABLE public.staff_breaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_block_id UUID NOT NULL REFERENCES public.staff_attendance_blocks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.club_sessions(id) ON DELETE CASCADE,
  break_start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  break_end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_breaks ENABLE ROW LEVEL SECURITY;

-- RLS policies for staff_breaks
CREATE POLICY "Users can view their own breaks"
ON public.staff_breaks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own breaks"
ON public.staff_breaks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own breaks"
ON public.staff_breaks
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all breaks
CREATE POLICY "Admins can view all breaks"
ON public.staff_breaks
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_staff_breaks_attendance_block ON public.staff_breaks(attendance_block_id);
CREATE INDEX idx_staff_breaks_user_session ON public.staff_breaks(user_id, session_id);

-- Enable realtime for staff_breaks
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_breaks;