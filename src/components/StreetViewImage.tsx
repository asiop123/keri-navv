import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { getStreetViewUrl } from '@/lib/googleMaps';

interface Props {
  lat: number;
  lng: number;
  alt: string;
  className?: string;
  size?: string;
}

/**
 * <img> som hämtar Street View-bild via en säker URL.
 * Nyckeln laddas från edge function (cacheas).
 */
export default function StreetViewImage({ lat, lng, alt, className = '', size = '800x400' }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStreetViewUrl(lat, lng, size)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [lat, lng, size]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <Eye className="h-5 w-5 text-muted-foreground/50" />
      </div>
    );
  }

  if (!url) {
    return <div className={`bg-muted animate-pulse ${className}`} />;
  }

  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
