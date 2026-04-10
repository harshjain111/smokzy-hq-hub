

## Plan: Fix Dashboard Layout — KPIs Up, Alerts Compressed

### What changes

**1. `src/components/dashboard/AdminDashboard.tsx`** — Restructure the "today" mode layout:
- Remove `<AdminNotifications />` from the page entirely
- Move `<KPIStrip>` to be the first element after the toggle
- Keep the Yesterday's Sales row
- Add a new `<AlertBar />` component (thin 60px bar with severity counts)
- Keep `<ClubGrid>` as the main content below

**2. `src/components/admin/KPIStrip.tsx`** — Redesign to a single unified grid:
- All 6 KPIs in one grid: `grid-cols-6` on desktop, `grid-cols-2` on mobile (2x3)
- Each card: 100px tall, big number (28px font), small uppercase label below
- Remove the primary/secondary split and horizontal scroll pattern

**3. Create `src/components/admin/AlertBar.tsx`** — New thin alert bar:
- Fetches unread notifications from `admin_notifications`, groups by severity
- Renders a single 60px horizontal bar: `🔴 N Critical • 🟠 N Warnings • 🟡 N Pending • View All →`
- Each count is clickable and opens the drawer filtered to that severity
- Severity classification: type-based mapping (force_closed/mismatch → critical, overdue/pending → warning, etc.)

**4. Create `src/components/admin/AlertDrawer.tsx`** — Slide-in alert drawer:
- Uses `Sheet` component (right side on desktop, bottom on mobile)
- Filter tabs: All / Critical / Warnings / Pending
- Each alert: compact row with icon + venue + issue + dismiss button + mark-read
- Reuses the existing notification fetch/mark-read/dismiss logic from `AdminNotifications`

**5. `src/components/dashboard/admin/AdminNotifications.tsx`** — No changes needed (will just stop being imported in the dashboard; the AlertBar/Drawer replaces it)

### Final page structure (today mode)
```text
[TODAY / ANALYTICS toggle]
[6 KPI Cards — 1 row desktop, 2x3 mobile, 100px tall]
[Yesterday's Sales row]
[Thin Alert Bar: 🔴 N • 🟠 N • 🟡 N • View All →]
[Clubs Grid]
```

### Files
- Modify: `src/components/dashboard/AdminDashboard.tsx`
- Modify: `src/components/admin/KPIStrip.tsx`
- Create: `src/components/admin/AlertBar.tsx`
- Create: `src/components/admin/AlertDrawer.tsx`

