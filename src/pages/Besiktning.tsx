import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, AlertTriangle, Clock, FileCheck, Flame, Truck } from 'lucide-react';
import { mockReminders, getVehiclesForDriver } from '@/data/mockData';
import { useRole } from '@/context/RoleContext';
import { getReminderStatus, getDaysUntil } from '@/types';

const inspectionCategories = [
  { id: 'fordon', label: 'Fordonsbesiktning', icon: Truck, description: 'Nästa besiktningsdatum' },
  { id: 'fardskrivare', label: 'Färdskrivare', icon: Clock, description: 'Kalibrering & kontroll' },
  { id: 'bakgavel', label: 'Bakgavellyft', icon: FileCheck, description: 'Besiktning bakgavellyft' },
  { id: 'brandslackare', label: 'Brandsläckare', icon: Flame, description: 'Kontroll & utgångsdatum' },
];

export default function Besiktning() {
  const { currentUser } = useRole();
  const myVehicles = getVehiclesForDriver(currentUser.id);
  const vehicleIds = myVehicles.map((v) => v.id);

  const inspectionReminders = mockReminders.filter(
    (r) =>
      r.status === 'active' &&
      r.relatedType === 'vehicle' &&
      vehicleIds.includes(r.relatedId)
  );

  const statusColor = (s: string) => {
    if (s === 'red') return 'bg-destructive text-destructive-foreground';
    if (s === 'yellow') return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Besiktning
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kontroller och datum för dina fordon
        </p>
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {inspectionCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Card key={cat.id} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upcoming reminders */}
      {inspectionReminders.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Kommande datum
          </h2>
          <div className="space-y-2">
            {inspectionReminders.map((r) => {
              const status = getReminderStatus(r.dueDate);
              const days = getDaysUntil(r.dueDate);
              return (
                <Card key={r.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.dueDate}</p>
                    </div>
                    <Badge className={statusColor(status)}>
                      {days <= 0 ? (
                        <><AlertTriangle className="h-3 w-3 mr-1" />Förfallen</>
                      ) : (
                        `${days} dagar`
                      )}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
