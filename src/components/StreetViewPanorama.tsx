import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Eye, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const GOOGLE_MAPS_KEY = 'AIzaSyDtwH0gOPIznevKsiEncudw9kaoH6Q8p_Y';

interface StreetViewPanoramaProps {
  lat: number;
  lng: number;
  heading?: number;
  pitch?: number;
  className?: string;
  label?: string;
  showExpandButton?: boolean;
  showZoomButtons?: boolean;
}

function useGoogleMapsScript() {
  const [loaded, setLoaded] = useState(!!window.google?.maps?.StreetViewPanorama);

  useEffect(() => {
    if (window.google?.maps?.StreetViewPanorama) {
      setLoaded(true);
      return;
    }

    // Check if script is already being loaded
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      existing.addEventListener('load', () => setLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  return loaded;
}

function PanoramaView({ lat, lng, heading = 0, pitch = 5, className = 'w-full h-full', showZoomButtons = false }: {
  lat: number; lng: number; heading?: number; pitch?: number; className?: string; showZoomButtons?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !window.google?.maps) return;

    setNoData(false);

    const sv = new google.maps.StreetViewService();
    const position = new google.maps.LatLng(lat, lng);

    sv.getPanorama({ location: position, radius: 100 }, (data, status) => {
      if (status === google.maps.StreetViewStatus.OK && data?.location?.latLng && containerRef.current) {
        panoramaRef.current = new google.maps.StreetViewPanorama(containerRef.current, {
          position: data.location.latLng,
          pov: { heading, pitch },
          zoom: 0,
          addressControl: false,
          showRoadLabels: true,
          motionTracking: false,
          motionTrackingControl: false,
          fullscreenControl: false,
          linksControl: true,
          panControl: true,
          zoomControl: true,
          scrollwheel: true,
          enableCloseButton: false,
        });
      } else {
        setNoData(true);
      }
    });

    return () => {
      panoramaRef.current = null;
    };
  }, [lat, lng, heading, pitch]);

  const handleZoom = (delta: number) => {
    if (!panoramaRef.current) return;
    const current = panoramaRef.current.getZoom() ?? 0;
    panoramaRef.current.setZoom(Math.max(0, Math.min(5, current + delta)));
  };

  if (noData) {
    return (
      <div className={`${className} flex items-center justify-center bg-muted`}>
        <div className="text-center text-muted-foreground text-xs">
          <Eye className="h-5 w-5 mx-auto mb-1 opacity-50" />
          Street View ej tillgänglig
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      {showZoomButtons && (
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 w-9 p-0 bg-background/90 backdrop-blur shadow-lg hover:bg-background"
            onClick={() => handleZoom(1)}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 w-9 p-0 bg-background/90 backdrop-blur shadow-lg hover:bg-background"
            onClick={() => handleZoom(-1)}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function StreetViewPanorama({
  lat, lng, heading = 0, pitch = 5, className = 'w-full h-[160px]', label, showExpandButton = true,
}: StreetViewPanoramaProps) {
  const loaded = useGoogleMapsScript();
  const [expanded, setExpanded] = useState(false);

  if (!loaded) {
    return (
      <div className={`${className} bg-muted animate-pulse flex items-center justify-center`}>
        <span className="text-xs text-muted-foreground">Laddar Street View…</span>
      </div>
    );
  }

  return (
    <>
      <div className={`relative ${className} overflow-hidden`}>
        <PanoramaView lat={lat} lng={lng} heading={heading} pitch={pitch} className="w-full h-full" />
        
        {label && (
          <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur rounded px-2 py-0.5 text-[10px] font-medium flex items-center gap-1 pointer-events-none">
            <Eye className="h-3 w-3" />
            {label}
          </div>
        )}

        {showExpandButton && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2 h-7 w-7 p-0 bg-background/80 backdrop-blur hover:bg-background"
            onClick={() => setExpanded(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-4xl w-[95vw] h-[80vh] p-0 overflow-hidden">
          <PanoramaView lat={lat} lng={lng} heading={heading} pitch={pitch} className="w-full h-full" />
        </DialogContent>
      </Dialog>
    </>
  );
}
