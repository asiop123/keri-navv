import { TimelineEntry, RestStopInfo, RestStopSuitability, RestStopFacilities } from '@/types';
import { supabase } from '@/integrations/supabase/client';

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tomtom-proxy`;

type CachedProxyResponse = {
  body: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  expiresAt: number;
};

const proxyResponseCache = new Map<string, CachedProxyResponse>();
const proxyInFlight = new Map<string, Promise<CachedProxyResponse>>();

function responseFromCache(entry: CachedProxyResponse): Response {
  return new Response(entry.body, {
    status: entry.status,
    statusText: entry.statusText,
    headers: entry.headers,
  });
}

function proxyCacheTtl(path: string): number {
  if (path.startsWith('/search/2/nearbySearch/')) return 10 * 60_000;
  if (path.startsWith('/search/2/search/')) return 2 * 60_000;
  if (path.startsWith('/search/2/geocode/') || path.startsWith('/search/2/reverseGeocode/')) return 30 * 60_000;
  if (path.startsWith('/routing/1/calculateRoute/')) return 2 * 60_000;
  return 60_000;
}

async function runLimited<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

/**
 * Call TomTom via the secure edge-function proxy.
 * `path` is the TomTom API path (e.g. "/search/2/geocode/foo.json").
 * `params` are the TomTom query params (the proxy injects the API key).
 */
async function proxyFetch(path: string, params: Record<string, string | number | undefined>): Promise<Response> {
  const url = new URL(PROXY_URL);
  url.searchParams.set('path', path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const cacheKey = url.toString();
  const cached = proxyResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return responseFromCache(cached);

  const existing = proxyInFlight.get(cacheKey);
  if (existing) return responseFromCache(await existing);

  const request = (async (): Promise<CachedProxyResponse> => {
    const res = await fetch(url.toString(), { headers: await authHeaders() });
    const body = await res.text();
    const entry: CachedProxyResponse = {
      body,
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      expiresAt: Date.now() + proxyCacheTtl(path),
    };
    if (res.ok) proxyResponseCache.set(cacheKey, entry);
    return entry;
  })();

  proxyInFlight.set(cacheKey, request);
  return responseFromCache(await request.finally(() => proxyInFlight.delete(cacheKey)));
}

export interface VehicleParams {
  weightKg?: number;
  heightM?: number;
  widthM?: number;
  lengthM?: number;
}

export interface GuidanceInstruction {
  routeOffsetMeters: number;
  travelTimeSeconds: number;
  point: { lat: number; lng: number };
  maneuver?: string;
  message: string;
  street?: string;
  signpostText?: string;
  exitNumber?: string;
  junctionType?: string;
  roadNumbers?: string[];
  roundaboutExitNumber?: number;
}

export interface RouteResult {
  distanceKm: number;
  travelTimeSeconds: number;
  departureTime: string;
  arrivalTime: string;
  legs: RouteLeg[];
  geoJson: GeoJSON.FeatureCollection;
  bbox: [number, number, number, number];
  waypoints: { lat: number; lng: number; name: string }[];
  routePoints: [number, number][];
  alternatives?: RouteResult[];
  instructions?: GuidanceInstruction[];
}

export interface RouteLeg {
  distanceKm: number;
  travelTimeSeconds: number;
  startLabel: string;
  endLabel: string;
}

interface GeocodingResult {
  lat: number;
  lng: number;
  name: string;
}

export async function geocode(query: string): Promise<GeocodingResult> {
  const res = await proxyFetch(`/search/2/geocode/${encodeURIComponent(query)}.json`, {
    countrySet: 'SE,NO,DK,FI',
    limit: 1,
  });
  if (!res.ok) throw new Error(`Geocoding failed for "${query}": ${res.status}`);
  const data = await res.json();
  if (!data.results?.length) throw new Error(`Ingen plats hittades för "${query}"`);
  const r = data.results[0];
  return {
    lat: r.position.lat,
    lng: r.position.lon,
    name: r.address?.freeformAddress || query,
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await proxyFetch(`/search/2/reverseGeocode/${lat},${lng}.json`, { language: 'sv-SE' });
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json();
    const addr = data.addresses?.[0]?.address;
    if (!addr) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    return addr.municipality || addr.freeformAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

function parseRoute(
  routeData: any,
  allCoords: GeocodingResult[]
): RouteResult {
  const summary = routeData.summary;

  const allPoints: [number, number][] = [];
  for (const leg of routeData.legs) {
    for (const point of leg.points) {
      allPoints.push([point.longitude, point.latitude]);
    }
  }

  const geoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: allPoints },
      properties: {},
    }],
  };

  const legs: RouteLeg[] = routeData.legs.map((leg: any, i: number) => ({
    distanceKm: Math.round(leg.summary.lengthInMeters / 1000),
    travelTimeSeconds: leg.summary.travelTimeInSeconds,
    startLabel: allCoords[i].name,
    endLabel: allCoords[i + 1].name,
  }));

  const lats = allPoints.map(p => p[1]);
  const lngs = allPoints.map(p => p[0]);

  // Parse turn-by-turn guidance instructions
  let instructions: GuidanceInstruction[] | undefined;
  const rawInstr = routeData.guidance?.instructions;
  if (Array.isArray(rawInstr) && rawInstr.length > 0) {
    instructions = rawInstr.map((ins: any) => ({
      routeOffsetMeters: ins.routeOffsetInMeters ?? 0,
      travelTimeSeconds: ins.travelTimeInSeconds ?? 0,
      point: { lat: ins.point?.latitude ?? 0, lng: ins.point?.longitude ?? 0 },
      maneuver: ins.maneuver,
      message: ins.message || ins.combinedMessage || '',
      street: ins.street || ins.streetName,
      signpostText: ins.signpostText || ins.signpost?.text,
      exitNumber: ins.exitNumber,
      junctionType: ins.junctionType,
      roadNumbers: ins.roadNumbers,
      roundaboutExitNumber: ins.roundaboutExitNumber,
    }));
  }

  return {
    distanceKm: Math.round(summary.lengthInMeters / 1000),
    travelTimeSeconds: summary.travelTimeInSeconds,
    departureTime: summary.departureTime,
    arrivalTime: summary.arrivalTime,
    legs,
    geoJson,
    bbox: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
    waypoints: allCoords.map(c => ({ lat: c.lat, lng: c.lng, name: c.name })),
    routePoints: allPoints,
    instructions,
  };
}

export async function calculateRoute(
  startCoord: GeocodingResult,
  endCoord: GeocodingResult,
  waypointCoords: GeocodingResult[],
  departAt?: string,
  vehicleParams?: VehicleParams
): Promise<RouteResult> {
  const locations = [startCoord, ...waypointCoords, endCoord]
    .map(c => `${c.lat},${c.lng}`)
    .join(':');

  const depart = departAt || new Date().toISOString();
  const params: Record<string, string | number | undefined> = {
    travelMode: 'truck',
    departAt: depart,
    routeRepresentation: 'polyline',
    computeTravelTimeFor: 'all',
    maxAlternatives: 2,
    instructionsType: 'tagged',
    language: 'sv-SE',
  };
  if (vehicleParams) {
    if (vehicleParams.weightKg) params.vehicleWeight = vehicleParams.weightKg;
    if (vehicleParams.heightM) params.vehicleHeight = vehicleParams.heightM;
    if (vehicleParams.widthM) params.vehicleWidth = vehicleParams.widthM;
    if (vehicleParams.lengthM) params.vehicleLength = vehicleParams.lengthM;
  } else {
    params.vehicleWeight = 40000;
  }

  const res = await proxyFetch(`/routing/1/calculateRoute/${locations}/json`, params);
  if (!res.ok) throw new Error(`Routing failed: ${res.status}`);
  const data = await res.json();

  if (!data.routes?.length) throw new Error('Ingen rutt hittades');

  const allCoords = [startCoord, ...waypointCoords, endCoord];
  const result = parseRoute(data.routes[0], allCoords);

  // Parse alternatives if available
  if (data.routes.length > 1) {
    result.alternatives = data.routes.slice(1).map((r: any) => parseRoute(r, allCoords));
  }

  return result;
}

function getPointAlongRoute(
  routePoints: [number, number][],
  fraction: number
): { lng: number; lat: number } {
  if (routePoints.length === 0) return { lng: 0, lat: 0 };
  if (fraction <= 0) return { lng: routePoints[0][0], lat: routePoints[0][1] };
  if (fraction >= 1) {
    const last = routePoints[routePoints.length - 1];
    return { lng: last[0], lat: last[1] };
  }

  const distances: number[] = [0];
  let totalDist = 0;
  for (let i = 1; i < routePoints.length; i++) {
    const dx = routePoints[i][0] - routePoints[i - 1][0];
    const dy = routePoints[i][1] - routePoints[i - 1][1];
    totalDist += Math.sqrt(dx * dx + dy * dy);
    distances.push(totalDist);
  }

  const targetDist = fraction * totalDist;
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= targetDist) {
      const segFraction = (targetDist - distances[i - 1]) / (distances[i] - distances[i - 1]);
      const lng = routePoints[i - 1][0] + segFraction * (routePoints[i][0] - routePoints[i - 1][0]);
      const lat = routePoints[i - 1][1] + segFraction * (routePoints[i][1] - routePoints[i - 1][1]);
      return { lng, lat };
    }
  }

  const last = routePoints[routePoints.length - 1];
  return { lng: last[0], lat: last[1] };
}

/**
 * Assess how suitable a rest stop is for a specific vehicle based on
 * its physical dimensions and the stop's category/type.
 */
function assessStopSuitability(
  categories: string[],
  vehicle?: VehicleParams
): { suitability: RestStopSuitability; note: string } {
  if (!vehicle) return { suitability: 'good', note: '' };

  const catsLower = categories.map(c => c.toLowerCase());
  const isTruckStop = catsLower.some(c => c.includes('truck'));
  const isRestArea = catsLower.some(c => c.includes('rest') || c.includes('rast'));
  const isPetrolStation = catsLower.some(c => c.includes('petrol') || c.includes('gas') || c.includes('fuel') || c.includes('bensin'));
  const isParking = catsLower.some(c => c.includes('parking') || c.includes('parkering'));

  const lengthM = vehicle.lengthM || 0;
  const heightM = vehicle.heightM || 0;
  const weightKg = vehicle.weightKg || 0;

  // Truck stops: designed for heavy vehicles
  if (isTruckStop) {
    if (lengthM > 25) {
      return { suitability: 'good', note: `Lastbilsstopp – extra långt ekipage (${lengthM}m), kontrollera svängutrymme` };
    }
    return { suitability: 'perfect', note: `Lastbilsstopp – anpassat för tunga fordon` };
  }

  // Rest areas: usually OK but check dimensions
  if (isRestArea) {
    if (lengthM > 20) {
      return { suitability: 'good', note: `Rastplats – ditt ekipage (${lengthM}m) kan behöva extra utrymme` };
    }
    return { suitability: 'perfect', note: 'Rastplats – bra för tunga fordon' };
  }

  // Parking: may have height/length restrictions
  if (isParking) {
    const warnings: string[] = [];
    if (heightM > 3.5) warnings.push(`höjd ${heightM}m kan vara för hög`);
    if (lengthM > 12) warnings.push(`längd ${lengthM}m – begränsat utrymme`);
    if (weightKg > 16000) warnings.push(`vikt ${(weightKg / 1000).toFixed(0)}t – ej för tung trafik`);

    if (warnings.length > 0) {
      return {
        suitability: lengthM > 16 || heightM > 4 ? 'unsuitable' : 'warning',
        note: `Parkering – ${warnings.join(', ')}`,
      };
    }
    return { suitability: 'good', note: 'Parkering – troligen lämplig' };
  }

  // Petrol stations: tight for large trucks
  if (isPetrolStation) {
    if (lengthM > 16 || weightKg > 26000) {
      return {
        suitability: 'warning',
        note: `Bensinstation – trångt för ${lengthM}m ekipage, ${(weightKg / 1000).toFixed(0)}t`,
      };
    }
    if (heightM > 4) {
      return { suitability: 'warning', note: `Bensinstation – tak kan vara lågt (ditt fordon ${heightM}m)` };
    }
    return { suitability: 'good', note: 'Bensinstation – bör fungera' };
  }

  // Unknown category
  if (lengthM > 16 || weightKg > 26000) {
    return { suitability: 'warning', note: `Okänd typ – verifiera att ${lengthM}m / ${(weightKg / 1000).toFixed(0)}t ryms` };
  }
  return { suitability: 'good', note: '' };
}

/**
 * Detect facilities from TomTom POI categories and classifications.
 * Conservative: only mark as true when there's strong evidence.
 */
function detectFacilitiesFromTomTom(poi: any): RestStopFacilities {
  const cats: string[] = (poi?.categories || []).map((c: string) => c.toLowerCase());
  const classNames: string[] = (poi?.classifications || [])
    .flatMap((cl: any) => (cl?.names || []).map((n: any) => (n?.name || '').toLowerCase()));
  const allTerms = [...cats, ...classNames].join(' ');

  const isTruckStop = allTerms.includes('truck stop') || allTerms.includes('lastbilsparkering');
  const isRestArea = allTerms.includes('rest area') || allTerms.includes('rastplats') || allTerms.includes('rast');
  const isFuelStation = allTerms.includes('petrol') || allTerms.includes('gas station') || allTerms.includes('fuel') || allTerms.includes('bensin') || allTerms.includes('diesel') || allTerms.includes('tankstation');

  return {
    toilet: isTruckStop || isRestArea, // fuel stations don't always have public toilets
    food: allTerms.includes('restaurant') || allTerms.includes('food') || allTerms.includes('café') || allTerms.includes('cafe') || allTerms.includes('fast food'),
    shower: false, // can't reliably determine from category data alone
    fuel: isFuelStation,
    truckParking: isTruckStop || (allTerms.includes('parking') && (allTerms.includes('heavy') || allTerms.includes('truck') || allTerms.includes('lastbil'))),
  };
}

/**
 * Detect facilities from Google Places types
 */
function detectFacilitiesFromGoogle(types: string[], name: string): RestStopFacilities {
  const typesStr = types.join(' ').toLowerCase();
  const nameStr = name.toLowerCase();
  const isTruck = nameStr.includes('truck') || nameStr.includes('lastbil') || typesStr.includes('truck');
  const isFuel = typesStr.includes('gas_station') || nameStr.includes('bensin') || nameStr.includes('diesel') || nameStr.includes('circle k') || nameStr.includes('preem') || nameStr.includes('okq8') || nameStr.includes('st1') || nameStr.includes('ingo');
  const isRestArea = nameStr.includes('rastplats') || nameStr.includes('rast') || nameStr.includes('rest area');

  return {
    toilet: isTruck || isRestArea, // don't assume fuel stations have public toilets
    food: typesStr.includes('restaurant') || typesStr.includes('food') || typesStr.includes('cafe') || typesStr.includes('meal'),
    shower: false, // can't verify from API data
    fuel: isFuel,
    truckParking: isTruck,
  };
}

/**
 * Check if a rest stop matches the required facility filters.
 * If no filters are active (all false), every stop matches.
 */
function matchesFacilityFilters(facilities: RestStopFacilities, filters?: RestStopFacilities): boolean {
  if (!filters) return true;
  const anyActive = filters.toilet || filters.food || filters.shower || filters.fuel || filters.truckParking;
  if (!anyActive) return true;
  if (filters.toilet && !facilities.toilet) return false;
  if (filters.food && !facilities.food) return false;
  if (filters.shower && !facilities.shower) return false;
  if (filters.fuel && !facilities.fuel) return false;
  if (filters.truckParking && !facilities.truckParking) return false;
  return true;
}

/**
 * Get the minimum distance (km) from a point to the nearest route segment.
 */
function distanceToRoute(lat: number, lng: number, routePoints: [number, number][]): number {
  let minDist = Infinity;
  for (let i = 0; i < routePoints.length - 1; i += 3) { // sample every 3rd point for perf
    const d = haversineKm(lat, lng, routePoints[i][1], routePoints[i][0]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Get route points in a "search window" before the rest break.
 * Returns sample points along the route corridor where we should search for rest stops.
 * 
 * Strategy based on estimated speed:
 * - Highway (>70 km/h): search from 25 min before break, max 2 km from route
 * - Rural (50-70 km/h): search from 15 min before break, max 1.5 km from route
 * - Urban (<50 km/h): search from 10 min before break, max 1 km from route
 */
function getSearchWindow(
  routePoints: [number, number][],
  breakFraction: number,
  totalDistanceKm: number,
  totalTimeSeconds: number
): { searchPoints: { lat: number; lng: number }[]; maxOffRouteKm: number } {
  const avgSpeedKmh = (totalDistanceKm / totalTimeSeconds) * 3600;
  
  let searchMinutesBefore: number;
  let maxOffRouteKm: number;
  
  if (avgSpeedKmh > 70) {
    searchMinutesBefore = 25;
    maxOffRouteKm = 2;
  } else if (avgSpeedKmh > 50) {
    searchMinutesBefore = 15;
    maxOffRouteKm = 1.5;
  } else {
    searchMinutesBefore = 10;
    maxOffRouteKm = 1;
  }
  
  // Convert search window to fraction of route
  const searchFractionWindow = (searchMinutesBefore / (totalTimeSeconds / 60));
  const startFraction = Math.max(0, breakFraction - searchFractionWindow);
  
  // Get route points in this window
  const startIdx = Math.floor(startFraction * (routePoints.length - 1));
  const endIdx = Math.min(Math.floor(breakFraction * (routePoints.length - 1)), routePoints.length - 1);
  
  // Sample up to 5 evenly spaced points in the window for searching
  const points: { lat: number; lng: number }[] = [];
  const step = Math.max(1, Math.floor((endIdx - startIdx) / 4));
  for (let i = startIdx; i <= endIdx; i += step) {
    points.push({ lat: routePoints[i][1], lng: routePoints[i][0] });
  }
  // Always include the break point itself
  if (endIdx > startIdx) {
    points.push({ lat: routePoints[endIdx][1], lng: routePoints[endIdx][0] });
  }
  
  return { searchPoints: points, maxOffRouteKm };
}

/**
 * Search for rest stops along a route corridor before a break point.
 * Uses multiple search points along the route and filters by distance to route.
 */
export async function searchRestStopsAlongRoute(
  routePoints: [number, number][],
  breakFraction: number,
  totalDistanceKm: number,
  totalTimeSeconds: number,
  vehicle?: VehicleParams,
  filters?: RestStopFacilities
): Promise<RestStopInfo[]> {
  const { searchPoints, maxOffRouteKm } = getSearchWindow(
    routePoints, breakFraction, totalDistanceKm, totalTimeSeconds
  );
  
  if (searchPoints.length === 0) return [];
  
  const seen = new Set<string>();
  const allStops: RestStopInfo[] = [];

  // Helper to collect stops from a search with a given max distance
  const collectStops = async (maxDistKm: number, applyFilters: boolean) => {
    const searchRadiusM = maxDistKm * 1000 + 500;

    // TomTom search from multiple corridor points
    // categorySet: 7369=truck stop, 9352=rest area, 7312=petrol station, 7311=parking garage
    await runLimited(searchPoints, 2, async (pt) => {
        try {
          const res = await proxyFetch(`/search/2/nearbySearch/.json`, {
            lat: pt.lat, lon: pt.lng, radius: searchRadiusM,
            categorySet: '7369,9352,7312,7311', limit: 15, language: 'sv-SE',
          });
          if (!res.ok) return;
          const data = await res.json();
          for (const r of (data.results || [])) {
            const stopLat = r.position.lat;
            const stopLng = r.position.lon;
            const key = `${stopLat.toFixed(3)},${stopLng.toFixed(3)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const distToRoute = distanceToRoute(stopLat, stopLng, routePoints);
            if (distToRoute > maxDistKm) continue;
            const cats: string[] = r.poi?.categories || [];
            const isTruckStop = cats.some((c: string) => c.toLowerCase().includes('truck'));
            const { suitability, note } = assessStopSuitability(cats, vehicle);
            const facilities = detectFacilitiesFromTomTom(r.poi);
            if (applyFilters && !matchesFacilityFilters(facilities, filters)) continue;
            allStops.push({
              name: r.poi?.name || r.address?.freeformAddress || 'Rastplats',
              lat: stopLat, lng: stopLng,
              distance: `${distToRoute.toFixed(1)} km från rutt`,
              category: isTruckStop ? 'Lastbilsparkering' : (cats[0] || 'Rastplats'),
              address: r.address?.freeformAddress || '',
              facilities, suitability, suitabilityNote: note,
            });
          }
        } catch { /* skip */ }
      }
    );

    // Google Places JS SDK search from multiple corridor points
    const googleSearchPoints = [
      searchPoints[0],
      searchPoints[Math.floor(searchPoints.length / 2)],
      searchPoints[searchPoints.length - 1],
    ].filter((p, i, arr) => arr.findIndex(a => a.lat === p.lat && a.lng === p.lng) === i);

    await runLimited(googleSearchPoints, 2, async (pt) => {
        try {
          const googleResults = await searchGooglePlaces(pt.lat, pt.lng, searchRadiusM);
          for (const place of googleResults) {
            const key = `${place.lat.toFixed(3)},${place.lng.toFixed(3)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const distToRoute = distanceToRoute(place.lat, place.lng, routePoints);
            if (distToRoute > maxDistKm) continue;
            if (applyFilters && !matchesFacilityFilters(place.facilities, filters)) continue;
            const fakeCats = place.isTruckStop ? ['truck stop'] : ['rest area'];
            const { suitability, note } = assessStopSuitability(fakeCats, vehicle);
            allStops.push({
              name: place.name, lat: place.lat, lng: place.lng,
              distance: `${distToRoute.toFixed(1)} km från rutt`,
              category: place.isTruckStop ? 'Lastbilsparkering' : 'Rastplats',
              address: place.address || '',
              facilities: place.facilities, suitability, suitabilityNote: note,
            });
          }
        } catch { /* skip */ }
      }
    );
  };

  // First pass: search with filters within normal distance
  await collectStops(maxOffRouteKm, true);

  // If no results with filters, widen search (up to 5km) and relax filters
  if (allStops.length === 0) {
    await collectStops(Math.max(maxOffRouteKm * 2, 5), false);
  }
  
  // Sort: best facility match first, then closest to route, then category priority
  const hasActiveFilters = filters && (filters.toilet || filters.food || filters.shower || filters.fuel || filters.truckParking);
  
  const facilityMatchScore = (f: RestStopFacilities): number => {
    if (!hasActiveFilters || !filters) return 0;
    let score = 0;
    if (filters.toilet && f.toilet) score++;
    if (filters.food && f.food) score++;
    if (filters.shower && f.shower) score++;
    if (filters.fuel && f.fuel) score++;
    if (filters.truckParking && f.truckParking) score++;
    return score;
  };

  const catPriority = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('lastbil') || c.includes('truck')) return 0;
    if (c.includes('rast') || c.includes('rest')) return 1;
    if (c.includes('bensin') || c.includes('fuel') || c.includes('petrol')) return 2;
    return 3;
  };
  const suitOrder: Record<RestStopSuitability, number> = { perfect: 0, good: 1, warning: 2, unsuitable: 3 };
  
  allStops.sort((a, b) => {
    // Facility match score (higher = better)
    const fmA = facilityMatchScore(a.facilities || {} as RestStopFacilities);
    const fmB = facilityMatchScore(b.facilities || {} as RestStopFacilities);
    if (fmA !== fmB) return fmB - fmA;
    const cp = catPriority(a.category || '') - catPriority(b.category || '');
    if (cp !== 0) return cp;
    const sp = (suitOrder[a.suitability || 'good']) - (suitOrder[b.suitability || 'good']);
    if (sp !== 0) return sp;
    const distA = parseFloat(a.distance || '99');
    const distB = parseFloat(b.distance || '99');
    return distA - distB;
  });
  
  return allStops.slice(0, 15);
}

/**
 * Legacy single-point search (kept for compatibility)
 */
export async function searchRestStops(
  lat: number,
  lng: number,
  radius: number = 5000,
  vehicle?: VehicleParams,
  filters?: RestStopFacilities
): Promise<RestStopInfo[]> {
  try {
    const res = await proxyFetch(`/search/2/nearbySearch/.json`, {
      lat, lon: lng, radius, categorySet: '7369,9352,7312,7311', limit: 10, language: 'sv-SE',
    });
    if (!res.ok) return [];
    const data = await res.json();
    const stops: RestStopInfo[] = [];
    for (const r of (data.results || [])) {
      const cats: string[] = r.poi?.categories || [];
      const isTruckStop = cats.some((c: string) => c.toLowerCase().includes('truck'));
      const { suitability, note } = assessStopSuitability(cats, vehicle);
      const facilities = detectFacilitiesFromTomTom(r.poi);
      if (!matchesFacilityFilters(facilities, filters)) continue;
      stops.push({
        name: r.poi?.name || 'Rastplats',
        lat: r.position.lat,
        lng: r.position.lon,
        distance: `${(r.dist / 1000).toFixed(1)} km`,
        category: isTruckStop ? 'Lastbilsparkering' : (cats[0] || 'Rastplats'),
        address: r.address?.freeformAddress || '',
        facilities,
        suitability,
        suitabilityNote: note,
      });
    }
    return stops;
  } catch { return []; }
}

/**
 * Search Google Places Nearby using the JS SDK (avoids CORS issues).
 * Creates a temporary hidden map div for the PlacesService.
 */
async function searchGooglePlaces(
  lat: number,
  lng: number,
  radius: number
): Promise<Array<{ name: string; lat: number; lng: number; address?: string; isTruckStop: boolean; facilities: RestStopFacilities }>> {
  // Only works if Google Maps JS SDK is loaded
  if (!window.google?.maps?.places) return [];

  return new Promise((resolve) => {
    const results: Array<{ name: string; lat: number; lng: number; address?: string; isTruckStop: boolean; facilities: RestStopFacilities }> = [];
    const seen = new Set<string>();

    // Create a temporary div for PlacesService (it requires a map or div)
    let tempDiv = document.getElementById('__places_service_div');
    if (!tempDiv) {
      tempDiv = document.createElement('div');
      tempDiv.id = '__places_service_div';
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);
    }
    const service = new google.maps.places.PlacesService(tempDiv as HTMLDivElement);

    const keywords = ['truck stop', 'rastplats', 'lastbilsparkering', 'bensinstation lastbil'];
    let completed = 0;

    const onAllDone = () => {
      resolve(results);
    };

    for (const keyword of keywords) {
      const request: google.maps.places.TextSearchRequest = {
        query: keyword,
        location: new google.maps.LatLng(lat, lng),
        radius: Math.min(radius, 30000),
      };

      service.textSearch(request, (places, status) => {
        completed++;
        if (status === google.maps.places.PlacesServiceStatus.OK && places) {
          for (const place of places.slice(0, 5)) {
            const pLat = place.geometry?.location?.lat();
            const pLng = place.geometry?.location?.lng();
            if (pLat == null || pLng == null) continue;
            const key = `${pLat.toFixed(3)},${pLng.toFixed(3)}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const types = place.types || [];
            const name = place.name || 'Rastplats';
            const facilities = detectFacilitiesFromGoogle(types, name);

            results.push({
              name,
              lat: pLat,
              lng: pLng,
              address: place.formatted_address || '',
              isTruckStop: facilities.truckParking,
              facilities,
            });
          }
        }
        if (completed >= keywords.length) onAllDone();
      });
    }

    // Safety timeout in case Google doesn't respond
    setTimeout(() => {
      if (completed < keywords.length) resolve(results);
    }, 5000);
  });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * EU driving & rest time regulations (EC 561/2006):
 *
 * DRIVING TIME:
 * - Max 4.5h continuous → mandatory break
 * - Max 9h/day (extendable to 10h, max 2 times per week)
 * - Max 56h/week
 * - Max 90h per 2-week period
 *
 * BREAKS (after 4.5h driving):
 * - At least 45 min in one block, OR split: 15 min + 30 min
 * - After 45 min total break → new 4.5h driving period
 *
 * DAILY REST (within each 24h period):
 * - Normal: at least 11h uninterrupted
 * - Reduced: minimum 9h (max 3 times between two weekly rests, i.e. within 144h)
 * - Split: 3h + 9h (total 12h within 24h)
 *
 * WEEKLY REST (starts latest after 6 × 24h = 144h):
 * - Normal: at least 45h uninterrupted
 * - Reduced: minimum 24h (every other week)
 * - Compensation: lost hours (21h if 24h rest) must be taken before end of 3rd following week,
 *   attached to a rest of at least 9h
 *
 * A 10-minute safety margin is applied to all driving limits.
 */
