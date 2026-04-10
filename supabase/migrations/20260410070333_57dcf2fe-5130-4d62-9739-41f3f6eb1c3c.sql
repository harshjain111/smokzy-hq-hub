
-- daily_roster table
CREATE TABLE public.daily_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  staff_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  shift_start TIME,
  shift_end TIME,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed')),
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  last_edited_by UUID,
  last_edited_at TIMESTAMPTZ,
  edit_count INT NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'weekly' CHECK (source IN ('weekly','added','modified')),
  original_staff_id UUID,
  note TEXT,
  is_removed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_daily_roster_active ON public.daily_roster (venue_id, date, staff_id) WHERE is_removed = false;

ALTER TABLE public.daily_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access daily_roster" ON public.daily_roster FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Club incharge full access daily_roster" ON public.daily_roster FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));

CREATE POLICY "Club mgmt select daily_roster" ON public.daily_roster FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.get_user_venues(auth.uid())));

CREATE POLICY "Club mgmt update daily_roster" ON public.daily_roster FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.get_user_venues(auth.uid())))
  WITH CHECK (venue_id IN (SELECT public.get_user_venues(auth.uid())));

CREATE POLICY "Employee select own daily_roster" ON public.daily_roster FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

-- roster_audit_log table
CREATE TABLE public.roster_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  roster_date DATE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('prefilled','edited','confirmed','reset')),
  user_id UUID,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.roster_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access audit_log" ON public.roster_audit_log FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Club incharge full access audit_log" ON public.roster_audit_log FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));

CREATE POLICY "Club mgmt select audit_log" ON public.roster_audit_log FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.get_user_venues(auth.uid())));

-- incharge_daily_tasks table
CREATE TABLE public.incharge_daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  task_date DATE NOT NULL,
  assigned_to UUID,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','overdue','missed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_type, venue_id, task_date)
);

ALTER TABLE public.incharge_daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access daily_tasks" ON public.incharge_daily_tasks FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Club incharge full access daily_tasks" ON public.incharge_daily_tasks FOR ALL TO authenticated
  USING (public.is_club_incharge(auth.uid())) WITH CHECK (public.is_club_incharge(auth.uid()));

CREATE POLICY "Club mgmt select own venue tasks" ON public.incharge_daily_tasks FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.get_user_venues(auth.uid())));

-- Enable realtime on daily_roster
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_roster;
