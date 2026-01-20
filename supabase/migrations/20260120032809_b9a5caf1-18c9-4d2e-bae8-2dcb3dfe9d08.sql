-- Create table to track KOT entries (both uploads and declarations)
CREATE TABLE public.kot_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.club_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('photo', 'no_kot_declared')),
  -- For photo entries
  photo_url TEXT,
  -- For no_kot_declared entries
  declaration_reason TEXT CHECK (
    declaration_reason IS NULL OR 
    declaration_reason IN ('club_denied_kot', 'kot_not_provided', 'system_issue', 'other')
  ),
  declaration_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kot_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Admins can view all KOT entries
CREATE POLICY "Admins can view all KOT entries"
ON public.kot_entries FOR SELECT
USING (is_admin(auth.uid()));

-- Employees can insert KOT entries for their venue
CREATE POLICY "Employees can insert KOT entries"
ON public.kot_entries FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND 
  venue_id = get_user_venue(auth.uid())
);

-- Employees can view their venue's KOT entries
CREATE POLICY "Employees can view venue KOT entries"
ON public.kot_entries FOR SELECT
USING (venue_id = get_user_venue(auth.uid()));

-- Club management can view their venue KOT entries
CREATE POLICY "Club management can view venue KOT entries"
ON public.kot_entries FOR SELECT
USING (venue_id IN (SELECT get_user_venues(auth.uid())));

-- Create index for faster queries
CREATE INDEX idx_kot_entries_session ON public.kot_entries(session_id);
CREATE INDEX idx_kot_entries_venue_date ON public.kot_entries(venue_id, created_at);