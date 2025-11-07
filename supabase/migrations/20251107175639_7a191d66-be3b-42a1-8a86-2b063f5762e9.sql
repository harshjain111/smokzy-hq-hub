-- Fix sales_reports to use category_id instead of enum
-- First, add a new column for the category reference
ALTER TABLE sales_reports 
ADD COLUMN category_id UUID REFERENCES venue_hookah_categories(id);

-- Drop the old enum column (after adding the new one)
ALTER TABLE sales_reports 
DROP COLUMN hookah_category;

-- Make category_id NOT NULL
ALTER TABLE sales_reports 
ALTER COLUMN category_id SET NOT NULL;