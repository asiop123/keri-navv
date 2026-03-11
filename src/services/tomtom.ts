import { TimelineEntry, RestStopInfo, RestStopSuitability, RestStopFacilities } from '@/types';

const API_KEY = 'MuNXa5wvdkAvcr10ExFWNBen06rcF3mT';

const BASE_URL = 'https://api.tomtom.com';

export interface VehicleParams {
  weightKg?: number;
  heightM?: number;
  widthM?: number;
  lengthM?: number;
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
  const url = `${BASE_URL}/search/2/geocode/${encodeURIComponent(query)}.json?key=${API_KEY}&countrySet=SE&limit=1`;
  const res = await fetch(url);
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
  const url = `${BASE_URL}/search/2/reverseGeocode/${lat},${lng}.json?key=${API_KEY}&language=sv-SE`;
  try {
    const res = await fetch(url);
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
  let url = `${BASE_URL}/routing/1/calculateRoute/${locations}/json?key=${API_KEY}&travelMode=truck&departAt=${depart}&routeRepresentation=polyline&computeTravelTimeFor=all&maxAlternatives=2`;

  if (vehicleParams) {
    if (vehicleParams.weightKg) url += `&vehicleWeight=${vehicleParams.weightKg}`;
    if (vehicleParams.heightM) url += `&vehicleHeight=${vehicleParams.heightM}`;
    if (vehicleParams.widthM) url += `&vehicleWidth=${vehicleParams.widthM}`;
    if (vehicleParams.lengthM) url += `&vehicleLength=${vehicleParams.lengthM}`;
  } else {
    url += `&vehicleWeight=40000`;
  }

  const res = await fetch(url);
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
    toilet: isTruckStop || isRestArea || isFuelStation,
    food: allTerms.includes('restaurant') || allTerms.includes('food') || allTerms.includes('café') || allTerms.includes('cafe') || allTerms.includes('fast food'),
    shower: isTruckStop, // only truck stops reliably have showers
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
    toilet: isTruck || isFuel || isRestArea,
    food: typesStr.includes('restaurant') || typesStr.includes('food') || typesStr.includes('cafe') || typesStr.includes('meal'),
    shower: isTruck,
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
    await Promise.all(
      searchPoints.map(async (pt) => {
        const url = `${BASE_URL}/search/2/nearbySearch/.json?key=${API_KEY}&lat=${pt.lat}&lon=${pt.lng}&radius=${searchRadiusM}&categorySet=7369,9352,7312,7311&limit=15&language=sv-SE`;
        try {
          const res = await fetch(url);
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
      })
    );

    // Google Places JS SDK search from multiple corridor points
    const googleSearchPoints = [
      searchPoints[0],
      searchPoints[Math.floor(searchPoints.length / 2)],
      searchPoints[searchPoints.length - 1],
    ].filter((p, i, arr) => arr.findIndex(a => a.lat === p.lat && a.lng === p.lng) === i);

    await Promise.all(
      googleSearchPoints.map(async (pt) => {
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
      })
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
  const url = `${BASE_URL}/search/2/nearbySearch/.json?key=${API_KEY}&lat=${lat}&lon=${lng}&radius=${radius}&categorySet=7369,9352,7312,7311&limit=10&language=sv-SE`;
  try {
    const res = await fetch(url);
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

export async function generateTimeline(
  route: RouteResult,
  routeType: 'normal' | 'fastest',
  waypointStopMinutes?: number[],
  vehicle?: VehicleParams,
  facilityFilters?: RestStopFacilities,
  usedDriveMinutesToday?: number
): Promise<TimelineEntry[]> {
  const timeline: TimelineEntry[] = [];
  const SAFETY_MARGIN = 10;
  const MAX_DRIVE_BEFORE_REST = 4.5 * 60 - SAFETY_MARGIN;
  const REST_DURATION = 45;
  const MAX_DAILY_DRIVE = (routeType === 'fastest' ? 10 : 9) * 60 - SAFETY_MARGIN;
  const OVERNIGHT_REST = 11 * 60;

  let currentTime = new Date(route.departureTime);
  let drivingSinceRest = 0;
  let dailyDriving = usedDriveMinutesToday ? usedDriveMinutesToday * 60 : 0;
  let totalDrivenMinutes = 0;
  const totalTravelMinutes = Math.round(route.travelTimeSeconds / 60);

  const restBreakPoints: { index: number; fraction: number; type: 'rest' | 'overnight' }[] = [];

  const addEntry = (type: TimelineEntry['type'], label: string, durationMinutes: number, location?: string) => {
    const startTime = new Date(currentTime);
    const endTime = new Date(currentTime.getTime() + durationMinutes * 60000);
    timeline.push({ type, label, startTime: startTime.toISOString(), endTime: endTime.toISOString(), durationMinutes, location });
    currentTime = endTime;
  };

  for (let i = 0; i < route.legs.length; i++) {
    const leg = route.legs[i];
    let remainingDriveMin = Math.round(leg.travelTimeSeconds / 60);

    if (i > 0) {
      const stopDuration = waypointStopMinutes?.[i - 1] ?? 30;
      addEntry('stop', `Stopp: ${leg.startLabel} (${stopDuration} min)`, stopDuration, leg.startLabel);
    }

    while (remainingDriveMin > 0) {
      const driveUntilRest = MAX_DRIVE_BEFORE_REST - drivingSinceRest;
      const driveUntilDaily = MAX_DAILY_DRIVE - dailyDriving;
      const maxDrive = Math.min(driveUntilRest, driveUntilDaily, remainingDriveMin);
      const driveChunk = Math.max(maxDrive, 1);

      addEntry('drive', `Körning ${leg.startLabel} → ${leg.endLabel}`, driveChunk);
      remainingDriveMin -= driveChunk;
      drivingSinceRest += driveChunk;
      dailyDriving += driveChunk;
      totalDrivenMinutes += driveChunk;

      if (remainingDriveMin <= 0) break;

      const fraction = Math.min(totalDrivenMinutes / totalTravelMinutes, 1);

      if (dailyDriving >= MAX_DAILY_DRIVE) {
        const entryIndex = timeline.length;
        addEntry('overnight', 'Dygnsvila (11h)', OVERNIGHT_REST);
        restBreakPoints.push({ index: entryIndex, fraction, type: 'overnight' });
        drivingSinceRest = 0;
        dailyDriving = 0;
      } else if (drivingSinceRest >= MAX_DRIVE_BEFORE_REST) {
        const entryIndex = timeline.length;
        addEntry('rest', 'Rast (45 min)', REST_DURATION);
        restBreakPoints.push({ index: entryIndex, fraction, type: 'rest' });
        drivingSinceRest = 0;
      }
    }
  }

  addEntry('arrival', `Ankomst ${route.waypoints[route.waypoints.length - 1].name}`, 0, route.waypoints[route.waypoints.length - 1].name);

  // Search for rest stops along the route corridor
  if (restBreakPoints.length > 0 && route.routePoints.length > 0) {
    const results = await Promise.all(
      restBreakPoints.map(async (bp) => {
        const stops = await searchRestStopsAlongRoute(
          route.routePoints,
          bp.fraction,
          route.distanceKm,
          route.travelTimeSeconds,
          vehicle,
          facilityFilters
        );
        return { bp, stops };
      })
    );

    for (const { bp, stops } of results) {
      const entry = timeline[bp.index];
      if (!entry) continue;

      let validStops = stops;

      // For overnight stops, require actual truck parking or rest area — never a random road coordinate
      if (bp.type === 'overnight') {
        validStops = stops.filter(s => {
          const cat = (s.category || '').toLowerCase();
          return cat.includes('lastbil') || cat.includes('truck') || cat.includes('rast') || cat.includes('rest') || cat.includes('parkering') || cat.includes('parking');
        });

        // If no suitable overnight stops found, do an extended search (up to 10km)
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
          // If still nothing, accept any real POI result (not a fabricated coordinate)
          if (validStops.length === 0 && widerStops.length > 0) {
            validStops = widerStops;
          }
        }
      }

      if (validStops.length > 0) {
        const bestStop = { ...validStops[0], alternatives: validStops.slice(1) };
        entry.restStop = bestStop;
        entry.location = bestStop.name;
        entry.label = bp.type === 'overnight'
          ? `Dygnsvila (11h) – ${bestStop.name}`
          : `Rast (45 min) – ${bestStop.name}`;
      } else {
        // Never place a marker on the road — mark as "no safe stop found"
        entry.label = bp.type === 'overnight'
          ? 'Dygnsvila (11h) – ⚠️ Ingen säker plats hittades'
          : 'Rast (45 min) – ⚠️ Ingen rastplats hittades';
        entry.location = 'Ingen plats hittad';
        // Don't set restStop at all — no marker on the map for a fake location
      }
    }
  }

  return timeline;
}

export function getTomTomApiKey(): string {
  return API_KEY;
}
