-- Seed default flavours into the flavours catalogue and
-- auto-populate every venue's stock with these flavours (quantity 0, editable by staff).

-- 1. Insert flavours (skip if already present)
INSERT INTO public.flavours (name) VALUES
  ('Paan Kiwi Mint'),
  ('Hangover'),
  ('Black Magic'),
  ('Dubai Special'),
  ('Kiwi Springwater'),
  ('Blueberry Blast'),
  ('Grape Mint'),
  ('Sea Breeze'),
  ('Lady Love'),
  ('Love 66'),
  ('Stardust'),
  ('Berlin Night'),
  ('The One'),
  ('Havana'),
  ('Paan Mango'),
  ('Golden Hour'),
  ('Exotic')
ON CONFLICT (name) DO NOTHING;

-- 2. For every existing venue, create a stock record for each flavour
--    with quantity 0 so staff can update it. Skip if already tracked.
INSERT INTO public.stock (venue_id, item_name, quantity, category)
SELECT v.id, f.name, 0, 'flavour'
FROM public.venues v
CROSS JOIN public.flavours f
WHERE f.name IN (
  'Paan Kiwi Mint', 'Hangover', 'Black Magic', 'Dubai Special',
  'Kiwi Springwater', 'Blueberry Blast', 'Grape Mint', 'Sea Breeze',
  'Lady Love', 'Love 66', 'Stardust', 'Berlin Night',
  'The One', 'Havana', 'Paan Mango', 'Golden Hour', 'Exotic'
)
ON CONFLICT (venue_id, item_name, category) DO NOTHING;
