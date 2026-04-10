import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, fullName, phone, password, role, venueId } = await req.json();

    console.log('Updating user:', { userId, fullName, phone, role, venueId });

    // Update password if provided
    if (password) {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password }
      );

      if (passwordError) {
        console.error('Password update error:', passwordError);
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

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error updating user:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update user' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
