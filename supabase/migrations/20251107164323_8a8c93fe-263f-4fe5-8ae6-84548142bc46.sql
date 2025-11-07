-- Add unique constraint to stock table for upsert operations
ALTER TABLE public.stock
ADD CONSTRAINT stock_venue_flavour_unique UNIQUE (venue_id, flavour_name);

-- Add unique constraint to user_roles if not exists (for potential upserts)
-- Note: The table already has a unique constraint on (user_id, role) based on the schema