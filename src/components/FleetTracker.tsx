import { useState, useEffect, useRef, useCallback } from 'react';
import tt from '@tomtom-international/web-sdk-maps';
import '@tomtom-international/web-sdk-maps/dist/maps.css';
import { getTomTomApiKey } from '@/services/tomtom';
import { mockVehicles, getDriverForVehicle } from '@/data/mockData';
import { Vehicle } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, LocateFixed, Navigation, Clock, Weight, AlertTriangle, Layers, StreetView } from 'lucide-react';
import { subscribeToPositions } from '@/services/gpsTracking';
import { supabase } from '@/integrations/supabase/client';

const TOMTOM_KEY = getTomTomApiKey();
const GOOGLE_MAPS_KEY = 'AIzaSyDtwH0gOPIznevKsiEncudw9kaoH6Q8p_Y';

interface VehiclePosition {
  vehicleId: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  lastUpdate: Date;
  status: 'driving' | 'idle' | 'parked';
  driverName?: string;
  weight?: number;
}

// Fallback simulated positions
const SIMULATED_POSITIONS: VehiclePosition[] = [
  {
    vehicleId: 'v1', lat: 58.41, lng: 15.62, heading: 210, speed: 82,
    lastUpdate: new Date(), status: 'driving',
  },
  {
    vehicleId: 'v2', lat: 57.71, lng: 11.97, heading: 0, speed: 0,
    lastUpdate: new Date(Date.now() - 1000 * 60 * 12), status: 'parked',
  },
];

function simulateMovement(pos: VehiclePosition): VehiclePosition {
  if (pos.status !== 'driving') return { ...pos };
  const rad = (pos.heading * Math.PI) / 180;
  const delta = 0.002 + Math.random() * 0.003;
  return {
    ...pos,
    lat: pos.lat + Math.cos(rad) * delta,
    lng: pos.lng + Math.sin(rad) * delta,
    speed: 70 + Math.round(Math.random() * 20),
    heading: pos.heading + (Math.random() - 0.5) * 8,
    lastUpdate: new Date(),
  };
}

const statusLabel: Record<string, string> = { driving: 'Kör', idle: 'Tomgång', parked: 'Parkerad' };
const statusVariant: Record<string, string> = {
  driving: 'bg-success text-success-foreground',
  idle: 'bg-warning text-warning-foreground',
  parked: 'bg-muted text-muted-foreground',
};

type MapStyle = 'satellite' | 'map';

