-- Add early checkout columns to attendance table
ALTER TABLE public.attendance 
ADD COLUMN early_checkout BOOLEAN DEFAULT false,
ADD COLUMN early_checkout_reason TEXT;

-- Create a table for admin notifications about early checkouts
CREATE TABLE public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  venue_id UUID REFERENCES public.venues(id),
  user_id UUID NOT NULL,
  attendance_id UUID REFERENCES public.attendance(id),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admin can view all notifications
CREATE POLICY "Admins can view all notifications"
ON public.admin_notifications
FOR SELECT
USING (is_admin(auth.uid()));

-- Admin can update notifications (mark as read)
CREATE POLICY "Admins can update notifications"
ON public.admin_notifications
FOR UPDATE
USING (is_admin(auth.uid()));

-- Employees can insert notifications
CREATE POLICY "Employees can insert notifications"
ON public.admin_notifications
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Enable realtime for admin notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;