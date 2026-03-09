import { TimelineEntry } from '@/types';

const API_KEY = '19474696';
const BASE_URL = 'https://api.tomtom.com';

export interface RouteResult {
  distanceKm: number;
  travelTimeSeconds: number;
  departureTime: string;
  arrivalTime: string;
  legs: RouteLeg[];
  geoJson: GeoJSON.FeatureCollection;
  bbox: [number, number, number, number];
  waypoints: { lat: number; lng: number; name: string }[];
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

export async function calculateRoute(
  startCoord: GeocodingResult,
  endCoord: GeocodingResult,
  waypointCoords: GeocodingResult[],
  departAt?: string
): Promise<RouteResult> {
  const locations = [startCoord, ...waypointCoords, endCoord]
    .map(c => `${c.lat},${c.lng}`)
    .join(':');

  const depart = departAt || new Date().toISOString();
  const url = `${BASE_URL}/routing/1/calculateRoute/${locations}/json?key=${API_KEY}&travelMode=truck&vehicleWeight=40000&departAt=${depart}&routeRepresentation=polyline&computeTravelTimeFor=all`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed: ${res.status}`);
  const data = await res.json();

  if (!data.routes?.length) throw new Error('Ingen rutt hittades');
  const route = data.routes[0];
  const summary = route.summary;

  // Build GeoJSON from route points
  const allPoints: [number, number][] = [];
  for (const leg of route.legs) {
    for (const point of leg.points) {
      allPoints.push([point.longitude, point.latitude]);
    }
  }

  const geoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: allPoints,
      },
      properties: {},
    }],
  };

  const allCoords = [startCoord, ...waypointCoords, endCoord];
  const legs: RouteLeg[] = route.legs.map((leg: any, i: number) => ({
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
  };
}

/**
 * Generate EU driving/rest timeline from a route result.
 * Rules: 4.5h driving → 45min break, max 9h daily driving, 11h overnight rest.
 */
export function generateTimeline(
  route: RouteResult,
  routeType: 'normal' | 'fastest'
): TimelineEntry[] {
  const timeline: TimelineEntry[] = [];
  const MAX_DRIVE_BEFORE_REST = 4.5 * 60; // 270 min
  const REST_DURATION = 45; // min
  const MAX_DAILY_DRIVE = (routeType === 'fastest' ? 10 : 9) * 60; // min
  const OVERNIGHT_REST = 11 * 60; // min

  let currentTime = new Date(route.departureTime);
  let drivingSinceRest = 0;
  let dailyDriving = 0;

  const addEntry = (type: TimelineEntry['type'], label: string, durationMinutes: number, location?: string) => {
    const startTime = new Date(currentTime);
    const endTime = new Date(currentTime.getTime() + durationMinutes * 60000);
    timeline.push({
      type,
      label,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes,
      location,
    });
    currentTime = endTime;
  };

  for (let i = 0; i < route.legs.length; i++) {
    const leg = route.legs[i];
    let remainingDriveMin = Math.round(leg.travelTimeSeconds / 60);

    // Stop at waypoint (loading/unloading) if not first
    if (i > 0) {
      addEntry('stop', `Stopp: ${leg.startLabel}`, 30, leg.startLabel);
    }

    while (remainingDriveMin > 0) {
      const driveUntilRest = MAX_DRIVE_BEFORE_REST - drivingSinceRest;
      const driveUntilDaily = MAX_DAILY_DRIVE - dailyDriving;
      const maxDrive = Math.min(driveUntilRest, driveUntilDaily, remainingDriveMin);
      const driveChunk = Math.max(maxDrive, 1);

      addEntry(
        'drive',
        `Körning ${leg.startLabel} → ${leg.endLabel}`,
        driveChunk,
        undefined
      );

      remainingDriveMin -= driveChunk;
      drivingSinceRest += driveChunk;
      dailyDriving += driveChunk;

      if (remainingDriveMin <= 0) break;

      // Need overnight rest?
      if (dailyDriving >= MAX_DAILY_DRIVE) {
        addEntry('overnight', 'Dygnsvila (11h)', OVERNIGHT_REST, undefined);
        drivingSinceRest = 0;
        dailyDriving = 0;
      }
      // Need driving rest?
      else if (drivingSinceRest >= MAX_DRIVE_BEFORE_REST) {
        addEntry('rest', 'Rast (45 min)', REST_DURATION, undefined);
        drivingSinceRest = 0;
      }
    }
  }

  // Arrival
  addEntry(
    'arrival',
    `Ankomst ${route.waypoints[route.waypoints.length - 1].name}`,
    0,
    route.waypoints[route.waypoints.length - 1].name
  );

  return timeline;
}

export function getTomTomApiKey(): string {
  return API_KEY;
}
