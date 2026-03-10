import { TimelineEntry } from '@/types';
import { RouteResult } from '@/services/tomtom';
import { supabase } from '@/integrations/supabase/client';

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

export async function getSavedTrips(): Promise<SavedTrip[]> {
  try {
    const { data, error } = await supabase
      .from('saved_trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      startName: row.start_name,
      endName: row.end_name,
      waypointNames: row.waypoint_names as string[],
      distanceKm: Number(row.distance_km),
      travelTimeSeconds: row.travel_time_seconds,
      totalWeightKg: Number(row.total_weight_kg),
      vehicleId: row.vehicle_id,
      vehicleLabel: row.vehicle_label,
      routeType: row.route_type as 'normal' | 'fastest',
      timeline: row.timeline as TimelineEntry[],
      route: row.route as RouteResult,
    }));
  } catch (err) {
    console.error('Failed to fetch trips:', err);
    return [];
  }
}

export async function saveTrip(trip: SavedTrip): Promise<void> {
  try {
    const { error } = await supabase.from('saved_trips').insert({
      id: trip.id,
      start_name: trip.startName,
      end_name: trip.endName,
      waypoint_names: trip.waypointNames,
      distance_km: trip.distanceKm,
      travel_time_seconds: trip.travelTimeSeconds,
      total_weight_kg: trip.totalWeightKg,
      vehicle_id: trip.vehicleId,
      vehicle_label: trip.vehicleLabel,
      route_type: trip.routeType,
      timeline: trip.timeline as any,
      route: trip.route as any,
    });
    if (error) throw error;
  } catch (err) {
    console.error('Failed to save trip:', err);
  }
}

export async function deleteTrip(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('saved_trips').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('Failed to delete trip:', err);
  }
}
