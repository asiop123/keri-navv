import { TimelineEntry, RestStopInfo, RestStopSuitability, RestStopFacilities } from '@/types';

const API_KEY = 'MuNXa5wvdkAvcr10ExFWNBen06rcF3mT';
const GOOGLE_KEY = 'AIzaSyDtwH0gOPIznevKsiEncudw9kaoH6Q8p_Y';
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
  let url = `${BASE_URL}/routing/1/calculateRoute/${locations}/json?key=${API_KEY}&travelMode=truck&departAt=${depart}&routeRepresentation=polyline&computeTravelTimeFor=all&maxAlternatives=5`;

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

export async function searchRestStops(
  lat: number,
  lng: number,
  radius: number = 20000,
  vehicle?: VehicleParams
): Promise<RestStopInfo[]> {
  // 7369 = truck stop, 7311 = petrol/gas station, 9352 = rest area, 7312 = parking
  const url = `${BASE_URL}/search/2/nearbySearch/.json?key=${API_KEY}&lat=${lat}&lon=${lng}&radius=${radius}&categorySet=7369,9352,7312,7311&limit=8&language=sv-SE`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results?.length) return [];
    
    const stops: RestStopInfo[] = data.results.map((r: any) => {
      const distKm = (r.dist / 1000).toFixed(1);
      const cats: string[] = r.poi?.categories || [];
      const isTruckStop = cats.some((c: string) => c.toLowerCase().includes('truck'));
      const { suitability, note } = assessStopSuitability(cats, vehicle);

      return {
        name: r.poi?.name || r.address?.freeformAddress || 'Rastplats',
        lat: r.position.lat,
        lng: r.position.lon,
        distance: `${distKm} km`,
        category: isTruckStop ? 'Lastbilsparkering' : (cats[0] || 'Rastplats'),
        suitability,
        suitabilityNote: note,
      };
    });

    // Sort: perfect first, then good, warning, unsuitable last
    const order: Record<RestStopSuitability, number> = { perfect: 0, good: 1, warning: 2, unsuitable: 3 };
    stops.sort((a, b) => (order[a.suitability || 'good']) - (order[b.suitability || 'good']));

    return stops;
  } catch {
    return [];
  }
}

export async function generateTimeline(
  route: RouteResult,
  routeType: 'normal' | 'fastest',
  waypointStopMinutes?: number[],
  vehicle?: VehicleParams
): Promise<TimelineEntry[]> {
  const timeline: TimelineEntry[] = [];
  const SAFETY_MARGIN = 10; // 10 min margin before legal limit
  const MAX_DRIVE_BEFORE_REST = 4.5 * 60 - SAFETY_MARGIN; // 260 min instead of 270
  const REST_DURATION = 45;
  const MAX_DAILY_DRIVE = (routeType === 'fastest' ? 10 : 9) * 60 - SAFETY_MARGIN;
  const OVERNIGHT_REST = 11 * 60;

  let currentTime = new Date(route.departureTime);
  let drivingSinceRest = 0;
  let dailyDriving = 0;
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

  if (restBreakPoints.length > 0 && route.routePoints.length > 0) {
    const results = await Promise.all(
      restBreakPoints.map(async (bp) => {
        const point = getPointAlongRoute(route.routePoints, bp.fraction);
        const stops = await searchRestStops(point.lat, point.lng, 20000, vehicle);
        return { bp, stops, searchPoint: point };
      })
    );

    for (const { bp, stops, searchPoint } of results) {
      const entry = timeline[bp.index];
      if (entry && stops.length > 0) {
        const bestStop = { ...stops[0], alternatives: stops.slice(1) };
        entry.restStop = bestStop;
        entry.location = bestStop.name;
        entry.label = bp.type === 'overnight'
          ? `Dygnsvila (11h) – ${bestStop.name}`
          : `Rast (45 min) – ${bestStop.name}`;
      } else if (entry) {
        entry.restStop = { name: 'Längs rutten', lat: searchPoint.lat, lng: searchPoint.lng, category: 'Rastplats', alternatives: [] };
      }
    }
  }

  return timeline;
}

export function getTomTomApiKey(): string {
  return API_KEY;
}
