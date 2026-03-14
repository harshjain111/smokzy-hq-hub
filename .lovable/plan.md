

# Club History Redesign — Admin-Friendly Decision Dashboard

## Current Problems
1. **Two-step navigation**: Admin must first browse a session list, click a session, then expand accordion sections one at a time — too many taps to reach data
2. **Only one section visible at a time** due to accordion pattern — comparing attendance with sales requires collapsing/expanding
3. **Calendar popover closes on interaction** making date selection frustrating
4. **No admin control over attendance** — cannot add or delete punch-ins for staff

## New Design

```text
┌──────────────────────────────────────┐
│  ← Club Name          🔄 Refresh    │
│  [LIVE SESSION]  [HISTORY]           │
├──────────────────────────────────────┤
│  ◄ M  T  W  T  F  S  S  📅 ►       │  ← Horizontal date strip (last 14 days)
│       10 11 12 13 14                 │    with calendar icon for older dates
├──────────────────────────────────────┤
│  ┌─ Session Summary Card ──────────┐ │
│  │ 🟢 Complete  18:00–03:15        │ │  Always visible, no accordion
│  │ ✓Stock  ✓Sales  ✓Photo          │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌─ Counter Photo ─────────────────┐ │
│  │ [photo thumbnail — tap to zoom] │ │  Always visible
│  └─────────────────────────────────┘ │
│                                      │
│  ┌─ Sales ─────────────────────────┐ │
│  │ 42 hookahs │ +12% vs prev day   │ │  Always visible
│  │ Category breakdown inline       │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌─ Stock ─────────────────────────┐ │
│  │ 8 items │ 1 mismatch            │ │  Always visible
│  └─────────────────────────────────┘ │
│                                      │
│  ┌─ Attendance ────────────────────┐ │
│  │ 3 staff │ [+ Add Punch-In]     │ │  Admin can add/delete
│  │ Staff rows with 🗑 delete       │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌─ Activity Log ──────────────────┐ │
│  │ Timeline of events              │ │
│  └─────────────────────────────────┘ │
└──────────────────────────────────────┘
```

## Implementation Plan

### 1. Create `DateNavigationStrip.tsx`
- Horizontal scrollable row showing last 14 days as date chips (day name + date number)
- Active date highlighted with primary color
- Calendar icon button at end opens a Popover with `<Calendar>` (with `pointer-events-auto`) for picking older dates
- Emits `onDateChange(date)` callback
- Today is excluded (that's the LIVE tab)

### 2. Create `HistoricalDayView.tsx`
- Receives `clubId`, `clubName`, and `selectedDate`
- Fetches session for that date from `club_sessions`
- Renders ALL sections as always-visible stacked cards (no accordions):
  - **Session Summary** — status badge, duration, task completion checklist, force-close warning
  - **Counter Photo** — thumbnail with tap-to-zoom dialog
  - **Sales** — total, comparisons, category breakdown (reuses logic from `HistoricalSalesSection`)
  - **Stock** — items and mismatches (reuses logic from `HistoricalStockSection`)
  - **Attendance** — staff list with admin Add/Delete controls (see below)
  - **Activity Log** — timeline (reuses logic from `HistoricalActivitySection`)
- Shows "No session recorded for this date" if no data
- Single scrollable page — admin sees everything at a glance

### 3. Update `HistoricalAttendanceSection.tsx` — Admin Attendance Controls
- **Add "Add Punch-In" button** at top of attendance section
  - Opens a dialog with: staff dropdown (venue staff from `user_roles`), check-in time, check-out time (optional)
  - Inserts into `staff_attendance_blocks` with the session's ID, venue_id
- **Add delete button** (trash icon) on each attendance record
  - Confirmation dialog before deleting
  - Deletes from `staff_attendance_blocks`
- **Add edit capability** — tap a record to edit check-in/check-out times via dialog

### 4. Update `ClubDetail.tsx` — Replace History View
- Remove `SessionHistoryList` + `HistoricalSessionDetail` drill-down pattern
- Replace with `DateNavigationStrip` + `HistoricalDayView` side by side
- Date strip at top, day view below — single page, no back button needed

### 5. Database Migration — Admin RLS Policies
Add policies on `staff_attendance_blocks` for admin:
- `INSERT` policy: `is_admin(auth.uid())`
- `DELETE` policy: `is_admin(auth.uid())`
- `UPDATE` policy for all fields: `is_admin(auth.uid())`

### Files

| File | Action |
|------|--------|
| `src/components/admin/club/DateNavigationStrip.tsx` | Create |
| `src/components/admin/club/HistoricalDayView.tsx` | Create |
| `src/components/admin/club/HistoricalAttendanceSection.tsx` | Modify — add admin add/edit/delete |
| `src/pages/ClubDetail.tsx` | Modify — replace history section |
| SQL migration | Admin INSERT/DELETE/UPDATE on `staff_attendance_blocks` |

### What stays
- `PeriodSummaryPanel` — still accessible via a "Period Report" button in the date strip area (7-day / 30-day summary + PDF export)
- `SessionHistoryList` — removed (replaced by date strip)
- `HistoricalSessionDetail` — removed (replaced by HistoricalDayView)
- All individual section components (`HistoricalSalesSection`, `HistoricalStockSection`, `HistoricalActivitySection`) — reused inside HistoricalDayView but rendered without accordions

