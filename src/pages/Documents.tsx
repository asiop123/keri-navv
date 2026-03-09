import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Plus, Upload } from 'lucide-react';
import { mockDocuments, getVehicleById, getUserById } from '@/data/mockData';
import { getReminderStatus, getDaysUntil } from '@/types';
import { useRole } from '@/context/RoleContext';
import { toast } from 'sonner';

const typeLabels: Record<string, string> = {
  registration: 'Registreringsbevis',
  license: 'Förarbevis',
  insurance: 'Försäkring',
  cmr: 'CMR',
  inspection: 'Besiktning',
};

export default function Documents() {
  const { role, currentUser } = useRole();
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false);

  let docs = [...mockDocuments];
  if (role === 'chauffeur') {
    docs = docs.filter(d => d.userId === currentUser.id || (d.vehicleId && getVehicleById(d.vehicleId)?.driverId === currentUser.id));
  }
  if (filter !== 'all') {
    docs = docs.filter(d => d.type === filter);
  }

  const statusColor = (s: string) => {
    if (s === 'red') return 'bg-destructive text-destructive-foreground';
    if (s === 'yellow') return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  const getRelatedName = (d: typeof docs[0]) => {
    if (d.vehicleId) {
      const v = getVehicleById(d.vehicleId);
      return v ? `${v.brand} ${v.model} (${v.regNr})` : '';
    }
    if (d.userId) {
      const u = getUserById(d.userId);
      return u ? u.name : '';
    }
    return '';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Dokument
          </h1>
          <p className="text-muted-foreground mt-1">{docs.length} dokument</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
              <Plus className="h-4 w-4 mr-2" /> Ladda upp
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ladda upp dokument</DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); toast.success('Dokument uppladdat! (mockdata)'); setOpen(false); }} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Titel *</Label>
                <Input placeholder="Försäkringsbrev – Volvo FH16" required />
              </div>
              <div className="space-y-1.5">
                <Label>Typ *</Label>
                <Select defaultValue="registration">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Utgångsdatum</Label>
                <Input type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Fil</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Klicka eller dra en fil hit</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG (max 10 MB)</p>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
                </div>
              </div>
              <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
                Spara dokument
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Alla</Button>
        {Object.entries(typeLabels).map(([k, v]) => (
          <Button key={k} variant={filter === k ? 'default' : 'outline'} size="sm" onClick={() => setFilter(k)}>{v}</Button>
        ))}
      </div>

      <div className="space-y-3">
        {docs.map(d => (
          <Card key={d.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{d.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{typeLabels[d.type]}</Badge>
                      <span className="text-xs text-muted-foreground">{getRelatedName(d)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Uppladdad {d.uploadedAt}</p>
                  </div>
                </div>
                {d.expiryDate && (
                  <div className="text-right shrink-0">
                    <Badge className={statusColor(getReminderStatus(d.expiryDate))}>
                      {getDaysUntil(d.expiryDate) <= 0 ? 'Utgången' : `${getDaysUntil(d.expiryDate)}d`}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{d.expiryDate}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
