# Smokzy Inventory — Club Stock Integration API

Read-only API for Smokzy Inventory to fetch live club (venue) flavour stock from the Club App.

**The Club App remains the single source of truth for club stock. This integration is strictly READ-ONLY.**

---

## Base URL

```
https://ozlrwwwtohaqggmhgfbm.supabase.co/functions/v1
```

---

## Authentication

All endpoints require a pre-shared API key via Bearer token.

```
Authorization: Bearer <INVENTORY_API_KEY>
```

The API key is:
- Stored as the `INVENTORY_API_KEY` environment variable in Supabase Edge Functions
- Compared using a timing-safe equality check
- Revocable by rotating the env var in the Supabase dashboard
- Scoped to read-only access — no write operations exist

### Setting up the API key

1. Generate a strong random key (minimum 32 characters):
   ```bash
   openssl rand -base64 48
   ```
2. Set it in Supabase Dashboard → Project Settings → Edge Functions → Environment Variables:
   ```
   INVENTORY_API_KEY=<your-generated-key>
   ```
3. Configure the same key in Smokzy Inventory's environment:
   ```
   CLUB_APP_API_KEY=<same-key>
   ```

### Optional: CORS origin restriction

For additional security, set `INVENTORY_ALLOWED_ORIGIN` to the Smokzy Inventory domain:
```
INVENTORY_ALLOWED_ORIGIN=https://inventory.smokzy.com
```
When unset, browser-origin requests are blocked (empty `Access-Control-Allow-Origin`), which is the correct default for server-to-server calls.

---

## Endpoints

### 1. GET /inventory-club-stock

Fetch stock records for all tracked club × flavour combinations.

#### Query Parameters

| Parameter      | Type   | Description                                                         |
|---------------|--------|---------------------------------------------------------------------|
| `club_id`     | UUID   | Filter by venue/club ID                                             |
| `location`    | string | Filter by venue location (case-insensitive substring match)         |
| `flavour_id`  | UUID   | Filter by flavour ID (from the `flavours` table)                    |
| `flavour_name`| string | Filter by exact flavour/item name                                   |
| `status`      | string | Filter by computed status: `OK`, `LOW`, or `OUT_OF_STOCK`           |
| `page`        | int    | Page number (default: 1)                                            |
| `limit`       | int    | Items per page (default: 100, max: 500)                             |

#### Example Requests

