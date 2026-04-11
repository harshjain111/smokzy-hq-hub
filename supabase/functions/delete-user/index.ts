import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  assertCallerIsAdmin,
  AuthzError,
  countAdmins,
  errorResponse,
  getCurrentRole,
  logAdminAudit,
} from "../_shared/authz.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let callerId: string | null = null;
  let callerIp: string | null = null;
  let targetUserId: string | null = null;
  let oldRole: string | null = null;

  try {
    // 1. AuthZ: caller must be an admin.
    ({ callerId, ip: callerIp } = await assertCallerIsAdmin(req, supabaseAdmin));

    const body = await req.json();
    const { userId } = body ?? {};
    if (!userId || typeof userId !== 'string') {
      throw new AuthzError(400, 'Invalid request', 'missing userId');
    }
    targetUserId = userId;

    // 2. Self-delete guard. Admins must not delete their own account.
    if (userId === callerId) {
      throw new AuthzError(
        409,
        'Cannot delete your own account',
        `caller ${callerId} attempted self-delete`,
      );
    }

    // 3. Last-admin-delete guard. If the target is an admin and deleting
    //    them would leave zero admins, refuse.
    oldRole = await getCurrentRole(supabaseAdmin, userId);
    if (oldRole === 'admin') {
      const adminCount = await countAdmins(supabaseAdmin);
      if (adminCount <= 1) {
        throw new AuthzError(
          409,
          'Cannot delete the last admin — promote another user first',
          `caller ${callerId} tried to delete last admin ${userId}`,
        );
      }
    }

    console.log('Deleting user:', userId, 'by', callerId);

    // Delete user (this will cascade to profiles and user_roles)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error('Delete error:', error);
      throw error;
    }

    console.log('User deleted successfully');

    logAdminAudit({
      action: 'delete_user',
      caller_id: callerId,
      target_user_id: targetUserId,
      old_role: oldRole,
      new_role: null,
      ip: callerIp,
      success: true,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error deleting user:', error);
    logAdminAudit({
      action: 'delete_user',
      caller_id: callerId ?? 'unknown',
      target_user_id: targetUserId,
      old_role: oldRole,
      ip: callerIp,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error, corsHeaders);
  }
});
