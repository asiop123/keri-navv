import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Clock, Plus, X, Route, AlertTriangle, Loader2, Save, History, ChevronLeft, ChevronRight, Navigation } from 'lucide-react';
import { mockVehicles, getVehicleById } from '@/data/mockData';
import { BK_LIMITS, BKClass, TimelineEntry } from '@/types';
import { toast } from 'sonner';
import { geocode, calculateRoute, generateTimeline, RouteResult } from '@/services/tomtom';
import { SavedTrip, getSavedTrips, saveTrip } from '@/services/tripStorage';
import TomTomMap from '@/components/TomTomMap';
import TripHistory from '@/components/TripHistory';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function RoutePlanning() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [loadWeight, setLoadWeight] = useState('');
  const [routeType, setRouteType] = useState<'normal' | 'fastest'>('normal');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);

  useEffect(() => {
    setSavedTrips(getSavedTrips());
  }, []);

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

  const timelineIcon = (type: TimelineEntry['type']) => {
    switch (type) {
      case 'drive': return '🚛';
      case 'rest': return '☕';
      case 'overnight': return '🌙';
      case 'stop': return '📦';
      case 'arrival': return '🏁';
    }
  };

  const timelineBg = (type: TimelineEntry['type']) => {
    switch (type) {
      case 'drive': return 'border-l-4 border-l-primary/60';
      case 'rest': return 'border-l-4 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20';
      case 'overnight': return 'border-l-4 border-l-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20';
      case 'stop': return 'border-l-4 border-l-orange-400 bg-orange-50/50 dark:bg-orange-950/20';
      case 'arrival': return 'border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20';
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsSaved(false);

    try {
      const [startCoord, endCoord, ...waypointCoords] = await Promise.all([
        geocode(start),
        geocode(end),
        ...waypoints.filter(w => w.trim()).map(w => geocode(w)),
      ]);

      const result = await calculateRoute(startCoord, endCoord, waypointCoords);
      
      toast.info('Söker rastplatser längs rutten...');
      const tl = await generateTimeline(result, routeType);

      setRouteResult(result);
      setTimeline(tl);

      const hours = Math.floor(result.travelTimeSeconds / 3600);
      const mins = Math.round((result.travelTimeSeconds % 3600) / 60);
      toast.success(`Rutt beräknad: ${result.distanceKm} km, ${hours}h ${mins}min`);
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
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      startName: routeResult.waypoints[0].name,
      endName: routeResult.waypoints[routeResult.waypoints.length - 1].name,
      waypointNames: routeResult.waypoints.slice(1, -1).map(w => w.name),
      distanceKm: routeResult.distanceKm,
      travelTimeSeconds: routeResult.travelTimeSeconds,
      totalWeightKg: totalWeight,
      vehicleId,
      vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.regNr})` : 'Okänt',
      routeType,
      timeline,
      route: routeResult,
    };
    saveTrip(trip);
    setSavedTrips(getSavedTrips());
    setIsSaved(true);
    toast.success('Resa sparad!');
  };

  const handleSelectTrip = (trip: SavedTrip) => {
    setRouteResult(trip.route);
    setTimeline(trip.timeline);
    setIsSaved(true);
    setVehicleId(trip.vehicleId);
    setActiveTab('form');
    toast.info(`Visar: ${trip.startName} → ${trip.endName}`);
  };

  const handleDeleteTrip = (id: string) => {
    setSavedTrips(prev => prev.filter(t => t.id !== id));
  };

  const totalDriveTimeH = routeResult
    ? Math.round((routeResult.travelTimeSeconds / 3600) * 10) / 10
    : 0;

  return (
    <div className="relative w-full -m-4 md:-m-6" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Full-screen map */}
      <TomTomMap route={routeResult} className="absolute inset-0 z-0" />

      {/* Panel toggle button */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="absolute top-4 z-20 bg-card shadow-lg rounded-r-lg p-2 hover:bg-accent transition-colors border border-l-0 border-border"
        style={{ left: panelOpen ? '400px' : '0px', transition: 'left 0.3s ease' }}
      >
        {panelOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </button>

      {/* Left panel - Google Maps style */}
      <div
        className="absolute top-0 left-0 bottom-0 z-10 bg-card shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 border-r border-border"
        style={{
          width: '400px',
          transform: panelOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Panel header */}
        <div className="shrink-0 p-4 border-b border-border bg-primary text-primary-foreground">
          <div className="flex items-center gap-2 mb-3">
            <Navigation className="h-5 w-5" />
            <h1 className="text-lg font-bold">Ruttplanering</h1>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('form')}
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'form'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'text-primary-foreground/60 hover:text-primary-foreground/80'
              }`}
            >
              <Route className="h-3.5 w-3.5 inline mr-1.5" />
              Planera
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'text-primary-foreground/60 hover:text-primary-foreground/80'
              }`}
            >
              <History className="h-3.5 w-3.5 inline mr-1.5" />
              Historik ({savedTrips.length})
            </button>
          </div>
        </div>

        {/* Panel content */}
        <ScrollArea className="flex-1">
          {activeTab === 'history' && (
            <div className="p-4">
              <TripHistory trips={savedTrips} onSelect={handleSelectTrip} onDelete={handleDeleteTrip} />
            </div>
          )}

          {activeTab === 'form' && (
            <div className="p-4 space-y-4">
              {/* Route form */}
              <form onSubmit={handleCreate} className="space-y-3">
                {/* Start/end inputs styled like Google Maps */}
                <div className="relative space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 shadow-sm" />
                    <Input
                      value={start}
                      onChange={e => setStart(e.target.value)}
                      placeholder="Startpunkt"
                      required
                      className="h-10 text-sm"
                    />
                  </div>

                  {waypoints.map((wp, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0 shadow-sm" />
                      <Input
                        value={wp}
                        onChange={e => {
                          const newWp = [...waypoints];
                          newWp[i] = e.target.value;
                          setWaypoints(newWp);
                        }}
                        placeholder={`Stopp ${i + 1}`}
                        className="h-10 text-sm"
                      />
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => setWaypoints(waypoints.filter((_, j) => j !== i))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 shrink-0 shadow-sm" />
                    <Input
                      value={end}
                      onChange={e => setEnd(e.target.value)}
                      placeholder="Slutdestination"
                      required
                      className="h-10 text-sm"
                    />
                  </div>
                </div>

                <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setWaypoints([...waypoints, ''])}>
                  <Plus className="h-3 w-3 mr-1" /> Lägg till stopp
                </Button>

                {/* Vehicle & weight */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Fordon</Label>
                    <Select value={vehicleId} onValueChange={setVehicleId}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Välj fordon" /></SelectTrigger>
                      <SelectContent>
                        {mockVehicles.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.brand} {v.model}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last (kg)</Label>
                    <Input type="number" value={loadWeight} onChange={e => setLoadWeight(e.target.value)} placeholder="20000" className="h-9 text-xs" required />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Rutttyp</Label>
                  <Select value={routeType} onValueChange={v => setRouteType(v as 'normal' | 'fastest')}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal (9h max)</SelectItem>
                      <SelectItem value="fastest">Snabbast (10h flex)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* BK status */}
                {selectedVehicle && loadWeight && (
                  <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Totalvikt</span>
                      <span className="font-bold">{totalWeight.toLocaleString()} kg</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {bkResults.map(r => (
                        <div key={r.bk} className="flex items-center justify-between px-2 py-1 rounded bg-card text-xs">
                          <span>{r.bk}</span>
                          <Badge className={`${statusColor(r.status)} text-[10px] px-1.5 py-0`}>
                            {r.status === 'green' ? 'OK' : r.status === 'yellow' ? 'Nära' : 'Ej OK'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {bkResults.some(r => r.status === 'red') && (
                      <div className="flex items-center gap-1.5 text-[11px] text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Överstiger BK-gränser</span>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={isLoading}
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold h-11"
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Beräknar...</>
                  ) : (
                    <><Route className="h-4 w-4 mr-2" /> Beräkna rutt</>
                  )}
                </Button>
              </form>

              {/* Route result summary */}
              {routeResult && (
                <>
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-primary" />
                        Resöversikt
                      </h2>
                      {!isSaved ? (
                        <Button size="sm" variant="outline" onClick={handleSave} className="text-xs h-7">
                          <Save className="h-3 w-3 mr-1" /> Spara
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">✓ Sparad</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-bold text-primary">{routeResult.distanceKm}</div>
                        <div className="text-[10px] text-muted-foreground">km</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-bold text-primary">{totalDriveTimeH}</div>
                        <div className="text-[10px] text-muted-foreground">timmar</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-bold text-primary">{timeline.filter(t => t.type === 'rest' || t.type === 'overnight').length}</div>
                        <div className="text-[10px] text-muted-foreground">raster</div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {routeResult.waypoints.map(w => w.name).join(' → ')}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="border-t border-border pt-4 space-y-2">
                    <h2 className="text-sm font-bold flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      Tidslinje
                    </h2>
                    <p className="text-[10px] text-muted-foreground">EU kör- och vilotider</p>

                    <div className="space-y-1">
                      {timeline.map((entry, i) => (
                        <div key={i} className={`rounded-md px-3 py-2 ${timelineBg(entry.type)}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{timelineIcon(entry.type)}</span>
                              <span className="text-xs font-medium">{entry.label}</span>
                            </div>
                            {entry.durationMinutes > 0 && (
                              <span className="text-[10px] text-muted-foreground font-medium">{entry.durationMinutes} min</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 ml-7">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(entry.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                              {' – '}
                              {new Date(entry.endTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {entry.location && (
                              <span className="text-[10px] text-muted-foreground">· {entry.location}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-lg bg-muted/40 p-2.5 mt-2">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">EU-regler:</p>
                      <ul className="text-[10px] text-muted-foreground space-y-0.5">
                        <li>• 4,5h körning → 45 min rast</li>
                        <li>• Max {routeType === 'fastest' ? '10h' : '9h'} körning/dag</li>
                        <li>• Dygnsvila: 11 timmar</li>
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
