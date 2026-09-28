-- Change default stock unit from 'packets' to 'grams' for all venues.
ALTER TABLE public.stock ALTER COLUMN unit SET DEFAULT 'grams';
