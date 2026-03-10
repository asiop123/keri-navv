import { useState, useEffect, useRef, useCallback } from 'react';
import tt from '@tomtom-international/web-sdk-maps';
import '@tomtom-international/web-sdk-maps/dist/maps.css';
import { getTomTomApiKey } from '@/services/tomtom';
import { mockVehicles, getDriverForVehicle } from '@/data/mockData';
import { Vehicle } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, LocateFixed, Truck, Navigation, Clock } from 'lucide-react';

const API_KEY = getTomTomApiKey();

interface VehiclePosition {
  vehicleId: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number; // km/h
  lastUpdate: Date;
  status: 'driving' | 'idle' | 'parked';
}

// Simulated vehicle positions around Sweden
const SIMULATED_POSITIONS: VehiclePosition[] = [
  {
    vehicleId: 'v1',
    lat: 58.41,
    lng: 15.62,
    heading: 210,
    speed: 82,
    lastUpdate: new Date(),
    status: 'driving',
  },
  {
    vehicleId: 'v2',
    lat: 57.71,
    lng: 11.97,
    heading: 0,
    speed: 0,
    lastUpdate: new Date(Date.now() - 1000 * 60 * 12),
    status: 'parked',
  },
];

// Simulate small movement for driving vehicles
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

const statusLabel: Record<string, string> = {
  driving: 'Kör',
  idle: 'Tomgång',
  parked: 'Parkerad',
};

const statusVariant: Record<string, string> = {
  driving: 'bg-success text-success-foreground',
  idle: 'bg-warning text-warning-foreground',
  parked: 'bg-muted text-muted-foreground',
};

export default function FleetTracker() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<tt.Map | null>(null);
  const markersRef = useRef<Record<string, tt.Marker>>({});
  const [positions, setPositions] = useState<VehiclePosition[]>(SIMULATED_POSITIONS);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const map = tt.map({
      key: API_KEY,
      container: mapRef.current,
      center: [15.5, 58.5],
      zoom: 6,
      language: 'sv-SE',
    });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
      markersRef.current = {};
    };
  }, []);

  // Update markers when positions change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    positions.forEach((pos) => {
      const vehicle = mockVehicles.find((v) => v.id === pos.vehicleId);
      if (!vehicle) return;

      const driver = getDriverForVehicle(vehicle.id);

      if (markersRef.current[pos.vehicleId]) {
        markersRef.current[pos.vehicleId].setLngLat([pos.lng, pos.lat]);
        // Update popup content
        const popup = markersRef.current[pos.vehicleId].getPopup();
        if (popup) {
          popup.setHTML(buildPopupHtml(vehicle, pos, driver?.name));
        }
      } else {
        const el = document.createElement('div');
        el.className = 'fleet-vehicle-marker';
        el.style.cssText = `
          width: 40px; height: 40px; border-radius: 50%;
          background: ${pos.status === 'driving' ? '#22c55e' : pos.status === 'idle' ? '#eab308' : '#6b7280'};
          border: 3px solid white; box-shadow: 0 2px 12px rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; cursor: pointer; transition: transform 0.2s;
        `;
        el.textContent = '🚛';
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)'; });
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
        el.addEventListener('click', () => setSelectedVehicle(pos.vehicleId));

        const popup = new tt.Popup({ offset: 25, closeButton: false }).setHTML(
          buildPopupHtml(vehicle, pos, driver?.name)
        );

        const marker = new tt.Marker({ element: el })
          .setLngLat([pos.lng, pos.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current[pos.vehicleId] = marker;
      }
    });
  }, [positions]);

  // Simulate movement every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPositions((prev) => prev.map(simulateMovement));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const flyToVehicle = useCallback((vehicleId: string) => {
    const map = mapInstance.current;
    const pos = positions.find((p) => p.vehicleId === vehicleId);
    if (map && pos) {
      (map as any).flyTo({ center: [pos.lng, pos.lat], zoom: 12, duration: 1000 });
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

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Fordonsövervakning
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fitAll} className="text-xs gap-1">
            <LocateFixed className="h-3.5 w-3.5" />
            Visa alla
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Map */}
        <div ref={mapRef} className="w-full h-[300px] md:h-[400px]" />

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
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-primary/10 ring-1 ring-primary/30'
                    : 'bg-muted/50 hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                    🚛
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {vehicle.brand} {vehicle.model}
                      <span className="ml-2 text-muted-foreground font-normal">{vehicle.regNr}</span>
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {driver && (
                        <span className="flex items-center gap-1">
                          <Navigation className="h-3 w-3" />
                          {driver.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeSince(pos.lastUpdate)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {pos.status === 'driving' && (
                    <span className="text-xs font-mono text-muted-foreground">{pos.speed} km/h</span>
                  )}
                  <Badge className={statusVariant[pos.status]}>
                    {statusLabel[pos.status]}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function buildPopupHtml(vehicle: Vehicle, pos: VehiclePosition, driverName?: string): string {
  return `
    <div style="padding:6px;min-width:160px;font-family:system-ui">
      <strong style="font-size:14px">${vehicle.brand} ${vehicle.model}</strong>
      <p style="font-size:12px;color:#888;margin:2px 0">${vehicle.regNr}</p>
      ${driverName ? `<p style="font-size:12px;margin:2px 0">🧑‍✈️ ${driverName}</p>` : ''}
      <p style="font-size:12px;margin:4px 0 0">
        ${pos.status === 'driving' ? `🟢 Kör — ${pos.speed} km/h` : pos.status === 'idle' ? '🟡 Tomgång' : '⚫ Parkerad'}
      </p>
    </div>
  `;
}