export default function FleetTracker() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<tt.Map | null>(null);
  const markersRef = useRef<Record<string, tt.Marker>>({});
  const [positions, setPositions] = useState<VehiclePosition[]>(SIMULATED_POSITIONS);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('satellite');
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [useRealData, setUseRealData] = useState(false);

  // Fetch recent driver events
  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from('driver_events')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(10);
      if (data) setRecentEvents(data);
    };
    fetchEvents();

    const channel = supabase
      .channel('driver-events-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_events' }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Subscribe to real-time positions
  useEffect(() => {
    const unsubscribe = subscribeToPositions((latestPositions) => {
      if (latestPositions.size > 0) {
        setUseRealData(true);
        const realPositions: VehiclePosition[] = [];
        latestPositions.forEach((pos, vehicleId) => {
          const vehicle = mockVehicles.find(v => v.id === vehicleId);
          const driver = getDriverForVehicle(vehicleId);
          const speedKmh = pos.speed_kmh ?? 0;
          realPositions.push({
            vehicleId,
            lat: pos.lat,
            lng: pos.lng,
            heading: pos.heading ?? 0,
            speed: speedKmh,
            lastUpdate: new Date(pos.recorded_at),
            status: speedKmh > 5 ? 'driving' : speedKmh > 1 ? 'idle' : 'parked',
            driverName: driver?.name,
            weight: vehicle?.weightKg,
          });
        });
        setPositions(realPositions);
      }
    });
    return unsubscribe;
  }, []);

  // Initialize map with satellite style
  useEffect(() => {
    if (!mapRef.current) return;

    const map = tt.map({
      key: API_KEY,
      container: mapRef.current,
      center: [15.5, 58.5],
      zoom: 6,
      language: 'sv-SE',
      style: `https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAYW55dGltZTtRRlhDUTVxdzd1dWxiTW50.json?key=${API_KEY}`,
    });

    // Set satellite layer
    map.on('load', () => {
      try {
        map.setStyle(`https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAYW55dGltZTtRRlhDUTVxdzd1dWxiTW50.json?key=${API_KEY}`);
      } catch (e) {
        // Fallback - satellite may not be available, use default
      }
    });

    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; markersRef.current = {}; };
  }, []);

  // Toggle map style
  const toggleMapStyle = useCallback(() => {
    const map = mapInstance.current;
    if (!map) return;
    const newStyle = mapStyle === 'satellite' ? 'map' : 'satellite';
    setMapStyle(newStyle);

    if (newStyle === 'map') {
      map.setStyle(`https://api.tomtom.com/style/1/style/22.2.1-*?map=2/basic_street-light&poi=2/poi_light&key=${API_KEY}`);
    } else {
      map.setStyle(`https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAYW55dGltZTtRRlhDUTVxdzd1dWxiTW50.json?key=${API_KEY}`);
    }
  }, [mapStyle]);

  // Update markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    positions.forEach((pos) => {
      const vehicle = mockVehicles.find((v) => v.id === pos.vehicleId);
      if (!vehicle) return;
      const driver = getDriverForVehicle(vehicle.id);

      if (markersRef.current[pos.vehicleId]) {
        markersRef.current[pos.vehicleId].setLngLat([pos.lng, pos.lat]);
        const popup = markersRef.current[pos.vehicleId].getPopup();
        if (popup) popup.setHTML(buildPopupHtml(vehicle, pos, driver?.name));
      } else {
        const el = document.createElement('div');
        el.className = 'fleet-vehicle-marker';
        el.style.cssText = `
          width: 44px; height: 44px; border-radius: 50%;
          background: ${pos.status === 'driving' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : pos.status === 'idle' ? 'linear-gradient(135deg, #eab308, #ca8a04)' : 'linear-gradient(135deg, #6b7280, #4b5563)'};
          border: 3px solid white; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; cursor: pointer; transition: transform 0.2s;
        `;
        el.textContent = '🚛';
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.25)'; });
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
        el.addEventListener('click', () => setSelectedVehicle(pos.vehicleId));

        const popup = new tt.Popup({ offset: 25, closeButton: false }).setHTML(
          buildPopupHtml(vehicle, pos, driver?.name)
        );
        const marker = new tt.Marker({ element: el }).setLngLat([pos.lng, pos.lat]).setPopup(popup).addTo(map);
        markersRef.current[pos.vehicleId] = marker;
      }
    });
  }, [positions]);

  // Simulate movement if no real data
  useEffect(() => {
    if (useRealData) return;
    const interval = setInterval(() => {
      setPositions((prev) => prev.map(simulateMovement));
    }, 3000);
    return () => clearInterval(interval);
  }, [useRealData]);

  const flyToVehicle = useCallback((vehicleId: string) => {
    const map = mapInstance.current;
    const pos = positions.find((p) => p.vehicleId === vehicleId);
    if (map && pos) {
      (map as any).flyTo({ center: [pos.lng, pos.lat], zoom: 14, duration: 1000 });
      setSelectedVehicle(vehicleId);
      markersRef.current[vehicleId]?.togglePopup();
    }
  }, [positions]);

  const fitAll = useCallback(() => {
    const map = mapInstance.current;
    if (!map || positions.length === 0) return;
    const bounds = new tt.LngLatBounds();
    positions.forEach((p) => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: 60, duration: 800 });
    setSelectedVehicle(null);
  }, [positions]);

  const timeSince = (date: Date) => {
    const sec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (sec < 60) return 'Just nu';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min sedan`;
    return `${Math.floor(min / 60)}h ${min % 60}m sedan`;
  };

  const eventIcon = (type: string) => {
    switch (type) {
      case 'hard_brake': return '🛑';
      case 'long_stop': return '⏱️';
      case 'speeding': return '💨';
      default: return '⚠️';
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Fordonsövervakning
            {useRealData && (
              <Badge className="bg-success/20 text-success text-[10px]">LIVE</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleMapStyle} className="text-xs gap-1 h-8">
              <Layers className="h-3.5 w-3.5" />
              {mapStyle === 'satellite' ? 'Karta' : 'Satellit'}
            </Button>
            <Button variant="outline" size="sm" onClick={fitAll} className="text-xs gap-1 h-8">
              <LocateFixed className="h-3.5 w-3.5" />
              Alla
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Map */}
        <div ref={mapRef} className="w-full h-[350px] md:h-[450px]" />

        {/* Vehicle list */}
        <div className="p-4 space-y-2">
          {positions.map((pos) => {
            const vehicle = mockVehicles.find((v) => v.id === pos.vehicleId);
            if (!vehicle) return null;
            const driver = getDriverForVehicle(vehicle.id);
            const isSelected = selectedVehicle === pos.vehicleId;

            return (
              <div
                key={pos.vehicleId}
                onClick={() => flyToVehicle(pos.vehicleId)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-primary/10 ring-1 ring-primary/30 shadow-md'
                    : 'bg-muted/50 hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg shadow-sm ${
                    pos.status === 'driving' ? 'bg-success/20' : pos.status === 'idle' ? 'bg-warning/20' : 'bg-muted'
                  }`}>
                    🚛
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {vehicle.brand} {vehicle.model}
                      <span className="ml-2 text-muted-foreground font-normal text-xs">{vehicle.regNr}</span>
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {driver && (
                        <span className="flex items-center gap-1">
                          <Navigation className="h-3 w-3" />
                          {driver.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Weight className="h-3 w-3" />
                        {(vehicle.weightKg / 1000).toFixed(1)}t
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeSince(pos.lastUpdate)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Badge className={statusVariant[pos.status]}>
                    {statusLabel[pos.status]}
                  </Badge>
                  {pos.status === 'driving' && (
                    <span className="text-xs font-mono text-muted-foreground">{pos.speed} km/h</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent events */}
        {recentEvents.length > 0 && (
          <div className="border-t px-4 py-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Senaste händelser
            </h3>
            <div className="space-y-1.5">
              {recentEvents.slice(0, 5).map((event) => {
                const vehicle = mockVehicles.find(v => v.id === event.vehicle_id);
                return (
                  <div key={event.id} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/30">
                    <span>{eventIcon(event.event_type)}</span>
                    <span className="flex-1 truncate">
                      {event.description ?? event.event_type}
                      {vehicle && <span className="text-muted-foreground ml-1">· {vehicle.regNr}</span>}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        event.severity === 'high' ? 'border-destructive/30 text-destructive' : 'border-warning/30 text-warning'
                      }`}
                    >
                      {event.severity === 'high' ? 'Allvarlig' : 'Medel'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function buildPopupHtml(vehicle: Vehicle, pos: VehiclePosition, driverName?: string): string {
  return `
    <div style="padding:8px;min-width:180px;font-family:system-ui">
      <strong style="font-size:14px">${vehicle.brand} ${vehicle.model}</strong>
      <p style="font-size:11px;color:#888;margin:2px 0">${vehicle.regNr}</p>
      ${driverName ? `<p style="font-size:12px;margin:2px 0">🧑‍✈️ ${driverName}</p>` : ''}
      <p style="font-size:12px;margin:2px 0">⚖️ ${(vehicle.weightKg / 1000).toFixed(1)} ton</p>
      <p style="font-size:12px;margin:4px 0 0">
        ${pos.status === 'driving' ? `🟢 Kör — ${pos.speed} km/h` : pos.status === 'idle' ? '🟡 Tomgång' : '⚫ Parkerad'}
      </p>
    </div>
  `;
}
