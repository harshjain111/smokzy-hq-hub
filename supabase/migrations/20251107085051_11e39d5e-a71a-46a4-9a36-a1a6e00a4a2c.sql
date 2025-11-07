-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

-- Create enum for hookah categories
CREATE TYPE public.hookah_category AS ENUM ('premium', 'standard', 'budget');

-- Create venues table
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, venue_id)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in_selfie_url TEXT NOT NULL,
  check_in_lat DECIMAL(10, 8) NOT NULL,
  check_in_lng DECIMAL(11, 8) NOT NULL,
  check_out_time TIMESTAMPTZ,
  check_out_selfie_url TEXT,
  check_out_lat DECIMAL(10, 8),
  check_out_lng DECIMAL(11, 8),
  tasks_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create stock table
CREATE TABLE public.stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  flavour_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  unit TEXT NOT NULL DEFAULT 'packets',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(venue_id, flavour_name)
);

-- Create hookah pots table
CREATE TABLE public.hookah_pots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  total_pots INTEGER NOT NULL DEFAULT 0,
  working_pots INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create breakage reports table
CREATE TABLE public.breakage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  reported_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cause TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sales reports table
CREATE TABLE public.sales_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  reported_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hookah_category hookah_category NOT NULL,
  quantity_sold INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(venue_id, report_date, hookah_category)
);

-- Create closing photos table
CREATE TABLE public.closing_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  photo_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('closing-photos', 'closing-photos', false);

-- Enable RLS on all tables
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hookah_pots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breakage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_photos ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1 AND role = 'admin'
  )
$$;

-- Create function to get user venue
CREATE OR REPLACE FUNCTION public.get_user_venue(user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT venue_id FROM public.user_roles
  WHERE user_roles.user_id = $1 AND role = 'employee'
  LIMIT 1
$$;

-- RLS Policies for venues
CREATE POLICY "Admins can view all venues"
  ON public.venues FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Employees can view their venue"
  ON public.venues FOR SELECT
  TO authenticated
  USING (id = public.get_user_venue(auth.uid()));

CREATE POLICY "Admins can manage venues"
  ON public.venues FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- RLS Policies for attendance
CREATE POLICY "Admins can view all attendance"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Employees can view their own attendance"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Employees can insert their own attendance"
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND venue_id = public.get_user_venue(auth.uid()));

CREATE POLICY "Employees can update their own attendance"
  ON public.attendance FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for stock
CREATE POLICY "Admins can manage all stock"
  ON public.stock FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Employees can view their venue stock"
  ON public.stock FOR SELECT
  TO authenticated
  USING (venue_id = public.get_user_venue(auth.uid()));

CREATE POLICY "Employees can update their venue stock"
  ON public.stock FOR UPDATE
  TO authenticated
  USING (venue_id = public.get_user_venue(auth.uid()))
  WITH CHECK (venue_id = public.get_user_venue(auth.uid()));

-- RLS Policies for hookah_pots
CREATE POLICY "Admins can manage all pots"
  ON public.hookah_pots FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Employees can view their venue pots"
  ON public.hookah_pots FOR SELECT
  TO authenticated
  USING (venue_id = public.get_user_venue(auth.uid()));

CREATE POLICY "Employees can update their venue pots"
  ON public.hookah_pots FOR UPDATE
  TO authenticated
  USING (venue_id = public.get_user_venue(auth.uid()))
  WITH CHECK (venue_id = public.get_user_venue(auth.uid()));

-- RLS Policies for breakage_reports
CREATE POLICY "Admins can view all breakage reports"
  ON public.breakage_reports FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Employees can view their venue breakage reports"
  ON public.breakage_reports FOR SELECT
  TO authenticated
  USING (venue_id = public.get_user_venue(auth.uid()));

CREATE POLICY "Employees can insert breakage reports for their venue"
  ON public.breakage_reports FOR INSERT
  TO authenticated
  WITH CHECK (reported_by = auth.uid() AND venue_id = public.get_user_venue(auth.uid()));

-- RLS Policies for sales_reports
CREATE POLICY "Admins can view all sales reports"
  ON public.sales_reports FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Employees can view their venue sales reports"
  ON public.sales_reports FOR SELECT
  TO authenticated
  USING (venue_id = public.get_user_venue(auth.uid()));

CREATE POLICY "Employees can insert sales reports for their venue"
  ON public.sales_reports FOR INSERT
  TO authenticated
  WITH CHECK (reported_by = auth.uid() AND venue_id = public.get_user_venue(auth.uid()));

CREATE POLICY "Employees can update their venue sales reports"
  ON public.sales_reports FOR UPDATE
  TO authenticated
  USING (venue_id = public.get_user_venue(auth.uid()) AND reported_by = auth.uid())
  WITH CHECK (venue_id = public.get_user_venue(auth.uid()) AND reported_by = auth.uid());

-- RLS Policies for closing_photos
CREATE POLICY "Admins can view all closing photos"
  ON public.closing_photos FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Employees can view their venue closing photos"
  ON public.closing_photos FOR SELECT
  TO authenticated
  USING (venue_id = public.get_user_venue(auth.uid()));

CREATE POLICY "Employees can insert closing photos for their venue"
  ON public.closing_photos FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND venue_id = public.get_user_venue(auth.uid()));

-- Storage policies for attendance photos
CREATE POLICY "Users can upload their own attendance photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attendance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own attendance photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attendance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all attendance photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attendance-photos' AND public.is_admin(auth.uid()));

-- Storage policies for closing photos
CREATE POLICY "Users can upload closing photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'closing-photos');

CREATE POLICY "Users can view closing photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'closing-photos');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stock_updated_at BEFORE UPDATE ON public.stock FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_hookah_pots_updated_at BEFORE UPDATE ON public.hookah_pots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();