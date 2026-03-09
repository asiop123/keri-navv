import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Truck, User, FileText, Shield } from 'lucide-react';
import { getVehicleById, getDriverForVehicle, getDocumentsForVehicle, getRemindersForVehicle } from '@/data/mockData';
import { getReminderStatus, getDaysUntil } from '@/types';

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const vehicle = getVehicleById(id || '');

  if (!vehicle) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Fordon hittades inte.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/fordon')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Tillbaka
        </Button>
      </div>
    );
  }

  const driver = getDriverForVehicle(vehicle.id);
  const documents = getDocumentsForVehicle(vehicle.id);
  const reminders = getRemindersForVehicle(vehicle.id);

  const statusColor = (s: string) => {
    if (s === 'red') return 'bg-destructive text-destructive-foreground';
    if (s === 'yellow') return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  const inspStatus = getReminderStatus(vehicle.nextInspectionDate);
  const taxStatus = getReminderStatus(vehicle.taxDate);

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate('/fordon')} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-2" /> Tillbaka till fordon
      </Button>

      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
          <Truck className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-lg text-muted-foreground font-mono">{vehicle.regNr}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Fordonsdata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Längd" value={`${vehicle.lengthM} m`} />
            <Row label="Tjänstevikt" value={`${vehicle.weightKg.toLocaleString()} kg`} />
            <Row label="Maxlast" value={`${vehicle.maxLoadKg.toLocaleString()} kg`} />
            <Row label="Max totalvikt" value={`${(vehicle.weightKg + vehicle.maxLoadKg).toLocaleString()} kg`} />
            <Row label="Axeltryck" value={`${vehicle.axleWeightKg.toLocaleString()} kg`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Status & datum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Besiktning</span>
              <div className="flex items-center gap-2">
                <span className="text-sm">{vehicle.nextInspectionDate}</span>
                <Badge className={statusColor(inspStatus)}>
                  {getDaysUntil(vehicle.nextInspectionDate) <= 0 ? 'Förfallen' : `${getDaysUntil(vehicle.nextInspectionDate)}d`}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Skatt</span>
              <div className="flex items-center gap-2">
                <span className="text-sm">{vehicle.taxDate}</span>
                <Badge className={statusColor(taxStatus)}>
                  {getDaysUntil(vehicle.taxDate) <= 0 ? 'Förfallen' : `${getDaysUntil(vehicle.taxDate)}d`}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-4 w-4" /> Försäkring
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Bolag" value={vehicle.insuranceCompany} />
            {vehicle.insuranceNumber && <Row label="Nr" value={vehicle.insuranceNumber} />}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Giltig t.o.m.</span>
              <div className="flex items-center gap-2">
                <span>{vehicle.insuranceExpiry}</span>
                <Badge className={statusColor(getReminderStatus(vehicle.insuranceExpiry))}>
                  {getDaysUntil(vehicle.insuranceExpiry) <= 0 ? 'Utgången' : `${getDaysUntil(vehicle.insuranceExpiry)}d`}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-4 w-4" /> Förare
            </CardTitle>
          </CardHeader>
          <CardContent>
            {driver ? (
              <div className="space-y-2">
                <p className="font-semibold">{driver.name}</p>
                <p className="text-sm text-muted-foreground">{driver.email}</p>
                {driver.phone && <p className="text-sm text-muted-foreground">{driver.phone}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Ingen förare tilldelad.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {documents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" /> Dokument
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{d.title}</p>
                  <p className="text-xs text-muted-foreground">Uppladdad {d.uploadedAt}</p>
                </div>
                {d.expiryDate && (
                  <Badge className={statusColor(getReminderStatus(d.expiryDate))}>
                    {getDaysUntil(d.expiryDate) <= 0 ? 'Utgången' : `${getDaysUntil(d.expiryDate)}d`}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {reminders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Påminnelser</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reminders.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-sm">{r.title}</p>
                <Badge className={statusColor(getReminderStatus(r.dueDate))}>
                  {getDaysUntil(r.dueDate) <= 0 ? 'Förfallen' : `${getDaysUntil(r.dueDate)}d`}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
