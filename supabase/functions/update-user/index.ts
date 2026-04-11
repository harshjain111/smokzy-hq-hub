import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  assertCallerIsAdmin,
  assertValidRole,
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
    const { userId, fullName, phone, password, role, venueId } = body ?? {};

    if (!userId || typeof userId !== 'string') {
      throw new AuthzError(400, 'Invalid request', 'missing userId');
    }
    targetUserId = userId;

    // 2. Validate role against hardcoded allowlist.
    assertValidRole(role);

    // 3. Last-admin-demotion guard. Look up the target's current role; if
    //    they're being demoted from admin and there is only one admin
    //    left in the system, refuse. This prevents the "locked out at
    //    2 AM" failure mode whether the caller is demoting themselves
    //    or another admin.
    oldRole = await getCurrentRole(supabaseAdmin, userId);
    if (oldRole === 'admin' && role !== 'admin') {
      const adminCount = await countAdmins(supabaseAdmin);
      if (adminCount <= 1) {
        throw new AuthzError(
          409,
          'Cannot demote the last admin — promote another user first',
          `caller ${callerId} tried to demote last admin ${userId}`,
        );
      }
    }

    console.log('Updating user:', { userId, fullName, phone, role, venueId, callerId });

    // Update password if provided
    if (password) {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password }
      );

      if (passwordError) {
        console.error('Password update error:', passwordError);
        if (passwordError.code === 'weak_password' || passwordError.name === 'AuthWeakPasswordError') {
          return new Response(
            JSON.stringify({
              success: false,
              code: 'weak_password',
              error: 'Password is too weak or has been found in a data breach. Please choose a stronger, unique password.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw passwordError;
      }
      console.log('Password updated');
    }

    // Update profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        phone,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile error:', profileError);
      throw profileError;
    }

    console.log('Profile updated');

    // First, delete existing role for this user (to handle role changes properly)
    const { error: deleteError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Delete role error:', deleteError);
      throw deleteError;
    }

    // Insert new role - for club_management and employee, venueId is required
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role,
        venue_id: role === 'employee' ? venueId : null,
      });

    if (roleError) {
      console.error('Role insert error:', roleError);
      throw roleError;
    }

    console.log('User role updated to:', role);

    logAdminAudit({
      action: 'update_user',
      caller_id: callerId,
      target_user_id: targetUserId,
      old_role: oldRole,
      new_role: role,
      ip: callerIp,
      success: true,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error updating user:', error);
    logAdminAudit({
      action: 'update_user',
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
