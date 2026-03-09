import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList } from 'lucide-react';
import { mockTasks, getUserById, getVehicleById } from '@/data/mockData';

export default function Tasks() {
  const tasks = [...mockTasks].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  const statusLabel: Record<string, string> = {
    pending: 'Väntande',
    in_progress: 'Pågående',
    completed: 'Klar',
  };

  const statusVariant = (s: string) => {
    if (s === 'completed') return 'bg-success text-success-foreground';
    if (s === 'in_progress') return 'bg-warning text-warning-foreground';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-primary" />
          Uppgifter
        </h1>
        <p className="text-muted-foreground mt-1">{tasks.length} uppgifter</p>
      </div>

      <div className="space-y-3">
        {tasks.map(t => {
          const assignee = getUserById(t.assignedTo);
          const vehicle = t.vehicleId ? getVehicleById(t.vehicleId) : undefined;
          return (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{t.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {assignee && <Badge variant="secondary" className="text-xs">{assignee.name}</Badge>}
                      {vehicle && <Badge variant="outline" className="text-xs">{vehicle.regNr}</Badge>}
                      <span className="text-xs text-muted-foreground">Deadline: {t.deadline}</span>
                    </div>
                  </div>
                  <Badge className={statusVariant(t.status)}>{statusLabel[t.status]}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
