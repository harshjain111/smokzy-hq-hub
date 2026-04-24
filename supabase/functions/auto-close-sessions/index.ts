import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    console.log(`Auto-close sessions: checking for stale sessions before ${todayStr}`);

    // Find all open sessions where session_date < today
    const { data: staleSessions, error: fetchError } = await supabase
      .from("club_sessions")
      .select("id, session_date, venue_id")
      .eq("status", "open")
      .lt("session_date", todayStr);

    if (fetchError) {
      throw fetchError;
    }

    if (!staleSessions || staleSessions.length === 0) {
      console.log("No stale sessions found.");
      return new Response(JSON.stringify({ message: "No stale sessions", closed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${staleSessions.length} stale session(s) to close.`);

    let closedCount = 0;
    let checkedOutCount = 0;

    for (const session of staleSessions) {
      // Force-close the session
      const { error: updateError } = await supabase
        .from("club_sessions")
        .update({
          status: "force_closed",
          closed_at: new Date().toISOString(),
          force_close_reason: "Auto-closed: session exceeded daily boundary",
        })
        .eq("id", session.id);

      if (updateError) {
        console.error(`Failed to close session ${session.id}:`, updateError);
        continue;
      }
      closedCount++;

      // Auto-checkout any staff still checked in
      const { data: openBlocks } = await supabase
        .from("staff_attendance_blocks")
        .select("id")
        .eq("session_id", session.id)
        .is("check_out_time", null);

      if (openBlocks && openBlocks.length > 0) {
        const { error: checkoutError } = await supabase
          .from("staff_attendance_blocks")
          .update({
            check_out_time: new Date().toISOString(),
            duty_completed: false,
          })
          .eq("session_id", session.id)
          .is("check_out_time", null);

        if (checkoutError) {
          console.error(`Failed to auto-checkout staff for session ${session.id}:`, checkoutError);
        } else {
          checkedOutCount += openBlocks.length;
        }
      }

      // Also end any open breaks
      await supabase
        .from("staff_breaks")
        .update({
          break_end_time: new Date().toISOString(),
          duration_minutes: 0,
        })
        .eq("session_id", session.id)
        .is("break_end_time", null);
    }

    const result = {
      message: `Closed ${closedCount} sessions, auto-checked-out ${checkedOutCount} staff`,
      closed: closedCount,
      checkedOut: checkedOutCount,
    };
    console.log(result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auto-close error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
