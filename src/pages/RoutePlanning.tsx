import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import StreetViewPanorama from "@/components/StreetViewPanorama";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  MapPin,
  Clock,
  Plus,
  X,
  Route,
  AlertTriangle,
  Loader2,
  Save,
  History,
  Navigation,
  Locate,
  Square,
  ChevronUp,
  ChevronDown,
  Search,
  Car,
  ArrowLeft,
  Bookmark,
  Info,
  Eye,
  Repeat,
  ArrowUpDown,
  SlidersHorizontal,
  Truck,
} from "lucide-react";

import StreetViewImage from "@/components/StreetViewImage";
import { mockVehicles, getVehicleById } from "@/data/mockData";
import { BK_LIMITS, BKClass, TimelineEntry, RestStopFacilities } from "@/types";
import { toast } from "sonner";
import {
  geocode,
  calculateRoute,
  generateTimeline,
  reverseGeocode,
  RouteResult,
  VehicleParams,
} from "@/services/tomtom";
import { SavedTrip, getSavedTrips, saveTrip, saveDrivenTrip } from "@/services/tripStorage";
import { getSearchHistory, saveSearchHistory, SearchHistoryEntry } from "@/services/searchHistory";
import TomTomMap, { TomTomMapHandle } from "@/components/TomTomMap";
import TripHistory from "@/components/TripHistory";
import AddressAutocomplete, { AddressSuggestion } from "@/components/AddressAutocomplete";

interface TripLeg {
  id: string;
  startName: string;
  endName: string;
  route: RouteResult;
  alternativeRoutes: RouteResult[];
  timeline: TimelineEntry[];
}

const LEG_COLORS = ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];

type ViewState = "search" | "preview" | "details" | "navigating";

