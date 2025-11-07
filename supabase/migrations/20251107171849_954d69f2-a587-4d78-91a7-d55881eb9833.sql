-- Add category enum for stock items
CREATE TYPE public.stock_category AS ENUM ('flavour', 'hookah_pots', 'accessories');

-- Add category column to stock table
ALTER TABLE public.stock 
ADD COLUMN category public.stock_category NOT NULL DEFAULT 'flavour';

-- Update the unique constraint to include category
ALTER TABLE public.stock 
DROP CONSTRAINT IF EXISTS stock_venue_id_flavour_name_key;

ALTER TABLE public.stock 
ADD CONSTRAINT stock_venue_id_item_unique UNIQUE (venue_id, flavour_name, category);

-- Rename flavour_name to item_name for clarity
ALTER TABLE public.stock 
RENAME COLUMN flavour_name TO item_name;

-- Allow employees to insert stock items for their venue
CREATE POLICY "Employees can insert their venue stock" 
ON public.stock 
FOR INSERT 
WITH CHECK (venue_id = get_user_venue(auth.uid()));