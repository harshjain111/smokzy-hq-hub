-- Normalized per-item inspection results (category, tri-state status, reason/notes/photos).
-- Additive only: the existing fixed boolean columns on `inspections` are left untouched;
-- new inspections simply stop populating them (nothing else in the app reads them).
CREATE TABLE public.inspection_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_label text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  status text NOT NULL CHECK (status IN ('pass', 'attention', 'fail')),
  reason text,
  notes text,
  photo_urls text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage inspection items" ON public.inspection_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Club incharge can manage inspection items" ON public.inspection_items FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club mgmt can view venue inspection items" ON public.inspection_items FOR SELECT TO authenticated
  USING (inspection_id IN (
    SELECT id FROM public.inspections WHERE venue_id IN (SELECT public.get_user_venues(auth.uid()))
  ));

CREATE INDEX idx_inspection_items_inspection ON public.inspection_items(inspection_id);
CREATE INDEX idx_inspection_items_key ON public.inspection_items(item_key);
