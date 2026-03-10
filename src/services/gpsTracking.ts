import { supabase } from '@/integrations/supabase/client';

interface GpsPosition {
  lat: number;
  lng: number;
  speed: number; // m/s from Geolocation API
  heading: number | null;
  accuracy: number;
  timestamp: number;
}

let watchId: number | null = null;
let lastPosition: GpsPosition | null = null;
let lastSendTime = 0;
let stopStartTime: number | null = null;

const SEND_INTERVAL_MS = 10000; // Send every 10 seconds
const HARD_BRAKE_THRESHOLD = 3; // m/s² deceleration
const STOP_NOTIFY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function startGpsTracking(vehicleId: string, driverId: string) {
  if (watchId !== null) stopGpsTracking();

  if (!('geolocation' in navigator)) {
    console.warn('Geolocation not available');
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const current: GpsPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: position.coords.speed ?? 0,
        heading: position.coords.heading,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };

      // Detect hard braking
      if (lastPosition && current.speed !== null && lastPosition.speed !== null) {
        const timeDiffS = (current.timestamp - lastPosition.timestamp) / 1000;
        if (timeDiffS > 0 && timeDiffS < 10) {
          const deceleration = (lastPosition.speed - current.speed) / timeDiffS;
          if (deceleration > HARD_BRAKE_THRESHOLD) {
            logDriverEvent(vehicleId, driverId, {
              event_type: 'hard_brake',
              severity: deceleration > 5 ? 'high' : 'medium',
              lat: current.lat,
              lng: current.lng,
              speed_before: lastPosition.speed * 3.6, // Convert to km/h
              speed_after: current.speed * 3.6,
              description: `Hård inbromsning: ${Math.round(lastPosition.speed * 3.6)} → ${Math.round(current.speed * 3.6)} km/h`,
            });
          }
        }
      }

      // Detect long stops
      const speedKmh = current.speed * 3.6;
      if (speedKmh < 2) {
        if (stopStartTime === null) {
          stopStartTime = current.timestamp;
        } else if (current.timestamp - stopStartTime >= STOP_NOTIFY_THRESHOLD_MS) {
          const durationSeconds = Math.round((current.timestamp - stopStartTime) / 1000);
          logDriverEvent(vehicleId, driverId, {
            event_type: 'long_stop',
            severity: durationSeconds > 600 ? 'high' : 'medium',
            lat: current.lat,
            lng: current.lng,
            duration_seconds: durationSeconds,
            description: `Stopp i ${Math.round(durationSeconds / 60)} minuter`,
          });
          // Reset so we don't spam — notify again after another 5 min
          stopStartTime = current.timestamp;
        }
      } else {
        stopStartTime = null;
      }

      // Send position to database periodically
      const now = Date.now();
      if (now - lastSendTime >= SEND_INTERVAL_MS) {
        sendPosition(vehicleId, driverId, current);
        lastSendTime = now;
      }

      lastPosition = current;
    },
    (error) => {
      console.error('GPS error:', error.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    }
  );
}

export function stopGpsTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  lastPosition = null;
  stopStartTime = null;
}

async function sendPosition(vehicleId: string, driverId: string, pos: GpsPosition) {
  try {
    await supabase.from('vehicle_positions').insert({
      vehicle_id: vehicleId,
      driver_id: driverId,
      lat: pos.lat,
      lng: pos.lng,
      speed_kmh: pos.speed * 3.6,
      heading: pos.heading ?? 0,
      accuracy_m: pos.accuracy,
    });
  } catch (err) {
    console.error('Failed to send position:', err);
  }
}

async function logDriverEvent(
  vehicleId: string,
  driverId: string,
  event: {
    event_type: string;
    severity: string;
    lat?: number;
    lng?: number;
    speed_before?: number;
    speed_after?: number;
    duration_seconds?: number;
    description?: string;
  }
) {
  try {
    const { data } = await supabase.from('driver_events').insert({
      vehicle_id: vehicleId,
      driver_id: driverId,
      ...event,
    }).select('id').single();

    // Create notification for chef
    if (data) {
      await supabase.from('chef_notifications').insert({
        chef_id: 'user-chef',
        driver_id: driverId,
        vehicle_id: vehicleId,
        event_id: data.id,
        notification_type: event.event_type === 'hard_brake' ? 'hard_brake' : 'long_stop',
        title: event.event_type === 'hard_brake' ? '⚠️ Hård inbromsning' : '⏱️ Långt stopp',
        message: event.description ?? 'Händelse registrerad',
      });
    }
  } catch (err) {
    console.error('Failed to log driver event:', err);
  }
}

// Hook to get latest positions for all vehicles (real-time)
export function subscribeToPositions(
  callback: (positions: Map<string, {
    lat: number;
    lng: number;
    speed_kmh: number;
    heading: number;
    recorded_at: string;
    vehicle_id: string;
    driver_id: string;
  }>) => void
) {
  // Initial fetch of latest positions
  const fetchLatest = async () => {
    const { data } = await supabase
      .from('vehicle_positions')
      .select('*')
      .order('recorded_at', { ascending: false });

    if (data) {
      const latest = new Map<string, typeof data[0]>();
      data.forEach((pos) => {
        if (!latest.has(pos.vehicle_id)) {
          latest.set(pos.vehicle_id, pos);
        }
      });
      callback(latest);
    }
  };

  fetchLatest();

  // Subscribe to real-time updates
  const channel = supabase
    .channel('vehicle-positions-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'vehicle_positions' },
      (payload) => {
        fetchLatest(); // Re-fetch all latest on any new insert
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
