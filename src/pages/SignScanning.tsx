import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Camera, CheckCircle, XCircle, History, ScanLine } from 'lucide-react';
import { mockVehicles, mockSignScans, getVehicleById } from '@/data/mockData';
import { useRole } from '@/context/RoleContext';
import { SignRestriction } from '@/types';
import { toast } from 'sonner';

export default function SignScanning() {
  const { currentUser } = useRole();
  const [vehicleId, setVehicleId] = useState(mockVehicles[0]?.id || '');
  const [signText, setSignText] = useState('');
  const [restrictionType, setRestrictionType] = useState<SignRestriction['type']>('weight');
  const [restrictionValue, setRestrictionValue] = useState('');
  const [scanResult, setScanResult] = useState<{ allowed: boolean; message: string } | null>(null);
  const [scans, setScans] = useState(mockSignScans);

  const vehicle = getVehicleById(vehicleId);

  const typeLabels: Record<string, string> = {
    weight: 'Vikt (ton/kg)', height: 'Höjd (m)', length: 'Längd (m)',
    width: 'Bredd (m)', no_entry: 'Förbud att köra in', no_parking: 'Parkeringsförbud', other: 'Övrigt',
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;

    let allowed = true;
    let message = '';
    const val = parseFloat(restrictionValue);

    switch (restrictionType) {
      case 'weight': {
        const weightKg = val >= 100 ? val : val * 1000;
        if (vehicle.weightKg > weightKg) {
          allowed = false;
          message = `Du får INTE köra in. Fordonets vikt (${vehicle.weightKg.toLocaleString()} kg) överstiger skyltens gräns (${weightKg.toLocaleString()} kg).`;
        } else {
          message = `Du får köra in. Fordonets vikt (${vehicle.weightKg.toLocaleString()} kg) understiger gränsen (${weightKg.toLocaleString()} kg).`;
        }
        break;
      }
      case 'height': {
        const h = vehicle.heightM || 4.0;
        if (h > val) {
          allowed = false;
          message = `Du får INTE köra in. Fordonets höjd (${h} m) överstiger skyltens gräns (${val} m).`;
        } else {
          message = `Du får köra in. Fordonets höjd (${h} m) understiger gränsen (${val} m).`;
        }
        break;
      }
      case 'length': {
        if (vehicle.lengthM > val) {
          allowed = false;
          message = `Du får INTE köra in. Fordonets längd (${vehicle.lengthM} m) överstiger skyltens gräns (${val} m).`;
        } else {
          message = `Du får köra in. Fordonets längd (${vehicle.lengthM} m) understiger gränsen (${val} m).`;
        }
        break;
      }
      case 'width': {
        const w = vehicle.widthM || 2.6;
        if (w > val) {
          allowed = false;
          message = `Du får INTE köra in. Fordonets bredd (${w} m) överstiger skyltens gräns (${val} m).`;
        } else {
          message = `Du får köra in. Fordonets bredd (${w} m) understiger gränsen (${val} m).`;
        }
        break;
      }
      case 'no_entry':
        allowed = false;
        message = 'Du får INTE köra in. Skylten visar körförbud.';
        break;
      case 'no_parking':
        allowed = false;
        message = 'Här får du INTE parkera.';
        break;
      default:
        message = 'Kontrollera manuellt – skylttypen kunde inte tolkas automatiskt.';
    }

    setScanResult({ allowed, message });
    toast.success('Skanning utförd!');

    const newScan = {
      id: `scan-${Date.now()}`, userId: currentUser.id, vehicleId, manualText: signText,
      restriction: { type: restrictionType, value: val || undefined, unit: restrictionType === 'weight' ? 'kg' : 'm' },
      result: allowed ? 'allowed' as const : 'denied' as const,
      resultMessage: message, scannedAt: new Date().toISOString(),
    };
    setScans([newScan, ...scans]);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ScanLine className="h-7 w-7 text-primary" />
          Skyltskanning
        </h1>
        <p className="text-muted-foreground mt-1">Kontrollera om ditt fordon får passera</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Ny skanning</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleScan} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fordon *</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {mockVehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} ({v.regNr})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Typ av begränsning *</Label>
                <Select value={restrictionType} onValueChange={v => setRestrictionType(v as SignRestriction['type'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!['no_entry', 'no_parking', 'other'].includes(restrictionType) && (
              <div className="space-y-1.5">
                <Label>Skyltens värde *</Label>
                <Input
                  type="number" step="0.1" value={restrictionValue}
                  onChange={e => setRestrictionValue(e.target.value)}
                  placeholder={restrictionType === 'weight' ? '3.5 (ton) eller 3500 (kg)' : 'T.ex. 4.5'}
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Skyltens text (valfritt)</Label>
              <Textarea value={signText} onChange={e => setSignText(e.target.value)} placeholder='T.ex. "3,5 t" eller "Höjd 4,5 m"' rows={2} />
            </div>

            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors">
              <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Ta bild på skylt (valfritt)</p>
              <p className="text-xs text-muted-foreground">OCR-tolkning i framtida version</p>
            </div>

            <Button type="submit" size="lg" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold h-12">
              <ScanLine className="h-5 w-5 mr-2" /> Kontrollera
            </Button>
          </form>
        </CardContent>
      </Card>

      {scanResult && (
        <Card className={scanResult.allowed ? 'border-success/50 bg-success/5' : 'border-destructive/50 bg-destructive/5'}>
          <CardContent className="p-6 flex items-start gap-4">
            {scanResult.allowed ? (
              <CheckCircle className="h-10 w-10 text-success shrink-0" />
            ) : (
              <XCircle className="h-10 w-10 text-destructive shrink-0" />
            )}
            <div>
              <h3 className="text-lg font-bold">{scanResult.allowed ? '✅ Tillåtet' : '🚫 Ej tillåtet'}</h3>
              <p className="text-sm mt-1">{scanResult.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Skanningshistorik
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga skanningar ännu.</p>
          ) : (
            scans.map(s => {
              const v = getVehicleById(s.vehicleId);
              return (
                <div key={s.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">{s.manualText || typeLabels[s.restriction.type]}</p>
                    <p className="text-xs text-muted-foreground">{v?.regNr} · {s.location || 'Okänd plats'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.scannedAt).toLocaleString('sv-SE')}</p>
                  </div>
                  <Badge className={s.result === 'allowed' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>
                    {s.result === 'allowed' ? 'Tillåtet' : 'Nekat'}
                  </Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
