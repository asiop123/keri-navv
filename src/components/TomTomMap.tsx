import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import tt from '@tomtom-international/web-sdk-maps';
import '@tomtom-international/web-sdk-maps/dist/maps.css';
import { getTomTomApiKey, RouteResult } from '@/services/tomtom';
import { TimelineEntry } from '@/types';
import { Map, Satellite, Moon, Mountain, Layers } from 'lucide-react';

const API_KEY = getTomTomApiKey();

type MapStyle = {
  id: string;
  label: string;
  icon: React.ReactNode;
  style: string;
};

const MAP_STYLES: MapStyle[] = [
  {
    id: 'basic',
    label: 'Karta',
    icon: <Map className="h-4 w-4" />,
    style: `https://api.tomtom.com/style/1/style/*?map=basic_main&key=${API_KEY}`,
  },
  {
    id: 'satellite',
    label: 'Satellit',
    icon: <Satellite className="h-4 w-4" />,
    style: `https://api.tomtom.com/style/1/style/*?map=2/basic_street-satellite&poi=2/poi_dynamic-satellite&key=${API_KEY}`,
  },
  {
    id: 'night',
    label: 'Natt',
    icon: <Moon className="h-4 w-4" />,
    style: `https://api.tomtom.com/style/1/style/*?map=basic_night&key=${API_KEY}`,
  },
  {
    id: 'terrain',
    label: 'Terräng',
    icon: <Mountain className="h-4 w-4" />,
    style: `https://api.tomtom.com/style/1/style/*?map=basic_main&hillshading=1&key=${API_KEY}`,
  },
];

interface TomTomMapProps {
  route?: RouteResult | null;
  timeline?: TimelineEntry[];
  userPosition?: { lat: number; lng: number } | null;
  isNavigating?: boolean;
  className?: string;
  defaultStyle?: string;
  onMapClick?: (lat: number, lng: number) => void;
}

export interface TomTomMapHandle {
  getMap: () => tt.Map | null;
  centerOnUser: () => void;
  flyToLocation: (lng: number, lat: number, zoom?: number) => void;
}

