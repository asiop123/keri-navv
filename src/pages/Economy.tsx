import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Fuel, Plus, TrendingUp, DollarSign, BarChart3, AlertTriangle } from 'lucide-react';
import { mockVehicles, mockFuelLogs, getFuelLogsForVehicle, getVehicleById } from '@/data/mockData';
import { FuelLog } from '@/types';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Economy() {
  const [vehicleId, setVehicleId] = useState(mockVehicles[0]?.id || '');
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(mockFuelLogs);
  const [addOpen, setAddOpen] = useState(false);

  const vehicle = getVehicleById(vehicleId);
  const logs = fuelLogs.filter(f => f.vehicleId === vehicleId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calc consumption between consecutive logs
  const consumptionData = logs.slice(0, -1).map((log, i) => {
    const prev = logs[i + 1];
    const distKm = log.odometerKm - prev.odometerKm;
    const lPer100 = distKm > 0 ? (log.liters / distKm) * 100 : 0;
    return { date: log.date, lPer100: Math.round(lPer100 * 10) / 10, cost: Math.round(log.liters * log.pricePerLiter), distKm };
  }).reverse();

  const avgConsumption = consumptionData.length > 0
    ? Math.round((consumptionData.reduce((s, c) => s + c.lPer100, 0) / consumptionData.length) * 10) / 10
    : 0;

  const totalCost = logs.reduce((s, l) => s + l.liters * l.pricePerLiter, 0);
  const totalLiters = logs.reduce((s, l) => s + l.liters, 0);

  const hasDeviation = consumptionData.some(c => Math.abs(c.lPer100 - avgConsumption) / avgConsumption > 0.15);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const newLog: FuelLog = {
      id: `fuel-${Date.now()}`, vehicleId, userId: 'user-chauffeur',
      date: fd.get('date') as string, odometerKm: Number(fd.get('odometer')),
      liters: Number(fd.get('liters')), pricePerLiter: Number(fd.get('price')),
      location: fd.get('location') as string || undefined,
    };
    setFuelLogs([newLog, ...fuelLogs]);
    setAddOpen(false);
    toast.success('Tankning registrerad!');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Fuel className="h-7 w-7 text-primary" /> Ekonomi
          </h1>
          <p className="text-muted-foreground mt-1">Bränsle & kostnadsuppföljning</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
              <Plus className="h-4 w-4 mr-2" /> Ny tankning
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrera tankning</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Datum *</Label><Input name="date" type="date" required /></div>
                <div className="space-y-1.5"><Label>Mätarställning (km) *</Label><Input name="odometer" type="number" required placeholder="245500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Liter *</Label><Input name="liters" type="number" step="0.1" required placeholder="320" /></div>
                <div className="space-y-1.5"><Label>Pris/liter (kr) *</Label><Input name="price" type="number" step="0.01" required placeholder="18.50" /></div>
              </div>
              <div className="space-y-1.5"><Label>Plats</Label><Input name="location" placeholder="OKQ8 Södertälje" /></div>
              <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">Spara tankning</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-1.5">
        <Label>Välj fordon</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {mockVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} ({v.regNr})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{avgConsumption}</p>
          <p className="text-xs text-muted-foreground">l/100 km snitt</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Fuel className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalLiters.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Liter totalt</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <DollarSign className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{Math.round(totalCost).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">kr totalt</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <BarChart3 className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{logs.length}</p>
          <p className="text-xs text-muted-foreground">Tankningar</p>
        </CardContent></Card>
      </div>

      {hasDeviation && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm">Förbrukningen avviker mer än 15% från snittet. Kan tyda på tekniskt problem eller ändrad körstil.</p>
          </CardContent>
        </Card>
      )}

      {consumptionData.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Förbrukning (l/100 km)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consumptionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value: number) => [`${value} l/100km`, 'Förbrukning']}
                  />
                  <Bar dataKey="lPer100" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">Tankningslogg</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {logs.map(l => (
            <div key={l.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium text-sm">{l.date} · {l.location || 'Okänd plats'}</p>
                <p className="text-xs text-muted-foreground">{l.liters} liter @ {l.pricePerLiter} kr/l · Mätare: {l.odometerKm.toLocaleString()} km</p>
              </div>
              <Badge variant="secondary" className="text-sm font-bold">{Math.round(l.liters * l.pricePerLiter).toLocaleString()} kr</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
