import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';

const GOOGLE_MAPS_KEY = 'AIzaSyDtwH0gOPIznevKsiEncudw9kaoH6Q8p_Y';

interface Suggestion {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
  placeholder?: string;
  className?: string;
  biasLat?: number;
  biasLng?: number;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Sök adress...',
  className = '',
  biasLat,
  biasLng,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressSearch = useRef(false);
  const sessionTokenRef = useRef(crypto.randomUUID());

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getPlaceDetails = useCallback(async (placeId: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeId}&key=${GOOGLE_MAPS_KEY}&language=sv`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.results?.[0]?.geometry?.location) {
        const loc = data.results[0].geometry.location;
        return { lat: loc.lat, lng: loc.lng };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_KEY}&language=sv&components=country:se&sessiontoken=${sessionTokenRef.current}`;
      
      if (biasLat && biasLng) {
        url += `&location=${biasLat},${biasLng}&radius=500000`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        // Fallback: use Google Geocoding API for search
        await searchFallback(query);
        return;
      }
      const data = await res.json();

      if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
        await searchFallback(query);
        return;
      }

      const predictions: PlacePrediction[] = data.predictions || [];
      const results: Suggestion[] = predictions.map((p) => ({
        id: p.place_id,
        name: p.structured_formatting?.main_text || p.description.split(',')[0],
        address: p.description,
        lat: 0, // Will be resolved on select
        lng: 0,
      }));

      setSuggestions(results);
      setIsOpen(results.length > 0);
      setSelectedIndex(-1);
    } catch {
      await searchFallback(query);
    } finally {
      setIsLoading(false);
    }
  }, [biasLat, biasLng]);

  // Fallback using Google Geocoding API
  const searchFallback = useCallback(async (query: string) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_KEY}&language=sv&region=se`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      
      const results: Suggestion[] = (data.results || []).slice(0, 5).map((r: any) => ({
        id: r.place_id,
        name: r.address_components?.[0]?.long_name || r.formatted_address?.split(',')[0] || query,
        address: r.formatted_address || '',
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
      }));

      setSuggestions(results);
      setIsOpen(results.length > 0);
      setSelectedIndex(-1);
    } catch {
      // silent
    }
  }, []);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    if (suppressSearch.current) {
      suppressSearch.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(newValue), 300);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    suppressSearch.current = true;
    onChange(suggestion.address || suggestion.name);
    
    // If lat/lng are 0, resolve from place_id
    if (suggestion.lat === 0 && suggestion.lng === 0) {
      const coords = await getPlaceDetails(suggestion.id);
      if (coords) {
        suggestion = { ...suggestion, ...coords };
      }
    }
    
    onSelect?.(suggestion);
    setIsOpen(false);
    setSuggestions([]);
    // Generate new session token for next search session
    sessionTokenRef.current = crypto.randomUUID();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Input
          value={value}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={`h-10 text-sm pr-8 ${className}`}
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden max-h-[240px] overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelect(s)}
              className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-accent transition-colors text-sm ${
                i === selectedIndex ? 'bg-accent' : ''
              } ${i > 0 ? 'border-t border-border/50' : ''}`}
            >
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">{s.name}</div>
                {s.address && s.address !== s.name && (
                  <div className="text-xs text-muted-foreground truncate">{s.address}</div>
                )}
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[9px] text-muted-foreground/60 text-right border-t border-border/30">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
