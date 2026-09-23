# Cron Jobs — Pre-Migration Baseline

Captured from the OLD Lovable Cloud project (`fqtfmhlevdhaitkyoyzr`) via `select jobid,
schedule, command, jobname, active from cron.job order by jobid;` on 2026-08-27, per Phase 0
step 4 of `MIGRATION-RUNBOOK.md`. These jobs live only in `cron.job` on the live DB — they are
**not** in `supabase/migrations/` — so this file is their only record until they're recreated
on the new project (Phase 2d).

## Inventory (9 active jobs; jobid 2 does not exist — dropped previously, not a gap to fill)

| jobid | jobname | schedule (UTC) | function | body |
|---|---|---|---|---|
| 1 | auto-close-stale-sessions | `0 2 * * *` | `auto-close-sessions` | — |
| 3 | daily-stock-carry-forward | `30 6 * * *` | `stock-carry-forward` | — |
| 4 | generate-notifications-every-30min | `*/30 * * * *` | `generate-notifications` | — |
| 5 | roster-prefill | `25 0 * * *` | `roster-daily-jobs` | `{"action":"prefill"}` |
| 6 | roster-create-tasks | `30 0 * * *` | `roster-daily-jobs` | `{"action":"create-tasks"}` |
| 7 | roster-reminder-9am | `30 3 * * *` | `roster-daily-jobs` | `{"action":"send-reminders"}` |
| 8 | roster-reminder-1pm | `30 7 * * *` | `roster-daily-jobs` | `{"action":"send-reminders"}` |
| 9 | roster-check-overdue | `30 8 * * *` | `roster-daily-jobs` | `{"action":"check-overdue"}` |
| 10 | roster-check-missed | `29 18 * * *` | `roster-daily-jobs` | `{"action":"check-missed"}` |

All schedules are UTC (`cron.schedule` default). `30 3 * * *` = 9:00am IST, `30 7 * * *` =
1:00pm IST, `29 18 * * *` = ~11:59pm IST — these look intentionally IST-aligned; keep the exact
UTC values below when recreating so local times don't shift.

## Recreation SQL — run in the NEW project's SQL editor (Phase 2d)

Fill in `<NEW_REF>` and `<CRON_SECRET>` (the shared secret you'll also wire into
`auto-close-sessions` per the Hardening section of the runbook — same value here and in that
function's env var). Do not run this until Phase 1 (new project + functions deployed) is done.

```sql
select cron.schedule('auto-close-stale-sessions', '0 2 * * *', $$
  select net.http_post(
    url:='https://<NEW_REF>.supabase.co/functions/v1/auto-close-sessions',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <CRON_SECRET>"}'::jsonb
  );
$$);

select cron.schedule('daily-stock-carry-forward', '30 6 * * *', $$
  select net.http_post(
    url:='https://<NEW_REF>.supabase.co/functions/v1/stock-carry-forward',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <CRON_SECRET>"}'::jsonb
  );
$$);

select cron.schedule('generate-notifications-every-30min', '*/30 * * * *', $$
  select net.http_post(
    url:='https://<NEW_REF>.supabase.co/functions/v1/generate-notifications',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <CRON_SECRET>"}'::jsonb
  );
$$);

select cron.schedule('roster-prefill', '25 0 * * *', $$
  select net.http_post(
    url:='https://<NEW_REF>.supabase.co/functions/v1/roster-daily-jobs',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <CRON_SECRET>"}'::jsonb,
    body:='{"action":"prefill"}'::jsonb
  );
$$);

select cron.schedule('roster-create-tasks', '30 0 * * *', $$
  select net.http_post(
    url:='https://<NEW_REF>.supabase.co/functions/v1/roster-daily-jobs',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <CRON_SECRET>"}'::jsonb,
    body:='{"action":"create-tasks"}'::jsonb
  );
$$);

select cron.schedule('roster-reminder-9am', '30 3 * * *', $$
  select net.http_post(
    url:='https://<NEW_REF>.supabase.co/functions/v1/roster-daily-jobs',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <CRON_SECRET>"}'::jsonb,
    body:='{"action":"send-reminders"}'::jsonb
  );
$$);

select cron.schedule('roster-reminder-1pm', '30 7 * * *', $$
  select net.http_post(
    url:='https://<NEW_REF>.supabase.co/functions/v1/roster-daily-jobs',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <CRON_SECRET>"}'::jsonb,
    body:='{"action":"send-reminders"}'::jsonb
  );
$$);

select cron.schedule('roster-check-overdue', '30 8 * * *', $$
  select net.http_post(
    url:='https://<NEW_REF>.supabase.co/functions/v1/roster-daily-jobs',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <CRON_SECRET>"}'::jsonb,
    body:='{"action":"check-overdue"}'::jsonb
  );
$$);

select cron.schedule('roster-check-missed', '29 18 * * *', $$
  select net.http_post(
    url:='https://<NEW_REF>.supabase.co/functions/v1/roster-daily-jobs',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <CRON_SECRET>"}'::jsonb,
    body:='{"action":"check-missed"}'::jsonb
  );
$$);
```

**Note:** `auto-close-sessions`, `stock-carry-forward`, and `generate-notifications` currently
have `verify_jwt = false` (publicly callable) and read no body — that's why their `net.http_post`
calls above carry an `Authorization` header but the target functions don't check it *yet*. Add
the `CRON_SECRET` check inside each function (compare the header to `Deno.env.get('CRON_SECRET')`,
403 if it doesn't match) before or right after recreating these jobs — otherwise the header is
decorative and the endpoints stay open to anyone. See runbook Hardening section.

After running, verify:
```sql
select jobid, jobname, schedule, active from cron.job order by jobid;
```
and watch `cron.job_run_details` over the next cycle to confirm each job fires successfully
against the new project.
