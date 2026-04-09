-- Add photo_url column to inspections table for inspection photos
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS photo_url text;

-- Add violation_noted column to track if a violation was found during inspection
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS violation_noted boolean NOT NULL DEFAULT false;

-- Add score column (percentage out of total checks)
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS score integer;