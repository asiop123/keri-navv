import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MapPin, Clock, Plus, X, Route, AlertTriangle, Loader2, Save, History,
  Navigation, Locate, Play, Square, Compass, ChevronUp, ChevronDown, Search,
  Car, ArrowLeft, ExternalLink, Star, Info, Eye,
} from 'lucide-react';

const GOOGLE_MAPS_KEY = 'AIzaSyDtwH0gOPIznevKsiEncudw9kaoH6Q8p_Y';
import { mockVehicles, getVehicleById } from '@/data/mockData';
import { BK_LIMITS, BKClass, TimelineEntry } from '@/types';
import { toast } from 'sonner';
import { geocode, calculateRoute, generateTimeline, reverseGeocode, RouteResult, VehicleParams } from '@/services/tomtom';
import { SavedTrip, getSavedTrips, saveTrip } from '@/services/tripStorage';
import TomTomMap, { TomTomMapHandle } from '@/components/TomTomMap';
import TripHistory from '@/components/TripHistory';
import AddressAutocomplete from '@/components/AddressAutocomplete';

type ViewState = 'search' | 'details' | 'navigating';

export default function RoutePlanning() {
  const mapHandleRef = useRef<TomTomMapHandle>(null);
  const [viewState, setViewState] = useState<ViewState>('search');
  const [destination, setDestination] = useState('');
  const [start, setStart] = useState('');
  const [waypoints, setWaypoints] = useState<{ address: string; stopMinutes: number }[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [loadWeight, setLoadWeight] = useState('');
  const [routeType, setRouteType] = useState<'normal' | 'fastest'>('normal');
  const [departureTime, setDepartureTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    return now.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);

  // GPS & Navigation
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [navStartTime, setNavStartTime] = useState<Date | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    type: string;
    label: string;
    lat: number;
    lng: number;
    name: string;
    category?: string;
    distance?: string;
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
    timelineIndex?: number;
    alternatives?: Array<{ name: string; lat: number; lng: number; distance?: string; category?: string; suitability?: string; suitabilityNote?: string }>;
    suitability?: string;
    suitabilityNote?: string;
  } | null>(null);

  useEffect(() => { setSavedTrips(getSavedTrips()); }, []);

  // Get GPS
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserPosition(coords);
          try {
            const name = await reverseGeocode(coords.lat, coords.lng);
            setStart(name);
          } catch { setStart('Min position'); }
        },
        () => { setStart(''); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const haversineKm = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  useEffect(() => {
    if (!isNavigating || !userPosition || !routeResult) return;
    const nextWp = routeResult.waypoints[Math.min(currentStep + 1, routeResult.waypoints.length - 1)];
    const dist = haversineKm(userPosition.lat, userPosition.lng, nextWp.lat, nextWp.lng);
    if (dist < 0.5 && currentStep < routeResult.waypoints.length - 1) {
      setCurrentStep(prev => prev + 1);
      toast.success(`Passerade: ${nextWp.name}`);
    }
    setDistanceToNext(dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`);
  }, [userPosition, isNavigating, routeResult, currentStep, haversineKm]);

  const startGpsTracking = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    setGpsWatchId(id);
  }, []);

  const stopGpsTracking = useCallback(() => {
    if (gpsWatchId !== null) { navigator.geolocation.clearWatch(gpsWatchId); setGpsWatchId(null); }
  }, [gpsWatchId]);

  useEffect(() => {
    return () => { if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId); };
  }, [gpsWatchId]);

  const handleStartNavigation = useCallback(() => {
    if (!routeResult) return;
    setIsNavigating(true);
    setViewState('navigating');
    setCurrentStep(0);
    setNavStartTime(new Date());
    startGpsTracking();
    toast.success('Navigation startad!');
  }, [routeResult, startGpsTracking]);

  const handleStopNavigation = useCallback(() => {
    setIsNavigating(false);
    setViewState('details');
    stopGpsTracking();
    setNavStartTime(null);
    toast.info('Navigation avslutad');
  }, [stopGpsTracking]);

  const selectedVehicle = vehicleId ? getVehicleById(vehicleId) : undefined;
  const totalWeight = selectedVehicle ? selectedVehicle.weightKg + Number(loadWeight || 0) : 0;

  const getBKStatus = (weight: number) => {
    const results: { bk: BKClass; limit: number; status: 'green' | 'yellow' | 'red' }[] = [];
    for (const [bk, limit] of Object.entries(BK_LIMITS) as [BKClass, number][]) {
      const ratio = weight / limit;
      if (ratio > 1) results.push({ bk, limit, status: 'red' });
      else if (ratio > 0.9) results.push({ bk, limit, status: 'yellow' });
      else results.push({ bk, limit, status: 'green' });
    }
    return results;
  };
  const bkResults = totalWeight > 0 ? getBKStatus(totalWeight) : [];

  const statusColor = (s: string) => {
    if (s === 'red') return 'bg-destructive text-destructive-foreground';
    if (s === 'yellow') return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  const handleSearch = async () => {
    if (!destination.trim()) return;
    setIsLoading(true);
    setIsSaved(false);

    try {
      const startQuery = start || 'Stockholm';
      const [startCoord, endCoord, ...waypointCoords] = await Promise.all([
        userPosition && (!start || start === 'Min position')
          ? Promise.resolve({ lat: userPosition.lat, lng: userPosition.lng, name: start || 'Min position' })
          : geocode(startQuery),
        geocode(destination),
        ...waypoints.filter(w => w.address.trim()).map(w => geocode(w.address)),
      ]);

      const vehicleParams: VehicleParams | undefined = selectedVehicle
        ? { weightKg: totalWeight, heightM: selectedVehicle.heightM, widthM: selectedVehicle.widthM, lengthM: selectedVehicle.lengthM }
        : undefined;

      const result = await calculateRoute(startCoord, endCoord, waypointCoords, new Date(departureTime).toISOString(), vehicleParams);
      const stopMinutes = waypoints.filter(w => w.address.trim()).map(w => w.stopMinutes);
      const tl = await generateTimeline(result, routeType, stopMinutes, vehicleParams);

      setRouteResult(result);
      setTimeline(tl);
      setViewState('details');

      const hours = Math.floor(result.travelTimeSeconds / 3600);
      const mins = Math.round((result.travelTimeSeconds % 3600) / 60);
      toast.success(`${result.distanceKm} km · ${hours}h ${mins}min`);
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte beräkna rutt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (!routeResult) return;
    const vehicle = selectedVehicle;
    const trip: SavedTrip = {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(),
      startName: routeResult.waypoints[0].name,
      endName: routeResult.waypoints[routeResult.waypoints.length - 1].name,
      waypointNames: routeResult.waypoints.slice(1, -1).map(w => w.name),
      distanceKm: routeResult.distanceKm, travelTimeSeconds: routeResult.travelTimeSeconds,
      totalWeightKg: totalWeight, vehicleId,
      vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.regNr})` : 'Okänt',
      routeType, timeline, route: routeResult,
    };
    saveTrip(trip);
    setSavedTrips(getSavedTrips());
    setIsSaved(true);
    toast.success('Resa sparad!');
  };

  const handleBack = () => {
    setViewState('search');
    setRouteResult(null);
    setTimeline([]);
    setDestination('');
    setSelectedLocation(null);
  };

  const handleTimelineEntryClick = (entry: TimelineEntry, timelineIndex: number) => {
    let lat: number | undefined;
    let lng: number | undefined;
    let name = entry.location || entry.label;
    let category = '';
    let distance = '';
    let alternatives: Array<{ name: string; lat: number; lng: number; distance?: string; category?: string }> = [];

    if (entry.restStop) {
      lat = entry.restStop.lat;
      lng = entry.restStop.lng;
      name = entry.restStop.name;
      category = entry.restStop.category || '';
      distance = entry.restStop.distance || '';
      alternatives = entry.restStop.alternatives || [];
    } else if (entry.type === 'stop' || entry.type === 'arrival') {
      const wp = routeResult?.waypoints.find(w => entry.label.includes(w.name) || entry.location === w.name);
      if (wp) { lat = wp.lat; lng = wp.lng; name = wp.name; }
    }

    if (lat !== undefined && lng !== undefined) {
      setSelectedLocation({
        type: entry.type,
        label: entry.label,
        lat, lng, name,
        category, distance,
        startTime: entry.startTime,
        endTime: entry.endTime,
        durationMinutes: entry.durationMinutes,
        timelineIndex,
        alternatives,
        suitability: entry.restStop?.suitability,
        suitabilityNote: entry.restStop?.suitabilityNote,
      });
      mapHandleRef.current?.flyToLocation(lng, lat, 14);
    }
  };

  const handleSwapRestStop = (alt: { name: string; lat: number; lng: number; distance?: string; category?: string }) => {
    if (selectedLocation?.timelineIndex === undefined) return;
    const idx = selectedLocation.timelineIndex;
    const updated = [...timeline];
    const entry = updated[idx];
    if (!entry || !entry.restStop) return;

    // Move current stop to alternatives, put selected alt as main
    const currentStop = {
      name: entry.restStop.name,
      lat: entry.restStop.lat,
      lng: entry.restStop.lng,
      distance: entry.restStop.distance,
      category: entry.restStop.category,
    };
    const otherAlts = (entry.restStop.alternatives || []).filter(a => a.name !== alt.name);
    
    entry.restStop = {
      ...alt,
      alternatives: [currentStop, ...otherAlts],
    };
    entry.location = alt.name;
    entry.label = entry.type === 'overnight'
      ? `Dygnsvila (11h) – ${alt.name}`
      : `Rast (45 min) – ${alt.name}`;

    setTimeline(updated);
    setSelectedLocation(prev => prev ? {
      ...prev,
      name: alt.name,
      lat: alt.lat,
      lng: alt.lng,
      category: alt.category || '',
      distance: alt.distance || '',
      suitability: (alt as any).suitability || 'good',
      suitabilityNote: (alt as any).suitabilityNote || '',
      alternatives: [currentStop, ...otherAlts],
    } : null);
    mapHandleRef.current?.flyToLocation(alt.lng, alt.lat, 14);
    toast.success(`Bytte rastplats till ${alt.name}`);
  };

  const totalDriveTimeH = routeResult ? Math.floor(routeResult.travelTimeSeconds / 3600) : 0;
  const totalDriveTimeMin = routeResult ? Math.round((routeResult.travelTimeSeconds % 3600) / 60) : 0;
  const nextWaypoint = routeResult ? routeResult.waypoints[Math.min(currentStep + 1, routeResult.waypoints.length - 1)] : null;
  const elapsedMin = navStartTime ? Math.round((Date.now() - navStartTime.getTime()) / 60000) : 0;

  const timelineIcon = (type: TimelineEntry['type']) => {
    switch (type) { case 'drive': return '🚛'; case 'rest': return '☕'; case 'overnight': return '🌙'; case 'stop': return '📦'; case 'arrival': return '🏁'; }
  };

  return (
    <div className="relative w-full -m-4 md:-m-6" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Map */}
      <TomTomMap
        ref={mapHandleRef}
        route={routeResult}
        timeline={timeline}
        userPosition={userPosition}
        isNavigating={isNavigating}
        className="absolute inset-0 z-0"
      />

      {/* ===== SEARCH VIEW ===== */}
      {viewState === 'search' && (
        <>
          {/* Search bar - Google Maps style */}
          <div className="absolute top-4 left-4 right-4 z-20 max-w-lg mx-auto">
            <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
              {/* Destination field */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                <AddressAutocomplete
                  value={destination}
                  onChange={setDestination}
                  onSelect={(suggestion) => {
                    if (suggestion.lat && suggestion.lng) {
                      setDestinationCoords({ lat: suggestion.lat, lng: suggestion.lng });
                    }
                    setTimeout(() => handleSearch(), 100);
                  }}
                  placeholder="Vart vill du åka?"
                  className="border-0 shadow-none focus-visible:ring-0 h-auto py-0 text-base placeholder:text-muted-foreground/60"
                  biasLat={userPosition?.lat}
                  biasLng={userPosition?.lng}
                />
                {destination && (
                  <button onClick={() => setDestination('')} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Expandable: start + options */}
              <div className="border-t border-border/50">
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Car className="h-3.5 w-3.5" />
                    {start ? `Från: ${start}` : 'Startpunkt & fordon'}
                    {selectedVehicle && ` · ${selectedVehicle.brand} ${selectedVehicle.model}`}
                  </span>
                  {showOptions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showOptions && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/30">
                    {/* Start point */}
                    <div className="flex items-center gap-2 pt-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <AddressAutocomplete
                        value={start}
                        onChange={setStart}
                        placeholder="Startpunkt (auto GPS)"
                        className="h-9 text-sm"
                        biasLat={userPosition?.lat}
                        biasLng={userPosition?.lng}
                      />
                      {userPosition && (
                        <button
                          onClick={async () => {
                            const name = await reverseGeocode(userPosition.lat, userPosition.lng);
                            setStart(name);
                          }}
                          className="shrink-0 p-1.5 rounded-md hover:bg-accent"
                          title="Min position"
                        >
                          <Locate className="h-4 w-4 text-primary" />
                        </button>
                      )}
                    </div>

                    {/* Waypoints */}
                    {waypoints.map((wp, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                          <AddressAutocomplete
                            value={wp.address}
                            onChange={(val) => { const n = [...waypoints]; n[i] = { ...n[i], address: val }; setWaypoints(n); }}
                            placeholder={`Stopp ${i + 1}`}
                            className="h-9 text-sm"
                            biasLat={userPosition?.lat}
                            biasLng={userPosition?.lng}
                          />
                          <button onClick={() => setWaypoints(waypoints.filter((_, j) => j !== i))} className="p-1 hover:bg-accent rounded">
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="ml-5 flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <input
                            type="number"
                            min={0}
                            value={wp.stopMinutes}
                            onChange={(e) => { const n = [...waypoints]; n[i] = { ...n[i], stopMinutes: Number(e.target.value) }; setWaypoints(n); }}
                            className="w-16 h-7 rounded-md border border-input bg-background px-2 text-xs text-center"
                          />
                          <span className="text-[10px] text-muted-foreground">min lasttid</span>
                        </div>
                      </div>
                    ))}

                    <button onClick={() => setWaypoints([...waypoints, { address: '', stopMinutes: 30 }])} className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Lägg till stopp
                    </button>

                    {/* Vehicle & Load */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Fordon</Label>
                        <Select value={vehicleId} onValueChange={setVehicleId}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Välj" /></SelectTrigger>
                          <SelectContent>
                            {mockVehicles.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.brand} {v.model}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Last (kg)</Label>
                        <Input type="number" value={loadWeight} onChange={e => setLoadWeight(e.target.value)} placeholder="0" className="h-8 text-xs" />
                      </div>
                    </div>

                    {/* Departure time */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Avgångstid</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local"
                          value={departureTime}
                          onChange={e => setDepartureTime(e.target.value)}
                          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {(() => {
                          const d = new Date(departureTime);
                          const dayName = d.toLocaleDateString('sv-SE', { weekday: 'long' });
                          const dateStr = d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          return (
                            <span className={isWeekend ? 'text-amber-500 font-medium' : ''}>
                              {dayName} {dateStr} {isWeekend && '(helg – annan trafik)'}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Route type */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRouteType('normal')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${routeType === 'normal' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                      >
                        Normal (9h)
                      </button>
                      <button
                        onClick={() => setRouteType('fastest')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${routeType === 'fastest' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                      >
                        Snabbast (10h)
                      </button>
                    </div>

                    {/* BK status */}
                    {bkResults.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {bkResults.map(r => (
                          <Badge key={r.bk} className={`${statusColor(r.status)} text-[10px] px-1.5 py-0`}>
                            {r.bk} {r.status === 'green' ? '✓' : r.status === 'yellow' ? '⚠' : '✗'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Search button */}
              {destination && (
                <div className="px-4 pb-3">
                  <Button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-xl"
                  >
                    {isLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Beräknar rutt...</>
                    ) : (
                      <><Route className="h-4 w-4 mr-2" /> Sök rutt</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Quick actions - bottom */}
          <div className="absolute bottom-6 left-4 right-4 z-20 max-w-lg mx-auto flex gap-2">
            {userPosition && (
              <button
                onClick={() => mapHandleRef.current?.centerOnUser()}
                className="bg-card shadow-lg rounded-full p-3 hover:bg-accent transition-colors border border-border"
              >
                <Locate className="h-5 w-5 text-primary" />
              </button>
            )}
            {savedTrips.length > 0 && (
              <button
                onClick={() => {
                  const last = savedTrips[0];
                  setRouteResult(last.route);
                  setTimeline(last.timeline);
                  setDestination(last.endName);
                  setViewState('details');
                }}
                className="bg-card shadow-lg rounded-full px-4 py-3 hover:bg-accent transition-colors border border-border text-xs font-medium flex items-center gap-2"
              >
                <History className="h-4 w-4 text-primary" />
                Senaste: {savedTrips[0].endName}
              </button>
            )}
          </div>
        </>
      )}

      {/* ===== DETAILS VIEW ===== */}
      {viewState === 'details' && routeResult && (
        <>
          {/* Top bar */}
          <div className="absolute top-4 left-4 right-4 z-20 max-w-lg mx-auto">
            <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={handleBack} className="shrink-0 p-1 hover:bg-accent rounded-lg">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{destination}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {routeResult.waypoints.map(w => w.name).join(' → ')}
                  </div>
                </div>
              </div>

              {/* Departure/arrival date context */}
              <div className="px-4 py-1.5 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  Avg: {new Date(routeResult.departureTime).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
                  {new Date(routeResult.departureTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>
                  Ank: {new Date(routeResult.arrivalTime).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
                  {new Date(routeResult.arrivalTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 border-t border-border/50">
                <div className="text-center py-3 border-r border-border/50">
                  <div className="text-lg font-bold text-primary">{routeResult.distanceKm}</div>
                  <div className="text-[10px] text-muted-foreground">km</div>
                </div>
                <div className="text-center py-3 border-r border-border/50">
                  <div className="text-lg font-bold text-primary">{totalDriveTimeH}h {totalDriveTimeMin}min</div>
                  <div className="text-[10px] text-muted-foreground">restid</div>
                </div>
                <div className="text-center py-3">
                  <div className="text-lg font-bold text-primary">
                    {new Date(routeResult.arrivalTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">ankomst</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom sheet */}
          <div className="absolute bottom-0 left-0 right-0 z-20">
            <div className="max-w-lg mx-auto">
              {/* Expand/collapse timeline */}
              <div className="bg-card rounded-t-2xl shadow-xl border border-b-0 border-border overflow-hidden">
                {/* Action buttons */}
                <div className="p-4 flex gap-2">
                  <Button
                    onClick={handleStartNavigation}
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-base"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Starta
                  </Button>
                  {!isSaved ? (
                    <Button variant="outline" onClick={handleSave} className="h-12 rounded-xl px-4">
                      <Save className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="h-12 px-4 flex items-center text-xs text-muted-foreground">✓</div>
                  )}
                </div>

                {/* Timeline toggle */}
                <button
                  onClick={() => setShowTimeline(!showTimeline)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border-t border-border/50 text-xs text-muted-foreground hover:bg-accent/50"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Tidslinje ({timeline.length} steg · {timeline.filter(t => t.type === 'rest' || t.type === 'overnight').length} raster)
                  </span>
                  {showTimeline ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </button>

                {showTimeline && (
                  <div className="max-h-[40vh] overflow-y-auto border-t border-border/30">
                    <div className="p-3 space-y-1">
                      {timeline.map((entry, i) => {
                        // Show day header when date changes
                        const entryDate = new Date(entry.startTime).toLocaleDateString('sv-SE');
                        const prevDate = i > 0 ? new Date(timeline[i - 1].startTime).toLocaleDateString('sv-SE') : null;
                        const showDayHeader = i === 0 || entryDate !== prevDate;
                        const entryDay = new Date(entry.startTime);

                        return (
                          <div key={i}>
                            {showDayHeader && (
                              <div className="flex items-center gap-2 py-1.5 px-1 mt-1 mb-0.5">
                                <div className="h-px flex-1 bg-border" />
                                <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                                  📅 {entryDay.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })}
                                </span>
                                <div className="h-px flex-1 bg-border" />
                              </div>
                            )}
                            <button
                              onClick={() => handleTimelineEntryClick(entry, i)}
                              className={`w-full text-left rounded-lg px-3 py-2 transition-colors hover:ring-1 hover:ring-primary/30 cursor-pointer ${
                              entry.type === 'drive' ? 'border-l-4 border-l-primary/60' :
                              entry.type === 'rest' ? 'border-l-4 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20' :
                              entry.type === 'overnight' ? 'border-l-4 border-l-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' :
                              entry.type === 'stop' ? 'border-l-4 border-l-orange-400 bg-orange-50/50 dark:bg-orange-950/20' :
                              'border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{timelineIcon(entry.type)}</span>
                                  <span className="text-xs font-medium">{entry.label}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {entry.durationMinutes > 0 && (
                                    <span className="text-[10px] text-muted-foreground">{entry.durationMinutes} min</span>
                                  )}
                                  {(entry.restStop || entry.type === 'stop' || entry.type === 'arrival') && (
                                    <MapPin className="h-3 w-3 text-primary" />
                                  )}
                                </div>
                              </div>
                              <div className="ml-7 text-[10px] text-muted-foreground">
                                {new Date(entry.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                                {' – '}
                                {new Date(entry.endTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {entry.restStop && (
                                <div className="ml-7 mt-1 flex items-center gap-1.5 text-[11px] text-primary">
                                  <MapPin className="h-3 w-3" />
                                  <span className="underline underline-offset-2">{entry.restStop.name}</span>
                                </div>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-4 pb-3">
                      <div className="rounded-lg bg-muted/40 p-2.5 text-[10px] text-muted-foreground">
                        <span className="font-semibold">EU-regler:</span> 4,5h → 45 min rast · Max {routeType === 'fastest' ? '10h' : '9h'}/dag · 11h dygnsvila
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Location detail card - Google Maps style */}
          {selectedLocation && (
            <div className="absolute left-4 right-4 z-30 max-w-sm mx-auto animate-in slide-in-from-bottom-4 fade-in duration-300"
              style={{ top: '50%', transform: 'translateY(-50%)' }}
            >
              <div className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
                {/* Header with colored bar */}
                <div className={`h-1.5 ${
                  selectedLocation.type === 'rest' ? 'bg-amber-400' :
                  selectedLocation.type === 'overnight' ? 'bg-indigo-500' :
                  selectedLocation.type === 'stop' ? 'bg-orange-400' :
                  selectedLocation.type === 'arrival' ? 'bg-emerald-500' :
                  'bg-primary'
                }`} />

                {/* Street View preview */}
                <div className="relative w-full h-[160px] bg-muted">
                  <img
                    src={`https://maps.googleapis.com/maps/api/streetview?size=600x160&location=${selectedLocation.lat},${selectedLocation.lng}&fov=100&pitch=5&key=${GOOGLE_MAPS_KEY}`}
                    alt={`Street View – ${selectedLocation.name}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur rounded px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    Street View
                  </div>
                </div>

                <div className="p-4">
                  {/* Close button */}
                  <button
                    onClick={() => setSelectedLocation(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-accent transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>

                  {/* Icon + Name */}
                  <div className="flex items-start gap-3 pr-8">
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                      selectedLocation.type === 'rest' ? 'bg-amber-100 dark:bg-amber-950' :
                      selectedLocation.type === 'overnight' ? 'bg-indigo-100 dark:bg-indigo-950' :
                      selectedLocation.type === 'stop' ? 'bg-orange-100 dark:bg-orange-950' :
                      selectedLocation.type === 'arrival' ? 'bg-emerald-100 dark:bg-emerald-950' :
                      'bg-primary/10'
                    }`}>
                      {selectedLocation.type === 'rest' ? '☕' :
                       selectedLocation.type === 'overnight' ? '🌙' :
                       selectedLocation.type === 'stop' ? '📦' :
                       selectedLocation.type === 'arrival' ? '🏁' : '📍'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-foreground leading-tight">{selectedLocation.name}</h3>
                      {selectedLocation.category && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{selectedLocation.category}</p>
                      )}
                      {/* Vehicle suitability badge */}
                      {selectedLocation.suitability && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            selectedLocation.suitability === 'perfect' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                            selectedLocation.suitability === 'good' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400' :
                            selectedLocation.suitability === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                            'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                          }`}>
                            {selectedLocation.suitability === 'perfect' ? '✓ Perfekt' :
                             selectedLocation.suitability === 'good' ? '👍 Bra' :
                             selectedLocation.suitability === 'warning' ? '⚠ Varning' :
                             '✗ Olämplig'}
                          </span>
                        </div>
                      )}
                      {selectedLocation.suitabilityNote && (
                        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{selectedLocation.suitabilityNote}</p>
                      )}
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {selectedLocation.startTime && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Tid</div>
                        <div className="text-xs font-medium mt-0.5">
                          {new Date(selectedLocation.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                          {selectedLocation.endTime && ` – ${new Date(selectedLocation.endTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                      </div>
                    )}
                    {selectedLocation.durationMinutes !== undefined && selectedLocation.durationMinutes > 0 && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Varaktighet</div>
                        <div className="text-xs font-medium mt-0.5">
                          {selectedLocation.durationMinutes >= 60
                            ? `${Math.floor(selectedLocation.durationMinutes / 60)}h ${selectedLocation.durationMinutes % 60}min`
                            : `${selectedLocation.durationMinutes} min`}
                        </div>
                      </div>
                    )}
                    {selectedLocation.distance && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Avstånd från rutt</div>
                        <div className="text-xs font-medium mt-0.5">{selectedLocation.distance}</div>
                      </div>
                    )}
                    <div className="bg-muted/50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Datum</div>
                      <div className="text-xs font-medium mt-0.5">
                        {selectedLocation.startTime
                          ? new Date(selectedLocation.startTime).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
                          : '–'}
                      </div>
                    </div>
                  </div>

                  {/* Coordinates */}
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}</span>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3 flex gap-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedLocation.lat},${selectedLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-xl py-2 text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Google Maps
                    </a>
                    <button
                      onClick={() => {
                        mapHandleRef.current?.flyToLocation(selectedLocation.lng, selectedLocation.lat, 16);
                      }}
                      className="flex items-center justify-center gap-1.5 bg-muted rounded-xl px-4 py-2 text-xs font-medium hover:bg-accent transition-colors"
                    >
                      <Locate className="h-3.5 w-3.5" />
                      Zooma in
                    </button>
                  </div>

                  {/* Alternatives - swap rest stop */}
                  {selectedLocation.alternatives && selectedLocation.alternatives.length > 0 && (
                    selectedLocation.type === 'rest' || selectedLocation.type === 'overnight'
                  ) && (
                    <div className="mt-3 border-t border-border/50 pt-3">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Alternativa rastplatser
                      </div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {selectedLocation.alternatives.map((alt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSwapRestStop(alt)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left ${
                              alt.suitability === 'unsuitable' ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50' :
                              alt.suitability === 'warning' ? 'bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50' :
                              'bg-muted/40 hover:bg-accent'
                            }`}
                          >
                            <div className={`shrink-0 w-2 h-2 rounded-full ${
                              alt.suitability === 'perfect' ? 'bg-emerald-500' :
                              alt.suitability === 'good' ? 'bg-sky-500' :
                              alt.suitability === 'warning' ? 'bg-amber-500' :
                              alt.suitability === 'unsuitable' ? 'bg-red-500' : 'bg-muted-foreground'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium truncate">{alt.name}</div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                {alt.distance && <span>{alt.distance}</span>}
                                {alt.category && <span>· {alt.category}</span>}
                                {alt.suitabilityNote && <span>· {alt.suitabilityNote}</span>}
                              </div>
                            </div>
                            <span className="text-[10px] text-primary font-medium shrink-0">Byt</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Map controls */}
          <div className="absolute right-4 bottom-[180px] z-20 flex flex-col gap-2">
            {userPosition && (
              <button onClick={() => mapHandleRef.current?.centerOnUser()} className="bg-card shadow-lg rounded-full p-3 hover:bg-accent border border-border">
                <Locate className="h-5 w-5 text-primary" />
              </button>
            )}
          </div>
        </>
      )}

      {/* ===== NAVIGATION VIEW ===== */}
      {viewState === 'navigating' && routeResult && (
        <>
          {/* Top HUD */}
          <div className="absolute top-0 left-0 right-0 z-30">
            <div className="bg-primary/95 backdrop-blur-md text-primary-foreground p-4 shadow-xl">
              <div className="flex items-center justify-between max-w-lg mx-auto">
                <div className="flex items-center gap-3">
                  <Compass className="h-6 w-6 animate-pulse" />
                  <div>
                    <div className="text-[10px] opacity-70 uppercase tracking-wider">Nästa stopp</div>
                    <div className="font-bold text-lg leading-tight">{nextWaypoint?.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold tracking-tight">{distanceToNext || '...'}</div>
                  <div className="text-[10px] opacity-70">kvar</div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-3 justify-center">
              <div className="bg-card/90 backdrop-blur rounded-full px-3 py-1.5 text-[11px] font-medium shadow-lg border border-border flex items-center gap-1.5">
                <Route className="h-3 w-3 text-primary" /> {routeResult.distanceKm} km
              </div>
              <div className="bg-card/90 backdrop-blur rounded-full px-3 py-1.5 text-[11px] font-medium shadow-lg border border-border flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-primary" /> {elapsedMin} min
              </div>
              {userPosition && (
                <div className="bg-card/90 backdrop-blur rounded-full px-3 py-1.5 text-[11px] font-medium shadow-lg border border-border flex items-center gap-1.5">
                  <Navigation className="h-3 w-3 text-emerald-500" /> GPS
                </div>
              )}
            </div>
          </div>

          {/* Stop button */}
          <div className="absolute bottom-8 left-0 right-0 z-30 flex justify-center">
            <button
              onClick={handleStopNavigation}
              className="bg-destructive text-destructive-foreground shadow-xl rounded-full px-8 py-4 font-bold text-base flex items-center gap-2"
            >
              <Square className="h-5 w-5" /> Avsluta
            </button>
          </div>

          {userPosition && (
            <div className="absolute right-4 bottom-24 z-20">
              <button onClick={() => mapHandleRef.current?.centerOnUser()} className="bg-card shadow-lg rounded-full p-3 border border-border">
                <Locate className="h-5 w-5 text-primary" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
