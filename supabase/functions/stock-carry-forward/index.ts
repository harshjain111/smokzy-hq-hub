import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all venues
    const { data: venues, error: venuesError } = await supabase
      .from("venues")
      .select("id, name");

    if (venuesError) {
      console.error("Failed to fetch venues:", venuesError);
      return new Response(JSON.stringify({ error: "Failed to fetch venues" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const results: { venue: string; status: string; error?: string }[] = [];

    for (const venue of venues || []) {
      try {
        // Check if today's record already exists
        const { data: existing } = await supabase
          .from("venue_stock_daily")
          .select("id")
          .eq("venue_id", venue.id)
          .eq("date", today)
          .maybeSingle();

        if (existing) {
          results.push({ venue: venue.name, status: "skipped_exists" });
          continue;
        }

        // Get yesterday's closing stock
        const { data: yesterdayRecord } = await supabase
          .from("venue_stock_daily")
          .select("closing_stock")
          .eq("venue_id", venue.id)
          .eq("date", yesterday)
          .maybeSingle();

        const hasClosingStock = yesterdayRecord?.closing_stock != null;

        // Get global min_stock_threshold
        const { data: globalSetting } = await supabase
          .from("global_settings")
          .select("value")
          .eq("key", "min_stock_threshold")
          .maybeSingle();

        const minThreshold = globalSetting?.value ? parseInt(globalSetting.value, 10) : 10;

        // Insert today's record
        const { error: insertError } = await supabase
          .from("venue_stock_daily")
          .insert({
            venue_id: venue.id,
            date: today,
            opening_stock: hasClosingStock ? yesterdayRecord!.closing_stock : null,
            opening_stock_source: hasClosingStock ? "auto" : "missing",
            min_stock_threshold: minThreshold,
            packets_received: 0,
            packets_used: 0,
            closing_stock: null,
          });

        if (insertError) {
          console.error(`Error for venue ${venue.name}:`, insertError);
          results.push({ venue: venue.name, status: "error", error: insertError.message });
        } else {
          results.push({
            venue: venue.name,
            status: hasClosingStock ? "auto_carried" : "missing_opening",
          });
        }
      } catch (venueErr) {
        const msg = venueErr instanceof Error ? venueErr.message : String(venueErr);
        console.error(`Exception for venue ${venue.name}:`, msg);
        results.push({ venue: venue.name, status: "error", error: msg });
      }
    }

    console.log("Stock carry-forward results:", JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Stock carry-forward fatal error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
