import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  assertCallerIsAdmin,
  assertValidRole,
  errorResponse,
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

  try {
    // 1. AuthZ: caller must be an admin (role resolved from DB, not JWT claims).
    ({ callerId, ip: callerIp } = await assertCallerIsAdmin(req, supabaseAdmin));

    const body = await req.json();
    const { fullName, phone, password, role, venueId } = body ?? {};

    // 2. Validate role against hardcoded allowlist before any DB write.
    assertValidRole(role);

    console.log('Creating user:', { fullName, phone, role, venueId, callerId });

    // Create auth user
    const email = `${phone}@smokzy.com`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone,
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('User creation failed');
    }

    console.log('User created:', authData.user.id);

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name: fullName,
        phone,
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      throw profileError;
    }

    console.log('Profile created');

    // Create user role - for club_management and employee, venueId is required
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role,
        venue_id: role === 'employee' ? venueId : null,
      });

    if (roleError) {
      console.error('Role error:', roleError);
      throw roleError;
    }

    console.log('User role created');

    logAdminAudit({
      action: 'create_user',
      caller_id: callerId,
      target_user_id: authData.user.id,
      old_role: null,
      new_role: role,
      ip: callerIp,
      success: true,
    });

    return new Response(
      JSON.stringify({ success: true, userId: authData.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    // Server-side: log the real reason. Client: generic safe message.
    console.error('Error creating user:', error);
    logAdminAudit({
      action: 'create_user',
      caller_id: callerId ?? 'unknown',
      target_user_id: null,
      ip: callerIp,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error, corsHeaders);
  }
});
