-- Add 'club_management' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'club_management';