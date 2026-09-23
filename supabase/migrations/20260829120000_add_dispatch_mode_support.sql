-- Dispatch mode (packet vs weight) support: extend packet_dispatches with a
-- free-form recipient name, an optional photo, and a per-row unit snapshot
-- so historical dispatches stay unambiguous if the global mode is changed
-- later.

ALTER TABLE public.packet_dispatches
  ADD COLUMN IF NOT EXISTS received_by_name text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'packets';

-- Storage bucket for dispatch handover photos (private; admin/club_incharge only,
-- same audience as packet_dispatches itself).
INSERT INTO storage.buckets (id, name, public)
VALUES ('dispatch-photos', 'dispatch-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can manage dispatch photos"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'dispatch-photos' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'dispatch-photos' AND public.is_admin(auth.uid()));

CREATE POLICY "Club incharge can manage dispatch photos"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'dispatch-photos' AND public.is_club_incharge(auth.uid()))
WITH CHECK (bucket_id = 'dispatch-photos' AND public.is_club_incharge(auth.uid()));
