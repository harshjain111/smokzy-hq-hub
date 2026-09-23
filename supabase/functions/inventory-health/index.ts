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

    // Light query to verify DB connectivity
    const { error } = await supabase
      .from("venues")
      .select("id", { count: "exact", head: true });

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          service: "club-stock-integration",
          status: "unhealthy",
          reason: "Database connection failed.",
          timestamp: new Date().toISOString(),
        }),
        {
          status: 503,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        service: "club-stock-integration",
        status: "healthy",
        timestamp: new Date().toISOString(),
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
