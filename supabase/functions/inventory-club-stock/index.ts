import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  assertInventoryApiKey,
  IntegrationAuthError,
  inventoryCorsHeaders,
  inventoryErrorResponse,
} from "../_shared/inventory-auth.ts";

type StockStatus = "OK" | "LOW" | "OUT_OF_STOCK";

interface StockRecord {
  club: {
    id: string;
    name: string;
    location: string;
  };
  flavour: {
    id: string | null;
    name: string;
    packet_weight_grams: number | null;
  };
  stock: {
    quantity: number;
    unit: string;
    minimum_required: number;
    status: StockStatus;
  };
  updated_at: string;
}

function computeStatus(quantity: number, minimum: number): StockStatus {
  if (quantity === 0) return "OUT_OF_STOCK";
  if (quantity < minimum) return "LOW";
  return "OK";
}

serve(async (req) => {
  const cors = inventoryCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is allowed." },
      }),
      { status: 405, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  try {
    assertInventoryApiKey(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const params = url.searchParams;

    // Parse filters
    const clubId = params.get("club_id");
    const location = params.get("location");
    const flavourId = params.get("flavour_id");
    const flavourName = params.get("flavour_name");
    const statusFilter = params.get("status")?.toUpperCase() as
      | StockStatus
      | null;

    // Pagination
    const page = Math.max(1, parseInt(params.get("page") || "1", 10));
    const limit = Math.min(
      500,
      Math.max(1, parseInt(params.get("limit") || "100", 10)),
    );

    // Validate status filter
    if (
      statusFilter &&
      !["OK", "LOW", "OUT_OF_STOCK"].includes(statusFilter)
    ) {
      throw new IntegrationAuthError(
        400,
        "INVALID_PARAMETER",
        `Invalid status filter "${statusFilter}". Must be one of: OK, LOW, OUT_OF_STOCK`,
      );
    }

    // Fetch all active flavours into a lookup map (name → flavour)
    const { data: flavours, error: flavourErr } = await supabase
      .from("flavours")
      .select("id, name, packet_weight_grams, is_active");

    if (flavourErr) {
      console.error("[INVENTORY] flavours fetch failed:", flavourErr.message);
      throw new Error("Failed to fetch flavours.");
    }

    const flavourByName = new Map<
      string,
      { id: string; name: string; packet_weight_grams: number; is_active: boolean }
    >();
    for (const f of flavours || []) {
      flavourByName.set(f.name, f);
    }

    // If filtering by flavour_id, resolve the flavour name for the stock query
    let flavourNameFilter: string | null = flavourName || null;
    if (flavourId) {
      const match = (flavours || []).find((f) => f.id === flavourId);
      if (!match) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [],
            pagination: { page, limit, total: 0, total_pages: 0 },
            meta: {
              total_clubs: 0,
              total_items: 0,
              low_stock_items: 0,
              out_of_stock_items: 0,
            },
          }),
          {
            status: 200,
            headers: { ...cors, "Content-Type": "application/json" },
          },
        );
      }
      flavourNameFilter = match.name;
    }

    // Build stock query — only category = 'flavour'
    let stockQuery = supabase
      .from("stock")
      .select("id, venue_id, item_name, quantity, low_stock_threshold, unit, updated_at, venues!inner(id, name, location)", { count: "exact" })
      .eq("category", "flavour");

    if (clubId) {
      stockQuery = stockQuery.eq("venue_id", clubId);
    }
    if (flavourNameFilter) {
      stockQuery = stockQuery.eq("item_name", flavourNameFilter);
    }

    // Fetch ALL matching records (we need them for status filtering + aggregates)
    // Then paginate in application code if status filter is active
    if (statusFilter) {
      // When filtering by status, we must fetch all and filter in JS
      // because status is computed, not stored
      const { data: allStock, error: stockErr } = await stockQuery;

      if (stockErr) {
        console.error("[INVENTORY] stock fetch failed:", stockErr.message);
        throw new Error("Failed to fetch stock data.");
      }

      let records = mapStockRecords(allStock || [], flavourByName);

      // Apply location filter
      if (location) {
        const loc = location.toLowerCase();
        records = records.filter((r) =>
          r.club.location.toLowerCase().includes(loc)
        );
      }

      // Apply status filter
      records = records.filter((r) => r.stock.status === statusFilter);

      const total = records.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedData = records.slice(offset, offset + limit);

      // Compute meta from the filtered set
      const meta = computeMeta(records);

      return new Response(
        JSON.stringify({
          success: true,
          data: paginatedData,
          pagination: { page, limit, total, total_pages: totalPages },
          meta,
        }),
        {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    // No status filter — use DB-level pagination
    // But if location filter, we need to filter in JS (it's a text search on venue location)
    if (location) {
      const { data: allStock, error: stockErr } = await stockQuery;

      if (stockErr) {
        console.error("[INVENTORY] stock fetch failed:", stockErr.message);
        throw new Error("Failed to fetch stock data.");
      }

      let records = mapStockRecords(allStock || [], flavourByName);
      const loc = location.toLowerCase();
      records = records.filter((r) =>
        r.club.location.toLowerCase().includes(loc)
      );

      const total = records.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedData = records.slice(offset, offset + limit);
      const meta = computeMeta(records);

      return new Response(
        JSON.stringify({
          success: true,
          data: paginatedData,
          pagination: { page, limit, total, total_pages: totalPages },
          meta,
        }),
        {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    // Simple case: no status/location filter — paginate at DB level
    const offset = (page - 1) * limit;
    const { data: stockData, error: stockErr, count } = await stockQuery
      .order("venue_id", { ascending: true })
      .order("item_name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (stockErr) {
      console.error("[INVENTORY] stock fetch failed:", stockErr.message);
      throw new Error("Failed to fetch stock data.");
    }

    const records = mapStockRecords(stockData || [], flavourByName);
    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    // For meta, we need full-dataset aggregates — run a separate lightweight query
    const meta = await computeMetaFromDb(supabase, clubId, flavourNameFilter);

    return new Response(
      JSON.stringify({
        success: true,
        data: records,
        pagination: { page, limit, total, total_pages: totalPages },
        meta,
      }),
      {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return inventoryErrorResponse(err, cors);
  }
});

function mapStockRecords(
  stockRows: Array<Record<string, unknown>>,
  flavourByName: Map<string, { id: string; name: string; packet_weight_grams: number }>,
): StockRecord[] {
  return stockRows.map((row) => {
    const venue = row.venues as { id: string; name: string; location: string };
    const itemName = row.item_name as string;
    const quantity = row.quantity as number;
    const threshold = row.low_stock_threshold as number;
    const unit = row.unit as string;
    const updatedAt = row.updated_at as string;

    const flavour = flavourByName.get(itemName);

    return {
      club: {
        id: venue.id,
        name: venue.name,
        location: venue.location,
      },
      flavour: {
        id: flavour?.id ?? null,
        name: itemName,
        packet_weight_grams: flavour?.packet_weight_grams ?? null,
      },
      stock: {
        quantity,
        unit,
        minimum_required: threshold,
        status: computeStatus(quantity, threshold),
      },
      updated_at: updatedAt,
    };
  });
}

function computeMeta(records: StockRecord[]) {
  const clubIds = new Set(records.map((r) => r.club.id));
  let low = 0;
  let oos = 0;
  for (const r of records) {
    if (r.stock.status === "LOW") low++;
    else if (r.stock.status === "OUT_OF_STOCK") oos++;
  }
  return {
    total_clubs: clubIds.size,
    total_items: records.length,
    low_stock_items: low,
    out_of_stock_items: oos,
  };
}

async function computeMetaFromDb(
  supabase: ReturnType<typeof createClient>,
  clubId: string | null,
  flavourName: string | null,
) {
  let q = supabase
    .from("stock")
    .select("venue_id, quantity, low_stock_threshold")
    .eq("category", "flavour");

  if (clubId) q = q.eq("venue_id", clubId);
  if (flavourName) q = q.eq("item_name", flavourName);

  const { data, error } = await q;

  if (error || !data) {
    return { total_clubs: 0, total_items: 0, low_stock_items: 0, out_of_stock_items: 0 };
  }

  const clubIds = new Set<string>();
  let low = 0;
  let oos = 0;
  for (const row of data) {
    clubIds.add(row.venue_id);
    const status = computeStatus(row.quantity, row.low_stock_threshold);
    if (status === "LOW") low++;
    else if (status === "OUT_OF_STOCK") oos++;
  }

  return {
    total_clubs: clubIds.size,
    total_items: data.length,
    low_stock_items: low,
    out_of_stock_items: oos,
  };
}
