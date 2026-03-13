/// <reference types="google.maps" />
import { useState, useRef, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    google?: typeof google;
  }
}
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, History, ChevronDown } from 'lucide-react';

const GOOGLE_MAPS_KEY = 'AIzaSyDtwH0gOPIznevKsiEncudw9kaoH6Q8p_Y';

// Load Google Maps JS SDK once
let googleMapsLoaded = false;
let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (googleMapsLoaded && window.google?.maps?.places) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      googleMapsLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&language=sv&region=SE`;
    script.async = true;
    script.onload = () => { googleMapsLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

interface Suggestion {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  isHistory?: boolean;
  matchText?: string;
}

export type { Suggestion as AddressSuggestion };

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
  placeholder?: string;
  className?: string;
  biasLat?: number;
  biasLng?: number;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
  initialSuggestions?: Suggestion[];
  inlineResults?: boolean;
  autoFocus?: boolean;
  maxInitialVisible?: number;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Sök adress...',
  className = '',
  biasLat,
  biasLng,
  onInputFocus,
  onInputBlur,
  initialSuggestions = [],
  inlineResults = false,
  autoFocus = false,
  maxInitialVisible,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [expandedHistory, setExpandedHistory] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [sdkReady, setSdkReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressSearch = useRef(false);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const dummyDivRef = useRef<HTMLDivElement | null>(null);

  // Load Google Maps SDK
  useEffect(() => {
    loadGoogleMaps().then(() => {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      // PlacesService needs a DOM element or map
      if (!dummyDivRef.current) {
        dummyDivRef.current = document.createElement('div');
      }
      placesServiceRef.current = new google.maps.places.PlacesService(dummyDivRef.current);
      setSdkReady(true);
    }).catch(() => {
      console.warn('Google Maps SDK failed to load, using TomTom fallback');
    });
  }, []);

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

  const searchGoogle = useCallback(async (query: string) => {
    if (!autocompleteServiceRef.current) return false;

    return new Promise<boolean>((resolve) => {
      const request: google.maps.places.AutocompletionRequest = {
        input: query,
        componentRestrictions: { country: 'se' },
      };

      if (biasLat && biasLng) {
        request.location = new google.maps.LatLng(biasLat, biasLng);
        request.radius = 500000;
      }

      autocompleteServiceRef.current!.getPlacePredictions(request, (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          const results: Suggestion[] = predictions.map((p) => ({
            id: p.place_id,
            name: p.structured_formatting?.main_text || p.description.split(',')[0],
            address: p.description,
            lat: 0,
            lng: 0,
          }));
          setSuggestions(results);
          setIsOpen(results.length > 0);
          setSelectedIndex(-1);
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }, [biasLat, biasLng]);

  // TomTom fallback
  const searchTomTom = useCallback(async (query: string) => {
    try {
      const { getTomTomApiKey } = await import('@/services/tomtom');
      const key = getTomTomApiKey();
      let url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${key}&countrySet=SE&limit=5&language=sv-SE&typeahead=true`;
      if (biasLat && biasLng) {
        url += `&lat=${biasLat}&lon=${biasLng}&radius=500000`;
      }
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const results: Suggestion[] = (data.results || []).map((r: any) => ({
        id: r.id,
        name: r.poi?.name || r.address?.municipality || r.address?.freeformAddress || query,
        address: r.address?.freeformAddress || '',
        lat: r.position.lat,
        lng: r.position.lon,
      }));
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setSelectedIndex(-1);
    } catch {
      // silent
    }
  }, [biasLat, biasLng]);

  const getMatchingHistory = useCallback((query: string) => {
    if (!initialSuggestions.length) return [];
    const q = query.toLowerCase();
    const results: Suggestion[] = [];
    const seenLocations = new Set<string>();

    for (const s of initialSuggestions) {
      const locations = (s.matchText || s.name).split('|');
      for (const loc of locations) {
        const locLower = loc.trim().toLowerCase();
        const words = locLower.split(/\s+/);
        if (words.some(w => w.startsWith(q)) && !seenLocations.has(locLower)) {
          seenLocations.add(locLower);
          results.push({
            ...s,
            name: loc.trim(), // Show only the matched location
          });
        }
      }
    }
    return results;
  }, [initialSuggestions]);

  const search = useCallback(async (query: string) => {
    // For any input, check matching history first
    const matchingHistory = getMatchingHistory(query);

    if (query.length < 2) {
      // Show matching history (all if empty query, filtered otherwise)
      const historyToShow = query.length === 0 ? initialSuggestions : matchingHistory;
      if (historyToShow.length > 0) {
        setSuggestions(historyToShow);
        setIsOpen(true);
        setSelectedIndex(-1);
      } else {
        setSuggestions([]);
        setIsOpen(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      if (sdkReady) {
        const ok = await searchGoogle(query);
        if (!ok) await searchTomTom(query);
      } else {
        await searchTomTom(query);
      }
    } finally {
      setIsLoading(false);
      // Merge matching history to the top of search results
      setSuggestions(prev => {
        const nonHistory = prev.filter(s => !s.isHistory);
        if (matchingHistory.length === 0) return nonHistory;
        return [...matchingHistory, ...nonHistory];
      });
    }
  }, [sdkReady, searchGoogle, searchTomTom, initialSuggestions, getMatchingHistory]);

  const resolvePlace = useCallback((placeId: string): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!placesServiceRef.current) { resolve(null); return; }
      placesServiceRef.current.getDetails(
        { placeId, fields: ['geometry'] },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            resolve({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
          } else {
            resolve(null);
          }
        }
      );
    });
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

    // Resolve coordinates if needed
    if (suggestion.lat === 0 && suggestion.lng === 0) {
      const coords = await resolvePlace(suggestion.id);
      if (coords) {
        suggestion = { ...suggestion, ...coords };
      }
    }

    onSelect?.(suggestion);
    setIsOpen(false);
    setSuggestions([]);
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
    <div ref={containerRef} className={`relative ${inlineResults ? 'flex flex-col' : ''}`} style={inlineResults ? { flex: '1 1 auto', minHeight: 0 } : { flex: '1' }}>
      <div className="relative">
        <Input
          value={value}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            } else if (value.length < 2 && initialSuggestions.length > 0) {
              setSuggestions(initialSuggestions);
              setIsOpen(true);
              setSelectedIndex(-1);
            }
            onInputFocus?.();
          }}
          onBlur={() => onInputBlur?.()}
          placeholder={placeholder}
          className={`h-10 text-sm pr-8 ${className}`}
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (() => {
        const allHistory = suggestions.every(s => s.isHistory);
        const shouldLimit = maxInitialVisible && allHistory && !expandedHistory;
        const visibleSuggestions = shouldLimit ? suggestions.slice(0, maxInitialVisible) : suggestions;
        const hasMore = shouldLimit && suggestions.length > maxInitialVisible;
        return (
        <div className={inlineResults
          ? "flex-1 overflow-y-auto"
          : "absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden max-h-[240px] overflow-y-auto"
        }>
          {visibleSuggestions.map((s, i) => (
            <button
              key={s.id + i}
              type="button"
              onClick={() => handleSelect(s)}
              className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-accent transition-colors text-sm ${
                i === selectedIndex ? 'bg-accent' : ''
              } ${i > 0 ? 'border-t border-border/50' : ''}`}
            >
              {s.isHistory ? <History className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /> : <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                {s.isHistory && s.name.includes('→') ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-sm text-foreground truncate">{s.name.split('→')[0].trim()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">{s.name.split('→').pop()?.trim()}</span>
                    </div>
                    {s.address && <div className="text-xs text-muted-foreground mt-0.5">{s.address}</div>}
                  </>
                ) : (
                  <>
                    <div className="font-medium text-foreground truncate">{s.name}</div>
                    {s.address && s.address !== s.name && (
                      <div className="text-xs text-muted-foreground truncate">{s.address}</div>
                    )}
                  </>
                )}
              </div>
            </button>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpandedHistory(true)}
              className="w-full px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:bg-accent transition-colors border-t border-border/50">
              <ChevronDown className="h-3.5 w-3.5" />
              Visa fler ({suggestions.length - maxInitialVisible!} till)
            </button>
          )}
          {!suggestions.some(s => s.isHistory) && (
            <div className="px-3 py-1.5 text-[9px] text-muted-foreground/60 text-right border-t border-border/30">
              Powered by Google
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}
