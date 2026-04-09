

# Phase 1 Implementation Plan — Club Incharge Module Foundation

## What We're Building

Phase 1 lays the database foundation and basic UI for the Club Incharge module: new role, new tables, flavour management page, packet-trackable flag on categories, and global settings.

## Database Migration (Single SQL Migration)

### 1. Add `club_incharge` to `app_role` enum
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'club_incharge';
```

### 2. New `is_club_incharge` security definer function
- Unlike `club_management` (venue-scoped), `club_incharge` gets access to ALL venues
- The function simply checks if the user has the `club_incharge` role — no venue filtering

### 3. New Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `flavours` | Master flavour list | id, name, packet_weight_grams (default 28), is_active, created_at |
| `global_settings` | App-wide config | id, key (unique text), value (text), created_at, updated_at |
| `roster_assignments` | Weekly staff scheduling | id, staff_id, venue_id, date, shift_start, shift_end, status (text), assigned_by, remarks, week_start_date, created_at |
| `packet_dispatches` | Daily packet tracking | id, venue_id, date, flavour_id (FK), quantity_sent, received_by_staff_id, dispatched_by, created_at |
| `venue_stock_daily` | Daily opening/closing stock | id, venue_id, date, opening_stock, packets_received, packets_used, closing_stock, min_stock_threshold (default from global), opening_stock_source (text: 'auto'/'manual'), updated_by, created_at |
| `inspections` | Club inspections | id, venue_id, inspector_id, date, time, 12 boolean checklist fields, remarks, created_at |
| `inspection_stock_checks` | Spot-check detail | id, inspection_id (FK), flavour_id (FK), reported_stock, measured_stock, match (boolean generated), created_at |
| `staff_violations` | Discipline tracking | id, staff_id, venue_id, date, type (text), severity (text), description, action_taken, resolved (boolean), reported_by, created_at |
| `staff_training` | Training records | id, staff_id, training_type (text), completed (boolean), completed_date, score, certified_by, created_at |
| `venue_accessories` | Equipment tracking | id, venue_id, item_type (text), quantity, condition (text), replacement_needed (boolean), last_checked_date, checked_by, remarks, updated_at |

### 4. Add `is_packet_trackable` column
```sql
ALTER TABLE venue_hookah_categories ADD COLUMN is_packet_trackable boolean NOT NULL DEFAULT false;
```

### 5. RLS Policies
- All new tables: admin gets full CRUD, club_incharge gets full CRUD (all venues), employees get SELECT on their venue only
- `global_settings`: admin and club_incharge can read/write; employees can read

### 6. Seed Data (via insert tool, not migration)
- 12 flavours pre-populated: Blueberry Mint, Double Apple, Grape Mint, Pan Rasna, Pineapple, Watermelon Ice, Kiwi Mint, Mango Tango, Rose Chill, Lemon Mint, Butterscotch, Mix Fruit (all active, 28g)
- Global setting: `min_stock_threshold` = `10`

### 7. Stock Carry-Forward Edge Function
- `supabase/functions/stock-carry-forward/index.ts`
- Runs via cron (scheduled daily at 6 AM)
- For each venue: copies yesterday's `closing_stock` into today's `opening_stock` with `opening_stock_source = 'auto'`
- If yesterday has no record or closing_stock is null: sets `opening_stock = null` and `opening_stock_source = 'missing'` — the UI will show "Opening stock not available — please enter manually"
- Error logging per venue so one failure doesn't block others

## Frontend Changes

### File: `src/hooks/useUserRole.ts`
- Add `club_incharge` to `AppRole` type
- Add detection in priority chain: admin > club_incharge > club_management > employee
- Club incharge gets `venueIds: []` (empty — they access all venues, no scoping needed)

### File: `src/pages/ManageFlavours.tsx` (New)
- CRUD page for flavours master table
- Table listing all flavours with name, packet weight, active status
- Add dialog with name + weight inputs
- Toggle active/inactive
- Inline edit support
- Uses `PageLayout` wrapper consistent with other management pages

### File: `src/components/dashboard/admin/HookahCategoryManagement.tsx` (Modify)
- Add a Switch/toggle per category row for `is_packet_trackable`
- Label: "Counts as packet usage"
- On toggle: updates `venue_hookah_categories.is_packet_trackable`

### File: `src/components/AdminSettingsMenu.tsx` (Modify)
- Add new menu items under a "Club Incharge" separator:
  - Manage Flavours (`/manage-flavours`)
  - (Future phase placeholders will be added later)

### File: `src/App.tsx` (Modify)
- Add route: `/manage-flavours` -> `ManageFlavours`

### File: `src/pages/Dashboard.tsx` (Modify)
- Add `club_incharge` role handling — for now, render AdminDashboard (same view as admin since they manage all venues)
- Show AdminSettingsMenu for club_incharge role too

## Implementation Order

1. Run database migration (tables, enum, functions, RLS, column addition)
2. Insert seed data (flavours + global setting)
3. Create stock-carry-forward edge function
4. Schedule cron job for edge function
5. Update `useUserRole.ts` with new role
6. Create `ManageFlavours.tsx` page
7. Update `HookahCategoryManagement.tsx` with trackable toggle
8. Update `AdminSettingsMenu.tsx` and `App.tsx` with new routes
9. Update `Dashboard.tsx` for club_incharge role

