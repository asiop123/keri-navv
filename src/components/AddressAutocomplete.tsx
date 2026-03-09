import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { getTomTomApiKey } from '@/services/tomtom';

interface Suggestion {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
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

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
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
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }, [biasLat, biasLng]);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    if (suppressSearch.current) {
      suppressSearch.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(newValue), 300);
  };

  const handleSelect = (suggestion: Suggestion) => {
    suppressSearch.current = true;
    onChange(suggestion.address || suggestion.name);
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
        </div>
      )}
    </div>
  );
}
