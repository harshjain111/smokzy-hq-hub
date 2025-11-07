-- Ensure ON CONFLICT works for bootstrap_admin by adding a unique index
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_unique_idx
  ON public.user_roles(user_id, role);

-- Address linter warning: set search_path on timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;