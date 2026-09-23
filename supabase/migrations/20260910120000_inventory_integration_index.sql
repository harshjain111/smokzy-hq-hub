-- Index to optimize the inventory integration endpoint query:
-- SELECT ... FROM stock WHERE category = 'flavour' ORDER BY venue_id, item_name
CREATE INDEX IF NOT EXISTS idx_stock_category_venue
  ON public.stock (category, venue_id, item_name)
  WHERE category = 'flavour';
