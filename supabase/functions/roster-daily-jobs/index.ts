import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    const { action, date } = await req.json();
    const targetDate = date || new Date().toISOString().split("T")[0];

    switch (action) {
      case "prefill": {
        // Get all venues
        const { data: venues } = await supabase.from("venues").select("id");
        if (!venues) break;

        for (const venue of venues) {
          // Check if daily roster already exists
          const { data: existing } = await supabase
            .from("daily_roster")
            .select("id")
            .eq("venue_id", venue.id)
            .eq("date", targetDate)
            .limit(1);

          if (existing && existing.length > 0) continue;

          // Get weekly roster assignments
          const { data: weekly } = await supabase
            .from("roster_assignments")
            .select("staff_id, shift_start, shift_end")
            .eq("venue_id", venue.id)
            .eq("date", targetDate)
            .eq("status", "assigned");

          if (!weekly || weekly.length === 0) continue;

          const rows = weekly.map((w: any) => ({
            venue_id: venue.id,
            date: targetDate,
            staff_id: w.staff_id,
            role: "Staff",
            shift_start: w.shift_start,
            shift_end: w.shift_end,
            status: "draft",
            source: "weekly",
          }));

          await supabase.from("daily_roster").insert(rows);

          // Audit log
          await supabase.from("roster_audit_log").insert({
            venue_id: venue.id,
            roster_date: targetDate,
            action: "prefilled",
            after_data: rows,
          });
        }

        return new Response(JSON.stringify({ ok: true, action: "prefill" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create-tasks": {
        const { data: venues } = await supabase.from("venues").select("id");
        if (!venues) break;

        // Deadline: 2 PM IST = 08:30 UTC
        const deadline = `${targetDate}T08:30:00Z`;

        // Get all club_incharge users
        const { data: incharges } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "club_incharge");

        const assignedTo = incharges?.[0]?.user_id || null;

        for (const venue of venues) {
          await supabase.from("incharge_daily_tasks").upsert({
            task_type: "confirm_daily_roster",
            venue_id: venue.id,
            task_date: targetDate,
            assigned_to: assignedTo,
            deadline,
            status: "pending",
          }, { onConflict: "task_type,venue_id,task_date" });
        }

        return new Response(JSON.stringify({ ok: true, action: "create-tasks" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check-overdue": {
        const { error } = await supabase
          .from("incharge_daily_tasks")
          .update({ status: "overdue" })
          .eq("task_date", targetDate)
          .eq("task_type", "confirm_daily_roster")
          .eq("status", "pending");

        // Generate notifications for overdue
        const { data: overdueTasks } = await supabase
          .from("incharge_daily_tasks")
          .select("venue_id, assigned_to")
          .eq("task_date", targetDate)
          .eq("status", "overdue");

        if (overdueTasks) {
          const { data: venues } = await supabase.from("venues").select("id, name");
          const venueMap = new Map((venues || []).map((v: any) => [v.id, v.name]));

          for (const task of overdueTasks) {
            if (!task.assigned_to) continue;
            await supabase.from("admin_notifications").insert({
              user_id: task.assigned_to,
              venue_id: task.venue_id,
              type: "roster_overdue",
              title: "Daily Roster OVERDUE",
              message: `Daily Roster overdue for ${venueMap.get(task.venue_id) || "venue"} on ${targetDate}`,
              priority: "high",
              link: "/roster/daily",
            });
          }
        }

        return new Response(JSON.stringify({ ok: true, action: "check-overdue" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check-missed": {
        await supabase
          .from("incharge_daily_tasks")
          .update({ status: "missed" })
          .eq("task_date", targetDate)
          .eq("task_type", "confirm_daily_roster")
          .in("status", ["pending", "overdue"]);

        return new Response(JSON.stringify({ ok: true, action: "check-missed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send-reminders": {
        const { data: pending } = await supabase
          .from("incharge_daily_tasks")
          .select("venue_id, assigned_to")
          .eq("task_date", targetDate)
          .eq("task_type", "confirm_daily_roster")
          .eq("status", "pending");

        if (pending && pending.length > 0) {
          const { data: venues } = await supabase.from("venues").select("id, name");
          const venueMap = new Map((venues || []).map((v: any) => [v.id, v.name]));
          const assignedTo = pending[0].assigned_to;

          if (assignedTo) {
            const venueNames = pending.map(p => venueMap.get(p.venue_id) || "venue").join(", ");
            await supabase.from("admin_notifications").insert({
              user_id: assignedTo,
              type: "roster_reminder",
              title: "Daily Rosters Pending",
              message: `${pending.length} venue(s) pending confirmation: ${venueNames}`,
              priority: "medium",
              link: "/roster/daily",
            });
          }
        }

        return new Response(JSON.stringify({ ok: true, action: "send-reminders" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