const TomTomMap = forwardRef<TomTomMapHandle, TomTomMapProps>(
  ({ route, timeline, userPosition, isNavigating, className = '' }, ref) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<tt.Map | null>(null);
    const userMarkerRef = useRef<tt.Marker | null>(null);
    const [currentStyle, setCurrentStyle] = useState('basic');
    const [showStylePicker, setShowStylePicker] = useState(false);
    const routeDataRef = useRef<{ route?: RouteResult | null; timeline?: TimelineEntry[] }>({});

    // Keep route data in ref for re-adding after style change
    routeDataRef.current = { route, timeline };

    const centerOnUser = useCallback(() => {
      const map = mapInstance.current;
      if (map && userPosition) {
        (map as any).flyTo({ center: [userPosition.lng, userPosition.lat], zoom: 15, duration: 800 });
      }
    }, [userPosition]);

    const flyToLocation = useCallback((lng: number, lat: number, zoom = 14) => {
      const map = mapInstance.current;
      if (map) {
        (map as any).flyTo({ center: [lng, lat], zoom, duration: 1000 });
      }
    }, []);

    useImperativeHandle(ref, () => ({
      getMap: () => mapInstance.current,
      centerOnUser,
      flyToLocation,
    }));

    // Initialize map
    useEffect(() => {
      if (!mapRef.current) return;

      const map = tt.map({
        key: API_KEY,
        container: mapRef.current,
        center: [15.6, 59.3],
        zoom: 5,
        language: 'sv-SE',
      });

      mapInstance.current = map;

      return () => {
        map.remove();
        mapInstance.current = null;
      };
    }, []);

    // Change map style
    const handleStyleChange = useCallback((styleId: string) => {
      const map = mapInstance.current;
      if (!map) return;

      const style = MAP_STYLES.find(s => s.id === styleId);
      if (!style) return;

      setCurrentStyle(styleId);
      setShowStylePicker(false);

      map.setStyle(style.style);

      // Re-add route after style loads
      map.once('styledata', () => {
        const { route: r, timeline: tl } = routeDataRef.current;
        if (r) {
          addRouteToMap(map, r, tl);
        }
      });
    }, []);

    // Add route helper
    const addRouteToMap = (map: tt.Map, route: RouteResult, timeline?: TimelineEntry[]) => {
      try {
        if (map.getLayer('route-line')) map.removeLayer('route-line');
        if (map.getLayer('route-line-bg')) map.removeLayer('route-line-bg');
        if (map.getSource('route')) map.removeSource('route');
      } catch {}

      map.addSource('route', { type: 'geojson', data: route.geoJson });
      map.addLayer({
        id: 'route-line-bg', type: 'line', source: 'route',
        paint: { 'line-color': '#0f2942', 'line-width': 8, 'line-opacity': 0.4 },
      });
      map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        paint: { 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.9 },
      });

      // Remove old markers (except user marker)
      document.querySelectorAll('.tt-marker').forEach(m => m.remove());

      // Waypoint markers
      route.waypoints.forEach((wp, i) => {
        const isStart = i === 0;
        const isEnd = i === route.waypoints.length - 1;
        const el = document.createElement('div');
        el.className = 'tt-marker';
        el.style.cssText = `
          width: 36px; height: 36px; border-radius: 50%;
          background: ${isStart ? '#22c55e' : isEnd ? '#ef4444' : '#eab308'};
          border: 3px solid white; box-shadow: 0 2px 12px rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: bold; color: white;
        `;
        el.textContent = isStart ? 'A' : isEnd ? 'B' : String(i);
        new tt.Marker({ element: el })
          .setLngLat([wp.lng, wp.lat])
          .setPopup(new tt.Popup().setHTML(`<strong>${wp.name}</strong>`))
          .addTo(map);
      });

      // Rest stop markers
      if (timeline) {
        timeline.filter(e => (e.type === 'rest' || e.type === 'overnight') && e.restStop)
          .forEach((entry) => {
            const stop = entry.restStop!;
            const el = document.createElement('div');
            el.className = 'tt-marker';
            const isOvernight = entry.type === 'overnight';
            el.style.cssText = `
              width: 32px; height: 32px; border-radius: 8px;
              background: ${isOvernight ? '#6366f1' : '#f59e0b'};
              border: 2px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
              display: flex; align-items: center; justify-content: center;
              font-size: 16px; cursor: pointer;
            `;
            el.textContent = isOvernight ? '🌙' : '☕';
            new tt.Marker({ element: el })
              .setLngLat([stop.lng, stop.lat])
              .setPopup(new tt.Popup().setHTML(`
                <div style="padding:4px;min-width:150px">
                  <strong>${isOvernight ? '🌙 Dygnsvila' : '☕ Rast'}</strong>
                  <p style="font-size:12px;margin:4px 0 0;color:#555">${stop.name}</p>
                  ${stop.distance ? `<p style="font-size:11px;color:#888">${stop.distance} från rutten</p>` : ''}
                </div>
              `))
              .addTo(map);
          });
      }

      map.fitBounds(
        [[route.bbox[0], route.bbox[1]], [route.bbox[2], route.bbox[3]]],
        { padding: 80, duration: 1000 }
      );
    };

    // Update user position marker
    useEffect(() => {
      const map = mapInstance.current;
      if (!map) return;

      if (!userPosition) {
        if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }
        return;
      }

      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([userPosition.lng, userPosition.lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'tt-user-marker';
        el.style.cssText = `
          width: 22px; height: 22px; border-radius: 50%;
          background: #3b82f6; border: 3px solid white;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
        `;
        const pulse = document.createElement('div');
        pulse.style.cssText = `
          position: absolute; top: -8px; left: -8px;
          width: 34px; height: 34px; border-radius: 50%;
          background: rgba(59,130,246,0.15);
          animation: pulse-ring 2s ease-out infinite;
        `;
        el.appendChild(pulse);
        userMarkerRef.current = new tt.Marker({ element: el })
          .setLngLat([userPosition.lng, userPosition.lat])
          .addTo(map);
      }

      if (isNavigating) {
        (map as any).easeTo({ center: [userPosition.lng, userPosition.lat], zoom: 15, duration: 500 });
      }
    }, [userPosition, isNavigating]);

    // Draw route and markers
    useEffect(() => {
      const map = mapInstance.current;
      if (!map || !route) return;

      const draw = () => addRouteToMap(map, route, timeline);

      if (map.isStyleLoaded()) {
        draw();
      } else {
        map.on('load', draw);
      }
    }, [route, timeline]);

    return (
      <>
        <style>{`
          @keyframes pulse-ring {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(2.5); opacity: 0; }
          }
        `}</style>
        <div className="relative w-full h-full">
          <div ref={mapRef} className={`w-full h-full ${className}`} />

          {/* Style picker button */}
          <div className="absolute bottom-4 left-4 z-10">
            <button
              onClick={() => setShowStylePicker(!showStylePicker)}
              className="bg-card shadow-lg rounded-xl p-2.5 hover:bg-accent transition-colors border border-border"
              title="Byt kartvy"
            >
              <Layers className="h-5 w-5 text-foreground" />
            </button>

            {/* Style picker panel */}
            {showStylePicker && (
              <div className="absolute bottom-14 left-0 bg-card rounded-xl shadow-xl border border-border overflow-hidden min-w-[180px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="px-3 py-2 border-b border-border">
                  <span className="text-xs font-semibold text-foreground">Kartvy</span>
                </div>
                <div className="p-1.5 grid grid-cols-2 gap-1">
                  {MAP_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => handleStyleChange(style.id)}
                      className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2.5 text-[11px] font-medium transition-colors ${
                        currentStyle === style.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent text-foreground'
                      }`}
                    >
                      {style.icon}
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
);

TomTomMap.displayName = 'TomTomMap';
export default TomTomMap;
