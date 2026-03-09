import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import tt from '@tomtom-international/web-sdk-maps';
import '@tomtom-international/web-sdk-maps/dist/maps.css';
import { getTomTomApiKey, RouteResult } from '@/services/tomtom';
import { TimelineEntry } from '@/types';

interface TomTomMapProps {
  route?: RouteResult | null;
  timeline?: TimelineEntry[];
  userPosition?: { lat: number; lng: number } | null;
  isNavigating?: boolean;
  className?: string;
}

export interface TomTomMapHandle {
  getMap: () => tt.Map | null;
  centerOnUser: () => void;
}

const TomTomMap = forwardRef<TomTomMapHandle, TomTomMapProps>(
  ({ route, timeline, userPosition, isNavigating, className = '' }, ref) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<tt.Map | null>(null);
    const userMarkerRef = useRef<tt.Marker | null>(null);

    const centerOnUser = useCallback(() => {
      const map = mapInstance.current;
      if (map && userPosition) {
        (map as any).flyTo({ center: [userPosition.lng, userPosition.lat], zoom: 15, duration: 800 });
      }
    }, [userPosition]);

    useImperativeHandle(ref, () => ({
      getMap: () => mapInstance.current,
      centerOnUser,
    }));

    // Initialize map
    useEffect(() => {
      if (!mapRef.current) return;

      const map = tt.map({
        key: getTomTomApiKey(),
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

    // Update user position marker
    useEffect(() => {
      const map = mapInstance.current;
      if (!map) return;

      if (!userPosition) {
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
          userMarkerRef.current = null;
        }
        return;
      }

      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([userPosition.lng, userPosition.lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'tt-user-marker';
        el.style.cssText = `
          width: 22px; height: 22px; border-radius: 50%;
          background: #3b82f6;
          border: 3px solid white;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
        `;
        // Pulsing ring
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

      // In navigation mode, follow user
      if (isNavigating) {
        (map as any).easeTo({ center: [userPosition.lng, userPosition.lat], zoom: 15, duration: 500 });
      }
    }, [userPosition, isNavigating]);

    // Draw route and markers
    useEffect(() => {
      const map = mapInstance.current;
      if (!map || !route) return;

      const addRoute = () => {
        if (map.getLayer('route-line')) map.removeLayer('route-line');
        if (map.getLayer('route-line-bg')) map.removeLayer('route-line-bg');
        if (map.getSource('route')) map.removeSource('route');

        map.addSource('route', {
          type: 'geojson',
          data: route.geoJson,
        });

        // Route background (wider, darker)
        map.addLayer({
          id: 'route-line-bg',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#0f2942',
            'line-width': 8,
            'line-opacity': 0.4,
          },
        });

        // Route line
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#2563eb',
            'line-width': 5,
            'line-opacity': 0.9,
          },
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
            border: 3px solid white;
            box-shadow: 0 2px 12px rgba(0,0,0,0.35);
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
          const restEntries = timeline.filter(
            e => (e.type === 'rest' || e.type === 'overnight') && e.restStop
          );
          restEntries.forEach((entry) => {
            const stop = entry.restStop!;
            const el = document.createElement('div');
            el.className = 'tt-marker';
            const isOvernight = entry.type === 'overnight';
            el.style.cssText = `
              width: 32px; height: 32px; border-radius: 8px;
              background: ${isOvernight ? '#6366f1' : '#f59e0b'};
              border: 2px solid white;
              box-shadow: 0 2px 10px rgba(0,0,0,0.3);
              display: flex; align-items: center; justify-content: center;
              font-size: 16px; cursor: pointer;
            `;
            el.textContent = isOvernight ? '🌙' : '☕';

            new tt.Marker({ element: el })
              .setLngLat([stop.lng, stop.lat])
              .setPopup(
                new tt.Popup().setHTML(`
                  <div style="padding:4px;min-width:150px">
                    <strong>${isOvernight ? '🌙 Dygnsvila' : '☕ Rast'}</strong>
                    <p style="font-size:12px;margin:4px 0 0;color:#555">${stop.name}</p>
                    ${stop.distance ? `<p style="font-size:11px;color:#888">${stop.distance} från rutten</p>` : ''}
                  </div>
                `)
              )
              .addTo(map);
          });
        }

        // Fit bounds
        map.fitBounds(
          [[route.bbox[0], route.bbox[1]], [route.bbox[2], route.bbox[3]]],
          { padding: 80, duration: 1000 }
        );
      };

      if (map.isStyleLoaded()) {
        addRoute();
      } else {
        map.on('load', addRoute);
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
        <div ref={mapRef} className={`w-full h-full ${className}`} />
      </>
    );
  }
);

TomTomMap.displayName = 'TomTomMap';
export default TomTomMap;