```bash
# All club stock
curl -X GET \
  "https://ozlrwwwtohaqggmhgfbm.supabase.co/functions/v1/inventory-club-stock" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Single club
curl -X GET \
  "https://ozlrwwwtohaqggmhgfbm.supabase.co/functions/v1/inventory-club-stock?club_id=abc-123" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Filter by location
curl -X GET \
  "https://ozlrwwwtohaqggmhgfbm.supabase.co/functions/v1/inventory-club-stock?location=Guwahati" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Only low-stock items, page 2
curl -X GET \
  "https://ozlrwwwtohaqggmhgfbm.supabase.co/functions/v1/inventory-club-stock?status=LOW&page=2&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Successful Response (200)

```json
{
  "success": true,
  "data": [
    {
      "club": {
        "id": "a1b2c3d4-...",
        "name": "Club Prime",
        "location": "Guwahati"
      },
      "flavour": {
        "id": "f1a2b3c4-...",
        "name": "Paan Kiwi Mint",
        "packet_weight_grams": 28
      },
      "stock": {
        "quantity": 3,
        "unit": "packets",
        "minimum_required": 10,
        "status": "LOW"
      },
      "updated_at": "2026-09-10T12:30:00+00:00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 150,
    "total_pages": 2
  },
  "meta": {
    "total_clubs": 12,
    "total_items": 150,
    "low_stock_items": 8,
    "out_of_stock_items": 3
  }
}
```

---

### 2. GET /inventory-club-stock-summary

Lightweight summary for dashboard widgets — no per-item data.

#### Example Request

```bash
curl -X GET \
  "https://ozlrwwwtohaqggmhgfbm.supabase.co/functions/v1/inventory-club-stock-summary" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Successful Response (200)

```json
{
  "success": true,
  "data": {
    "total_clubs": 12,
    "total_items": 150,
    "ok_items": 139,
    "low_stock_items": 8,
    "out_of_stock_items": 3
  },
  "last_updated_at": "2026-09-10T12:30:00+00:00"
}
```

---

### 3. GET /inventory-health

Health check to verify integration availability.

#### Example Request

```bash
curl -X GET \
  "https://ozlrwwwtohaqggmhgfbm.supabase.co/functions/v1/inventory-health" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Healthy Response (200)

```json
{
  "success": true,
  "service": "club-stock-integration",
  "status": "healthy",
  "timestamp": "2026-09-10T12:30:00.000Z"
}
```

#### Unhealthy Response (503)

```json
{
  "success": false,
  "service": "club-stock-integration",
  "status": "unhealthy",
  "reason": "Database connection failed.",
  "timestamp": "2026-09-10T12:30:00.000Z"
}
```

---

## Error Responses

All errors return structured JSON:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message."
  }
}
```

| Status | Code                 | When                                     |
|--------|---------------------|------------------------------------------|
| 401    | UNAUTHORIZED        | Missing, empty, or invalid API key       |
| 400    | INVALID_PARAMETER   | Bad query parameter value                |
| 405    | METHOD_NOT_ALLOWED  | Non-GET request                          |
| 429    | (Supabase default)  | Rate limited                             |
| 500    | INTERNAL_ERROR      | Unexpected server error                  |
| 503    | SERVICE_UNAVAILABLE | INVENTORY_API_KEY not configured         |

Stack traces and internal details are never exposed.

---

## Stock Status Logic

Status is **computed by the API** — Smokzy Inventory should use the returned `status` field directly.

```
IF quantity == 0        → "OUT_OF_STOCK"
ELSE IF quantity < minimum_required → "LOW"
ELSE                    → "OK"
```

The `minimum_required` value comes from the `low_stock_threshold` column in the Club App's `stock` table, set per club × flavour.

---

## Data Semantics

| Field              | Meaning                                                                 |
|--------------------|-------------------------------------------------------------------------|
| `stock.quantity`   | Current stock count at the club (integer, in `unit`)                    |
| `stock.unit`       | Unit of measurement (typically `"packets"`)                             |
| `stock.minimum_required` | Threshold below which the club needs restocking                  |
| `stock.status`     | Computed status: `OK`, `LOW`, or `OUT_OF_STOCK`                         |
| `updated_at`       | When this specific stock record was last modified in the Club App        |

### Zero stock vs. not tracked

- **Zero stock**: A record exists with `quantity: 0` and `status: "OUT_OF_STOCK"`. The flavour is tracked at this club but is depleted.
- **Not tracked**: No record is returned for that club × flavour combination. The flavour is not configured at that club. The API omits these — it only returns configured stock entries.

---

## Flavour Identification

Each stock record includes:

```json
{
  "flavour": {
    "id": "f1a2b3c4-...",
    "name": "Paan Kiwi Mint",
    "packet_weight_grams": 28
  }
}
```

- **`id`** (UUID): Stable identifier from the `flavours` table. Use this as the integration key.
- **`name`**: Display name. May change over time — do not use as the sole matching key.
- **`packet_weight_grams`**: Weight per packet (default 28g). Use this if Smokzy Inventory needs weight-based calculations.
- **`id: null`**: The stock item exists in the `stock` table but has no matching entry in the `flavours` catalogue. This can happen with legacy data or non-standard items.

### Mapping strategy

Smokzy Inventory should maintain a mapping table:

| Club App flavour ID | Smokzy Inventory flavour ID |
|--------------------|-----------------------------|
| `f1a2b3c4-...`    | `INV-FL-001`                |

On first sync, auto-match by name. For unmatched items, present them in the Smokzy Inventory UI for manual mapping.

---

## Club Identification

```json
{
  "club": {
    "id": "a1b2c3d4-...",
    "name": "Club Prime",
    "location": "Guwahati"
  }
}
```

- **`id`** (UUID): Stable venue identifier. Use this as the integration key.
- **`name`**: Display name. May change.
- **`location`**: Free-text location/city (e.g., `"Guwahati"`, `"Jorhat"`). There is no separate `location_id` — the Club App stores location as a text field. Filter and group by this string in Smokzy Inventory.

---

## Rate Limits

Supabase Edge Functions have built-in rate limiting. Recommended usage pattern:

| Use Case             | Frequency         |
|---------------------|-------------------|
| Dashboard load      | On page open      |
| Manual "Sync Now"   | User-triggered    |
| Background sync     | Every 15 minutes  |
| Summary widget      | Every 5 minutes   |

Stay under **60 requests per minute** to avoid hitting Supabase limits.

---

## Required Environment Variables

### Club App (Supabase Edge Functions)

| Variable                   | Required | Description                                        |
|---------------------------|----------|----------------------------------------------------|
| `INVENTORY_API_KEY`       | Yes      | Pre-shared API key for Smokzy Inventory             |
| `INVENTORY_ALLOWED_ORIGIN`| No       | Allowed CORS origin (leave unset for server-to-server) |
| `SUPABASE_URL`            | Auto     | Provided by Supabase runtime                        |
| `SUPABASE_SERVICE_ROLE_KEY`| Auto    | Provided by Supabase runtime                        |

### Smokzy Inventory (Consumer)

| Variable                   | Description                                        |
|---------------------------|----------------------------------------------------|
| `CLUB_APP_BASE_URL`      | `https://ozlrwwwtohaqggmhgfbm.supabase.co/functions/v1` |
| `CLUB_APP_API_KEY`       | The same key set as `INVENTORY_API_KEY` above       |

---

## Architecture

```
Smokzy Inventory Server
        │
        │  HTTPS (server-to-server)
        │  Authorization: Bearer <API_KEY>
        ▼
Supabase Edge Function (Deno)
        │
        │  Service Role Key (auto-provided)
        │  Bypasses RLS
        ▼
  Supabase PostgreSQL
  ┌──────────────────┐
  │ stock            │ ← quantity, threshold, unit per venue×item
  │ venues           │ ← club name, location
  │ flavours         │ ← flavour catalogue (id, name, weight)
  └──────────────────┘
```

**This is a read-only integration. No write endpoints exist. No stock modification is possible through this API.**

---

## No Write Endpoints

This integration deliberately provides **zero write capability**:

- No POST, PUT, PATCH, or DELETE endpoints
- The API key grants read-only access
- The edge functions only execute SELECT queries
- All non-GET requests return 405 Method Not Allowed

Stock changes must be made through the Club App UI by authorized staff.
