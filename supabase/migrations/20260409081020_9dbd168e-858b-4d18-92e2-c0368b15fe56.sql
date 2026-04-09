
-- 1. Create is_club_incharge security definer function
CREATE OR REPLACE FUNCTION public.is_club_incharge(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'club_incharge'
  )
$$;

-- 2. Add is_packet_trackable column to venue_hookah_categories
ALTER TABLE public.venue_hookah_categories
ADD COLUMN is_packet_trackable boolean NOT NULL DEFAULT false;

-- 3. Create flavours table
CREATE TABLE public.flavours (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  packet_weight_grams integer NOT NULL DEFAULT 28,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flavours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage flavours" ON public.flavours FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Club incharge can manage flavours" ON public.flavours FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Authenticated users can view flavours" ON public.flavours FOR SELECT TO authenticated
  USING (true);
CREATE TRIGGER update_flavours_updated_at BEFORE UPDATE ON public.flavours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create global_settings table
CREATE TABLE public.global_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage global settings" ON public.global_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Club incharge can manage global settings" ON public.global_settings FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Authenticated users can view global settings" ON public.global_settings FOR SELECT TO authenticated
  USING (true);
CREATE TRIGGER update_global_settings_updated_at BEFORE UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Create roster_assignments table
CREATE TABLE public.roster_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  date date NOT NULL,
  shift_start time,
  shift_end time,
  status text NOT NULL DEFAULT 'assigned',
  assigned_by uuid NOT NULL,
  remarks text,
  week_start_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.roster_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage roster" ON public.roster_assignments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Club incharge can manage roster" ON public.roster_assignments FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club mgmt can view venue roster" ON public.roster_assignments FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.get_user_venues(auth.uid())));
CREATE POLICY "Employees can view their roster" ON public.roster_assignments FOR SELECT TO authenticated
  USING (staff_id = auth.uid());
CREATE TRIGGER update_roster_updated_at BEFORE UPDATE ON public.roster_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_roster_venue_date ON public.roster_assignments(venue_id, date);
CREATE INDEX idx_roster_staff_date ON public.roster_assignments(staff_id, date);

-- 6. Create packet_dispatches table
CREATE TABLE public.packet_dispatches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  date date NOT NULL,
  flavour_id uuid NOT NULL REFERENCES public.flavours(id) ON DELETE CASCADE,
  quantity_sent integer NOT NULL DEFAULT 0,
  received_by_staff_id uuid,
  dispatched_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.packet_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage dispatches" ON public.packet_dispatches FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Club incharge can manage dispatches" ON public.packet_dispatches FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club mgmt can view venue dispatches" ON public.packet_dispatches FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.get_user_venues(auth.uid())));
CREATE POLICY "Employees can view their venue dispatches" ON public.packet_dispatches FOR SELECT TO authenticated
  USING (venue_id = public.get_user_venue(auth.uid()));
CREATE INDEX idx_dispatches_venue_date ON public.packet_dispatches(venue_id, date);

-- 7. Create venue_stock_daily table
CREATE TABLE public.venue_stock_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  date date NOT NULL,
  opening_stock integer,
  packets_received integer NOT NULL DEFAULT 0,
  packets_used integer NOT NULL DEFAULT 0,
  closing_stock integer,
  min_stock_threshold integer NOT NULL DEFAULT 10,
  opening_stock_source text NOT NULL DEFAULT 'manual',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(venue_id, date)
);
ALTER TABLE public.venue_stock_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage daily stock" ON public.venue_stock_daily FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Club incharge can manage daily stock" ON public.venue_stock_daily FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club mgmt can view venue daily stock" ON public.venue_stock_daily FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.get_user_venues(auth.uid())));
CREATE POLICY "Employees can view their venue daily stock" ON public.venue_stock_daily FOR SELECT TO authenticated
  USING (venue_id = public.get_user_venue(auth.uid()));
CREATE TRIGGER update_venue_stock_daily_updated_at BEFORE UPDATE ON public.venue_stock_daily
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_venue_stock_daily_venue_date ON public.venue_stock_daily(venue_id, date);

-- 8. Create inspections table
CREATE TABLE public.inspections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  inspector_id uuid NOT NULL,
  date date NOT NULL,
  time time NOT NULL,
  staff_grooming boolean NOT NULL DEFAULT false,
  venue_cleanliness boolean NOT NULL DEFAULT false,
  hookah_quality boolean NOT NULL DEFAULT false,
  music_ambience boolean NOT NULL DEFAULT false,
  inventory_check boolean NOT NULL DEFAULT false,
  safety_compliance boolean NOT NULL DEFAULT false,
  customer_feedback boolean NOT NULL DEFAULT false,
  staff_behavior boolean NOT NULL DEFAULT false,
  billing_accuracy boolean NOT NULL DEFAULT false,
  opening_procedure boolean NOT NULL DEFAULT false,
  closing_procedure boolean NOT NULL DEFAULT false,
  equipment_condition boolean NOT NULL DEFAULT false,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage inspections" ON public.inspections FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Club incharge can manage inspections" ON public.inspections FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club mgmt can view venue inspections" ON public.inspections FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.get_user_venues(auth.uid())));
