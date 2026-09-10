import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  assertInventoryApiKey,
  inventoryCorsHeaders,
  inventoryErrorResponse,
} from "../_shared/inventory-auth.ts";

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

    const { data, error } = await supabase
      .from("stock")
      .select("venue_id, quantity, low_stock_threshold, updated_at")
      .eq("category", "flavour");

    if (error) {
      console.error("[INVENTORY_SUMMARY] stock fetch failed:", error.message);
      throw new Error("Failed to fetch stock data.");
    }

    const rows = data || [];
    const clubIds = new Set<string>();
    let low = 0;
    let oos = 0;
    let ok = 0;
    let latestUpdate = "";

    for (const row of rows) {
      clubIds.add(row.venue_id);

      if (row.quantity === 0) {
        oos++;
      } else if (row.quantity < row.low_stock_threshold) {
        low++;
      } else {
        ok++;
      }

      if (row.updated_at && row.updated_at > latestUpdate) {
        latestUpdate = row.updated_at;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          total_clubs: clubIds.size,
          total_items: rows.length,
          ok_items: ok,
          low_stock_items: low,
          out_of_stock_items: oos,
        },
        last_updated_at: latestUpdate || null,
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
