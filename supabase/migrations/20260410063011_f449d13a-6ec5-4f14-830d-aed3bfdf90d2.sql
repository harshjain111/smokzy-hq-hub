
-- Add link and priority columns to admin_notifications
ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

-- Allow club incharge to update notifications (mark as read)
CREATE POLICY "Club incharge can update notifications"
ON public.admin_notifications
FOR UPDATE
TO authenticated
USING (is_club_incharge(auth.uid()));