export async function generateTimeline(
  route: RouteResult,
  routeType: 'normal' | 'fastest',
  waypointStopMinutes?: number[],
  vehicle?: VehicleParams,
  facilityFilters?: RestStopFacilities,
  usedDriveMinutesToday?: number
): Promise<TimelineEntry[]> {
  const timeline: TimelineEntry[] = [];
  const SAFETY_MARGIN = 10; // minutes

  // --- EU regulation constants (in minutes) ---
  const MAX_CONTINUOUS_DRIVE = 4.5 * 60 - SAFETY_MARGIN;   // 260 min
  const BREAK_DURATION = 45;
  const SPLIT_BREAK_FIRST = 15;
  const SPLIT_BREAK_SECOND = 30;

  const MAX_DAILY_DRIVE_NORMAL = 9 * 60 - SAFETY_MARGIN;    // 530 min
  const MAX_DAILY_DRIVE_EXTENDED = 10 * 60 - SAFETY_MARGIN;  // 590 min
  const MAX_EXTENDED_DAYS_PER_WEEK = 2;

  const DAILY_REST_NORMAL = 11 * 60;    // 660 min
  const DAILY_REST_REDUCED = 9 * 60;    // 540 min
  const MAX_REDUCED_DAILY_RESTS = 3;    // max between two weekly rests

  const WEEKLY_REST_NORMAL = 45 * 60;   // 2700 min
  const WEEKLY_REST_REDUCED = 24 * 60;  // 1440 min
  const MAX_HOURS_BEFORE_WEEKLY_REST = 144 * 60; // 8640 min (6 × 24h)

  // --- State tracking ---
  let currentTime = new Date(route.departureTime);
  let drivingSinceBreak = 0;            // minutes since last 45-min break
  let dailyDriving = usedDriveMinutesToday ? usedDriveMinutesToday * 60 : 0;
  let totalDrivenMinutes = 0;
  let splitBreakTaken = false;          // whether 15-min split break was taken in current period
  let reducedDailyRestCount = 0;        // count of 9h rests between weekly rests
  let extendedDayCount = 0;             // count of 10h days this week
  let timeSinceWeeklyRest = 0;          // minutes since last weekly rest
  let dayCount = 0;                     // days since last weekly rest

  const totalTravelMinutes = Math.round(route.travelTimeSeconds / 60);
  const restBreakPoints: { index: number; fraction: number; type: 'rest' | 'overnight' | 'weekly' }[] = [];

  // Determine max daily drive for current day
  const getMaxDailyDrive = (): number => {
    if (extendedDayCount < MAX_EXTENDED_DAYS_PER_WEEK) {
      // Can potentially use extended day, but prefer normal unless needed
      return MAX_DAILY_DRIVE_NORMAL;
    }
    return MAX_DAILY_DRIVE_NORMAL;
  };

  // Check if we can use a reduced daily rest
  const canUseReducedDailyRest = (): boolean => {
    return reducedDailyRestCount < MAX_REDUCED_DAILY_RESTS;
  };

  // Check if weekly rest is needed
  const needsWeeklyRest = (): boolean => {
    return timeSinceWeeklyRest >= MAX_HOURS_BEFORE_WEEKLY_REST;
  };

  const addEntry = (type: TimelineEntry['type'], label: string, durationMinutes: number, location?: string) => {
    const startTime = new Date(currentTime);
    const endTime = new Date(currentTime.getTime() + durationMinutes * 60000);
    timeline.push({
      type, label,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes,
      location,
    });
    currentTime = endTime;

    // Track time for weekly rest calculations (all time counts, not just driving)
    if (type !== 'overnight' && type !== 'rest') {
      timeSinceWeeklyRest += durationMinutes;
    }
  };

  for (let i = 0; i < route.legs.length; i++) {
    const leg = route.legs[i];
    let remainingDriveMin = Math.round(leg.travelTimeSeconds / 60);

    // Waypoint stop
    if (i > 0) {
      const stopDuration = waypointStopMinutes?.[i - 1] ?? 30;
      addEntry('stop', `Stopp: ${leg.startLabel} (${stopDuration} min)`, stopDuration, leg.startLabel);
    }

    while (remainingDriveMin > 0) {
      // Check if weekly rest is needed before driving
      if (needsWeeklyRest()) {
        const fraction = Math.min(totalDrivenMinutes / totalTravelMinutes, 1);
        const entryIndex = timeline.length;
        const weeklyRestDuration = WEEKLY_REST_NORMAL; // use normal weekly rest
        addEntry('overnight', `Veckovila (${Math.round(weeklyRestDuration / 60)}h)`, weeklyRestDuration);
        restBreakPoints.push({ index: entryIndex, fraction, type: 'weekly' });
        timeSinceWeeklyRest = 0;
        drivingSinceBreak = 0;
        dailyDriving = 0;
        dayCount = 0;
        reducedDailyRestCount = 0;
        extendedDayCount = 0;
        splitBreakTaken = false;
      }

      // Calculate how much we can drive before hitting a limit
      const driveUntilBreak = MAX_CONTINUOUS_DRIVE - drivingSinceBreak;
      const maxDailyDrive = getMaxDailyDrive();
      const driveUntilDaily = maxDailyDrive - dailyDriving;
      const maxDrive = Math.min(driveUntilBreak, driveUntilDaily, remainingDriveMin);
      const driveChunk = Math.max(maxDrive, 1);

      // Drive
      addEntry('drive', `Körning ${leg.startLabel} → ${leg.endLabel}`, driveChunk);
      remainingDriveMin -= driveChunk;
      drivingSinceBreak += driveChunk;
      dailyDriving += driveChunk;
      totalDrivenMinutes += driveChunk;
      timeSinceWeeklyRest += driveChunk;

      if (remainingDriveMin <= 0) break;

      const fraction = Math.min(totalDrivenMinutes / totalTravelMinutes, 1);

      // Check what triggered the stop
      if (dailyDriving >= maxDailyDrive) {
        // Daily driving limit reached → daily rest needed
        // Check if we can extend the day (max 2 per week)
        if (dailyDriving >= MAX_DAILY_DRIVE_NORMAL && dailyDriving < MAX_DAILY_DRIVE_EXTENDED && extendedDayCount < MAX_EXTENDED_DAYS_PER_WEEK) {
          // We could extend this day — but we already hit the normal limit
          // Check if remaining drive is small enough to justify extending
          const remainingAfterExtension = remainingDriveMin - (MAX_DAILY_DRIVE_EXTENDED - dailyDriving);
          if (remainingAfterExtension <= 0 || remainingDriveMin <= (MAX_DAILY_DRIVE_EXTENDED - dailyDriving)) {
            // Extending this day would help finish or significantly reduce remaining
            extendedDayCount++;
            // Continue driving — don't take rest yet
            continue;
          }
        }

        // Take daily rest
        const entryIndex = timeline.length;
        let restDuration: number;
        let restLabel: string;

        if (canUseReducedDailyRest()) {
          // Use reduced rest (9h) to save time
          restDuration = DAILY_REST_REDUCED;
          restLabel = `Dygnsvila (9h – reducerad ${reducedDailyRestCount + 1}/3)`;
          reducedDailyRestCount++;
        } else {
          // Must use normal rest (11h)
          restDuration = DAILY_REST_NORMAL;
          restLabel = 'Dygnsvila (11h)';
        }

        addEntry('overnight', restLabel, restDuration);
        restBreakPoints.push({ index: entryIndex, fraction, type: 'overnight' });
        drivingSinceBreak = 0;
        dailyDriving = 0;
        dayCount++;
        splitBreakTaken = false;

      } else if (drivingSinceBreak >= MAX_CONTINUOUS_DRIVE) {
        // 4.5h continuous driving limit reached → break needed
        const entryIndex = timeline.length;

        if (!splitBreakTaken) {
          // Option to use split break: take 15 min now, 30 min later
          // Use split break if remaining drive is substantial
          if (remainingDriveMin > MAX_CONTINUOUS_DRIVE) {
            // Take 15 min first part of split break
            addEntry('rest', 'Rast (15 min – del 1 av delad rast)', SPLIT_BREAK_FIRST);
            restBreakPoints.push({ index: entryIndex, fraction, type: 'rest' });
            splitBreakTaken = true;
            drivingSinceBreak = 0;
            // Note: next break must be 30 min
          } else {
            // Take full 45 min break
            addEntry('rest', 'Rast (45 min)', BREAK_DURATION);
            restBreakPoints.push({ index: entryIndex, fraction, type: 'rest' });
            drivingSinceBreak = 0;
            splitBreakTaken = false;
          }
        } else {
          // Must take 30 min second part of split break
          addEntry('rest', 'Rast (30 min – del 2 av delad rast)', SPLIT_BREAK_SECOND);
          restBreakPoints.push({ index: entryIndex, fraction, type: 'rest' });
          drivingSinceBreak = 0;
          splitBreakTaken = false; // Split break cycle complete, new period starts
        }
      }
    }
  }

  // Arrival
  addEntry('arrival', `Ankomst ${route.waypoints[route.waypoints.length - 1].name}`, 0, route.waypoints[route.waypoints.length - 1].name);

  // Search for rest stops along the route corridor for all break points
  if (restBreakPoints.length > 0 && route.routePoints.length > 0) {
    const results: Array<{ bp: typeof restBreakPoints[number]; stops: RestStopInfo[] }> = [];
    await runLimited(restBreakPoints, 1, async (bp) => {
        const stops = await searchRestStopsAlongRoute(
          route.routePoints,
          bp.fraction,
          route.distanceKm,
          route.travelTimeSeconds,
          vehicle,
          facilityFilters
        );
        results.push({ bp, stops });
      }
    );

    for (const { bp, stops } of results) {
      const entry = timeline[bp.index];
      if (!entry) continue;

      let validStops = stops;

      // For overnight/weekly stops, require actual truck parking or rest area
      if (bp.type === 'overnight' || bp.type === 'weekly') {
        validStops = stops.filter(s => {
          const cat = (s.category || '').toLowerCase();
          return cat.includes('lastbil') || cat.includes('truck') || cat.includes('rast') || cat.includes('rest') || cat.includes('parkering') || cat.includes('parking');
        });

        if (validStops.length === 0) {
          const widerStops = await searchRestStopsAlongRoute(
            route.routePoints,
            bp.fraction,
            route.distanceKm,
            route.travelTimeSeconds,
            vehicle,
            { truckParking: true, toilet: false, food: false, shower: false, fuel: false }
          );
          validStops = widerStops.filter(s => {
            const cat = (s.category || '').toLowerCase();
            return cat.includes('lastbil') || cat.includes('truck') || cat.includes('rast') || cat.includes('rest') || cat.includes('parkering') || cat.includes('parking');
          });
          if (validStops.length === 0 && widerStops.length > 0) {
            validStops = widerStops;
          }
        }
      }

      if (validStops.length > 0) {
        const bestStop = { ...validStops[0], alternatives: validStops.slice(1) };
        entry.restStop = bestStop;
        entry.location = bestStop.name;
        const typeLabel = bp.type === 'weekly'
          ? `Veckovila – ${bestStop.name}`
          : bp.type === 'overnight'
            ? `${entry.label.split(' –')[0]} – ${bestStop.name}`
            : `${entry.label.split(' –')[0]} – ${bestStop.name}`;
        entry.label = typeLabel;
      } else {
        entry.label = bp.type === 'weekly'
          ? 'Veckovila – ⚠️ Ingen säker plats hittades'
          : bp.type === 'overnight'
            ? `${entry.label.split(' –')[0]} – ⚠️ Ingen säker plats hittades`
            : `${entry.label.split(' –')[0]} – ⚠️ Ingen rastplats hittades`;
        entry.location = 'Ingen plats hittad';
      }
    }
  }

  return timeline;
}

/**
 * Fetch a short-lived TomTom tile key (used by the map SDK to load tiles).
 * Calls the secure proxy — only authenticated users can retrieve it.
 */
let _tileKeyCache: string | null = null;
export async function getTomTomTileKey(): Promise<string> {
  if (_tileKeyCache) return _tileKeyCache;
  const res = await fetch(`${PROXY_URL}/tile-key`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch tile key: ${res.status}`);
  const data = await res.json();
  _tileKeyCache = data.key;
  return data.key;
}
