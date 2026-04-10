import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, serviceKey);
  const today = new Date().toISOString().split("T")[0];
  const notifications: any[] = [];

  // Get all admin & club_incharge user IDs
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "club_incharge"]);

  const adminIds = (adminRoles || []).filter(r => r.role === "admin").map(r => r.user_id);
  const inchargeIds = (adminRoles || []).filter(r => r.role === "club_incharge").map(r => r.user_id);
  const notifyIds = [...new Set([...adminIds, ...inchargeIds])];

  // 1. Mismatch > 0 for any club
  const { data: stockDaily } = await supabase
    .from("venue_stock_daily")
    .select("venue_id, packets_used")
    .eq("date", today)
    .gt("packets_used", 0);

  const { data: salesData } = await supabase
    .from("sales_reports")
    .select("venue_id, quantity_sold, category_id")
    .eq("report_date", today);

  const { data: trackableCats } = await supabase
    .from("venue_hookah_categories")
    .select("id")
    .eq("is_packet_trackable", true);

  const trackableIds = new Set((trackableCats || []).map(c => c.id));

  const venueUsed = new Map<string, number>();
  (stockDaily || []).forEach(s => {
    venueUsed.set(s.venue_id, (venueUsed.get(s.venue_id) || 0) + s.packets_used);
  });

  const venueSold = new Map<string, number>();
  (salesData || []).filter(s => trackableIds.has(s.category_id)).forEach(s => {
    venueSold.set(s.venue_id, (venueSold.get(s.venue_id) || 0) + s.quantity_sold);
  });

  for (const [venueId, used] of venueUsed) {
    const sold = venueSold.get(venueId) || 0;
    const mismatch = used - sold;
    if (mismatch > 0) {
      for (const uid of notifyIds) {
        notifications.push({
          user_id: uid,
          type: "mismatch",
          title: "Packet Mismatch Detected",
          message: `${mismatch} packets unaccounted at a venue today`,
          venue_id: venueId,
          priority: "high",
          link: "/daily-report",
        });
      }
    }
  }

  // 2. Low stock
  const { data: lowStock } = await supabase
    .from("venue_stock_daily")
    .select("venue_id, closing_stock, min_stock_threshold")
    .eq("date", today)
    .not("closing_stock", "is", null);

  (lowStock || []).forEach(v => {
    if (v.closing_stock !== null && v.closing_stock <= v.min_stock_threshold) {
      for (const uid of inchargeIds) {
        notifications.push({
          user_id: uid,
          type: "low_stock",
          title: "Low Stock Alert",
          message: `Only ${v.closing_stock} packets remaining (threshold: ${v.min_stock_threshold})`,
          venue_id: v.venue_id,
          priority: "medium",
          link: "/daily-report",
        });
      }
    }
  });

  // 3. Staff not checked in 30 min after roster shift_start
  const { data: todayRoster } = await supabase
    .from("roster_assignments")
    .select("staff_id, venue_id, shift_start")
    .eq("date", today)
    .eq("status", "assigned");

  const { data: todayBlocks } = await supabase
    .from("staff_attendance_blocks")
    .select("user_id")
    .gte("check_in_time", `${today}T00:00:00`)
    .lte("check_in_time", `${today}T23:59:59`);

  const checkedInStaff = new Set((todayBlocks || []).map(b => b.user_id));
  const now = new Date();

  (todayRoster || []).forEach(r => {
    if (!checkedInStaff.has(r.staff_id) && r.shift_start) {
      const [h, m] = r.shift_start.split(":").map(Number);
      const shiftTime = new Date(now);
      shiftTime.setHours(h, m, 0, 0);
      const diffMin = (now.getTime() - shiftTime.getTime()) / 60000;
      if (diffMin > 30) {
        for (const uid of inchargeIds) {
          notifications.push({
            user_id: uid,
            type: "late_checkin",
            title: "Staff Late Check-in",
            message: `Staff not checked in ${Math.round(diffMin)} min after shift start`,
            venue_id: r.venue_id,
            priority: "high",
            link: "/roster/daily",
          });
        }
      }
    }
  });

  // 4. Club not inspected in 3+ days
  const { data: venues } = await supabase.from("venues").select("id, name");
  const { data: recentInspections } = await supabase
    .from("inspections")
    .select("venue_id, date")
    .gte("date", new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0]);

  const inspectedVenues = new Set((recentInspections || []).map(i => i.venue_id));
  (venues || []).forEach(v => {
    if (!inspectedVenues.has(v.id)) {
      for (const uid of inchargeIds) {
        notifications.push({
          user_id: uid,
          type: "inspection_overdue",
          title: "Inspection Overdue",
          message: `${v.name} not inspected in 3+ days`,
          venue_id: v.id,
          priority: "low",
          link: "/inspections",
        });
      }
    }
  });

  // 5. Poor condition accessories
  const { data: poorAccessories } = await supabase
    .from("venue_accessories")
    .select("venue_id, item_type")
    .eq("condition", "poor");

  (poorAccessories || []).forEach(a => {
    for (const uid of inchargeIds) {
      notifications.push({
        user_id: uid,
        type: "poor_accessory",
        title: "Poor Equipment Condition",
        message: `${a.item_type} in poor condition`,
        venue_id: a.venue_id,
        priority: "medium",
        link: "/accessories",
      });
    }
  });

  // Deduplicate: check existing notifications of same type+venue today
  const { data: existing } = await supabase
    .from("admin_notifications")
    .select("type, venue_id, user_id")
    .gte("created_at", `${today}T00:00:00`);

  const existingSet = new Set(
    (existing || []).map(e => `${e.type}|${e.venue_id || ""}|${e.user_id}`)
  );

  const toInsert = notifications.filter(
    n => !existingSet.has(`${n.type}|${n.venue_id || ""}|${n.user_id}`)
  );

  if (toInsert.length > 0) {
    await supabase.from("admin_notifications").insert(toInsert);
  }

  return new Response(
    JSON.stringify({ generated: toInsert.length, skipped: notifications.length - toInsert.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
