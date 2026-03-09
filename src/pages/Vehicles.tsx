import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, Plus } from 'lucide-react';
import { mockVehicles, getDriverForVehicle } from '@/data/mockData';
import { getReminderStatus, getDaysUntil } from '@/types';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';

export default function Vehicles() {
  const navigate = useNavigate();
  const { role } = useRole();

  const statusColor = (s: string) => {
    if (s === 'red') return 'bg-destructive text-destructive-foreground';
    if (s === 'yellow') return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Fordon</h1>
          <p className="text-muted-foreground mt-1">{mockVehicles.length} fordon registrerade</p>
        </div>
        {role === 'chef' && (
          <Button
            onClick={() => navigate('/fordon/ny')}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Lägg till
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {mockVehicles.map(v => {
          const driver = getDriverForVehicle(v.id);
          const inspStatus = getReminderStatus(v.nextInspectionDate);
          const inspDays = getDaysUntil(v.nextInspectionDate);

          return (
            <Card
              key={v.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/fordon/${v.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Truck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{v.brand} {v.model}</h3>
                      <p className="text-sm text-muted-foreground font-mono">{v.regNr}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-muted-foreground">Vikt:</span>{' '}
                    <span className="font-medium">{v.weightKg.toLocaleString()} kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Maxlast:</span>{' '}
                    <span className="font-medium">{v.maxLoadKg.toLocaleString()} kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Längd:</span>{' '}
                    <span className="font-medium">{v.lengthM} m</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Axeltryck:</span>{' '}
                    <span className="font-medium">{v.axleWeightKg.toLocaleString()} kg</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Besiktning:</span>
                    <Badge className={statusColor(inspStatus)}>
                      {inspDays <= 0 ? 'Förfallen' : `${inspDays} dagar`}
                    </Badge>
                  </div>
                  {driver ? (
                    <Badge variant="secondary" className="text-xs">{driver.name}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Ledig</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
