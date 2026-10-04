-- Re-add unique constraint as a partial index: only one OPEN session per venue per date
CREATE UNIQUE INDEX IF NOT EXISTS club_sessions_venue_date_open_uniq
  ON public.club_sessions (venue_id, session_date)
  WHERE status = 'open';

-- Atomic get-or-create function to prevent race conditions
CREATE OR REPLACE FUNCTION public.get_or_create_open_session(
  p_venue_id uuid,
  p_session_date date
)
RETURNS SETOF public.club_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result public.club_sessions;
BEGIN
  -- Try to find existing open session
  SELECT * INTO result
  FROM public.club_sessions
  WHERE venue_id = p_venue_id
    AND session_date = p_session_date
    AND status = 'open';

  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Try to insert; the partial unique index guards against duplicates
  BEGIN
    INSERT INTO public.club_sessions (venue_id, session_date, status)
    VALUES (p_venue_id, p_session_date, 'open')
    RETURNING * INTO result;
    RETURN NEXT result;
    RETURN;
  EXCEPTION WHEN unique_violation THEN
    -- Another transaction won the race — return that row
    SELECT * INTO result
    FROM public.club_sessions
    WHERE venue_id = p_venue_id
      AND session_date = p_session_date
      AND status = 'open';
    RETURN NEXT result;
    RETURN;
  END;
END;
$$;
