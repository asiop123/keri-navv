import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Clock, Plus, X, Route, AlertTriangle, Loader2, Save, History } from 'lucide-react';
import { mockVehicles, getVehicleById } from '@/data/mockData';
import { BK_LIMITS, BKClass, TimelineEntry } from '@/types';
import { toast } from 'sonner';
import { geocode, calculateRoute, generateTimeline, RouteResult } from '@/services/tomtom';
import { SavedTrip, getSavedTrips, saveTrip } from '@/services/tripStorage';
import TomTomMap from '@/components/TomTomMap';
import TripHistory from '@/components/TripHistory';

export default function RoutePlanning() {
  const [showForm, setShowForm] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
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

      toast.info('Beräknar rutt via TomTom...');

      const result = await calculateRoute(startCoord, endCoord, waypointCoords);
      const tl = generateTimeline(result, routeType);

      setRouteResult(result);
      setTimeline(tl);
      setShowForm(false);
      setShowHistory(false);

      const hours = Math.floor(result.travelTimeSeconds / 3600);
      const mins = Math.round((result.travelTimeSeconds % 3600) / 60);
      toast.success(`Rutt beräknad: ${result.distanceKm} km, ${hours}h ${mins}min körtid`);
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
      vehicleId: vehicleId,
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
    setShowForm(false);
    setShowHistory(false);
    setIsSaved(true);
    setVehicleId(trip.vehicleId);
    toast.info(`Visar sparad resa: ${trip.startName} → ${trip.endName}`);
  };

  const handleDeleteTrip = (id: string) => {
    setSavedTrips(prev => prev.filter(t => t.id !== id));
  };

  const totalDriveTimeH = routeResult
    ? Math.round((routeResult.travelTimeSeconds / 3600) * 10) / 10
    : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Ruttplanering</h1>
          <p className="text-muted-foreground mt-1">Planera resor med kör- och vilotider</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) setShowForm(false); }}
            className="font-semibold"
          >
            <History className="h-4 w-4 mr-2" />
            Historik ({savedTrips.length})
          </Button>
          <Button
            onClick={() => { setShowForm(!showForm); if (!showForm) setShowHistory(false); }}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ny resa
          </Button>
        </div>
      </div>

      {showHistory && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Sparade resor
          </h2>
          <TripHistory trips={savedTrips} onSelect={handleSelectTrip} onDelete={handleDeleteTrip} />
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Skapa ny resa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Startpunkt *</Label>
                  <Input value={start} onChange={e => setStart(e.target.value)} placeholder="Stockholm" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Slutdestination *</Label>
                  <Input value={end} onChange={e => setEnd(e.target.value)} placeholder="Göteborg" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mellanstopp</Label>
                {waypoints.map((wp, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={wp} onChange={e => {
                      const newWp = [...waypoints];
                      newWp[i] = e.target.value;
                      setWaypoints(newWp);
                    }} placeholder={`Stopp ${i + 1}`} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setWaypoints(waypoints.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setWaypoints([...waypoints, ''])}>
                  <Plus className="h-3 w-3 mr-1" /> Lägg till stopp
                </Button>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Fordon *</Label>
                  <Select value={vehicleId} onValueChange={setVehicleId}>
                    <SelectTrigger><SelectValue placeholder="Välj fordon" /></SelectTrigger>
                    <SelectContent>
                      {mockVehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} ({v.regNr})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Lastvikt (kg) *</Label>
                  <Input type="number" value={loadWeight} onChange={e => setLoadWeight(e.target.value)} placeholder="20000" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Rutttyp</Label>
                  <Select value={routeType} onValueChange={v => setRouteType(v as 'normal' | 'fastest')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal (strikt 9h)</SelectItem>
                      <SelectItem value="fastest">Snabbast (flex 10h)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedVehicle && loadWeight && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Totalvikt:</span>
                      <span className="font-bold text-lg">{totalWeight.toLocaleString()} kg</span>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">BK-klasser</span>
                      <div className="grid grid-cols-2 gap-2">
                        {bkResults.map(r => (
                          <div key={r.bk} className="flex items-center justify-between p-2 rounded bg-card">
                            <span className="text-sm font-medium">{r.bk} ({(r.limit / 1000).toFixed(1)}t)</span>
                            <Badge className={statusColor(r.status)}>
                              {r.status === 'green' ? 'OK' : r.status === 'yellow' ? 'Nära' : 'Ej tillåten'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      {bkResults.some(r => r.status === 'red') && (
                        <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>Totalvikten överstiger vissa BK-klasser. Välj alternativ rutt eller minska lasten.</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold h-12"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Beräknar rutt...
                  </>
                ) : (
                  <>
                    <Route className="h-5 w-5 mr-2" />
                    Beräkna rutt
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {routeResult && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Route className="h-5 w-5 text-primary" />
                  Resdetaljer
                </CardTitle>
                {!isSaved && (
                  <Button size="sm" variant="outline" onClick={handleSave} className="font-semibold">
                    <Save className="h-4 w-4 mr-1" />
                    Spara resa
                  </Button>
                )}
                {isSaved && (
                  <Badge variant="secondary" className="text-xs">✓ Sparad</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sträcka</span>
                <span className="font-medium text-right">
                  {routeResult.waypoints.map(w => w.name).join(' → ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avstånd</span>
                <span className="font-medium">{routeResult.distanceKm} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Körtid (TomTom)</span>
                <span className="font-medium">{totalDriveTimeH}h</span>
              </div>
              {selectedVehicle && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Totalvikt</span>
                  <span className="font-medium">{totalWeight.toLocaleString()} kg</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rutttyp</span>
                <Badge variant="secondary">{routeType === 'normal' ? 'Normal (9h)' : 'Snabbast (10h)'}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Karta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TomTomMap route={routeResult} className="aspect-video" />
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Tidslinje – kör- och vilotider
              </CardTitle>
              <p className="text-xs text-muted-foreground">Baserat på EU:s kör- och vilotidsregler</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {timeline.map((entry, i) => (
                  <div key={i} className="flex gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div className="text-xl">{timelineIcon(entry.type)}</div>
                      {i < timeline.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border my-1" />
                      )}
                    </div>
                    <div className={`flex-1 pb-4 ${entry.type === 'rest' || entry.type === 'overnight' ? 'bg-muted/30 -mx-2 px-2 rounded' : ''}`}>
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{entry.label}</p>
                        <span className="text-xs text-muted-foreground">{entry.durationMinutes} min</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(entry.endTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {entry.location && <span className="text-xs text-muted-foreground">· {entry.location}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Card className="mt-4 bg-muted/30">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">EU kör- och vilotidsregler (tillämpade):</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    <li>• Max 4,5h körning → 45 min rast (kan delas 15+30)</li>
                    <li>• Max {routeType === 'fastest' ? '10h' : '9h'} körning/dag</li>
                    <li>• Dygnsvila: minst 11 timmar</li>
                    <li>• Nattarbete (01–05): max 10h totalt per 24h</li>
                  </ul>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
