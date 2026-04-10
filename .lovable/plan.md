

## Plan: Daily Roster — Confirm/Edit/Save Flow

### Summary
Transform the Daily Roster from a read-only weekly roster mirror into a full confirm/edit/save workflow with audit logging, daily task tracking, and automated notifications.

### Database Changes (3 migrations)

**Migration 1: `daily_roster` table + `roster_audit_log` table**
- Create `daily_roster` table with columns: `id`, `venue_id`, `date`, `staff_id`, `shift_start`, `shift_end`, `role`, `status` (draft/confirmed), `confirmed_by`, `confirmed_at`, `last_edited_by`, `last_edited_at`, `edit_count`, `source` (weekly/added/modified), `original_staff_id` (to track swaps), `note`, `is_removed` (soft delete), `created_at`
- Unique constraint on `(venue_id, date, staff_id)` where not removed
- Create `roster_audit_log` table: `id`, `venue_id`, `roster_date`, `action` (prefilled/edited/confirmed/reset), `user_id`, `before_data` JSONB, `after_data` JSONB, `created_at`
- RLS: admin/club_incharge full CRUD; club_management SELECT+UPDATE on their venues; employees SELECT own rows

**Migration 2: `incharge_daily_tasks` table**
- Columns: `id`, `task_type`, `venue_id`, `task_date`, `assigned_to`, `deadline`, `status` (pending/completed/overdue/missed), `completed_at`, `created_at`
- Unique on `(task_type, venue_id, task_date)`
- RLS: admin/club_incharge full access

**Migration 3: Enable realtime on `daily_roster`**

### Edge Function: `roster-daily-jobs`
Single edge function handling multiple job types via `action` parameter:
- **prefill**: Creates `daily_roster` rows from `roster_assignments` for a given date, status=draft
- **create-tasks**: Creates `incharge_daily_tasks` for each venue for the day
- **check-overdue**: Marks unconfirmed tasks as overdue at 2PM IST
- **check-missed**: Marks still-unconfirmed tasks as missed at midnight
- **send-reminders**: Generates notifications at 9AM and 1PM IST for pending rosters

Cron scheduling via `pg_cron` (using insert tool, not migration):
- 00:25 UTC (5:55 AM IST): prefill
- 00:30 UTC (6:00 AM IST): create-tasks
- 03:30 UTC (9:00 AM IST): send reminder notifications
- 07:30 UTC (1:00 PM IST): 1-hour warning notifications
- 08:30 UTC (2:00 PM IST): overdue check
- 18:29 UTC (11:59 PM IST): missed check

### UI: Complete Rewrite of `DailyRoster.tsx`

**Top section:**
- Date nav (prev/today/next) + venue filter dropdown
- Status pill per venue: DRAFT (orange) / CONFIRMED (green) + "Edited N times" badge
- "Reset to Weekly Roster" button with confirmation dialog

**Per-venue card (expandable or tabbed by venue):**
- Each staff row shows: name, role (editable select), shift time (editable), source indicator (📅/✏️/➕/❌), note field, delete button
- Orange dot on rows modified from weekly plan
- "Add Staff" button opening a select filtered to venue employees
- Mark as leave/swap with reason field

**Bottom sticky bar:**
- Left: "X staff scheduled | Y modified from weekly"
- Right: "Confirm & Save Daily Roster" (when draft) or "Save Changes" (when confirmed)

**Validation on save:**
- At least 1 staff per venue
- No duplicate staff in same venue
- No time conflicts

**On confirm:** Sets status=confirmed, confirmed_by, confirmed_at, creates audit log entry, marks corresponding `incharge_daily_tasks` as completed

**Edit after confirm:** Increments edit_count, updates last_edited_by/at, creates audit log with diff, keeps status=confirmed

**Audit trail drawer:** "View History" link opens a sheet showing all edits with timestamp, user, and changes

### Integration Points

**DailySummary.tsx:** Add "Today's Tasks" section showing pending `incharge_daily_tasks` with deadline countdown and overdue highlighting

**Notifications:** The edge function generates `admin_notifications` rows for 9AM reminder, 1PM warning, and 2PM overdue alerts

### Files to Create/Modify
- **Create:** `src/pages/DailyRoster.tsx` (full rewrite)
- **Create:** `supabase/functions/roster-daily-jobs/index.ts`
- **Modify:** `src/pages/DailySummary.tsx` (add Today's Tasks section)
- **Database:** 2-3 migrations for new tables + RLS
- **Cron:** Insert cron schedules via Supabase insert tool

### Implementation Order
1. Database migrations (daily_roster, roster_audit_log, incharge_daily_tasks + RLS)
2. UI rewrite of DailyRoster.tsx with full edit/confirm/audit flow
3. Edge function for cron jobs (prefill, tasks, reminders, overdue/missed)
4. DailySummary integration (Today's Tasks)
5. Cron schedule setup

