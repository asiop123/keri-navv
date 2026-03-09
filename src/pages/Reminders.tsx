import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle } from 'lucide-react';
import { mockReminders, getUserById, getVehicleById } from '@/data/mockData';
import { getReminderStatus, getDaysUntil } from '@/types';
import { useRole } from '@/context/RoleContext';

export default function Reminders() {
  const { role, currentUser } = useRole();

  let reminders = [...mockReminders].filter(r => r.status === 'active');
  if (role === 'chauffeur') {
    reminders = reminders.filter(r => r.relatedId === currentUser.id);
  }
  reminders.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const statusColor = (s: string) => {
    if (s === 'red') return 'bg-destructive text-destructive-foreground';
    if (s === 'yellow') return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  const typeLabels: Record<string, string> = {
    inspection: 'Besiktning',
    tax: 'Skatt',
    license: 'Körkort',
    ykb: 'YKB',
    adr: 'ADR',
    maintenance: 'Underhåll',
    insurance: 'Försäkring',
  };

  const getRelatedName = (r: typeof reminders[0]) => {
    if (r.relatedType === 'vehicle') {
      const v = getVehicleById(r.relatedId);
      return v ? `${v.brand} ${v.model} (${v.regNr})` : '';
    }
    const u = getUserById(r.relatedId);
    return u ? u.name : '';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Bell className="h-7 w-7 text-primary" />
          Påminnelser
        </h1>
        <p className="text-muted-foreground mt-1">{reminders.length} aktiva påminnelser</p>
      </div>

      <div className="space-y-3">
        {reminders.map(r => {
          const status = getReminderStatus(r.dueDate);
          const days = getDaysUntil(r.dueDate);
          const isUrgent = status === 'red';

          return (
            <Card key={r.id} className={isUrgent ? 'border-destructive/50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {isUrgent && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                      <h3 className="font-semibold">{r.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{r.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">{typeLabels[r.type] || r.type}</Badge>
                      <span className="text-xs text-muted-foreground">{getRelatedName(r)}</span>
                    </div>
                    {isUrgent && (
                      <p className="text-sm text-destructive font-medium mt-2">
                        ⚠️ Åtgärd krävs – {days <= 0 ? 'Redan passerat!' : `Bara ${days} dagar kvar`}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={statusColor(status)}>
                      {days <= 0 ? 'Förfallen' : `${days} dagar`}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{r.dueDate}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
