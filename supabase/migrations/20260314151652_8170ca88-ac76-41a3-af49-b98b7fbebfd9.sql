
-- Admin can INSERT attendance blocks for any user
CREATE POLICY "Admins can insert attendance blocks"
ON public.staff_attendance_blocks
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Admin can UPDATE any attendance block
CREATE POLICY "Admins can update all attendance blocks"
ON public.staff_attendance_blocks
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Admin can DELETE any attendance block
CREATE POLICY "Admins can delete attendance blocks"
ON public.staff_attendance_blocks
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));
