

## Problem Diagnosis

The root cause is a date logic mismatch in `getOrCreateSession()`. Here's the exact scenario causing the bug:

```text
March 13, 6:00 PM → Staff checks in → session created for "2025-03-13" ✓
March 14, 2:00 AM → Tasks completed, session auto-closes ✓
March 14, 2:30 AM → Another staff checks in → getOrCreateSession() uses 
                     format(new Date()) = "2025-03-14" → creates NEW session for March 14
                     (This session gets tasks submitted too)
March 14, 6:00 PM → Evening staff checks in → getOrCreateSession() finds 
                     the "2025-03-14" session WITH tasks already submitted ← BUG
```

Two problems:
1. `getOrCreateSession()` uses raw calendar date instead of business-date logic (before 7am should map to previous day)
2. `getOrCreateSession()` doesn't filter by `status = 'open'` — it reuses closed sessions too
3. No server-side auto-close mechanism exists — relies entirely on client-side task completion

## Plan

### 1. Fix `getOrCreateSession()` in `useClubSession.ts`
- Use business-date logic: if current hour < `force_close_hour` (7am), use yesterday's date
- Only match sessions with `status = 'open'` (don't reuse closed sessions)
- Before creating a new session, force-close any stale open sessions for the venue

### 2. Fix `fetchSession()` in `useClubSession.ts`
- When fetching today's session after force_close_hour, also check for and auto-close any orphaned open sessions from previous days before returning today's session
- Only show `open` sessions as the active session; closed sessions should not be treated as current

### 3. Create scheduled edge function `auto-close-sessions`
- Runs daily at 7am IST via `pg_cron`
- Finds all `club_sessions` with `status = 'open'` where `session_date < today`
- Sets them to `status = 'force_closed'`, `force_close_reason = 'Auto-closed: session exceeded daily boundary'`, `closed_at = now()`
- Also auto-checks-out any staff still checked in on those sessions
- This is the safety net ensuring no session survives past the daily boundary

### 4. Add client-side stale session cleanup
- In `fetchSession()`, when loading the app, if any open session is found from a previous business date, force-close it client-side before proceeding
- This handles the case between server cron runs

### Technical Details

**Edge function** (`supabase/functions/auto-close-sessions/index.ts`):
- Uses service role key to bypass RLS
- Queries all open sessions where `session_date < CURRENT_DATE`
- Updates status to `force_closed`
- Updates all related `staff_attendance_blocks` with null `check_out_time` to set checkout

**Cron job** (via `pg_cron` + `pg_net`):
- Scheduled at `30 7 * * *` (7:30 AM daily, giving buffer after the 7am boundary)
- Calls the edge function via HTTP POST

