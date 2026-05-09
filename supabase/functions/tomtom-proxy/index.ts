import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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

type CachedTomTomResponse = {
  body: string;
  contentType: string;
  status: number;
  expiresAt: number;
  staleUntil: number;
};

const responseCache = new Map<string, CachedTomTomResponse>();
const inFlightRequests = new Map<string, Promise<CachedTomTomResponse>>();
let tomtomBackoffUntil = 0;

const emptySearchResponse = JSON.stringify({ results: [], rateLimited: true });

function ttlForPath(path: string): number {
  if (path.startsWith('/search/2/nearbySearch/')) return 10 * 60_000;
  if (path.startsWith('/search/2/reverseGeocode/')) return 30 * 60_000;
  if (path.startsWith('/search/2/geocode/')) return 30 * 60_000;
  if (path.startsWith('/search/2/search/')) return 2 * 60_000;
  if (path.startsWith('/routing/1/calculateRoute/')) return 2 * 60_000;
  return 60_000;
}

function isSearchPath(path: string): boolean {
  return path.startsWith('/search/2/nearbySearch/') || path.startsWith('/search/2/search/');
}

function cacheKeyFor(url: URL): string {
  const params = [...url.searchParams.entries()]
    .filter(([key]) => key !== 'key')
    .sort(([a], [b]) => a.localeCompare(b));
  return `${url.pathname}?${params.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

function responseFromCache(entry: CachedTomTomResponse, extraHeaders: Record<string, string> = {}) {
  return new Response(entry.body, {
    status: entry.status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      'Content-Type': entry.contentType,
    },
  });
}

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
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
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

    // Retry with exponential backoff on 429 (TomTom rate limit).
    let ttRes: Response;
    let body = '';
    const MAX_RETRIES = 4;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      ttRes = await fetch(ttUrl.toString());
      body = await ttRes.text();
      if (ttRes.status !== 429) break;
      const delay = 250 * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
      console.warn(`TomTom 429, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, delay));
    }
    return new Response(body, {
      status: ttRes!.status,
      headers: {
        ...corsHeaders,
        'Content-Type': ttRes!.headers.get('Content-Type') ?? 'application/json',
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
