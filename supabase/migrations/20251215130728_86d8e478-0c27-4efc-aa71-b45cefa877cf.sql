-- Add KOT photo URL column to sales_reports
ALTER TABLE public.sales_reports 
ADD COLUMN kot_photo_url text;

-- Create storage bucket for KOT photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('kot-photos', 'kot-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for KOT photos
CREATE POLICY "Employees can upload their own kot photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kot-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Employees can view kot photos from their venue"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kot-photos'
);

CREATE POLICY "Admins can view all kot photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kot-photos' 
  AND public.is_admin(auth.uid())
);