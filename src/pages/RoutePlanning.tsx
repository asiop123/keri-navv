import { useState, useEffect, useRef, useCallback } from 'react';
import StreetViewPanorama from '@/components/StreetViewPanorama';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  MapPin, Clock, Plus, X, Route, AlertTriangle, Loader2, Save, History,
  Navigation, Locate, Square, ChevronUp, ChevronDown, Search,
  Car, ArrowLeft, Star, Info, Eye, Repeat,
} from 'lucide-react';

const GOOGLE_MAPS_KEY = 'AIzaSyDtwH0gOPIznevKsiEncudw9kaoH6Q8p_Y';
import { mockVehicles, getVehicleById } from '@/data/mockData';
import { BK_LIMITS, BKClass, TimelineEntry, RestStopFacilities } from '@/types';
import { toast } from 'sonner';
import { geocode, calculateRoute, generateTimeline, reverseGeocode, RouteResult, VehicleParams } from '@/services/tomtom';
import { SavedTrip, getSavedTrips, saveTrip, saveDrivenTrip } from '@/services/tripStorage';
import TomTomMap, { TomTomMapHandle } from '@/components/TomTomMap';
import TripHistory from '@/components/TripHistory';
import AddressAutocomplete from '@/components/AddressAutocomplete';

interface TripLeg {
  id: string;
  startName: string;
  endName: string;
  route: RouteResult;
  alternativeRoutes: RouteResult[];
  timeline: TimelineEntry[];
}

