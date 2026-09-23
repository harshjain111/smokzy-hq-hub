# Sprint 1 — Follow-up items

Tracking small/non-blocking issues discovered while fixing the Sprint 1
security findings. These are not bugs in the fixes themselves — they
are known gaps to close in follow-up work.

## Sprint 1 cleanup (before Sprint 1 closes)

- [ ] **Rate limiting on `create-user`, `update-user`, `delete-user`.**
  No rate limit exists today. An authenticated admin with a valid JWT
  can currently spam user creation/modification unbounded. Options:
  (a) a Redis/KV-backed counter keyed on `callerId`, or (b) a small
  `rate_limit_events` table with a UNIQUE `(caller_id, bucket)`
  constraint checked in `_shared/authz.ts`. Suggested limit: 30
  writes/min per admin; 429 on exceed. Related: C1.

- [ ] **Weak-password early-return in `update-user` is not audit-logged.**
  `update-user/index.ts` returns the `code: 'weak_password'` response
  via an early `return` inside the `try` block, before the success
  `logAdminAudit()` call is reached. So a weak-password rejection on a
  password change is invisible in `[ADMIN_AUDIT]` logs. Minor
  pre-existing bug; fix by moving the weak-password branch into the
  catch block or calling `logAdminAudit({success:false, ...})` before
  the early return.

## Sprint 3

- [ ] **Promote `[ADMIN_AUDIT]` stdout logging to a real
  `admin_audit_log` table.** Current implementation in
  `_shared/authz.ts::logAdminAudit()` emits structured JSON to stdout
  with an `[ADMIN_AUDIT]` prefix. Edge function logs are useful for
  debugging but not retention/search/compliance. Create a table with
  columns matching `AdminAuditEntry`:
  `caller_id, action, target_user_id, old_role, new_role, ip,
  success, error, timestamp`. RLS: admin-only SELECT. Keep the stdout
  line in parallel for belt-and-braces.

- [ ] **`pg_cron` `auto-close-sessions` job lives only in production DB,
  not in version control.** A `grep -r 'net\.http_post\|cron\.schedule'
  supabase/` returns zero matches — the cron job was created via the
  Supabase dashboard at runtime and is not reproducible from a fresh
  restore. Ties into Finding **C7** (no pg_cron schedules in
  migrations). Resolution: capture the current `cron.job` row via the
  SQL editor, re-create it in a migration with the new `CRON_SECRET`
  header (from C2), and commit. Do the same for the roster-daily-jobs
  and stock-carry-forward jobs while we're at it.