interface DestinationPreview {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export default function RoutePlanning() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialView = searchParams.get('view') === 'map' ? 'search' : 'search';
  const initialSearchStep = searchParams.get('view') === 'map' ? null : 'search';
  const mapHandleRef = useRef<TomTomMapHandle>(null);
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const locationCardRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState<ViewState>(initialView);
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [waypoints, setWaypoints] = useState<{ address: string; stopMinutes: number }[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [loadWeight, setLoadWeight] = useState("");
  const [routeType, setRouteType] = useState<"normal" | "fastest">("normal");
  const [departureTime, setDepartureTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    return now.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isZoomedToUser, setIsZoomedToUser] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(true);
  const [showFilterCurtain, setShowFilterCurtain] = useState(false);
  const [fullscreenResplan, setFullscreenResplan] = useState(false);
  const [bottomSheetTab, setBottomSheetTab] = useState<"overview" | "streetview" | "resplan">("overview");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchStep, setSearchStep] = useState<"search" | "filters" | null>(initialSearchStep as any);

  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationPreview, setDestinationPreview] = useState<DestinationPreview | null>(null);
  const [mapClickCoords, setMapClickCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<RouteResult[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [usedDriveHours, setUsedDriveHours] = useState(0);
  const [restStopFilters, setRestStopFilters] = useState<RestStopFacilities>({
    toilet: false,
    food: false,
    shower: false,
    fuel: false,
    truckParking: false,
  });
  const [trips, setTrips] = useState<TripLeg[]>([]);
  const [addingNewLeg, setAddingNewLeg] = useState(false);
  const [draggingStopIdx, setDraggingStopIdx] = useState<number | null>(null);
  const [dragOverStopIdx, setDragOverStopIdx] = useState<number | null>(null);

  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const gpsPointsRef = useRef<{ lat: number; lng: number; time: string }[]>([]);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const dragPointerYRef = useRef<number | null>(null);
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
    alternatives?: Array<{
      name: string;
      lat: number;
      lng: number;
      distance?: string;
      category?: string;
      suitability?: string;
      suitabilityNote?: string;
      facilities?: RestStopFacilities;
    }>;
    suitability?: string;
    suitabilityNote?: string;
    facilities?: RestStopFacilities;
    address?: string;
  } | null>(null);

  const selectedVehicle = vehicleId ? getVehicleById(vehicleId) : undefined;
  const totalWeight = selectedVehicle ? selectedVehicle.weightKg + Number(loadWeight || 0) : 0;
  const [searchHistoryEntries, setSearchHistoryEntries] = useState<SearchHistoryEntry[]>([]);
  const latestUserPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const startValueRef = useRef("");

  useEffect(() => {
    latestUserPositionRef.current = userPosition;
  }, [userPosition]);

  useEffect(() => {
    startValueRef.current = start;
  }, [start]);

  useEffect(() => {
    getSavedTrips().then(setSavedTrips);
  }, []);
  useEffect(() => {
    getSearchHistory(40).then(setSearchHistoryEntries);
  }, []);

  useEffect(() => {
    if (draggingStopIdx === null) {
      dragPointerYRef.current = null;
      return;
    }

    const onGlobalDragOver = (event: DragEvent) => {
      dragPointerYRef.current = event.clientY;
      const container = timelineScrollRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const y = event.clientY - rect.top;
      const edgeZone = 110;
      const maxSpeed = 22;

      if (y < edgeZone) {
        const ratio = Math.min(1, Math.max(0, (edgeZone - y) / edgeZone));
        container.scrollTop -= Math.max(5, Math.round(ratio * maxSpeed));
      } else if (y > rect.height - edgeZone) {
        const ratio = Math.min(1, Math.max(0, (y - (rect.height - edgeZone)) / edgeZone));
        container.scrollTop += Math.max(5, Math.round(ratio * maxSpeed));
      }
    };

    window.addEventListener("dragover", onGlobalDragOver);
    return () => window.removeEventListener("dragover", onGlobalDragOver);
  }, [draggingStopIdx]);

  // Click outside to dismiss panels
  const dismissPanels = useCallback(() => {
    setShowDetails(false);
    setShowBottomSheet(false);
    setSelectedLocation(null);
    setDetailsExpanded(false);
    setShowFilterCurtain(false);

    // Toggle zoom like the GPS button
    if (isZoomedToUser) {
      const map = mapHandleRef.current?.getMap();
      if (map) {
        (map as any).flyTo({ zoom: 6, duration: 800 });
      }
      setIsZoomedToUser(false);
    } else if (userPosition) {
      mapHandleRef.current?.centerOnUser();
      setIsZoomedToUser(true);
    }
  }, [isZoomedToUser, userPosition]);

  // Auto-start GPS watch for smooth position
  const gpsInitRef = useRef(false);
  useEffect(() => {
    if (!("geolocation" in navigator) || gpsInitRef.current) return;
    gpsInitRef.current = true;
    // First try high-accuracy, then fall back to low-accuracy if it fails
    let highAccuracyFailed = false;
    const watchIds: number[] = [];

    const startWatch = (highAccuracy: boolean) => {
      const watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          // Skip positions with very poor accuracy (> 150m) unless it's the only one we have
          const accuracy = pos.coords.accuracy;
          if (accuracy > 150 && latestUserPositionRef.current) return;

          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserPosition(coords);

          if (!startValueRef.current) {
            try {
              const name = await reverseGeocode(coords.lat, coords.lng);
              setStart(name);
            } catch {
              setStart("Min position");
            }
          }
        },
        (err) => {
          // If high accuracy fails (TIMEOUT=3 or POSITION_UNAVAILABLE=2), try low accuracy
          if (highAccuracy && !highAccuracyFailed && (err.code === 2 || err.code === 3)) {
            highAccuracyFailed = true;
            console.warn('High accuracy GPS failed, falling back to low accuracy');
            startWatch(false);
          }
          if (!startValueRef.current) setStart("");
        },
        { enableHighAccuracy: highAccuracy, maximumAge: highAccuracy ? 5000 : 30000, timeout: highAccuracy ? 10000 : 20000 }
      );

      watchIds.push(watchId);
    };

    startWatch(true);

    return () => {
      watchIds.forEach((id) => navigator.geolocation.clearWatch(id));
    };
  }, []);

  const haversineKm = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  useEffect(() => {
    if (!isNavigating || !userPosition || !routeResult) return;
    const nextWp = routeResult.waypoints[Math.min(currentStep + 1, routeResult.waypoints.length - 1)];
    const dist = haversineKm(userPosition.lat, userPosition.lng, nextWp.lat, nextWp.lng);
    if (dist < 0.5 && currentStep < routeResult.waypoints.length - 1) {
      setCurrentStep((prev) => prev + 1);
      toast.success(`Passerade: ${nextWp.name}`);
    }
    setDistanceToNext(dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`);
  }, [userPosition, isNavigating, routeResult, currentStep, haversineKm]);

  // Preview destination marker
  const previewMarkerRef = useRef<any>(null);
  useEffect(() => {
    const map = mapHandleRef.current?.getMap();

    // Remove old preview marker
    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
      previewMarkerRef.current = null;
    }

    if (!map || viewState !== "preview" || !destinationPreview) return;

    import('@tomtom-international/web-sdk-maps').then((tt) => {
      if (viewState !== "preview" || !destinationPreview) return;
      const el = document.createElement('div');
      el.style.cssText = `
        width: 40px; height: 40px; border-radius: 50%;
        background: #ef4444;
        border: 3px solid white; box-shadow: 0 3px 14px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; color: white; font-weight: bold;
      `;
      el.textContent = '📍';
      previewMarkerRef.current = new tt.default.Marker({ element: el })
        .setLngLat([destinationPreview.lng, destinationPreview.lat])
        .addTo(map);
    });

    return () => {
      if (previewMarkerRef.current) {
        previewMarkerRef.current.remove();
        previewMarkerRef.current = null;
      }
    };
  }, [viewState, destinationPreview]);

  const startGpsTracking = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    gpsPointsRef.current = [];
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPosition(point);
        gpsPointsRef.current.push({ ...point, time: new Date().toISOString() });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
    setGpsWatchId(id);
  }, []);

  const stopGpsTracking = useCallback(() => {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      setGpsWatchId(null);
    }
  }, [gpsWatchId]);

  useEffect(() => {
    return () => {
      if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    };
  }, [gpsWatchId]);

  const handleStartNavigation = useCallback(() => {
    if (!routeResult) return;
    setIsNavigating(true);
    setViewState("navigating");
    setCurrentStep(0);
    setNavStartTime(new Date());
    startGpsTracking();
    toast.success("Navigation startad!");
  }, [routeResult, startGpsTracking]);

  const handleStopNavigation = useCallback(async () => {
    setIsNavigating(false);
    setViewState("details");
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
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        startName: routeResult.waypoints[0].name,
        endName: routeResult.waypoints[routeResult.waypoints.length - 1].name,
        waypointNames: routeResult.waypoints.slice(1, -1).map((w) => w.name),
        distanceKm: routeResult.distanceKm,
        travelTimeSeconds: routeResult.travelTimeSeconds,
        totalWeightKg: totalWeight,
        vehicleId,
        vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.regNr})` : "Okänt",
        routeType,
        timeline,
        route: routeResult,
        tripSource: "driven",
        drivenDistanceKm: Math.round(drivenDistanceKm * 10) / 10,
        drivenTimeSeconds,
      };
      await saveDrivenTrip(drivenTrip, drivenDistanceKm, drivenTimeSeconds, points);
      const updated = await getSavedTrips();
      setSavedTrips(updated);
      toast.info(`Körning sparad: ${Math.round(drivenDistanceKm)} km`);
    } else {
      toast.info("Navigation avslutad");
    }

    setNavStartTime(null);
    gpsPointsRef.current = [];
  }, [
    stopGpsTracking,
    routeResult,
    navStartTime,
    selectedVehicle,
    totalWeight,
    vehicleId,
    routeType,
    timeline,
    haversineKm,
  ]);

  const getBKStatus = (weight: number) => {
    const results: { bk: BKClass; limit: number; status: "green" | "yellow" | "red" }[] = [];
    for (const [bk, limit] of Object.entries(BK_LIMITS) as [BKClass, number][]) {
      const ratio = weight / limit;
      if (ratio > 1) results.push({ bk, limit, status: "red" });
      else if (ratio > 0.9) results.push({ bk, limit, status: "yellow" });
      else results.push({ bk, limit, status: "green" });
    }
    return results;
  };
  const bkResults = totalWeight > 0 ? getBKStatus(totalWeight) : [];

  const statusColor = (s: string) => {
    if (s === "red") return "bg-destructive text-destructive-foreground";
    if (s === "yellow") return "bg-warning text-warning-foreground";
    return "bg-success text-success-foreground";
  };

  const pendingDestCoordsRef = useRef<{ lat: number; lng: number; name: string } | null>(null);

  const handleSearch = async (overrideDest?: string) => {
    const destToUse = overrideDest || destination;
    if (!destToUse.trim()) return;
    setIsLoading(true);
    setIsSaved(false);

    try {
      const startQuery = start || "Stockholm";
      const destFromSelection = pendingDestCoordsRef.current;
      pendingDestCoordsRef.current = null;

      const [startCoord, endCoord, ...waypointCoords] = await Promise.all([
        userPosition && (!start || start === "Min position")
          ? Promise.resolve({ lat: userPosition.lat, lng: userPosition.lng, name: start || "Min position" })
          : geocode(startQuery),
        destFromSelection ? Promise.resolve(destFromSelection) : geocode(destination),
        ...waypoints.filter((w) => w.address.trim()).map((w) => geocode(w.address)),
      ]);

      // Round-trip: destination becomes waypoint, start becomes end
      const finalWaypoints = isRoundTrip && !addingNewLeg ? [...waypointCoords, endCoord] : waypointCoords;
      const finalEnd = isRoundTrip && !addingNewLeg ? startCoord : endCoord;

      const vehicleParams: VehicleParams | undefined = selectedVehicle
        ? {
            weightKg: totalWeight,
            heightM: selectedVehicle.heightM,
            widthM: selectedVehicle.widthM,
            lengthM: selectedVehicle.lengthM,
          }
        : undefined;

      const result = await calculateRoute(
        startCoord,
        finalEnd,
        finalWaypoints,
        new Date(departureTime).toISOString(),
        vehicleParams,
      );
      const stopMinutes = waypoints.filter((w) => w.address.trim()).map((w) => w.stopMinutes);
      const finalStopMinutes = isRoundTrip && !addingNewLeg ? [...stopMinutes, 30] : stopMinutes;

      const allRoutes = [result, ...(result.alternatives || [])];
      allRoutes.sort((a, b) => a.travelTimeSeconds - b.travelTimeSeconds);
      const bestRoute = allRoutes[0];
      delete bestRoute.alternatives;

      const otherRoutes = allRoutes.slice(1);
      otherRoutes.forEach((r) => delete r.alternatives);

      const tl = await generateTimeline(
        bestRoute,
        routeType,
        finalStopMinutes,
        vehicleParams,
        restStopFilters,
        usedDriveHours,
      );

      const newLeg: TripLeg = {
        id: crypto.randomUUID(),
        startName: startCoord.name,
        endName: isRoundTrip && !addingNewLeg ? `${endCoord.name} ↩ ${startCoord.name}` : endCoord.name,
        route: bestRoute,
        alternativeRoutes: otherRoutes,
        timeline: tl,
      };

      if (addingNewLeg) {
        setTrips((prev) => [...prev, newLeg]);
        setAddingNewLeg(false);
      } else {
        setTrips([newLeg]);
      }

      setAlternativeRoutes(otherRoutes);
      setSelectedRouteIndex(0);
      setRouteResult(bestRoute);
      setTimeline(tl);
      setViewState("details");
      setShowBottomSheet(true);
      const destWp = bestRoute.waypoints[bestRoute.waypoints.length - 1];
      setDestinationCoords({ lat: destWp.lat, lng: destWp.lng });

      // Auto-save searched route
      const vehicle = selectedVehicle;
      const autoTrip: SavedTrip = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        startName: bestRoute.waypoints[0].name,
        endName: bestRoute.waypoints[bestRoute.waypoints.length - 1].name,
        waypointNames: bestRoute.waypoints.slice(1, -1).map((w) => w.name),
        distanceKm: bestRoute.distanceKm,
        travelTimeSeconds: bestRoute.travelTimeSeconds,
        totalWeightKg: totalWeight,
        vehicleId,
        vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.regNr})` : "Okänt",
        routeType,
        timeline: tl,
        route: bestRoute,
        tripSource: "searched",
      };
      saveTrip(autoTrip).then(() => getSavedTrips().then(setSavedTrips));
      setIsSaved(true);

      const hours = Math.floor(bestRoute.travelTimeSeconds / 3600);
      const mins = Math.round((bestRoute.travelTimeSeconds % 3600) / 60);
      const altInfo = otherRoutes.length > 0 ? ` · ${otherRoutes.length + 1} rutter` : "";
      toast.success(`${bestRoute.distanceKm} km · ${hours}h ${mins}min${altInfo}`);
    } catch (err: any) {
      toast.error(err.message || "Kunde inte beräkna rutt");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!routeResult) return;
    const vehicle = selectedVehicle;
    const trip: SavedTrip = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      startName: routeResult.waypoints[0].name,
      endName: routeResult.waypoints[routeResult.waypoints.length - 1].name,
      waypointNames: routeResult.waypoints.slice(1, -1).map((w) => w.name),
      distanceKm: routeResult.distanceKm,
      travelTimeSeconds: routeResult.travelTimeSeconds,
      totalWeightKg: totalWeight,
      vehicleId,
      vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.regNr})` : "Okänt",
      routeType,
      timeline,
      route: routeResult,
    };
    await saveTrip(trip);
    const updated = await getSavedTrips();
    setSavedTrips(updated);
    setIsSaved(true);
    toast.success("Resa sparad!");
  };

  const handleBack = () => {
    if (addingNewLeg && trips.length > 0) {
      setAddingNewLeg(false);
      const lastTrip = trips[trips.length - 1];
      setRouteResult(lastTrip.route);
      setAlternativeRoutes(lastTrip.alternativeRoutes);
      setTimeline(lastTrip.timeline);
      setViewState("details");
      return;
    }
    setViewState("search");
    setRouteResult(null);
    setAlternativeRoutes([]);
    setSelectedRouteIndex(0);
    setTimeline([]);
    setDestination("");
    setSelectedLocation(null);
    setTrips([]);
    setAddingNewLeg(false);
  };

  const handleAddLeg = () => {
    if (!routeResult) return;
    const lastWp = routeResult.waypoints[routeResult.waypoints.length - 1];
    setStart(lastWp.name);
    setDestination("");
    setWaypoints([]);
    const lastTl = trips.length > 0 ? trips[trips.length - 1].timeline : timeline;
    const lastEntry = lastTl[lastTl.length - 1];
    if (lastEntry) {
      setDepartureTime(new Date(lastEntry.endTime).toISOString().slice(0, 16));
    }
    setAddingNewLeg(true);
    setViewState("search");
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
      ? {
          weightKg: totalWeight,
          heightM: selectedVehicle.heightM,
          widthM: selectedVehicle.widthM,
          lengthM: selectedVehicle.lengthM,
        }
      : undefined;
    const stopMinutes = waypoints.filter((w) => w.address.trim()).map((w) => w.stopMinutes);
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
    let category = "";
    let distance = "";
    let alternatives: Array<{ name: string; lat: number; lng: number; distance?: string; category?: string }> = [];

    if (entry.restStop) {
      lat = entry.restStop.lat;
      lng = entry.restStop.lng;
      name = entry.restStop.name;
      category = entry.restStop.category || "";
      distance = entry.restStop.distance || "";
      alternatives = entry.restStop.alternatives || [];
    } else if (entry.type === "stop" || entry.type === "arrival") {
      const wp = routeResult?.waypoints.find((w) => entry.label.includes(w.name) || entry.location === w.name);
      if (wp) {
        lat = wp.lat;
        lng = wp.lng;
        name = wp.name;
      }
    }

    if (lat !== undefined && lng !== undefined) {
      setSelectedLocation({
        type: entry.type,
        label: entry.label,
        lat,
        lng,
        name,
        category,
        distance,
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

  const handleSwapRestStop = (alt: {
    name: string;
    lat: number;
    lng: number;
    distance?: string;
    category?: string;
  }) => {
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
    const otherAlts = (entry.restStop.alternatives || []).filter((a) => a.name !== alt.name);

    entry.restStop = {
      ...alt,
      alternatives: [currentStop, ...otherAlts],
    };
    entry.location = alt.name;
    entry.label = entry.type === "overnight" ? `Dygnsvila (11h) – ${alt.name}` : `Rast (45 min) – ${alt.name}`;

    setTimeline(updated);
    setSelectedLocation((prev) =>
      prev
        ? {
            ...prev,
            name: alt.name,
            lat: alt.lat,
            lng: alt.lng,
            category: alt.category || "",
            distance: alt.distance || "",
            suitability: (alt as any).suitability || "good",
            suitabilityNote: (alt as any).suitabilityNote || "",
            alternatives: [currentStop, ...otherAlts],
          }
        : null,
    );
    mapHandleRef.current?.flyToLocation(alt.lng, alt.lat, 14);
    toast.success(`Bytte rastplats till ${alt.name}`);
  };

  const totalDriveTimeH = routeResult ? Math.floor(routeResult.travelTimeSeconds / 3600) : 0;
  const totalDriveTimeMin = routeResult ? Math.round((routeResult.travelTimeSeconds % 3600) / 60) : 0;
  const nextWaypoint = routeResult
    ? routeResult.waypoints[Math.min(currentStep + 1, routeResult.waypoints.length - 1)]
    : null;
  const elapsedMin = navStartTime ? Math.round((Date.now() - navStartTime.getTime()) / 60000) : 0;

  const combinedDistanceKm =
    trips.length > 1 ? trips.reduce((s, t) => s + t.route.distanceKm, 0) : routeResult?.distanceKm || 0;
  const combinedTimeSeconds =
    trips.length > 1 ? trips.reduce((s, t) => s + t.route.travelTimeSeconds, 0) : routeResult?.travelTimeSeconds || 0;
  const combinedTimeH = Math.floor(combinedTimeSeconds / 3600);
  const combinedTimeMin = Math.round((combinedTimeSeconds % 3600) / 60);
  const previousLegsForMap =
    trips.length > 1
      ? trips.slice(0, -1).map((leg, i) => ({ route: leg.route, color: LEG_COLORS[i % LEG_COLORS.length] }))
      : [];
  const allTimelineEntries = trips.length > 0 ? trips.flatMap((t) => t.timeline) : timeline;
  const allRestCount = allTimelineEntries.filter((t) => t.type === "rest" || t.type === "overnight").length;
  const displayTrips: TripLeg[] =
    trips.length > 0
      ? trips
      : routeResult
        ? [
            {
              id: "current",
              startName: start,
              endName: destination,
              route: routeResult,
              alternativeRoutes,
              timeline,
            },
          ]
        : [];

  const timelineIcon = (type: TimelineEntry["type"]) => {
    switch (type) {
      case "drive":
        return "🚛";
      case "rest":
        return "☕";
      case "overnight":
        return "🌙";
      case "stop":
        return "📦";
      case "arrival":
        return "🏁";
    }
  };

  return (
    <div className="relative overflow-hidden" style={{ height: "100vh", width: "100vw" }}>
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
        onMapTap={dismissPanels}
        onAlternativeClick={(i) => handleSwitchRoute(i + 1)}
      />

      {viewState === "details" && showBottomSheet && !selectedLocation && (
        <div className="absolute inset-0 z-10" onPointerDown={dismissPanels} aria-hidden="true" />
      )}

      {mapClickCoords && (
        <div className="absolute inset-0 z-40 bg-background">
          <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setMapClickCoords(null);
                if (userPosition) {
                  setTimeout(() => mapHandleRef.current?.flyToLocation(userPosition.lng, userPosition.lat, 8), 100);
                } else {
                  const map = mapHandleRef.current?.getMap();
                  if (map) setTimeout(() => (map as any).flyTo({ zoom: 6, duration: 800 }), 100);
                }
              }}
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
            showZoomButtons={true}
          />
        </div>
      )}

      {/* ===== SEARCH VIEW ===== */}
      {viewState === "search" && (
        <>
          {/* STEP 1: Full-screen SEARCH page */}
          {searchStep === "search" && (
            <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
              {/* Compact header */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setSearchStep(null);
                    setSearchFocused(false);
                  }}
                  className="p-2 rounded-full hover:bg-accent transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 text-foreground" />
                </button>
                <h2 className="text-lg font-bold text-foreground">Vart ska du?</h2>
              </div>

              {/* Search card + inline results */}
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                <div className="px-4 pb-2">
                  <div className="relative bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    {/* From - compact */}
                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground shrink-0">Från</span>
                        <span className="text-sm text-foreground truncate">{start || "Min position"}</span>
                      </div>
                      {userPosition && (
                        <button
                          onClick={async () => {
                            const name = await reverseGeocode(userPosition.lat, userPosition.lng);
                            setStart(name);
                          }}
                          className="shrink-0 p-1.5 rounded-lg hover:bg-accent transition-colors"
                          title="Min position"
                        >
                          <Locate className="h-3.5 w-3.5 text-primary" />
                        </button>
                      )}
                    </div>

                    {/* To - prominent */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive shrink-0" />
                      <div className="flex-1 min-w-0">
                        <AddressAutocomplete
                          value={destination}
                          onChange={setDestination}
                          onSelect={(suggestion) => {
                            if (suggestion.lat && suggestion.lng && !suggestion.isHistory) {
                              saveSearchHistory({
                                name: suggestion.name,
                                address: suggestion.address || suggestion.name,
                                lat: suggestion.lat,
                                lng: suggestion.lng,
                              }).then(() => getSearchHistory(40).then(setSearchHistoryEntries));
                            }
                            if (suggestion.isHistory) {
                              const trip = savedTrips.find((t) => t.id === suggestion.id);
                              if (trip) {
                                const destWp = trip.route.waypoints[trip.route.waypoints.length - 1];
                                const previewName = destWp.name || trip.endName;
                                setDestination(previewName);
                                setDestinationCoords({ lat: destWp.lat, lng: destWp.lng });
                                pendingDestCoordsRef.current = {
                                  lat: destWp.lat,
                                  lng: destWp.lng,
                                  name: previewName,
                                };
                                setDestinationPreview({
                                  name: previewName,
                                  address: previewName,
                                  lat: destWp.lat,
                                  lng: destWp.lng,
                                });
                                setViewState("preview");
                                setShowBottomSheet(false);
                                setShowDetails(false);
                                setSearchStep(null);
                                setSearchFocused(false);
                                setTimeout(() => {
                                  mapHandleRef.current?.flyToLocation(destWp.lng, destWp.lat, 16);
                                }, 100);
                                return;
                              }
                            }
                            if (suggestion.lat && suggestion.lng) {
                              setDestinationCoords({ lat: suggestion.lat, lng: suggestion.lng });
                              pendingDestCoordsRef.current = {
                                lat: suggestion.lat,
                                lng: suggestion.lng,
                                name: suggestion.name,
                              };
                              // Enter preview mode: zoom to destination
                              setDestinationPreview({
                                name: suggestion.name,
                                address: suggestion.address || suggestion.name,
                                lat: suggestion.lat,
                                lng: suggestion.lng,
                              });
                              setViewState("preview");
                              setSearchStep(null);
                              setSearchFocused(false);
                              // Zoom to destination
                              setTimeout(() => {
                                mapHandleRef.current?.flyToLocation(suggestion.lng, suggestion.lat, 16);
                              }, 100);
                              return;
                            }
                            setSearchStep("filters");
                            setSearchFocused(false);
                          }}
                          placeholder="Sök destination..."
                          autoFocus={true}
                          inlineResults={true}
                          maxInitialVisible={3}
                          className="border-0 shadow-none focus-visible:ring-0 h-auto py-0 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 px-0"
                          biasLat={userPosition?.lat}
                          biasLng={userPosition?.lng}
                          onInputFocus={() => setSearchFocused(true)}
                          onInputBlur={() => {}}
                          initialSuggestions={(() => {
                            const suggestions: Array<{
                              id: string;
                              name: string;
                              address: string;
                              lat: number;
                              lng: number;
                              isHistory: boolean;
                              matchText: string;
                            }> = [];
                            const seenKeys = new Set<string>();
                            for (const t of savedTrips) {
                              const key = t.endName.toLowerCase();
                              if (seenKeys.has(key)) continue;
                              seenKeys.add(key);
                              const allStops = [t.startName, ...t.waypointNames, t.endName].join(" → ");
                              const destWp = t.route.waypoints[t.route.waypoints.length - 1];
                              suggestions.push({
                                id: t.id,
                                name: allStops,
                                address: `${t.distanceKm} km · ${Math.floor(t.travelTimeSeconds / 3600)}h ${Math.round((t.travelTimeSeconds % 3600) / 60)}min`,
                                lat: destWp.lat,
                                lng: destWp.lng,
                                isHistory: true,
                                matchText: [t.endName, ...t.waypointNames].join("|"),
                              });
                            }
                            for (const h of searchHistoryEntries) {
                              const key = h.name.toLowerCase();
                              if (seenKeys.has(key)) continue;
                              seenKeys.add(key);
                              suggestions.push({
                                id: h.id,
                                name: h.name,
                                address: h.address,
                                lat: h.lat,
                                lng: h.lng,
                                isHistory: true,
                                matchText: h.name,
                              });
                            }
                            return suggestions.slice(0, 8);
                          })()}
                        />
                      </div>
                      {destination ? (
                        <button
                          onClick={() => {
                            setDestination("");
                            setRouteResult(null);
                            setAlternativeRoutes([]);
                            setSelectedRouteIndex(0);
                            setTimeline([]);
                            setTrips([]);
                            setViewState("search");
                          }}
                          className="shrink-0 p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : (
                        <Search className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Senaste besökta platser - unique places from driven trips */}
                {!destination &&
                  (() => {
                    const visitedPlaces: Array<{ name: string; lat: number; lng: number; date: string }> = [];
                    const seenPlaces = new Set<string>();
                    for (const trip of savedTrips.filter((t) => t.tripSource === "driven")) {
                      // Add all waypoints and destination
                      const stops = [...trip.waypointNames, trip.endName];
                      const waypoints = trip.route.waypoints;
                      for (let i = 0; i < stops.length; i++) {
                        const key = stops[i].toLowerCase().trim();
                        if (seenPlaces.has(key)) continue;
                        seenPlaces.add(key);
                        const wpIdx = Math.min(i + 1, waypoints.length - 1);
                        visitedPlaces.push({
                          name: stops[i],
                          lat: waypoints[wpIdx]?.lat ?? 0,
                          lng: waypoints[wpIdx]?.lng ?? 0,
                          date: trip.createdAt,
                        });
                      }
                      // Add rest stops and overnight stops from timeline
                      for (const entry of trip.timeline) {
                        if (
                          (entry.type === "rest" || entry.type === "overnight" || entry.type === "stop") &&
                          entry.restStop
                        ) {
                          const key = entry.restStop.name.toLowerCase().trim();
                          if (seenPlaces.has(key)) continue;
                          seenPlaces.add(key);
                          visitedPlaces.push({
                            name: entry.restStop.name,
                            lat: entry.restStop.lat,
                            lng: entry.restStop.lng,
                            date: trip.createdAt,
                          });
                        }
                      }
                    }
                    if (visitedPlaces.length === 0) return null;
                    return (
                      <div className="px-4 pt-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Senast besökta platser
                        </p>
                        <div className="space-y-2">
                          {visitedPlaces.slice(0, 8).map((place, i) => (
                            <div
                              key={place.name + i}
                              className="rounded-xl overflow-hidden border border-border/40 bg-card/50 hover:bg-accent/30 transition-colors"
                            >
                              {/* Street View thumbnail */}
                              <div
                                className="h-40 w-full bg-muted cursor-pointer relative group"
                                onClick={() => setMapClickCoords({ lat: place.lat, lng: place.lng })}
                              >
                                <StreetViewImage
                                  lat={place.lat}
                                  lng={place.lng}
                                  alt={`Street View: ${place.name}`}
                                  className="w-full h-full object-cover"
                                />

                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                              </div>
                              {/* Place info */}
                              <button
                                onClick={() => {
                                  setDestination(place.name);
                                  setDestinationCoords({ lat: place.lat, lng: place.lng });
                                  pendingDestCoordsRef.current = { lat: place.lat, lng: place.lng, name: place.name };
                                  setDestinationPreview({
                                    name: place.name,
                                    address: place.name,
                                    lat: place.lat,
                                    lng: place.lng,
                                  });
                                  setViewState("preview");
                                  setSearchStep(null);
                                  setSearchFocused(false);
                                  setTimeout(() => {
                                    mapHandleRef.current?.flyToLocation(place.lng, place.lat, 16);
                                  }, 100);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                              >
                                <MapPin className="h-4 w-4 text-primary shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{place.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(place.date).toLocaleDateString("sv-SE")}
                                  </p>
                                </div>
                                <span className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white text-lg font-extrabold whitespace-nowrap shrink-0 mx-[24px] my-0 mr-0 pr-[8px] ml-[24px] pb-[12px] pl-[13px]">
                                  Kör hit
                                  <Navigation className="h-5 w-5" />
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
              </div>

              {/* Bottom action */}
              {destination && (
                <div className="px-4 py-4 border-t border-border/30">
                  <Button
                    onClick={() => setSearchStep("filters")}
                    className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-2xl text-base shadow-lg shadow-primary/20"
                  >
                    Nästa – Anpassa rutt
                    <ChevronDown className="h-4 w-4 ml-2 rotate-[-90deg]" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Full-screen FILTERS page */}
          {searchStep === "filters" && (
            <div className="absolute inset-0 z-30 bg-card flex flex-col overflow-y-auto">
              <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/50">
                <button onClick={() => setSearchStep("search")} className="p-1.5 rounded-lg hover:bg-accent">
                  <ArrowLeft className="h-5 w-5 text-foreground" />
                </button>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-foreground">Anpassa rutt</span>
                  <p className="text-xs text-muted-foreground truncate">
                    {start || "Min position"} → {destination}
                  </p>
                </div>
              </div>

              <div className="flex-1 px-4 py-4 space-y-4">
                {/* Tur & retur */}
                <button
                  onClick={() => setIsRoundTrip(!isRoundTrip)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isRoundTrip
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Repeat className="h-3.5 w-3.5" />
                  Tur & retur
                </button>

                {/* Waypoints */}
                {waypoints.map((wp, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(i));
                      (e.currentTarget as HTMLElement).style.opacity = "0.4";
                    }}
                    onDragEnd={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = "1";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIdx = Number(e.dataTransfer.getData("text/plain"));
                      if (fromIdx === i) return;
                      const reordered = [...waypoints];
                      const [moved] = reordered.splice(fromIdx, 1);
                      reordered.splice(i, 0, moved);
                      setWaypoints(reordered);
                    }}
                    className="space-y-1 cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                      <AddressAutocomplete
                        value={wp.address}
                        onChange={(val) => {
                          const n = [...waypoints];
                          n[i] = { ...n[i], address: val };
                          setWaypoints(n);
                        }}
                        placeholder={`Stopp ${i + 1}`}
                        className="h-9 text-sm"
                        biasLat={userPosition?.lat}
                        biasLng={userPosition?.lng}
                      />

                      <button
                        onClick={() => setWaypoints(waypoints.filter((_, j) => j !== i))}
                        className="p-1 hover:bg-accent rounded"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="ml-9 flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <input
                        type="number"
                        min={0}
                        value={wp.stopMinutes}
                        onChange={(e) => {
                          const n = [...waypoints];
                          n[i] = { ...n[i], stopMinutes: Number(e.target.value) };
                          setWaypoints(n);
                        }}
                        className="w-16 h-7 rounded-md border border-input bg-background px-2 text-xs text-center"
                      />

                      <span className="text-[10px] text-muted-foreground">min lasttid</span>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setWaypoints([...waypoints, { address: "", stopMinutes: 30 }])}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Lägg till stopp
                </button>

                {/* Vehicle & Load */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Fordon</Label>
                    <Select value={vehicleId} onValueChange={setVehicleId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Välj" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockVehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.brand} {v.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Last (kg)</Label>
                    <Input
                      type="number"
                      value={loadWeight}
                      onChange={(e) => setLoadWeight(e.target.value)}
                      placeholder="0"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Departure time */}
                <div>
                  <Label className="text-[10px] text-muted-foreground">Avgångstid</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {(() => {
                      const d = new Date(departureTime);
                      const dayName = d.toLocaleDateString("sv-SE", { weekday: "long" });
                      const dateStr = d.toLocaleDateString("sv-SE", { day: "numeric", month: "long" });
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <span className={isWeekend ? "text-amber-500 font-medium" : ""}>
                          {dayName} {dateStr} {isWeekend && "(helg – annan trafik)"}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Route type */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setRouteType("normal")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${routeType === "normal" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    Normal (9h)
                  </button>
                  <button
                    onClick={() => setRouteType("fastest")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${routeType === "fastest" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
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
                      onChange={(e) => setUsedDriveHours(Number(e.target.value))}
                      className="flex-1 h-2 accent-primary"
                    />

                    <span className="text-sm font-bold text-foreground min-w-[3rem] text-right">{usedDriveHours}h</span>
                  </div>
                  {usedDriveHours > 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      ⏱ {routeType === "fastest" ? 10 - usedDriveHours : 9 - usedDriveHours}h körtid kvar idag
                    </p>
                  )}
                </div>

                {/* Rest stop facility filters */}
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Krav på rastplatser
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: "toilet" as const, icon: "🚻", label: "Toalett" },
                      { key: "food" as const, icon: "🍽️", label: "Mat" },
                      { key: "shower" as const, icon: "🚿", label: "Dusch" },
                      { key: "fuel" as const, icon: "⛽", label: "Drivmedel" },
                      { key: "truckParking" as const, icon: "🅿️", label: "Lastbilsp." },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setRestStopFilters((prev) => ({ ...prev, [f.key]: !prev[f.key] }))}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors border ${
                          restStopFilters[f.key]
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-accent"
                        }`}
                      >
                        <span>{f.icon}</span>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {Object.values(restStopFilters).some(Boolean) && (
                    <p className="text-[10px] text-muted-foreground">Bara rastplatser med valda faciliteter visas</p>
                  )}
                </div>

                {/* BK status */}
                {bkResults.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {bkResults.map((r) => (
                      <Badge key={r.bk} className={`${statusColor(r.status)} text-[10px] px-1.5 py-0`}>
                        {r.bk} {r.status === "green" ? "✓" : r.status === "yellow" ? "⚠" : "✗"}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Search button */}
              <div className="px-4 pb-4 pt-2 border-t border-border/50">
                <Button
                  onClick={() => {
                    setSearchStep(null);
                    setSearchFocused(false);
                    handleSearch();
                  }}
                  disabled={isLoading || !destination}
                  className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-xl text-base"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Beräknar rutt...
                    </>
                  ) : (
                    <>
                      <Route className="h-4 w-4 mr-2" /> Sök rutt
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Map search pill + back button */}
          {!searchStep && (
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center gap-2 pointer-events-none">
              <button
                onClick={() => navigate('/')}
                className="pointer-events-auto p-2.5 bg-card/90 backdrop-blur-lg rounded-full shadow-lg border border-border/50 hover:bg-card transition-all active:scale-[0.97]"
                aria-label="Tillbaka till startsidan"
              >
                <ArrowLeft className="h-4 w-4 text-foreground" />
              </button>
              <button
                onClick={() => setSearchStep("search")}
                className="pointer-events-auto flex-1 flex items-center gap-2.5 bg-card/90 backdrop-blur-lg rounded-full shadow-lg border border-border/50 px-4 py-2.5 hover:bg-card hover:shadow-xl transition-all active:scale-[0.97]"
              >
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className={`text-sm truncate ${destination ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {destination || 'Sök destination...'}
                </span>
              </button>
            </div>
          )}

          {/* Quick actions + Trip history - bottom (hidden during fullscreen search) */}
          {!searchStep && (
            <div className="absolute bottom-0 left-0 right-0 z-20">
              <div className="max-w-lg mx-auto">
                {/* GPS button */}
                <div className="flex gap-2 px-4 mb-2">
                  {userPosition && (
                    <button
                      onClick={() => {
                        if (isZoomedToUser) {
                          // Zoom out to overview
                          const map = mapHandleRef.current?.getMap();
                          if (map) {
                            (map as any).flyTo({ zoom: 6, duration: 800 });
                          }
                          setIsZoomedToUser(false);
                        } else {
                          // Zoom in to user position
                          mapHandleRef.current?.centerOnUser();
                          setIsZoomedToUser(true);
                        }
                      }}
                      className={`bg-card shadow-lg rounded-full p-3 hover:bg-accent transition-colors border ${isZoomedToUser ? 'border-primary bg-primary/10' : 'border-border'}`}
                    >
                      <Locate className={`h-5 w-5 ${isZoomedToUser ? 'text-primary' : 'text-muted-foreground'}`} />
                    </button>
                  )}
                </div>

                {/* Saved trips panel */}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== PREVIEW VIEW ===== */}
      {viewState === "preview" && destinationPreview && (
        <>
          {/* Transparent map click layer to dismiss preview */}
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={() => {
              if (userPosition) {
                mapHandleRef.current?.flyToLocation(userPosition.lng, userPosition.lat, 8);
              } else {
                const map = mapHandleRef.current?.getMap();
                if (map) (map as any).flyTo({ zoom: 6, duration: 800 });
              }
            }}
          />

          {/* Back button */}
          <div className="absolute top-3 left-3 z-20">
            <button
              onClick={() => {
                if (userPosition) {
                  mapHandleRef.current?.flyToLocation(userPosition.lng, userPosition.lat, 8);
                } else {
                  const map = mapHandleRef.current?.getMap();
                  if (map) (map as any).flyTo({ zoom: 6, duration: 800 });
                }
              }}
              className="p-2.5 bg-card/90 backdrop-blur-lg rounded-full shadow-lg border border-border/50 hover:bg-card transition-all"
            >
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
          </div>

          {/* Bottom destination card - Google Maps style */}
          <div className="absolute bottom-4 left-3 right-3 z-20 max-w-lg mx-auto">
            <div className="bg-card rounded-2xl shadow-xl overflow-hidden">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-8 h-1 rounded-full bg-muted-foreground/25" />
              </div>

              <div className="px-5 pb-5">
                {/* Title row: name + action icons */}
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-xl font-semibold text-foreground leading-tight pr-3 truncate">
                    {destinationPreview.name}
                  </h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setViewState("search");
                        setSearchStep(null);
                        setDestinationPreview(null);
                        setDestination("");
                        setDestinationCoords(null);
                        pendingDestCoordsRef.current = null;
                        if (previewMarkerRef.current) {
                          previewMarkerRef.current.remove();
                          previewMarkerRef.current = null;
                        }
                        if (userPosition) {
                          setTimeout(() => mapHandleRef.current?.flyToLocation(userPosition.lng, userPosition.lat, 8), 100);
                        }
                      }}
                      className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
                      title="Stäng"
                    >
                      <X className="h-5 w-5 text-foreground" />
                    </button>
                  </div>
                </div>

                {/* Subtitle: time + distance */}
                {userPosition && (
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 shrink-0" />
                    {(() => {
                      const dist = haversineKm(userPosition.lat, userPosition.lng, destinationPreview.lat, destinationPreview.lng);
                      // Estimate road distance (~1.3x haversine) and drive time at ~70 km/h avg
                      const roadDist = dist * 1.3;
                      const pureDriveMinutes = Math.round((roadDist / 70) * 60);
                      // Add EU rest breaks: 45 min rest every 4h20min (4.5h - 10min safety margin)
                      const maxDriveBlock = 260; // 4h20min in minutes
                      const restBreakMin = 45;
                      const numBreaks = Math.floor(pureDriveMinutes / maxDriveBlock);
                      const totalRestMin = numBreaks * restBreakMin;
                      // Add overnight rest (11h) if total drive exceeds ~9h
                      const maxDailyDrive = 540; // 9h in minutes
                      const overnightMin = 660; // 11h
                      const overnights = pureDriveMinutes > maxDailyDrive ? Math.floor(pureDriveMinutes / maxDailyDrive) : 0;
                      const totalMin = pureDriveMinutes + totalRestMin + (overnights * overnightMin);
                      const timeStr = totalMin < 60 ? `~${totalMin} min` : `~${Math.floor(totalMin / 60)}h ${totalMin % 60}min`;
                      const arrival = new Date(Date.now() + totalMin * 60000);
                      const arrivalStr = arrival.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                      const arrivalDay = arrival.toLocaleDateString('sv-SE', { weekday: 'short' });
                      const todayDay = new Date().toLocaleDateString('sv-SE', { weekday: 'short' });
                      const dayLabel = arrivalDay !== todayDay ? ` ${arrivalDay}` : '';
                      return `${timeStr} · Ank.${dayLabel} ${arrivalStr}`;
                    })()}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mb-4">
                  {userPosition
                    ? (() => {
                        const dist = haversineKm(userPosition.lat, userPosition.lng, destinationPreview.lat, destinationPreview.lng);
                        return dist < 1 ? `${Math.round(dist * 1000)} m` : `${Math.round(dist)} km`;
                      })()
                    : destinationPreview.address}
                </div>

                {/* Action buttons - horizontal pills */}
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  <button
                    onClick={() => {
                      setDestination(destinationPreview.name);
                      pendingDestCoordsRef.current = {
                        lat: destinationPreview.lat,
                        lng: destinationPreview.lng,
                        name: destinationPreview.name,
                      };
                      setDestinationPreview(null);
                      setSearchStep("filters");
                      setViewState("search");
                    }}
                    className="shrink-0 h-10 px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-full text-sm flex items-center gap-2 shadow-md transition-all"
                  >
                    <Navigation className="h-4 w-4" />
                    Kör hit
                  </button>
                  <button
                    onClick={() => {
                      setViewState("search");
                      setSearchStep("search");
                      setDestinationPreview(null);
                      setDestination("");
                      setDestinationCoords(null);
                      pendingDestCoordsRef.current = null;
                    }}
                    className="shrink-0 h-10 px-4 bg-accent hover:bg-accent/80 text-accent-foreground font-medium rounded-full text-sm flex items-center gap-2 transition-colors"
                  >
                    <Search className="h-4 w-4" />
                    Ändra
                  </button>
                  <button
                    onClick={() => handleSave()}
                    className="shrink-0 h-10 px-4 bg-accent hover:bg-accent/80 text-accent-foreground font-medium rounded-full text-sm flex items-center gap-2 transition-colors"
                  >
                    <Bookmark className="h-4 w-4" />
                    Spara
                  </button>
                </div>

                {/* Street View thumbnail */}
                <div className="mt-4 rounded-xl overflow-hidden">
                  <div
                    className="h-36 w-full bg-muted cursor-pointer relative group"
                    onClick={() => setMapClickCoords({ lat: destinationPreview.lat, lng: destinationPreview.lng })}
                  >
                    <StreetViewImage
                      lat={destinationPreview.lat}
                      lng={destinationPreview.lng}
                      alt={`Street View: ${destinationPreview.name}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {viewState === "details" && routeResult && (
        <>
          {/* Top bar - compact pill OR expanded panel */}
          <div className="absolute top-3 left-3 right-3 z-20 max-w-xl mx-auto">
            {!detailsExpanded ? (
              /* ── COMPACT PILL ── */
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  className="shrink-0 p-2.5 bg-card/90 backdrop-blur-lg rounded-full shadow-lg border border-border/50 hover:bg-card transition-all"
                >
                  <ArrowLeft className="h-4 w-4 text-foreground" />
                </button>

                <button
                  onClick={() => setDetailsExpanded(true)}
                  className="flex-1 flex items-center gap-3 bg-card/90 backdrop-blur-lg rounded-full shadow-lg border border-border/50 pl-4 pr-2 py-2 hover:bg-card transition-all active:scale-[0.98] min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{destination}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-muted-foreground font-medium">
                      {routeResult.travelTimeSeconds >= 3600
                        ? `${Math.floor(routeResult.travelTimeSeconds / 3600)}h ${Math.round((routeResult.travelTimeSeconds % 3600) / 60)}min`
                        : `${Math.round(routeResult.travelTimeSeconds / 60)} min`}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{routeResult.distanceKm} km</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 ml-1" />
                  </div>
                </button>

                <button
                  onClick={handleStartNavigation}
                  className="shrink-0 p-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-full shadow-lg transition-colors"
                >
                  <Navigation className="h-4 w-4 text-white" />
                </button>
              </div>
            ) : (
              /* ── EXPANDED PANEL ── */
              <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-xl border border-border/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Address rows */}
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-stretch gap-2">
                    <button
                      onClick={() => setDetailsExpanded(false)}
                      className="shrink-0 self-center p-2 hover:bg-accent rounded-xl transition-colors"
                    >
                      <ChevronUp className="h-5 w-5 text-foreground" />
                    </button>

                    <div className="flex-1 min-w-0 flex flex-col gap-1.5 relative">
                      <div className="absolute left-[7px] top-[14px] bottom-[14px] w-[2px] bg-border z-0" />
                      <button
                        onClick={() => {
                          setViewState("search");
                          setSearchStep("search");
                          setDetailsExpanded(false);
                        }}
                        className="flex items-center gap-2.5 bg-muted/60 hover:bg-muted rounded-lg px-3 py-2 transition-colors text-left relative z-10"
                      >
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-emerald-600/30 shrink-0" />
                        <span className="truncate text-sm text-foreground">{start || "Min position"}</span>
                      </button>
                      <button
                        onClick={() => {
                          setViewState("search");
                          setSearchStep("search");
                          setDetailsExpanded(false);
                        }}
                        className="flex items-center gap-2.5 bg-muted/60 hover:bg-muted rounded-lg px-3 py-2 transition-colors text-left relative z-10"
                      >
                        <div className="w-3.5 h-3.5 rounded-full bg-destructive border-2 border-destructive/30 shrink-0" />
                        <span className="truncate text-sm text-foreground">{destination}</span>
                      </button>
                    </div>

                    <div className="shrink-0 flex flex-col items-center justify-between py-0.5">
                      <button
                        onClick={() => {
                          const tmpStart = start;
                          const tmpDest = destination;
                          setStart(tmpDest);
                          setDestination(tmpStart);
                        }}
                        className="p-2 hover:bg-accent rounded-xl transition-colors"
                        title="Byt position och destination"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m21 16-4 4-4-4" stroke="hsl(var(--primary))" />
                          <path d="M17 20V4" stroke="hsl(var(--primary))" />
                          <path d="m3 8 4-4 4 4" stroke="hsl(var(--muted-foreground))" />
                          <path d="M7 4v16" stroke="hsl(var(--muted-foreground))" />
                        </svg>
                      </button>
                      <button
                        onClick={handleStartNavigation}
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-colors shadow-md"
                      >
                        <Navigation className="h-5 w-5 text-white" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setViewState("search");
                      setSearchStep("filters");
                      setDetailsExpanded(false);
                    }}
                    className="flex items-center gap-1.5 ml-11 mt-1 px-2 py-1 rounded-md text-xs text-muted-foreground/70 hover:text-muted-foreground hover:bg-accent/40 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Lägg till stopp
                  </button>
                </div>

                {/* Filter curtain toggle */}
                <button
                  onClick={() => setShowFilterCurtain(!showFilterCurtain)}
                  className="w-full flex items-center justify-center py-1 hover:bg-muted/40 transition-colors border-t border-border/30"
                >
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground/60 transition-transform duration-300 ${showFilterCurtain ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Filter curtain */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${showFilterCurtain ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}
                >
                  <div className="border-t border-border/30 bg-card px-4 py-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsRoundTrip(!isRoundTrip)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          isRoundTrip
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        <Repeat className="h-3.5 w-3.5" />
                        Tur & retur
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Fordon</Label>
                        <Select value={vehicleId} onValueChange={setVehicleId}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Välj" />
                          </SelectTrigger>
                          <SelectContent>
                            {mockVehicles.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.brand} {v.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Last (kg)</Label>
                        <Input
                          type="number"
                          value={loadWeight}
                          onChange={(e) => setLoadWeight(e.target.value)}
                          placeholder="0"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRouteType("normal")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${routeType === "normal" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        Normal (9h)
                      </button>
                      <button
                        onClick={() => setRouteType("fastest")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${routeType === "fastest" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        Snabbast (10h)
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: "toilet" as const, icon: "🚻", label: "Toalett" },
                        { key: "food" as const, icon: "🍽️", label: "Mat" },
                        { key: "shower" as const, icon: "🚿", label: "Dusch" },
                        { key: "fuel" as const, icon: "⛽", label: "Drivmedel" },
                        { key: "truckParking" as const, icon: "🅿️", label: "Lastbilsp." },
                      ].map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setRestStopFilters((prev) => ({ ...prev, [f.key]: !prev[f.key] }))}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors border ${
                            restStopFilters[f.key]
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border hover:bg-accent"
                          }`}
                        >
                          <span>{f.icon}</span>
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={() => {
                        setShowFilterCurtain(false);
                        setDetailsExpanded(false);
                        handleSearch();
                      }}
                      disabled={isLoading}
                      size="sm"
                      className="w-full bg-primary text-primary-foreground font-semibold rounded-lg"
                    >
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Route className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Beräkna om rutt
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating restore button when bottom sheet is hidden */}
          {!showBottomSheet && (
            <div className="absolute bottom-4 right-4 z-20">
              <Button onClick={() => setShowBottomSheet(true)} className="rounded-full shadow-lg px-4 py-2 gap-2">
                <ChevronUp className="h-4 w-4" />
                Visa resplan
              </Button>
            </div>
          )}

          {/* Bottom sheet - compact by default */}
          {showBottomSheet && (
            <div
              className={`absolute z-20 transition-all duration-300 ${fullscreenResplan ? 'inset-0' : 'bottom-4 left-3 right-3'}`}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  if (fullscreenResplan) {
                    setFullscreenResplan(false);
                  } else {
                    dismissPanels();
                  }
                }
              }}
            >
              <div ref={bottomSheetRef} className={`transition-all duration-300 ${fullscreenResplan ? 'h-full' : 'max-w-lg mx-auto'}`}>
                <div
                  className={`bg-card overflow-hidden transition-all duration-300 ${fullscreenResplan ? 'h-full rounded-none flex flex-col shadow-2xl' : `rounded-2xl shadow-xl ${bottomSheetTab !== 'overview' ? "max-h-[70vh] flex flex-col" : ""}`}`}
                >
                  {/* Google Maps drag handle */}
                  <div className="flex justify-center pt-3 pb-1 cursor-grab">
                    <div className="w-8 h-1 rounded-full bg-muted-foreground/25" />
                  </div>

                  {/* Route alternatives pills - Google Maps style */}
                  {alternativeRoutes.length > 0 && bottomSheetTab === "overview" && (
                    <div className="px-4 pb-2">
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        <button className="shrink-0 rounded-full px-3 py-1 text-xs font-medium bg-primary text-primary-foreground">
                          {Math.floor(routeResult.travelTimeSeconds / 3600)}h {Math.round((routeResult.travelTimeSeconds % 3600) / 60)}min
                        </button>
                        {alternativeRoutes.map((alt, i) => {
                          const diffMin = Math.round((alt.travelTimeSeconds - routeResult.travelTimeSeconds) / 60);
                          return (
                            <button
                              key={i}
                              onClick={() => handleSwitchRoute(i + 1)}
                              className="shrink-0 rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-accent transition-colors"
                            >
                              {Math.floor(alt.travelTimeSeconds / 3600)}h {Math.round((alt.travelTimeSeconds % 3600) / 60)}min
                              {diffMin > 0 && <span className="text-destructive ml-1">+{diffMin}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Main content area - Google Maps style */}
                  {bottomSheetTab === "overview" && (
                    <div className="px-5 pb-5">
                      {/* Title row: destination name + action icons */}
                      <div className="flex items-start justify-between mb-1">
                        <h2 className="text-xl font-semibold text-foreground leading-tight pr-3">
                          {destination || "Destination"}
                        </h2>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleSave()}
                            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
                            title="Spara"
                          >
                            <Bookmark className="h-5 w-5 text-foreground" />
                          </button>
                          <button
                            onClick={() => setShowBottomSheet(false)}
                            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
                            title="Stäng"
                          >
                            <X className="h-5 w-5 text-foreground" />
                          </button>
                        </div>
                      </div>

                      {/* Subtitle: arrival + distance */}
                      <div className="text-sm text-muted-foreground mb-1">
                        {(() => {
                          // Use timeline end time (includes EU rests) for real arrival
                          const allTimelines = trips.length > 0 ? trips : [{ timeline }];
                          const lastTl = allTimelines[allTimelines.length - 1]?.timeline;
                          const lastEntry = lastTl?.[lastTl.length - 1];
                          const arr = lastEntry
                            ? new Date(lastEntry.endTime)
                            : new Date(new Date(departureTime).getTime() + routeResult.travelTimeSeconds * 1000);
                          const dayName = arr.toLocaleDateString("sv-SE", { weekday: "long" });
                          const timeStr = arr.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
                          return `${dayName} ${timeStr}`;
                        })()}
                      </div>
                      <div className="text-sm text-muted-foreground mb-4">
                        {trips.length > 1 ? combinedDistanceKm : routeResult.distanceKm} km
                        {trips.length > 1
                          ? ` · ${combinedTimeH}h ${combinedTimeMin}min`
                          : ` · ${totalDriveTimeH}h ${totalDriveTimeMin}min`}
                        {allRestCount > 0 && ` · ${allRestCount} ${allRestCount === 1 ? "paus" : "pauser"}`}
                      </div>

                      {usedDriveHours > 0 && (
                        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mb-3">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{usedDriveHours}h redan körd – {routeType === "fastest" ? 10 - usedDriveHours : 9 - usedDriveHours}h kvar</span>
                        </div>
                      )}

                      {/* Action buttons - horizontal pills like Google Maps */}
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        <button
                          onClick={handleStartNavigation}
                          className="shrink-0 h-10 px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-full text-sm flex items-center gap-2 shadow-md transition-all"
                        >
                          <Navigation className="h-4 w-4" />
                          Starta
                        </button>
                        <button
                          onClick={() => setBottomSheetTab("streetview")}
                          className="shrink-0 h-10 px-4 bg-accent hover:bg-accent/80 text-accent-foreground font-medium rounded-full text-sm flex items-center gap-2 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          Gatuvy
                        </button>
                        <button
                          onClick={() => setBottomSheetTab("resplan")}
                          className="shrink-0 h-10 px-4 bg-accent hover:bg-accent/80 text-accent-foreground font-medium rounded-full text-sm flex items-center gap-2 transition-colors"
                        >
                          <Route className="h-4 w-4" />
                          Körschema
                        </button>
                        <button
                          onClick={() => handleSave()}
                          className="shrink-0 h-10 px-4 bg-accent hover:bg-accent/80 text-accent-foreground font-medium rounded-full text-sm flex items-center gap-2 transition-colors"
                        >
                          <Save className="h-4 w-4" />
                          Spara
                        </button>
                      </div>

                      {/* Street View preview thumbnail */}
                      {destinationCoords && (
                        <div className="mt-4">
                          <button
                            onClick={() => setBottomSheetTab("streetview")}
                            className="w-full rounded-xl overflow-hidden relative group"
                          >
                            <StreetViewPanorama
                              lat={destinationCoords.lat}
                              lng={destinationCoords.lng}
                              className="w-full h-[160px]"
                              showExpandButton={false}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Street View tab */}
                  {bottomSheetTab === "streetview" && (
                    <div className="flex-1 min-h-0 flex flex-col">
                      {/* Back header */}
                      <div className="px-4 py-2.5 flex items-center gap-3 border-b border-border">
                        <button
                          onClick={() => setBottomSheetTab("overview")}
                          className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
                        >
                          <ArrowLeft className="h-4 w-4 text-foreground" />
                        </button>
                        <span className="text-sm font-semibold text-foreground">Gatuvy – {destination || "Destination"}</span>
                      </div>
                      {destinationCoords ? (
                        <div className="flex-1 min-h-[50vh]">
                          <StreetViewPanorama
                            lat={destinationCoords.lat}
                            lng={destinationCoords.lng}
                            className="w-full h-full"
                            showExpandButton={true}
                            label={destination || "Destination"}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                          <div className="text-center">
                            <Eye className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            <p>Ingen gatuvy tillgänglig</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resplan (Steps) tab */}
                  {bottomSheetTab === "resplan" && (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                      {/* Back header */}
                      <div className="px-4 py-2.5 flex items-center justify-between border-b border-border">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setBottomSheetTab("overview")}
                            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
                          >
                            <ArrowLeft className="h-4 w-4 text-foreground" />
                          </button>
                          <div>
                            <div className="text-sm font-semibold text-foreground">Körschema</div>
                            <div className="text-[11px] text-muted-foreground">
                              {trips.length > 1
                                ? `${combinedDistanceKm} km · ${combinedTimeH}h ${combinedTimeMin}min`
                                : `${routeResult.distanceKm} km · ${totalDriveTimeH}h ${totalDriveTimeMin}min`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setFullscreenResplan(!fullscreenResplan)}
                          className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
                          title={fullscreenResplan ? 'Minimera' : 'Helskärm'}
                        >
                          {fullscreenResplan ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                          )}
                        </button>
                      </div>

                      <div
                        className="overflow-y-auto flex-1"
                        style={{ maxHeight: fullscreenResplan ? "calc(100vh - 120px)" : "calc(65vh - 80px)" }}
                        ref={timelineScrollRef}
                      >
                        <div className="py-2">
                          {/* EU pause info - compact */}
                          <div className="mx-4 mb-3 rounded-xl bg-muted/50 px-3 py-2">
                            <div className="text-[11px] text-muted-foreground leading-relaxed">
                              <span className="font-semibold text-foreground">Pauser:</span>{" "}
                              45 min rast efter 4,5h · max {routeType === "fastest" ? "10" : "9"}h/dag · 11h dygnsvila
                            </div>
                          </div>

                          {/* Timeline entries - Google Maps step style */}
                          {displayTrips.map((leg, legIdx) => {
                            const firstEntry = leg.timeline[0];
                            const lastEntry = leg.timeline[leg.timeline.length - 1];
                            const totalTripMs = lastEntry
                              ? new Date(lastEntry.endTime).getTime() - new Date(firstEntry.startTime).getTime()
                              : 0;
                            const totalTripH = Math.floor(totalTripMs / 3600000);
                            const totalTripMin = Math.round((totalTripMs % 3600000) / 60000);

                            return (
                              <div key={leg.id}>
                                {displayTrips.length > 1 && (
                                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                                    <div
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ background: LEG_COLORS[legIdx % LEG_COLORS.length] }}
                                    />
                                    <span className="text-xs font-bold text-foreground">Tur {legIdx + 1}</span>
                                  </div>
                                )}

                                {leg.timeline.map((entry, i) => {
                                  const startT = new Date(entry.startTime);
                                  const endT = new Date(entry.endTime);
                                  const timeStr = startT.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
                                  const endStr = endT.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
                                  const entryDate = startT.toLocaleDateString("sv-SE");
                                  const prevDate = i > 0 ? new Date(leg.timeline[i - 1].startTime).toLocaleDateString("sv-SE") : null;
                                  const showDayHeader = i === 0 || entryDate !== prevDate;

                                  const getLabel = () => {
                                    if (entry.type === "drive") {
                                      const h = Math.floor(entry.durationMinutes / 60);
                                      const m = entry.durationMinutes % 60;
                                      return `Kör ${h > 0 ? `${h}h ` : ""}${m}min`;
                                    }
                                    if (entry.type === "rest") return "Rast – 45 min";
                                    if (entry.type === "overnight") return "Dygnsvila – 11h";
                                    if (entry.type === "stop") return entry.location || "Mellanstation";
                                    if (entry.type === "arrival") return "Framme";
                                    return entry.label;
                                  };

                                  const getDotColor = () => {
                                    if (entry.type === "drive") return "bg-primary";
                                    if (entry.type === "rest") return "bg-amber-400";
                                    if (entry.type === "overnight") return "bg-indigo-500";
                                    if (entry.type === "stop") return "bg-orange-400";
                                    if (entry.type === "arrival") return "bg-emerald-500";
                                    return "bg-muted-foreground";
                                  };

                                  const isLast = i === leg.timeline.length - 1;

                                  return (
                                    <div key={`${legIdx}-${i}`}>
                                      {showDayHeader && (
                                        <div className="px-4 pt-3 pb-1">
                                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                            {startT.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short" })}
                                          </span>
                                        </div>
                                      )}
                                      <button
                                        onClick={() => handleTimelineEntryClick(entry, i)}
                                        draggable={entry.type === "stop"}
                                        onDragStart={
                                          entry.type === "stop"
                                            ? (e) => {
                                                const stopEntries = leg.timeline.filter((t) => t.type === "stop");
                                                const stopIdx = stopEntries.indexOf(entry);
                                                e.dataTransfer.effectAllowed = "move";
                                                e.dataTransfer.setData("text/plain", `stop:${stopIdx}`);
                                                setDraggingStopIdx(stopIdx);
                                              }
                                            : undefined
                                        }
                                        onDragEnd={entry.type === "stop" ? () => { setDraggingStopIdx(null); setDragOverStopIdx(null); } : undefined}
                                        onDragOver={
                                          entry.type === "stop"
                                            ? (e) => {
                                                e.preventDefault();
                                                const stopEntries = leg.timeline.filter((t) => t.type === "stop");
                                                const overIdx = stopEntries.indexOf(entry);
                                                if (overIdx !== dragOverStopIdx) setDragOverStopIdx(overIdx);
                                              }
                                            : undefined
                                        }
                                        onDrop={
                                          entry.type === "stop"
                                            ? (e) => {
                                                e.preventDefault();
                                                const data = e.dataTransfer.getData("text/plain");
                                                if (!data.startsWith("stop:")) return;
                                                const fromStopIdx = Number(data.split(":")[1]);
                                                const stopEntries = leg.timeline.filter((t) => t.type === "stop");
                                                const toStopIdx = stopEntries.indexOf(entry);
                                                setDraggingStopIdx(null); setDragOverStopIdx(null);
                                                if (fromStopIdx === toStopIdx) return;
                                                const reordered = [...waypoints];
                                                const [moved] = reordered.splice(fromStopIdx, 1);
                                                reordered.splice(toStopIdx, 0, moved);
                                                setWaypoints(reordered);
                                                setTimeout(() => handleSearch(), 100);
                                              }
                                            : undefined
                                        }
                                        className={`w-full text-left flex items-start gap-3 px-4 py-2 hover:bg-accent/40 transition-colors ${
                                          entry.type === "stop" ? "cursor-grab active:cursor-grabbing" : ""
                                        }`}
                                      >
                                        {/* Timeline dot + line */}
                                        <div className="flex flex-col items-center pt-1.5 shrink-0 w-4">
                                          <div className={`w-2.5 h-2.5 rounded-full ${getDotColor()} ${entry.type === "arrival" ? "ring-2 ring-emerald-200 dark:ring-emerald-800" : ""}`} />
                                          {!isLast && <div className="w-px flex-1 min-h-[20px] bg-border mt-1" />}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 pb-1">
                                          <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-sm font-medium text-foreground">{getLabel()}</span>
                                            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{timeStr}</span>
                                          </div>
                                          {entry.restStop && (
                                            <div className="text-xs text-primary mt-0.5 flex items-center gap-1">
                                              <MapPin className="h-3 w-3 shrink-0" />
                                              <span className="truncate">{entry.restStop.name}</span>
                                            </div>
                                          )}
                                          {entry.restStop?.facilities && Object.values(entry.restStop.facilities).some(Boolean) && (
                                            <div className="flex gap-1 mt-1 text-xs">
                                              {entry.restStop.facilities.toilet && <span>🚻</span>}
                                              {entry.restStop.facilities.food && <span>🍽️</span>}
                                              {entry.restStop.facilities.shower && <span>🚿</span>}
                                              {entry.restStop.facilities.fuel && <span>⛽</span>}
                                              {entry.restStop.facilities.truckParking && <span>🅿️</span>}
                                            </div>
                                          )}
                                          {entry.type === "arrival" && entry.location && (
                                            <div className="text-xs text-muted-foreground mt-0.5">{entry.location}</div>
                                          )}
                                          {entry.durationMinutes > 0 && entry.type !== "drive" && (
                                            <div className="text-[11px] text-muted-foreground mt-0.5">{timeStr} → {endStr}</div>
                                          )}
                                        </div>

                                        {entry.type === "stop" && (
                                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-1.5" />
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}

                                {(totalTripH > 0 || totalTripMin > 0) && (
                                  <div className="mx-4 my-2 px-3 py-2 bg-muted/40 rounded-lg flex items-center justify-between">
                                    <span className="text-[11px] text-muted-foreground">Total inkl. pauser</span>
                                    <span className="text-xs font-bold text-foreground">{totalTripH}h {totalTripMin}min</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {displayTrips.length > 1 && (
                            <div className="mx-4 my-2 px-3 py-2.5 bg-primary/10 rounded-lg flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">Totalt alla turer</span>
                              <span className="text-xs font-black text-primary">
                                {combinedDistanceKm} km · {combinedTimeH}h {combinedTimeMin}min
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedLocation && (
            <>
              {/* Invisible backdrop to dismiss location card */}
              <div className="absolute inset-0" style={{ zIndex: 25 }} onClick={() => setSelectedLocation(null)} />

              <div
                ref={locationCardRef}
                className="absolute left-4 right-4 z-30 max-w-sm mx-auto animate-in slide-in-from-bottom-4 fade-in duration-300"
                style={{ top: "50%", transform: "translateY(-50%)" }}
              >
                <div className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
                  {/* Header with colored bar */}
                  <div
                    className={`h-1.5 ${
                      selectedLocation.type === "rest"
                        ? "bg-amber-400"
                        : selectedLocation.type === "overnight"
                          ? "bg-indigo-500"
                          : selectedLocation.type === "stop"
                            ? "bg-orange-400"
                            : selectedLocation.type === "arrival"
                              ? "bg-emerald-500"
                              : "bg-primary"
                    }`}
                  />

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
                      <div
                        className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                          selectedLocation.type === "rest"
                            ? "bg-amber-100 dark:bg-amber-950"
                            : selectedLocation.type === "overnight"
                              ? "bg-indigo-100 dark:bg-indigo-950"
                              : selectedLocation.type === "stop"
                                ? "bg-orange-100 dark:bg-orange-950"
                                : selectedLocation.type === "arrival"
                                  ? "bg-emerald-100 dark:bg-emerald-950"
                                  : "bg-primary/10"
                        }`}
                      >
                        {selectedLocation.type === "rest"
                          ? "☕"
                          : selectedLocation.type === "overnight"
                            ? "🌙"
                            : selectedLocation.type === "stop"
                              ? "📦"
                              : selectedLocation.type === "arrival"
                                ? "🏁"
                                : "📍"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-foreground leading-tight">{selectedLocation.name}</h3>
                        {selectedLocation.category && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{selectedLocation.category}</p>
                        )}
                        {/* Vehicle suitability badge */}
                        {selectedLocation.suitability && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                selectedLocation.suitability === "perfect"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                                  : selectedLocation.suitability === "good"
                                    ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400"
                                    : selectedLocation.suitability === "warning"
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                              }`}
                            >
                              {selectedLocation.suitability === "perfect"
                                ? "✓ Perfekt"
                                : selectedLocation.suitability === "good"
                                  ? "👍 Bra"
                                  : selectedLocation.suitability === "warning"
                                    ? "⚠ Varning"
                                    : "✗ Olämplig"}
                            </span>
                          </div>
                        )}
                        {selectedLocation.suitabilityNote && (
                          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                            {selectedLocation.suitabilityNote}
                          </p>
                        )}
                        {/* Facility badges */}
                        {selectedLocation.facilities && Object.values(selectedLocation.facilities).some(Boolean) && (
                          <div className="mt-2 space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {selectedLocation.facilities.toilet && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">
                                  🚻 Toalett
                                </Badge>
                              )}
                              {selectedLocation.facilities.food && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">
                                  🍽️ Mat
                                </Badge>
                              )}
                              {selectedLocation.facilities.shower && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">
                                  🚿 Dusch
                                </Badge>
                              )}
                              {selectedLocation.facilities.fuel && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">
                                  ⛽ Drivmedel
                                </Badge>
                              )}
                              {selectedLocation.facilities.truckParking && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">
                                  🅿️ Lastbilsp.
                                </Badge>
                              )}
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
                            {new Date(selectedLocation.startTime).toLocaleTimeString("sv-SE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {selectedLocation.endTime &&
                              ` – ${new Date(selectedLocation.endTime).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`}
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
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Avstånd från rutt
                          </div>
                          <div className="text-xs font-medium mt-0.5">{selectedLocation.distance}</div>
                        </div>
                      )}
                      <div className="bg-muted/50 rounded-lg px-3 py-2">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Datum</div>
                        <div className="text-xs font-medium mt-0.5">
                          {selectedLocation.startTime
                            ? new Date(selectedLocation.startTime).toLocaleDateString("sv-SE", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })
                            : "–"}
                        </div>
                      </div>
                    </div>

                    {/* Coordinates */}
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          const loc = selectedLocation;
                          setSelectedLocation(null);
                          setDestination(loc.name);
                          setDestinationCoords({ lat: loc.lat, lng: loc.lng });
                          pendingDestCoordsRef.current = { lat: loc.lat, lng: loc.lng, name: loc.name };
                          handleSearch(loc.name);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-xl py-2 text-xs font-medium hover:opacity-90 transition-opacity"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Åk hit
                      </button>
                      <button
                        onClick={() => setMapClickCoords({ lat: selectedLocation.lat, lng: selectedLocation.lng })}
                        className="flex items-center justify-center gap-1.5 bg-muted rounded-xl px-4 py-2 text-xs font-medium hover:bg-accent transition-colors"
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
                      </button>
                    </div>

                    {/* Alternatives - swap rest stop */}
                    {selectedLocation.alternatives &&
                      selectedLocation.alternatives.length > 0 &&
                      (selectedLocation.type === "rest" || selectedLocation.type === "overnight") && (
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
                                  alt.suitability === "unsuitable"
                                    ? "bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50"
                                    : alt.suitability === "warning"
                                      ? "bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50"
                                      : "bg-muted/40 hover:bg-accent"
                                }`}
                              >
                                <div
                                  className={`shrink-0 w-2 h-2 rounded-full ${
                                    alt.suitability === "perfect"
                                      ? "bg-emerald-500"
                                      : alt.suitability === "good"
                                        ? "bg-sky-500"
                                        : alt.suitability === "warning"
                                          ? "bg-amber-500"
                                          : alt.suitability === "unsuitable"
                                            ? "bg-red-500"
                                            : "bg-muted-foreground"
                                  }`}
                                />
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
              <button
                onClick={() => mapHandleRef.current?.centerOnUser()}
                className="bg-card shadow-lg rounded-full p-3 hover:bg-accent border border-border"
              >
                <Locate className="h-5 w-5 text-primary" />
              </button>
            )}
          </div>
        </>
      )}

      {/* ===== NAVIGATION VIEW ===== */}
      {viewState === "navigating" && routeResult && (
        <>
          {/* Top HUD - Big & Clear */}
          <div className="absolute top-0 left-0 right-0 z-30">
            <div className="bg-foreground/95 backdrop-blur-md text-background px-5 pt-5 pb-4 shadow-2xl">
              <div className="max-w-lg mx-auto">
                {/* Distance - HUGE */}
                <div className="text-center mb-3">
                  <div className="text-6xl font-black tracking-tighter leading-none">{distanceToNext || "..."}</div>
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
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${userPosition ? "bg-emerald-400 animate-pulse" : "bg-destructive"}`}
                    />
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
