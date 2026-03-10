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
  alternativeRoutes?: RouteResult[];
  timeline?: TimelineEntry[];
  userPosition?: { lat: number; lng: number } | null;
  isNavigating?: boolean;
  className?: string;
  defaultStyle?: string;
  onMapClick?: (lat: number, lng: number) => void;
  onAlternativeClick?: (index: number) => void;
}

export interface TomTomMapHandle {
  getMap: () => tt.Map | null;
  centerOnUser: () => void;
  flyToLocation: (lng: number, lat: number, zoom?: number) => void;
}

const TomTomMap = forwardRef<TomTomMapHandle, TomTomMapProps>(
  ({ route, alternativeRoutes = [], timeline, userPosition, isNavigating, className = '', defaultStyle = 'basic', onMapClick, onAlternativeClick }, ref) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<tt.Map | null>(null);
    const userMarkerRef = useRef<tt.Marker | null>(null);
    const routeMarkersRef = useRef<tt.Marker[]>([]);
    const [currentStyle, setCurrentStyle] = useState(defaultStyle);
    const [showStylePicker, setShowStylePicker] = useState(false);
    const routeDataRef = useRef<{ route?: RouteResult | null; timeline?: TimelineEntry[]; alternativeRoutes?: RouteResult[] }>({});
    const onMapClickRef = useRef(onMapClick);
    const onAlternativeClickRef = useRef(onAlternativeClick);
    onMapClickRef.current = onMapClick;
    onAlternativeClickRef.current = onAlternativeClick;

    routeDataRef.current = { route, timeline, alternativeRoutes };

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

      const initStyle = MAP_STYLES.find(s => s.id === defaultStyle);

      const map = tt.map({
        key: API_KEY,
        container: mapRef.current,
        center: [15.6, 59.3],
        zoom: 5,
        language: 'sv-SE',
        style: initStyle?.style,
      });

      map.on('dblclick', (e: any) => {
        e.preventDefault();
        if (onMapClickRef.current) {
          onMapClickRef.current(e.lngLat.lat, e.lngLat.lng);
        }
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
        const { route: r, timeline: tl, alternativeRoutes: alts } = routeDataRef.current;
        if (r) {
          addRouteToMap(map, r, tl, alts);
        }
      });
    }, []);

    // Add route helper
    const addRouteToMap = (map: tt.Map, route: RouteResult, timeline?: TimelineEntry[], alts?: RouteResult[]) => {
      // Remove ALL old route markers (labels, waypoints, rest stops)
      routeMarkersRef.current.forEach(m => m.remove());
      routeMarkersRef.current = [];

      // Remove old layers/sources
      const layersToRemove = ['route-line', 'route-line-bg'];
      const sourcesToRemove = ['route'];
      for (let i = 0; i < 5; i++) {
        layersToRemove.push(`alt-route-line-${i}`, `alt-route-line-bg-${i}`);
        sourcesToRemove.push(`alt-route-${i}`);
      }
      try {
        layersToRemove.forEach(l => { if (map.getLayer(l)) map.removeLayer(l); });
        sourcesToRemove.forEach(s => { if (map.getSource(s)) map.removeSource(s); });
      } catch {}

      // Draw alternative routes first (behind main) - clearly GREY/WHITE, high contrast
      if (alts && alts.length > 0) {
        alts.forEach((alt, i) => {
          map.addSource(`alt-route-${i}`, { type: 'geojson', data: alt.geoJson });
          // White outer border for high visibility
          map.addLayer({
            id: `alt-route-line-bg-${i}`, type: 'line', source: `alt-route-${i}`,
            paint: { 'line-color': '#000000', 'line-width': 10, 'line-opacity': 0.25, 'line-offset': 6 },
          });
          // Bright white dashed inner line — clearly NOT blue
          map.addLayer({
            id: `alt-route-line-${i}`, type: 'line', source: `alt-route-${i}`,
            paint: {
              'line-color': '#ffffff',
              'line-width': 5,
              'line-opacity': 0.95,
              'line-dasharray': [4, 3],
              'line-offset': 6,
            },
          });

          // Click handlers
          const handleAltClick = () => { if (onAlternativeClickRef.current) onAlternativeClickRef.current(i); };
          map.on('click', `alt-route-line-bg-${i}`, handleAltClick);
          map.on('click', `alt-route-line-${i}`, handleAltClick);
          map.on('mouseenter', `alt-route-line-${i}`, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', `alt-route-line-${i}`, () => { map.getCanvas().style.cursor = ''; });
          map.on('mouseenter', `alt-route-line-bg-${i}`, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', `alt-route-line-bg-${i}`, () => { map.getCanvas().style.cursor = ''; });

          // Alt route label - grey bubble with time diff info
          const midIdx = Math.floor(alt.routePoints.length * 0.45);
          if (alt.routePoints[midIdx]) {
            const midPoint = alt.routePoints[midIdx];
            const diffMin = Math.round((alt.travelTimeSeconds - route.travelTimeSeconds) / 60);
            const diffKm = alt.distanceKm - route.distanceKm;
            const altH = Math.floor(alt.travelTimeSeconds / 3600);
            const altM = Math.round((alt.travelTimeSeconds % 3600) / 60);

            // Build label text
            let diffText = '';
            if (diffMin > 0) diffText = `+${diffMin} min`;
            else if (diffMin < 0) diffText = `${diffMin} min`;
            else diffText = 'Samma tid';

            let reasonText = '';
            if (diffKm > 5) reasonText = 'Längre väg';
            else if (diffKm < -5) reasonText = 'Kortare väg';
            else if (diffMin > 10) reasonText = 'Ev. trafik/omväg';
            else if (diffMin < -5) reasonText = 'Snabbare väg';

            const labelEl = document.createElement('div');
            labelEl.className = 'tt-marker tt-alt-label';
            labelEl.style.cssText = `
              background: white; color: #6b7280; font-size: 11px; font-weight: 600;
              padding: 6px 12px; border-radius: 12px; white-space: nowrap;
              box-shadow: 0 2px 10px rgba(0,0,0,0.2); border: 2px solid #d1d5db;
              cursor: pointer; user-select: none; transition: all 0.15s;
              display: flex; flex-direction: column; align-items: center; gap: 1px;
              max-width: 160px; line-height: 1.3;
            `;
            const line1 = document.createElement('span');
            line1.style.cssText = 'font-size: 12px; font-weight: 700; color: #374151;';
            line1.textContent = `${altH}h ${altM}m · ${alt.distanceKm} km`;
            labelEl.appendChild(line1);

            const line2 = document.createElement('span');
            line2.style.cssText = `font-size: 10px; font-weight: 600; color: ${diffMin > 0 ? '#dc2626' : diffMin < 0 ? '#16a34a' : '#6b7280'};`;
            line2.textContent = diffText + (reasonText ? ` · ${reasonText}` : '');
            labelEl.appendChild(line2);

            labelEl.title = 'Klicka för att välja denna rutt';
            labelEl.addEventListener('mouseenter', () => {
              labelEl.style.borderColor = '#2563eb';
              labelEl.style.boxShadow = '0 2px 12px rgba(37,99,235,0.3)';
            });
            labelEl.addEventListener('mouseleave', () => {
              labelEl.style.borderColor = '#d1d5db';
              labelEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            });
            labelEl.addEventListener('click', (e) => {
              e.stopPropagation();
              handleAltClick();
            });
            const altMarker = new tt.Marker({ element: labelEl, anchor: 'center' })
              .setLngLat([midPoint[0], midPoint[1]])
              .addTo(map);
            routeMarkersRef.current.push(altMarker);
          }
        });
      }

      // Draw main/selected route on top - BLUE
      map.addSource('route', { type: 'geojson', data: route.geoJson });
      map.addLayer({
        id: 'route-line-bg', type: 'line', source: 'route',
        paint: { 'line-color': '#1e40af', 'line-width': 9, 'line-opacity': 0.35 },
      });
      map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        paint: { 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.95 },
      });

      // Main route label - blue bubble
      if (route.routePoints.length > 0) {
        const midIdx = Math.floor(route.routePoints.length * 0.45);
        const midPoint = route.routePoints[midIdx];
        const mainH = Math.floor(route.travelTimeSeconds / 3600);
        const mainM = Math.round((route.travelTimeSeconds % 3600) / 60);
        const mainLabel = document.createElement('div');
        mainLabel.className = 'tt-marker tt-main-label';
        mainLabel.style.cssText = `
          background: #2563eb; color: white; font-size: 11px; font-weight: 600;
          padding: 6px 12px; border-radius: 12px; white-space: nowrap;
          box-shadow: 0 2px 10px rgba(37,99,235,0.4); border: 2px solid #1d4ed8;
          user-select: none; display: flex; flex-direction: column; align-items: center; gap: 1px;
          line-height: 1.3;
        `;
        const l1 = document.createElement('span');
        l1.style.cssText = 'font-size: 12px; font-weight: 700;';
        l1.textContent = `${mainH}h ${mainM}m · ${route.distanceKm} km`;
        mainLabel.appendChild(l1);

        const l2 = document.createElement('span');
        l2.style.cssText = 'font-size: 10px; opacity: 0.85;';
        l2.textContent = 'Snabbaste rutten';
        mainLabel.appendChild(l2);

        new tt.Marker({ element: mainLabel, anchor: 'center' })
          .setLngLat([midPoint[0], midPoint[1]])
          .addTo(map);
      }

      // Remove old waypoint/rest markers (keep route labels)
      document.querySelectorAll('.tt-marker:not(.tt-alt-label):not(.tt-main-label)').forEach(m => m.remove());

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

      const draw = () => addRouteToMap(map, route, timeline, alternativeRoutes);

      if (map.isStyleLoaded()) {
        draw();
      } else {
        map.on('load', draw);
      }
    }, [route, timeline, alternativeRoutes]);

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
