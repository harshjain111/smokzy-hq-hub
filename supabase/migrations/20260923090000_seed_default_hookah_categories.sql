-- Seed 4 default hookah pot categories for all existing venues.
-- Staff can edit or delete these per venue as needed.

INSERT INTO public.venue_hookah_categories (venue_id, category_name)
SELECT v.id, c.name
FROM public.venues v
CROSS JOIN (VALUES
  ('Normal Pot Normal Flavour'),
  ('Normal Pot Premium Flavour'),
  ('Premium Pot Normal Flavour'),
  ('Premium Pot Premium Flavour')
) AS c(name)
ON CONFLICT (venue_id, category_name) DO NOTHING;
