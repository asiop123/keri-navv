import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ClipboardCheck,
  ShieldCheck,
  Navigation,
  Weight,
  Camera,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { mockTasks, mockReminders, getVehiclesForDriver } from '@/data/mockData';
import { useRole } from '@/context/RoleContext';
import { getReminderStatus, getDaysUntil } from '@/types';
import { useNavigate } from 'react-router-dom';

export default function ChauffeurMyDay() {
  const { currentUser } = useRole();
  const navigate = useNavigate();
  const myVehicles = getVehiclesForDriver(currentUser.id);
  const myTasks = mockTasks.filter(
    (t) => t.assignedTo === currentUser.id && t.status !== 'completed'
  );

  // Check inspection-related reminders for warnings
  const vehicleIds = myVehicles.map((v) => v.id);
  const inspectionReminders = mockReminders.filter(
    (r) =>
      r.status === 'active' &&
      (r.type === 'inspection' || r.type === 'maintenance') &&
      r.relatedType === 'vehicle' &&
      vehicleIds.includes(r.relatedId)
  );
  const worstInspectionStatus = inspectionReminders.reduce<string>((worst, r) => {
    const s = getReminderStatus(r.dueDate);
    if (s === 'red') return 'red';
    if (s === 'yellow' && worst !== 'red') return 'yellow';
    return worst;
  }, 'green');

  const statusBadge = (status: string) => {
    if (status === 'red')
      return (
        <Badge className="bg-destructive text-destructive-foreground text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Brådskande
        </Badge>
      );
    if (status === 'yellow')
      return (
        <Badge className="bg-warning text-warning-foreground text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Snart
        </Badge>
      );
    return null;
  };

  const quickActions = [
    {
      id: 'besiktning',
      label: 'Besiktning',
      description: 'Kontroller & datum',
      icon: ShieldCheck,
      warning: worstInspectionStatus,
      onClick: () => navigate('/besiktning'),
    },
    {
      id: 'gps',
      label: 'GPS & Navigation',
      description: 'Starta navigation',
      icon: Navigation,
      onClick: () => navigate('/ruttplanering'),
    },
    {
      id: 'lastsäkring',
      label: 'Lastsäkring',
      description: 'Kalkylator',
      icon: Weight,
      onClick: () => navigate('/lastsäkring'),
    },
    {
      id: 'skylt',
      label: 'Skyltigenkänning',
      description: 'Fotografera skylt',
      icon: Camera,
      onClick: () => navigate('/skyltskanning'),
    },
  ];

  return (
    <div className="space-y-5 max-w-lg mx-auto pb-8">
      {/* Greeting */}
      <div className="pt-1">
        <h1 className="text-xl font-bold text-foreground">
          Hej {currentUser.name.split(' ')[0]}!
        </h1>
        {myVehicles[0] && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {myVehicles[0].brand} {myVehicles[0].model} · {myVehicles[0].regNr}
          </p>
        )}
      </div>

      {/* Tasks section */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Dagens uppgifter
        </h2>
        {myTasks.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center">
              <ClipboardCheck className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Inga uppgifter idag!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {myTasks.map((t) => (
              <Card
                key={t.id}
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={() => navigate('/uppgifter')}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Quick action grid */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Verktyg
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const hasWarning = action.warning && action.warning !== 'green';
            return (
              <Card
                key={action.id}
                className="cursor-pointer hover:shadow-md transition-all active:scale-[0.97] relative overflow-hidden"
                onClick={action.onClick}
              >
                <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                  <div
                    className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
                      hasWarning
                        ? action.warning === 'red'
                          ? 'bg-destructive/15'
                          : 'bg-warning/20'
                        : 'bg-primary/10'
                    }`}
                  >
                    <Icon
                      className={`h-7 w-7 ${
                        hasWarning
                          ? action.warning === 'red'
                            ? 'text-destructive'
                            : 'text-warning'
                          : 'text-primary'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {action.description}
                    </p>
                  </div>
                  {hasWarning && (
                    <div className="absolute top-2 right-2">
                      {statusBadge(action.warning!)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
