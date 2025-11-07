-- Create table for venue-specific hookah categories
CREATE TABLE public.venue_hookah_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(venue_id, category_name)
);

-- Enable RLS
ALTER TABLE public.venue_hookah_categories ENABLE ROW LEVEL SECURITY;

-- Admins can manage all categories
CREATE POLICY "Admins can manage venue hookah categories"
ON public.venue_hookah_categories
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Employees can view their venue categories
CREATE POLICY "Employees can view their venue hookah categories"
ON public.venue_hookah_categories
FOR SELECT
USING (venue_id = get_user_venue(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_venue_hookah_categories_updated_at
BEFORE UPDATE ON public.venue_hookah_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();