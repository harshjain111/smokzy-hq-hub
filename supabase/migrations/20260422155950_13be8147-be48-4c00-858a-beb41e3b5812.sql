
-- Allow club_management to perform inspections in their assigned venues
CREATE POLICY "Club mgmt can manage venue inspections"
ON public.inspections
FOR ALL
TO authenticated
USING (
  is_club_management(auth.uid())
  AND venue_id IN (SELECT get_user_venues(auth.uid()))
)
WITH CHECK (
  is_club_management(auth.uid())
  AND venue_id IN (SELECT get_user_venues(auth.uid()))
  AND inspector_id = auth.uid()
);

CREATE POLICY "Club mgmt can manage venue inspection checks"
ON public.inspection_stock_checks
FOR ALL
TO authenticated
USING (
  is_club_management(auth.uid())
  AND inspection_id IN (
    SELECT id FROM public.inspections
    WHERE venue_id IN (SELECT get_user_venues(auth.uid()))
  )
)
WITH CHECK (
  is_club_management(auth.uid())
  AND inspection_id IN (
    SELECT id FROM public.inspections
    WHERE venue_id IN (SELECT get_user_venues(auth.uid()))
  )
);

CREATE POLICY "Club mgmt can manage venue violations"
ON public.staff_violations
FOR ALL
TO authenticated
USING (
  is_club_management(auth.uid())
  AND venue_id IN (SELECT get_user_venues(auth.uid()))
)
WITH CHECK (
  is_club_management(auth.uid())
  AND venue_id IN (SELECT get_user_venues(auth.uid()))
  AND reported_by = auth.uid()
);
