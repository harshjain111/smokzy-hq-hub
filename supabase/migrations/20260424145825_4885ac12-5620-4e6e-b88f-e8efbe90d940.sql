
-- Allow any authenticated user who is the inspector to submit inspections
-- This fixes RLS errors when club_management or other authorized inspectors submit
CREATE POLICY "Authenticated inspectors can insert inspections"
ON public.inspections
FOR INSERT
TO authenticated
WITH CHECK (inspector_id = auth.uid());

CREATE POLICY "Authenticated inspectors can view their inspections"
ON public.inspections
FOR SELECT
TO authenticated
USING (inspector_id = auth.uid());

-- Allow inspectors to insert spot checks for inspections they own
CREATE POLICY "Inspectors can insert their stock checks"
ON public.inspection_stock_checks
FOR INSERT
TO authenticated
WITH CHECK (
  inspection_id IN (
    SELECT id FROM public.inspections WHERE inspector_id = auth.uid()
  )
);

CREATE POLICY "Inspectors can view their stock checks"
ON public.inspection_stock_checks
FOR SELECT
TO authenticated
USING (
  inspection_id IN (
    SELECT id FROM public.inspections WHERE inspector_id = auth.uid()
  )
);

-- Allow any authenticated user who is the reporter to log staff violations
CREATE POLICY "Authenticated reporters can insert violations"
ON public.staff_violations
FOR INSERT
TO authenticated
WITH CHECK (reported_by = auth.uid());