const LEG_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

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
  const [showDetails, setShowDetails] = useState(false);
  
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapClickCoords, setMapClickCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<RouteResult[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [usedDriveHours, setUsedDriveHours] = useState(0);
  const [restStopFilters, setRestStopFilters] = useState<RestStopFacilities>({
    toilet: false, food: false, shower: false, fuel: false, truckParking: false,
  });
  const [trips, setTrips] = useState<TripLeg[]>([]);
  const [addingNewLeg, setAddingNewLeg] = useState(false);

  // GPS & Navigation
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const gpsPointsRef = useRef<{ lat: number; lng: number; time: string }[]>([]);
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
    alternatives?: Array<{ name: string; lat: number; lng: number; distance?: string; category?: string; suitability?: string; suitabilityNote?: string; facilities?: RestStopFacilities }>;
    suitability?: string;
    suitabilityNote?: string;
    facilities?: RestStopFacilities;
    address?: string;
  } | null>(null);

  const selectedVehicle = vehicleId ? getVehicleById(vehicleId) : undefined;
  const totalWeight = selectedVehicle ? selectedVehicle.weightKg + Number(loadWeight || 0) : 0;

  useEffect(() => { getSavedTrips().then(setSavedTrips); }, []);

  // Auto-start GPS watch for smooth position
  const gpsInitRef = useRef(false);
  useEffect(() => {
    if (!('geolocation' in navigator) || gpsInitRef.current) return;
    gpsInitRef.current = true;
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPosition(coords);
        if (!start) {
          try {
            const name = await reverseGeocode(coords.lat, coords.lng);
            setStart(name);
          } catch { setStart('Min position'); }
        }
      },
      () => { if (!start) setStart(''); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
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
    gpsPointsRef.current = [];
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPosition(point);
        gpsPointsRef.current.push({ ...point, time: new Date().toISOString() });
      },
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

  const handleStopNavigation = useCallback(async () => {
    setIsNavigating(false);
    setViewState('details');
    stopGpsTracking();

    // Save driven trip
    if (routeResult && navStartTime) {
      const drivenTimeSeconds = Math.round((Date.now() - navStartTime.getTime()) / 1000);
      const points = gpsPointsRef.current;
      let drivenDistanceKm = 0;
      for (let i = 1; i < points.length; i++) {
        drivenDistanceKm += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
      }
      const vehicle = selectedVehicle;
      const drivenTrip: SavedTrip = {
        id: crypto.randomUUID(), createdAt: new Date().toISOString(),
        startName: routeResult.waypoints[0].name,
        endName: routeResult.waypoints[routeResult.waypoints.length - 1].name,
        waypointNames: routeResult.waypoints.slice(1, -1).map(w => w.name),
        distanceKm: routeResult.distanceKm, travelTimeSeconds: routeResult.travelTimeSeconds,
        totalWeightKg: totalWeight, vehicleId,
        vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.regNr})` : 'Okänt',
        routeType, timeline, route: routeResult, tripSource: 'driven',
        drivenDistanceKm: Math.round(drivenDistanceKm * 10) / 10,
        drivenTimeSeconds,
      };
      await saveDrivenTrip(drivenTrip, drivenDistanceKm, drivenTimeSeconds, points);
      const updated = await getSavedTrips();
      setSavedTrips(updated);
      toast.info(`Körning sparad: ${Math.round(drivenDistanceKm)} km`);
    } else {
      toast.info('Navigation avslutad');
    }

    setNavStartTime(null);
    gpsPointsRef.current = [];
  }, [stopGpsTracking, routeResult, navStartTime, selectedVehicle, totalWeight, vehicleId, routeType, timeline, haversineKm]);




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

  const pendingDestCoordsRef = useRef<{ lat: number; lng: number; name: string } | null>(null);

  const handleSearch = async () => {
    if (!destination.trim()) return;
    setIsLoading(true);
    setIsSaved(false);

    try {
      const startQuery = start || 'Stockholm';
      const destFromSelection = pendingDestCoordsRef.current;
      pendingDestCoordsRef.current = null;

      const [startCoord, endCoord, ...waypointCoords] = await Promise.all([
        userPosition && (!start || start === 'Min position')
          ? Promise.resolve({ lat: userPosition.lat, lng: userPosition.lng, name: start || 'Min position' })
          : geocode(startQuery),
        destFromSelection
          ? Promise.resolve(destFromSelection)
          : geocode(destination),
        ...waypoints.filter(w => w.address.trim()).map(w => geocode(w.address)),
      ]);

      // Round-trip: destination becomes waypoint, start becomes end
      const finalWaypoints = isRoundTrip && !addingNewLeg
        ? [...waypointCoords, endCoord]
        : waypointCoords;
      const finalEnd = isRoundTrip && !addingNewLeg ? startCoord : endCoord;

      const vehicleParams: VehicleParams | undefined = selectedVehicle
        ? { weightKg: totalWeight, heightM: selectedVehicle.heightM, widthM: selectedVehicle.widthM, lengthM: selectedVehicle.lengthM }
        : undefined;

      const result = await calculateRoute(startCoord, finalEnd, finalWaypoints, new Date(departureTime).toISOString(), vehicleParams);
      const stopMinutes = waypoints.filter(w => w.address.trim()).map(w => w.stopMinutes);
      const finalStopMinutes = isRoundTrip && !addingNewLeg
        ? [...stopMinutes, 30]
        : stopMinutes;

      const allRoutes = [result, ...(result.alternatives || [])];
      allRoutes.sort((a, b) => a.travelTimeSeconds - b.travelTimeSeconds);
      const bestRoute = allRoutes[0];
      delete bestRoute.alternatives;

      const otherRoutes = allRoutes.slice(1);
      otherRoutes.forEach(r => delete r.alternatives);

      const tl = await generateTimeline(bestRoute, routeType, finalStopMinutes, vehicleParams, restStopFilters, usedDriveHours);

      const newLeg: TripLeg = {
        id: crypto.randomUUID(),
        startName: startCoord.name,
        endName: isRoundTrip && !addingNewLeg ? `${endCoord.name} ↩ ${startCoord.name}` : endCoord.name,
        route: bestRoute,
        alternativeRoutes: otherRoutes,
        timeline: tl,
      };

      if (addingNewLeg) {
        setTrips(prev => [...prev, newLeg]);
        setAddingNewLeg(false);
      } else {
        setTrips([newLeg]);
      }

      setAlternativeRoutes(otherRoutes);
      setSelectedRouteIndex(0);
      setRouteResult(bestRoute);
      setTimeline(tl);
      setViewState('details');
      const destWp = bestRoute.waypoints[bestRoute.waypoints.length - 1];
      setDestinationCoords({ lat: destWp.lat, lng: destWp.lng });

      // Auto-save searched route
      const vehicle = selectedVehicle;
      const autoTrip: SavedTrip = {
        id: crypto.randomUUID(), createdAt: new Date().toISOString(),
        startName: bestRoute.waypoints[0].name,
        endName: bestRoute.waypoints[bestRoute.waypoints.length - 1].name,
        waypointNames: bestRoute.waypoints.slice(1, -1).map(w => w.name),
        distanceKm: bestRoute.distanceKm, travelTimeSeconds: bestRoute.travelTimeSeconds,
        totalWeightKg: totalWeight, vehicleId,
        vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.regNr})` : 'Okänt',
        routeType, timeline: tl, route: bestRoute, tripSource: 'searched',
      };
      saveTrip(autoTrip).then(() => getSavedTrips().then(setSavedTrips));
      setIsSaved(true);

      const hours = Math.floor(bestRoute.travelTimeSeconds / 3600);
      const mins = Math.round((bestRoute.travelTimeSeconds % 3600) / 60);
      const altInfo = otherRoutes.length > 0 ? ` · ${otherRoutes.length + 1} rutter` : '';
      toast.success(`${bestRoute.distanceKm} km · ${hours}h ${mins}min${altInfo}`);
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte beräkna rutt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
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
    await saveTrip(trip);
    const updated = await getSavedTrips();
    setSavedTrips(updated);
    setIsSaved(true);
    toast.success('Resa sparad!');
  };

  const handleBack = () => {
    if (addingNewLeg && trips.length > 0) {
      setAddingNewLeg(false);
      const lastTrip = trips[trips.length - 1];
      setRouteResult(lastTrip.route);
      setAlternativeRoutes(lastTrip.alternativeRoutes);
      setTimeline(lastTrip.timeline);
      setViewState('details');
      return;
    }
    setViewState('search');
    setRouteResult(null);
    setAlternativeRoutes([]);
    setSelectedRouteIndex(0);
    setTimeline([]);
    setDestination('');
    setSelectedLocation(null);
    setTrips([]);
    setAddingNewLeg(false);
  };

  const handleAddLeg = () => {
    if (!routeResult) return;
    const lastWp = routeResult.waypoints[routeResult.waypoints.length - 1];
    setStart(lastWp.name);
    setDestination('');
    setWaypoints([]);
    const lastTl = trips.length > 0 ? trips[trips.length - 1].timeline : timeline;
    const lastEntry = lastTl[lastTl.length - 1];
    if (lastEntry) {
      setDepartureTime(new Date(lastEntry.endTime).toISOString().slice(0, 16));
    }
    setAddingNewLeg(true);
    setViewState('search');
    setRouteResult(null);
    setAlternativeRoutes([]);
    setTimeline([]);
    setSelectedLocation(null);
  };

  const handleSwitchRoute = async (index: number) => {
    if (index === selectedRouteIndex) return;
    
    // Collect all routes: [current main, ...alternatives]
    const allRoutes = [routeResult!, ...alternativeRoutes];
    const newMain = allRoutes[index];
    const newAlts = allRoutes.filter((_, i) => i !== index);
    
    const vehicleParams: VehicleParams | undefined = selectedVehicle
      ? { weightKg: totalWeight, heightM: selectedVehicle.heightM, widthM: selectedVehicle.widthM, lengthM: selectedVehicle.lengthM }
      : undefined;
    const stopMinutes = waypoints.filter(w => w.address.trim()).map(w => w.stopMinutes);
    const tl = await generateTimeline(newMain, routeType, stopMinutes, vehicleParams, restStopFilters, usedDriveHours);
    
    setRouteResult(newMain);
    setAlternativeRoutes(newAlts);
    setSelectedRouteIndex(0);
    setTimeline(tl);
    setIsSaved(false);
    
    const hours = Math.floor(newMain.travelTimeSeconds / 3600);
    const mins = Math.round((newMain.travelTimeSeconds % 3600) / 60);
    toast.success(`Bytte rutt: ${newMain.distanceKm} km · ${hours}h ${mins}min`);
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
        facilities: entry.restStop?.facilities,
        address: entry.restStop?.address,
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

  const combinedDistanceKm = trips.length > 1 ? trips.reduce((s, t) => s + t.route.distanceKm, 0) : routeResult?.distanceKm || 0;
  const combinedTimeSeconds = trips.length > 1 ? trips.reduce((s, t) => s + t.route.travelTimeSeconds, 0) : routeResult?.travelTimeSeconds || 0;
  const combinedTimeH = Math.floor(combinedTimeSeconds / 3600);
  const combinedTimeMin = Math.round((combinedTimeSeconds % 3600) / 60);
  const previousLegsForMap = trips.length > 1 ? trips.slice(0, -1).map((leg, i) => ({ route: leg.route, color: LEG_COLORS[i % LEG_COLORS.length] })) : [];
  const allTimelineEntries = trips.length > 0 ? trips.flatMap(t => t.timeline) : timeline;
  const allRestCount = allTimelineEntries.filter(t => t.type === 'rest' || t.type === 'overnight').length;
  const displayTrips: TripLeg[] = trips.length > 0 ? trips : routeResult ? [{
    id: 'current', startName: start, endName: destination,
    route: routeResult, alternativeRoutes, timeline,
  }] : [];

  const timelineIcon = (type: TimelineEntry['type']) => {
    switch (type) { case 'drive': return '🚛'; case 'rest': return '☕'; case 'overnight': return '🌙'; case 'stop': return '📦'; case 'arrival': return '🏁'; }
  };

  return (
    <div className="relative w-full -m-4 md:-m-6" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Map */}
      <TomTomMap
        ref={mapHandleRef}
        route={routeResult}
        alternativeRoutes={alternativeRoutes}
        timeline={timeline}
        previousLegs={previousLegsForMap}
        userPosition={userPosition}
        isNavigating={isNavigating}
        className="absolute inset-0 z-0"
        defaultStyle="satellite"
        onMapClick={(lat, lng) => setMapClickCoords({ lat, lng })}
        onAlternativeClick={(i) => handleSwitchRoute(i + 1)}
      />

      {/* Fullscreen Street View on double-click */}
      {mapClickCoords && (
        <div className="absolute inset-0 z-40 bg-background">
          <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMapClickCoords(null)}
              className="gap-1.5 bg-background/90 backdrop-blur shadow-lg"
            >
              <ArrowLeft className="h-4 w-4" />
              Tillbaka till kartan
            </Button>
            <Badge variant="outline" className="bg-background/90 backdrop-blur text-xs">
              <Eye className="h-3 w-3 mr-1" />
              {mapClickCoords.lat.toFixed(5)}, {mapClickCoords.lng.toFixed(5)}
            </Badge>
          </div>
          <StreetViewPanorama
            lat={mapClickCoords.lat}
            lng={mapClickCoords.lng}
            className="w-full h-full"
            showExpandButton={false}
          />
        </div>
      )}

      {/* ===== SEARCH VIEW ===== */}
      {viewState === 'search' && (
        <>
          {/* Search bar - Google Maps style */}
          <div className="absolute top-4 left-4 right-4 z-20 max-w-lg mx-auto">
            <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
              {/* Start point - always visible */}
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <AddressAutocomplete
                  value={start}
                  onChange={setStart}
                  placeholder="Min position (GPS)"
                  className="border-0 shadow-none focus-visible:ring-0 h-auto py-0 text-xs text-muted-foreground placeholder:text-muted-foreground/50"
                  biasLat={userPosition?.lat}
                  biasLng={userPosition?.lng}
                />
                {userPosition && (
                  <button
                    onClick={async () => {
                      const name = await reverseGeocode(userPosition.lat, userPosition.lng);
                      setStart(name);
                    }}
                    className="shrink-0 p-1 rounded-md hover:bg-accent"
                    title="Min position"
                  >
                    <Locate className="h-3.5 w-3.5 text-primary" />
                  </button>
                )}
              </div>

              {/* Destination field */}
              <div className="flex items-center gap-3 px-4 py-2">
                <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                <AddressAutocomplete
                  value={destination}
                  onChange={setDestination}
                  onSelect={(suggestion) => {
                    if (suggestion.lat && suggestion.lng) {
                      setDestinationCoords({ lat: suggestion.lat, lng: suggestion.lng });
                      pendingDestCoordsRef.current = { lat: suggestion.lat, lng: suggestion.lng, name: suggestion.name };
                    }
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

              {/* Expandable options */}
              <div className="border-t border-border/50">
                {/* Tur & retur toggle + options toggle */}
                <div className="flex items-center justify-between px-4 py-2">
                  <button
                    onClick={() => setIsRoundTrip(!isRoundTrip)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isRoundTrip
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <Repeat className="h-3.5 w-3.5" />
                    Tur & retur
                  </button>
                  <button
                    onClick={() => setShowOptions(!showOptions)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Car className="h-3.5 w-3.5" />
                    {selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : 'Fordon & mer'}
                    {showOptions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>

                {showOptions && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/30">

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

                    {/* Remaining drive time */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Körtid redan använd idag</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <input
                          type="range"
                          min={0}
                          max={9}
                          step={0.5}
                          value={usedDriveHours}
                          onChange={e => setUsedDriveHours(Number(e.target.value))}
                          className="flex-1 h-2 accent-primary"
                        />
                        <span className="text-sm font-bold text-foreground min-w-[3rem] text-right">
                          {usedDriveHours}h
                        </span>
                      </div>
                      {usedDriveHours > 0 && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                          ⏱ {routeType === 'fastest' ? 10 - usedDriveHours : 9 - usedDriveHours}h körtid kvar idag
                        </p>
                      )}
                    </div>

                    {/* Rest stop facility filters */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Krav på rastplatser</div>
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          { key: 'toilet' as const, icon: '🚻', label: 'Toalett' },
                          { key: 'food' as const, icon: '🍽️', label: 'Mat' },
                          { key: 'shower' as const, icon: '🚿', label: 'Dusch' },
                          { key: 'fuel' as const, icon: '⛽', label: 'Drivmedel' },
                          { key: 'truckParking' as const, icon: '🅿️', label: 'Lastbilsp.' },
                        ]).map(f => (
                          <button
                            key={f.key}
                            onClick={() => setRestStopFilters(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors border ${
                              restStopFilters[f.key]
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                            }`}
                          >
                            <span>{f.icon}</span>
                            {f.label}
                          </button>
                        ))}
                      </div>
                      {Object.values(restStopFilters).some(Boolean) && (
                        <p className="text-[10px] text-muted-foreground">
                          Bara rastplatser med valda faciliteter visas
                        </p>
                      )}
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

          {/* Quick actions + Trip history - bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-20">
            <div className="max-w-lg mx-auto">
              {/* GPS button */}
              <div className="flex gap-2 px-4 mb-2">
                {userPosition && (
                  <button
                    onClick={() => mapHandleRef.current?.centerOnUser()}
                    className="bg-card shadow-lg rounded-full p-3 hover:bg-accent transition-colors border border-border"
                  >
                    <Locate className="h-5 w-5 text-primary" />
                  </button>
                )}
              </div>

              {/* Saved trips panel */}
              {savedTrips.length > 0 && (
                <div className="bg-card rounded-t-2xl shadow-xl border border-b-0 border-border overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Sökhistorik</span>
                    <span className="text-[10px] text-muted-foreground">({savedTrips.length})</span>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {savedTrips.slice(0, 10).map((trip) => (
                      <button
                        key={trip.id}
                        onClick={() => {
                          setRouteResult(trip.route);
                          setTimeline(trip.timeline);
                          setDestination(trip.endName);
                          const destWp = trip.route.waypoints[trip.route.waypoints.length - 1];
                          setDestinationCoords({ lat: destWp.lat, lng: destWp.lng });
                          setViewState('details');
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border/30 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Route className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">
                                {trip.startName} → {trip.endName}
                              </div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                <span>{trip.distanceKm} km</span>
                                <span>·</span>
                                <span>{Math.floor(trip.travelTimeSeconds / 3600)}h {Math.round((trip.travelTimeSeconds % 3600) / 60)}min</span>
                                <span>·</span>
                                <span>{new Date(trip.createdAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}</span>
                              </div>
                            </div>
                          </div>
                          <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground rotate-180 shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== DETAILS VIEW ===== */}
      {viewState === 'details' && routeResult && (
        <>
          {/* Top bar - compact */}
          <div className="absolute top-4 left-4 right-4 z-20 max-w-lg mx-auto">
            <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <button onClick={handleBack} className="shrink-0 p-1 hover:bg-accent rounded-lg">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {trips.length > 1 ? `${trips.length} turer` : destination}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <span className="font-bold text-primary">{trips.length > 1 ? combinedDistanceKm : routeResult.distanceKm} km</span>
                    <span>·</span>
                    <span className="font-bold text-primary">{trips.length > 1 ? `${combinedTimeH}h ${combinedTimeMin}min` : `${totalDriveTimeH}h ${totalDriveTimeMin}min`}</span>
                    {trips.length <= 1 && <>
                      <span>·</span>
                      <span>ank {new Date(routeResult.arrivalTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                    </>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Backdrop to dismiss resplan */}
          {showDetails && (
            <div className="absolute inset-0 z-[15]" onClick={() => setShowDetails(false)} />
          )}

          {/* Bottom sheet - compact by default */}
          <div className="absolute bottom-0 left-0 right-0 z-20">
            <div className="max-w-lg mx-auto">
              <div className={`bg-card rounded-t-2xl shadow-xl border border-b-0 border-border overflow-hidden transition-all ${showDetails ? 'max-h-[75vh]' : ''}`}>
                
                {/* Route alternatives - horizontal scroll, always visible */}
                {alternativeRoutes.length > 0 && (
                  <div className="px-3 pt-3 pb-1">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                      <button
                        className="shrink-0 rounded-lg px-2.5 py-1.5 text-left border-2 border-primary bg-primary/10 min-w-[80px]"
                      >
                        <div className="text-[11px] font-semibold text-foreground">Rutt 1</div>
                        <div className="text-[9px] text-muted-foreground whitespace-nowrap">
                          {routeResult.distanceKm} km · {Math.floor(routeResult.travelTimeSeconds / 3600)}h {Math.round((routeResult.travelTimeSeconds % 3600) / 60)}min
                        </div>
                      </button>
                      {alternativeRoutes.map((alt, i) => {
                        const diffMin = Math.round((alt.travelTimeSeconds - routeResult.travelTimeSeconds) / 60);
                        const diffKm = alt.distanceKm - routeResult.distanceKm;
                        return (
                          <button
                            key={i}
                            onClick={() => handleSwitchRoute(i + 1)}
                            className="shrink-0 rounded-lg px-2.5 py-1.5 text-left border border-border hover:border-primary/50 min-w-[80px]"
                          >
                            <div className="text-[11px] font-semibold text-foreground">Rutt {i + 2}</div>
                            <div className="text-[9px] text-muted-foreground whitespace-nowrap">
                              {alt.distanceKm} km · {Math.floor(alt.travelTimeSeconds / 3600)}h {Math.round((alt.travelTimeSeconds % 3600) / 60)}min
                            </div>
                            <div className="text-[9px] mt-0.5 whitespace-nowrap">
                              <span className={diffMin > 0 ? 'text-destructive' : 'text-emerald-600'}>
                                {diffMin > 0 ? '+' : ''}{diffMin}min
                              </span>
                              {' '}
                              <span className="text-muted-foreground">
                                {diffKm > 0 ? '+' : ''}{diffKm}km
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* BIG START BUTTON - always visible */}
                <div className="px-3 py-3">
                  <button
                    onClick={handleStartNavigation}
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-2xl text-lg flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/30 transition-all"
                  >
                    <Navigation className="h-6 w-6" />
                    KÖR
                  </button>
                </div>

                {/* Secondary actions */}
                <div className="px-3 pb-2 flex gap-2">
                  <Button variant="outline" onClick={handleAddLeg} className="flex-1 h-9 rounded-xl text-xs">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Lägg till tur
                  </Button>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-accent/50 transition-colors"
                  >
                    📋 Resplan
                    {showDetails ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {showDetails && (
                  <div className="overflow-y-auto" style={{ maxHeight: 'calc(75vh - 140px)' }}>
                    {/* Big clear summary cards */}
                    <div className="px-4 py-3 space-y-3">
                      {/* Quick overview - big numbers */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-primary/10 rounded-2xl p-3 text-center">
                          <div className="text-2xl font-black text-primary">
                            {trips.length > 1 ? combinedDistanceKm : routeResult.distanceKm}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium">km</div>
                        </div>
                        <div className="bg-primary/10 rounded-2xl p-3 text-center">
                          <div className="text-2xl font-black text-primary">
                            {trips.length > 1 ? `${combinedTimeH}:${String(combinedTimeMin).padStart(2,'0')}` : `${totalDriveTimeH}:${String(totalDriveTimeMin).padStart(2,'0')}`}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium">körtid</div>
                        </div>
                        <div className="bg-primary/10 rounded-2xl p-3 text-center">
                          <div className="text-2xl font-black text-primary">{allRestCount}</div>
                          <div className="text-xs text-muted-foreground font-medium">{allRestCount === 1 ? 'paus' : 'pauser'}</div>
                        </div>
                      </div>

                      {usedDriveHours > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 flex items-center gap-3">
                          <span className="text-2xl">⏱</span>
                          <div>
                            <div className="text-sm font-bold text-amber-800 dark:text-amber-300">
                              {usedDriveHours}h redan körd idag
                            </div>
                            <div className="text-xs text-amber-600 dark:text-amber-400">
                              Resan planeras med {routeType === 'fastest' ? 10 - usedDriveHours : 9 - usedDriveHours}h kvar
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step by step - visual journey */}
                      {displayTrips.map((leg, legIdx) => {
                        const depTime = new Date(leg.route.departureTime);
                        const arrTime = new Date(leg.route.arrivalTime);
                        const firstEntry = leg.timeline[0];
                        const lastEntry = leg.timeline[leg.timeline.length - 1];
                        const totalTripMs = lastEntry ? new Date(lastEntry.endTime).getTime() - new Date(firstEntry.startTime).getTime() : 0;
                        const totalTripH = Math.floor(totalTripMs / 3600000);
                        const totalTripMin = Math.round((totalTripMs % 3600000) / 60000);

                        return (
                          <div key={leg.id} className="space-y-2">
                            {displayTrips.length > 1 && (
                              <div className="flex items-center gap-2 pt-2">
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: LEG_COLORS[legIdx % LEG_COLORS.length] }} />
                                <span className="text-sm font-bold text-foreground">Tur {legIdx + 1}</span>
                              </div>
                            )}

                            {/* Visual journey steps */}
                            <div className="bg-card rounded-2xl border border-border overflow-hidden">
                              {leg.timeline.map((entry, i) => {
                                const startT = new Date(entry.startTime);
                                const endT = new Date(entry.endTime);
                                const timeStr = startT.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                                const endStr = endT.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                                const entryDate = startT.toLocaleDateString('sv-SE');
                                const prevDate = i > 0 ? new Date(leg.timeline[i - 1].startTime).toLocaleDateString('sv-SE') : null;
                                const showDayHeader = i === 0 || entryDate !== prevDate;

                                // Simplified labels
                                const getSimpleLabel = () => {
                                  if (entry.type === 'drive') {
                                    const h = Math.floor(entry.durationMinutes / 60);
                                    const m = entry.durationMinutes % 60;
                                    return `Kör ${h > 0 ? `${h}h ` : ''}${m}min`;
                                  }
                                  if (entry.type === 'rest') return 'Rast – 45 min';
                                  if (entry.type === 'overnight') return 'Sov – 11 timmar';
                                  if (entry.type === 'stop') return `Stopp: ${entry.location || 'Mellanstation'}`;
                                  if (entry.type === 'arrival') return `Framme!`;
                                  return entry.label;
                                };

                                const getBgColor = () => {
                                  if (entry.type === 'drive') return '';
                                  if (entry.type === 'rest') return 'bg-amber-50 dark:bg-amber-950/20';
                                  if (entry.type === 'overnight') return 'bg-indigo-50 dark:bg-indigo-950/20';
                                  if (entry.type === 'stop') return 'bg-orange-50 dark:bg-orange-950/20';
                                  if (entry.type === 'arrival') return 'bg-emerald-50 dark:bg-emerald-950/20';
                                  return '';
                                };

                                const getIcon = () => {
                                  if (entry.type === 'drive') return '🚛';
                                  if (entry.type === 'rest') return '☕';
                                  if (entry.type === 'overnight') return '🛏️';
                                  if (entry.type === 'stop') return '📦';
                                  if (entry.type === 'arrival') return '🏁';
                                  return '📍';
                                };

                                return (
                                  <div key={`${legIdx}-${i}`}>
                                    {showDayHeader && (
                                      <div className="bg-muted/60 px-4 py-2 flex items-center gap-2">
                                        <span className="text-lg">📅</span>
                                        <span className="text-sm font-bold text-foreground">
                                          {startT.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </span>
                                      </div>
                                    )}
                                    <button
                                      onClick={() => handleTimelineEntryClick(entry, i)}
                                      className={`w-full text-left px-4 py-3 flex items-center gap-4 border-b border-border/30 last:border-b-0 hover:bg-accent/30 transition-colors ${getBgColor()}`}
                                    >
                                      {/* Big icon */}
                                      <div className="text-2xl shrink-0 w-10 text-center">{getIcon()}</div>
                                      
                                      {/* Content */}
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-foreground">{getSimpleLabel()}</div>
                                        {entry.restStop && (
                                          <div className="text-xs text-primary font-medium mt-0.5 flex items-center gap-1">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            <span className="truncate">{entry.restStop.name}</span>
                                          </div>
                                        )}
                                        {entry.restStop?.facilities && Object.values(entry.restStop.facilities).some(Boolean) && (
                                          <div className="flex items-center gap-1.5 mt-1">
                                            <div className="flex gap-1">
                                              {entry.restStop.facilities.toilet && <span title="Toalett (uppskattat)">🚻</span>}
                                              {entry.restStop.facilities.food && <span title="Mat (uppskattat)">🍽️</span>}
                                              {entry.restStop.facilities.shower && <span title="Dusch (uppskattat)">🚿</span>}
                                              {entry.restStop.facilities.fuel && <span title="Drivmedel (uppskattat)">⛽</span>}
                                              {entry.restStop.facilities.truckParking && <span title="Lastbilsp. (uppskattat)">🅿️</span>}
                                            </div>
                                            <span className="text-[9px] text-muted-foreground italic">~uppskattat</span>
                                          </div>
                                        )}
                                        {entry.type === 'arrival' && (
                                          <div className="text-xs text-muted-foreground mt-0.5">{entry.location}</div>
                                        )}
                                      </div>

                                      {/* Time on right side - big and clear */}
                                      <div className="text-right shrink-0">
                                        <div className="text-base font-black text-foreground">{timeStr}</div>
                                        {entry.durationMinutes > 0 && entry.type !== 'drive' && (
                                          <div className="text-[11px] text-muted-foreground">→ {endStr}</div>
                                        )}
                                      </div>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Total trip time for this leg */}
                            {(totalTripH > 0 || totalTripMin > 0) && (
                              <div className="bg-muted/40 rounded-2xl p-3 flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground">Total tid inkl. pauser</span>
                                <span className="text-sm font-black text-foreground">{totalTripH}h {totalTripMin}min</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {displayTrips.length > 1 && (
                        <div className="bg-primary/10 rounded-2xl p-4 flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">🏁 Totalt alla turer</span>
                          <span className="text-sm font-black text-primary">
                            {combinedDistanceKm} km · {combinedTimeH}h {combinedTimeMin}min
                          </span>
                        </div>
                      )}

                      {/* EU rules - simple explanation */}
                      <div className="rounded-2xl bg-muted/40 p-3 space-y-1">
                        <div className="text-xs font-bold text-foreground">ℹ️ Så funkar pauserna</div>
                        <div className="text-xs text-muted-foreground leading-relaxed">
                          Efter <span className="font-bold">4,5 timmars körning</span> → 45 min rast<br/>
                          Max <span className="font-bold">{routeType === 'fastest' ? '10' : '9'} timmar</span> körning per dag<br/>
                          Sedan <span className="font-bold">11 timmars</span> vila (dygnsvila)
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Location detail card - Google Maps style */}
          {selectedLocation && (
            <>
            {/* Click-outside backdrop to dismiss */}
            <div className="absolute inset-0 z-20" onClick={() => setSelectedLocation(null)} />
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

                {/* Street View preview - click to fullscreen */}
                <button
                  onClick={() => setMapClickCoords({ lat: selectedLocation.lat, lng: selectedLocation.lng })}
                  className="relative w-full h-[160px] bg-muted block cursor-pointer group"
                >
                  <StreetViewPanorama
                    lat={selectedLocation.lat}
                    lng={selectedLocation.lng}
                    className="w-full h-[160px] pointer-events-none"
                    label="Street View"
                  />
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
                    <div className="bg-background/80 backdrop-blur rounded-full px-3 py-1.5 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      Visa helskärm
                    </div>
                  </div>
                </button>

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
                      {/* Facility badges */}
                      {selectedLocation.facilities && Object.values(selectedLocation.facilities).some(Boolean) && (
                        <div className="mt-2 space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {selectedLocation.facilities.toilet && <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">🚻 Toalett</Badge>}
                            {selectedLocation.facilities.food && <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">🍽️ Mat</Badge>}
                            {selectedLocation.facilities.shower && <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">🚿 Dusch</Badge>}
                            {selectedLocation.facilities.fuel && <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">⛽ Drivmedel</Badge>}
                            {selectedLocation.facilities.truckParking && <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">🅿️ Lastbilsp.</Badge>}
                          </div>
                          <p className="text-[9px] text-muted-foreground italic flex items-center gap-1">
                            <Info className="h-2.5 w-2.5 shrink-0" />
                            Faciliteter är uppskattade baserat på platstyp — verifiera innan
                          </p>
                        </div>
                      )}
                      {selectedLocation.address && (
                        <p className="text-[10px] text-muted-foreground mt-1">{selectedLocation.address}</p>
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
                    <button
                      onClick={() => setMapClickCoords({ lat: selectedLocation.lat, lng: selectedLocation.lng })}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-xl py-2 text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Street View
                    </button>
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
            </>
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
          {/* Top HUD - Big & Clear */}
          <div className="absolute top-0 left-0 right-0 z-30">
            <div className="bg-foreground/95 backdrop-blur-md text-background px-5 pt-5 pb-4 shadow-2xl">
              <div className="max-w-lg mx-auto">
                {/* Distance - HUGE */}
                <div className="text-center mb-3">
                  <div className="text-6xl font-black tracking-tighter leading-none">
                    {distanceToNext || '...'}
                  </div>
                  <div className="text-sm opacity-60 mt-1">kvar till nästa stopp</div>
                </div>

                {/* Next stop name */}
                <div className="bg-background/10 rounded-2xl px-4 py-3 text-center">
                  <div className="text-xs opacity-50 uppercase tracking-widest mb-0.5">Nästa</div>
                  <div className="font-bold text-lg leading-tight truncate">{nextWaypoint?.name}</div>
                </div>

                {/* Stats row */}
                <div className="flex justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-sm opacity-70">
                    <Route className="h-4 w-4" />
                    <span className="font-semibold">{routeResult.distanceKm} km</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm opacity-70">
                    <Clock className="h-4 w-4" />
                    <span className="font-semibold">{elapsedMin} min körd</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <div className={`w-2.5 h-2.5 rounded-full ${userPosition ? 'bg-emerald-400 animate-pulse' : 'bg-destructive'}`} />
                    <span className="font-semibold opacity-70">GPS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-6 left-0 right-0 z-30">
            <div className="max-w-lg mx-auto px-4 flex items-center gap-3">
              {/* Center on user */}
              {userPosition && (
                <button
                  onClick={() => mapHandleRef.current?.centerOnUser()}
                  className="bg-card shadow-xl rounded-full p-4 border border-border shrink-0"
                >
                  <Locate className="h-6 w-6 text-primary" />
                </button>
              )}

              {/* Stop button - prominent */}
              <button
                onClick={handleStopNavigation}
                className="flex-1 bg-destructive text-destructive-foreground shadow-xl rounded-2xl px-6 py-4 font-bold text-lg flex items-center justify-center gap-3"
              >
                <Square className="h-6 w-6" />
                Avsluta körning
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
