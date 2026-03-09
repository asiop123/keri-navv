import { useEffect, useRef } from 'react';
import tt from '@tomtom-international/web-sdk-maps';
import '@tomtom-international/web-sdk-maps/dist/maps.css';
import { getTomTomApiKey, RouteResult } from '@/services/tomtom';

interface TomTomMapProps {
  route?: RouteResult | null;
  className?: string;
}

export default function TomTomMap({ route, className = '' }: TomTomMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<tt.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    
    const map = tt.map({
      key: getTomTomApiKey(),
      container: mapRef.current,
      center: [15.6, 59.3], // Sweden center
      zoom: 5,
      language: 'sv-SE',
    });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !route) return;

    // Wait for map to be loaded
    const addRoute = () => {
      // Remove existing route layer/source
      if (map.getLayer('route-line')) map.removeLayer('route-line');
      if (map.getSource('route')) map.removeSource('route');

      // Add route line
      map.addSource('route', {
        type: 'geojson',
        data: route.geoJson,
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#1B3A5C',
          'line-width': 5,
          'line-opacity': 0.8,
        },
      });

      // Remove old markers
      const existingMarkers = document.querySelectorAll('.tt-marker');
      existingMarkers.forEach(m => m.remove());

      // Add waypoint markers
      route.waypoints.forEach((wp, i) => {
        const isStart = i === 0;
        const isEnd = i === route.waypoints.length - 1;
        
        const el = document.createElement('div');
        el.className = 'tt-marker';
        el.style.cssText = `
          width: 32px; height: 32px; border-radius: 50%;
          background: ${isStart ? '#22c55e' : isEnd ? '#ef4444' : '#eab308'};
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: bold; color: white;
        `;
        el.textContent = isStart ? 'A' : isEnd ? 'B' : String(i);

        new tt.Marker({ element: el })
          .setLngLat([wp.lng, wp.lat])
          .setPopup(new tt.Popup().setHTML(`<strong>${wp.name}</strong>`))
          .addTo(map);
      });

      // Fit map to route bounds
      map.fitBounds(
        [
          [route.bbox[0], route.bbox[1]],
          [route.bbox[2], route.bbox[3]],
        ],
        { padding: 50, duration: 1000 }
      );
    };

    if (map.isStyleLoaded()) {
      addRoute();
    } else {
      map.on('load', addRoute);
    }
  }, [route]);

  return (
    <div
      ref={mapRef}
      className={`w-full rounded-lg overflow-hidden ${className}`}
      style={{ minHeight: '300px' }}
    />
  );
}