CREATE INDEX idx_inspections_venue_date ON public.inspections(venue_id, date);

-- 9. Create inspection_stock_checks table
CREATE TABLE public.inspection_stock_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  flavour_id uuid NOT NULL REFERENCES public.flavours(id) ON DELETE CASCADE,
  reported_stock integer NOT NULL DEFAULT 0,
  measured_stock integer NOT NULL DEFAULT 0,
  match boolean GENERATED ALWAYS AS (reported_stock = measured_stock) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inspection_stock_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage inspection stock checks" ON public.inspection_stock_checks FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Club incharge can manage inspection stock checks" ON public.inspection_stock_checks FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club mgmt can view venue inspection checks" ON public.inspection_stock_checks FOR SELECT TO authenticated
  USING (inspection_id IN (
    SELECT id FROM public.inspections WHERE venue_id IN (SELECT public.get_user_venues(auth.uid()))
  ));

-- 10. Create staff_violations table
CREATE TABLE public.staff_violations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  date date NOT NULL,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  description text,
  action_taken text,
  resolved boolean NOT NULL DEFAULT false,
  reported_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage violations" ON public.staff_violations FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Club incharge can manage violations" ON public.staff_violations FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club mgmt can view venue violations" ON public.staff_violations FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.get_user_venues(auth.uid())));
CREATE POLICY "Employees can view their violations" ON public.staff_violations FOR SELECT TO authenticated
  USING (staff_id = auth.uid());
CREATE TRIGGER update_staff_violations_updated_at BEFORE UPDATE ON public.staff_violations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_violations_staff ON public.staff_violations(staff_id);
CREATE INDEX idx_violations_venue_date ON public.staff_violations(venue_id, date);

-- 11. Create staff_training table
CREATE TABLE public.staff_training (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL,
  training_type text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_date date,
  score integer,
  certified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage training" ON public.staff_training FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Club incharge can manage training" ON public.staff_training FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Employees can view their training" ON public.staff_training FOR SELECT TO authenticated
  USING (staff_id = auth.uid());
CREATE TRIGGER update_staff_training_updated_at BEFORE UPDATE ON public.staff_training
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_training_staff ON public.staff_training(staff_id);

-- 12. Create venue_accessories table
CREATE TABLE public.venue_accessories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  condition text NOT NULL DEFAULT 'good',
  replacement_needed boolean NOT NULL DEFAULT false,
  last_checked_date date,
  checked_by uuid,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.venue_accessories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage accessories" ON public.venue_accessories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Club incharge can manage accessories" ON public.venue_accessories FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club mgmt can view venue accessories" ON public.venue_accessories FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.get_user_venues(auth.uid())));
CREATE POLICY "Employees can view their venue accessories" ON public.venue_accessories FOR SELECT TO authenticated
  USING (venue_id = public.get_user_venue(auth.uid()));
CREATE TRIGGER update_venue_accessories_updated_at BEFORE UPDATE ON public.venue_accessories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_accessories_venue ON public.venue_accessories(venue_id);

-- 13. Club incharge RLS on existing tables
CREATE POLICY "Club incharge can view all venues" ON public.venues FOR SELECT TO authenticated
  USING (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club incharge can manage categories" ON public.venue_hookah_categories FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club incharge can view all attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club incharge can view all sales" ON public.sales_reports FOR SELECT TO authenticated
  USING (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club incharge can view all sessions" ON public.club_sessions FOR SELECT TO authenticated
  USING (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club incharge can view all attendance blocks" ON public.staff_attendance_blocks FOR SELECT TO authenticated
  USING (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club incharge can view all breaks" ON public.staff_breaks FOR SELECT TO authenticated
  USING (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club incharge can view all stock" ON public.stock FOR SELECT TO authenticated
  USING (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club incharge can view all venue settings" ON public.venue_settings FOR SELECT TO authenticated
  USING (public.is_club_incharge(auth.uid()));
CREATE POLICY "Club incharge can view notifications" ON public.admin_notifications FOR SELECT TO authenticated
  USING (public.is_club_incharge(auth.uid()));

-- 14. Enable pg_cron and pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
