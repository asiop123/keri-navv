import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.45.0/cors';

const TOMTOM_API_KEY = Deno.env.get('TOMTOM_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Allowlist of TomTom API path prefixes the proxy will forward.
const ALLOWED_PREFIXES = [
  '/search/2/geocode/',
  '/search/2/reverseGeocode/',
  '/search/2/nearbySearch/',
  '/search/2/search/',
  '/routing/1/calculateRoute/',
];

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check — only authenticated users may use the proxy.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    // Special endpoint: return the tile key for authenticated map tiles.
    if (url.pathname.endsWith('/tile-key')) {
      return new Response(JSON.stringify({ key: TOMTOM_API_KEY }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Expect ?path=/search/2/... &<other tomtom params>
    const path = url.searchParams.get('path');
    if (!path || !isAllowed(path)) {
      return new Response(JSON.stringify({ error: 'Path not allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build TomTom URL: copy all query params except `path`, and inject key.
    const ttUrl = new URL(`https://api.tomtom.com${path}`);
    url.searchParams.forEach((v, k) => {
      if (k !== 'path') ttUrl.searchParams.append(k, v);
    });
    ttUrl.searchParams.set('key', TOMTOM_API_KEY);

    const ttRes = await fetch(ttUrl.toString());
    const body = await ttRes.text();
    return new Response(body, {
      status: ttRes.status,
      headers: {
        ...corsHeaders,
        'Content-Type': ttRes.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch (err) {
    console.error('tomtom-proxy error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
