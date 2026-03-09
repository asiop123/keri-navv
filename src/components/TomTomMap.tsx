import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import tt from '@tomtom-international/web-sdk-maps';
import '@tomtom-international/web-sdk-maps/dist/maps.css';
import { getTomTomApiKey, RouteResult } from '@/services/tomtom';

interface TomTomMapProps {
  route?: RouteResult | null;
  className?: string;
}

export interface TomTomMapHandle {
  getMap: () => tt.Map | null;
}

const TomTomMap = forwardRef<TomTomMapHandle, TomTomMapProps>(({ route, className = '' }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<tt.Map | null>(null);

  useImperativeHandle(ref, () => ({
    getMap: () => mapInstance.current,
  }));

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

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !route) return;

    const addRoute = () => {
      if (map.getLayer('route-line')) map.removeLayer('route-line');
      if (map.getSource('route')) map.removeSource('route');

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

      const existingMarkers = document.querySelectorAll('.tt-marker');
      existingMarkers.forEach(m => m.remove());

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

      map.fitBounds(
        [
          [route.bbox[0], route.bbox[1]],
          [route.bbox[2], route.bbox[3]],
        ],
        { padding: 80, duration: 1000 }
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
      className={`w-full h-full ${className}`}
    />
  );
});

TomTomMap.displayName = 'TomTomMap';
export default TomTomMap;
