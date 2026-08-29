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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { venue_id } = await req.json();
    if (!venue_id) {
      return new Response(JSON.stringify({ error: "venue_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Settings (fall back to the same defaults as the settings page).
    const { data: settingsRows } = await supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["grams_per_chillum", "discrepancy_threshold_percent", "min_stock_threshold"]);

    const settings = new Map((settingsRows || []).map((r) => [r.key, r.value]));
    const gramsPerChillum = parseFloat(settings.get("grams_per_chillum") || "25");
    const thresholdPercent = parseFloat(settings.get("discrepancy_threshold_percent") || "10");
    const minStockThreshold = parseInt(settings.get("min_stock_threshold") || "10", 10);

    // Today's closing stock: sum of live flavour quantities for this venue.
    const { data: stockItems } = await supabase
      .from("stock")
      .select("quantity")
      .eq("venue_id", venue_id)
      .eq("category", "flavour");

    const todayClosing = (stockItems || []).reduce((sum, s) => sum + (s.quantity || 0), 0);

    // Yesterday's stored closing stock (the baseline). Null if we have none yet.
    const { data: yesterdayRecord } = await supabase
      .from("venue_stock_daily")
      .select("closing_stock")
      .eq("venue_id", venue_id)
      .eq("date", yesterday)
      .maybeSingle();

    const yesterdayClosing = yesterdayRecord?.closing_stock ?? null;

    // Today's received grams from dispatches, converting packet-mode rows via the flavour's
    // packet weight.
    const { data: dispatchRows } = await supabase
      .from("packet_dispatches")
      .select("quantity_sent, unit, flavour_id")
      .eq("venue_id", venue_id)
      .eq("date", today);

    let receivedToday = 0;
    if (dispatchRows && dispatchRows.length > 0) {
      const flavourIds = [...new Set(dispatchRows.map((d) => d.flavour_id))];
      const { data: flavours } = await supabase
        .from("flavours")
        .select("id, packet_weight_grams")
        .in("id", flavourIds);
      const weightMap = new Map((flavours || []).map((f) => [f.id, f.packet_weight_grams]));

      for (const d of dispatchRows) {
        if (d.unit === "grams") {
          receivedToday += d.quantity_sent;
        } else {
          receivedToday += d.quantity_sent * (weightMap.get(d.flavour_id) || 0);
        }
      }
    }

    const actualConsumption = yesterdayClosing !== null
      ? (yesterdayClosing + receivedToday) - todayClosing
      : null;

    // Persist today's snapshot so tomorrow's run has a baseline, regardless of whether we
    // can compute a discrepancy yet.
    const { data: existingToday } = await supabase
      .from("venue_stock_daily")
      .select("id")
      .eq("venue_id", venue_id)
      .eq("date", today)
      .maybeSingle();

    const snapshotRow = {
      venue_id,
      date: today,
      opening_stock: yesterdayClosing,
      opening_stock_source: yesterdayClosing !== null ? "auto" : "missing",
      packets_received: receivedToday,
      packets_used: actualConsumption ?? 0,
      closing_stock: todayClosing,
      min_stock_threshold: minStockThreshold,
    };

    if (existingToday) {
      await supabase.from("venue_stock_daily").update(snapshotRow).eq("id", existingToday.id);
    } else {
      await supabase.from("venue_stock_daily").insert(snapshotRow);
    }

    // No baseline yet (first run for this venue) -- nothing to compare, done.
    if (actualConsumption === null) {
      return new Response(JSON.stringify({ status: "no_baseline", closing_stock: todayClosing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Expected consumption from sales of packet-trackable categories.
    const { data: trackableCats } = await supabase
      .from("venue_hookah_categories")
      .select("id")
      .eq("venue_id", venue_id)
      .eq("is_packet_trackable", true);

    const trackableIds = (trackableCats || []).map((c) => c.id);

    let chillumsSold = 0;
    if (trackableIds.length > 0) {
      const { data: sales } = await supabase
        .from("sales_reports")
        .select("quantity_sold")
        .eq("venue_id", venue_id)
        .eq("report_date", today)
        .in("category_id", trackableIds);
      chillumsSold = (sales || []).reduce((sum, s) => sum + s.quantity_sold, 0);
    }

    const expectedConsumption = gramsPerChillum * chillumsSold;
    const discrepancyPct = expectedConsumption > 0
      ? Math.abs(actualConsumption - expectedConsumption) / expectedConsumption * 100
      : (actualConsumption > 0 ? 100 : 0);

    if (discrepancyPct <= thresholdPercent) {
      return new Response(
        JSON.stringify({ status: "within_tolerance", discrepancyPct, actualConsumption, expectedConsumption }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Notify admins + club_incharge, deduplicated against today's existing notifications
    // for this venue.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "club_incharge"]);
    const notifyIds = [...new Set((roles || []).map((r) => r.user_id))];

    const { data: existingNotifs } = await supabase
      .from("admin_notifications")
      .select("user_id")
      .eq("type", "stock_discrepancy")
      .eq("venue_id", venue_id)
      .gte("created_at", `${today}T00:00:00`);
    const alreadyNotified = new Set((existingNotifs || []).map((n) => n.user_id));

    const toInsert = notifyIds
      .filter((uid) => !alreadyNotified.has(uid))
      .map((uid) => ({
        user_id: uid,
        type: "stock_discrepancy",
        title: "Stock Discrepancy Detected",
        message: `${discrepancyPct.toFixed(0)}% gap between expected and actual flavour consumption today`,
        venue_id,
        priority: "high",
        link: "/daily-report",
      }));

    if (toInsert.length > 0) {
      await supabase.from("admin_notifications").insert(toInsert);
    }

    return new Response(
      JSON.stringify({
        status: "discrepancy_notified",
        discrepancyPct,
        actualConsumption,
        expectedConsumption,
        notified: toInsert.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("check-stock-discrepancy error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
