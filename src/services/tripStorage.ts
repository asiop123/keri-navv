import { TimelineEntry } from '@/types';
import { RouteResult } from '@/services/tomtom';

export interface SavedTrip {
  id: string;
  createdAt: string;
  startName: string;
  endName: string;
  waypointNames: string[];
  distanceKm: number;
  travelTimeSeconds: number;
  totalWeightKg: number;
  vehicleId: string;
  vehicleLabel: string;
  routeType: 'normal' | 'fastest';
  timeline: TimelineEntry[];
  route: RouteResult;
}

const STORAGE_KEY = 'saved-trips';

export function getSavedTrips(): SavedTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTrip(trip: SavedTrip): void {
  const trips = getSavedTrips();
  trips.unshift(trip);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export function deleteTrip(id: string): void {
  const trips = getSavedTrips().filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}
