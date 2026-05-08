// Seed demo users (chef + chauffeur). Idempotent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEMO = [
  { email: 'chef@demo.se', password: 'demo1234', name: 'Demo Chef', role: 'chef' as const },
  { email: 'chauffeur@demo.se', password: 'demo1234', name: 'Demo Chaufför', role: 'chauffeur' as const },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const results: any[] = [];
  for (const u of DEMO) {
    // Try to find existing user
    const { data: list } = await admin.auth.admin.listUsers();
    let user = list?.users?.find((x: any) => x.email === u.email);

    if (!user) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { display_name: u.name },
      });
      if (error) { results.push({ email: u.email, error: error.message }); continue; }
      user = created.user;
    }

    if (user) {
      // Ensure role
      await admin.from('user_roles').upsert(
        { user_id: user.id, role: u.role },
        { onConflict: 'user_id,role' },
      );
      results.push({ email: u.email, id: user.id, role: u.role, ok: true });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
