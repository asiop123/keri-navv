import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ClipboardCheck,
  ShieldCheck,
  Navigation,
  Weight,
  Camera,
  AlertTriangle,
  ChevronRight,
  Radio,
  RadioOff,
} from 'lucide-react';
import { mockTasks, mockReminders, getVehiclesForDriver } from '@/data/mockData';
import { useRole } from '@/context/RoleContext';
import { getReminderStatus } from '@/types';
import { useNavigate } from 'react-router-dom';
import { startGpsTracking, stopGpsTracking } from '@/services/gpsTracking';
import { toast } from 'sonner';

export default function ChauffeurMyDay() {
  const { currentUser } = useRole();
  const navigate = useNavigate();
  const myVehicles = getVehiclesForDriver(currentUser.id);
  const myTasks = mockTasks.filter(
    (t) => t.assignedTo === currentUser.id && t.status !== 'completed'
  );
  const [trackingActive, setTrackingActive] = useState(false);

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

  const toggleTracking = () => {
    if (trackingActive) {
      stopGpsTracking();
      setTrackingActive(false);
      toast.info('GPS-spårning stoppad');
    } else if (myVehicles[0]) {
      startGpsTracking(myVehicles[0].id, currentUser.id);
      setTrackingActive(true);
      toast.success('GPS-spårning aktiverad');
    }
  };

  useEffect(() => {
    return () => { stopGpsTracking(); };
  }, []);

  const quickActions = [
    {
      id: 'besiktning',
      label: 'Besiktning',
      description: 'Kontroller & datum',
      icon: ShieldCheck,
      color: 'from-blue-500 to-blue-600',
      shadowColor: 'shadow-blue-500/30',
      warning: worstInspectionStatus,
      onClick: () => navigate('/besiktning'),
    },
    {
      id: 'gps',
      label: 'Navigation',
      description: 'GPS & ruttplanering',
      icon: Navigation,
      color: 'from-emerald-500 to-emerald-600',
      shadowColor: 'shadow-emerald-500/30',
      onClick: () => navigate('/ruttplanering'),
    },
    {
      id: 'lastsäkring',
      label: 'Lastsäkring',
      description: 'Kalkylator',
      icon: Weight,
      color: 'from-amber-500 to-orange-500',
      shadowColor: 'shadow-amber-500/30',
      onClick: () => navigate('/lastsäkring'),
    },
    {
      id: 'skylt',
      label: 'Skyltar',
      description: 'Fotografera & tolka',
      icon: Camera,
      color: 'from-purple-500 to-purple-600',
      shadowColor: 'shadow-purple-500/30',
      onClick: () => navigate('/skyltskanning'),
    },
  ];

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-8">
      {/* Header + GPS toggle */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Hej {currentUser.name.split(' ')[0]}!
          </h1>
          {myVehicles[0] && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {myVehicles[0].brand} {myVehicles[0].model} · {myVehicles[0].regNr}
            </p>
          )}
        </div>
        <Button
          variant={trackingActive ? 'default' : 'outline'}
          size="sm"
          onClick={toggleTracking}
          className={`gap-1.5 h-9 ${trackingActive ? 'bg-success hover:bg-success/90 text-success-foreground' : ''}`}
        >
          {trackingActive ? <Radio className="h-4 w-4 animate-pulse" /> : <RadioOff className="h-4 w-4" />}
          {trackingActive ? 'GPS På' : 'GPS Av'}
        </Button>
      </div>

      {/* Tasks */}
      {myTasks.length > 0 ? (
        <section>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Dagens uppgifter
          </h2>
          <div className="space-y-2">
            {myTasks.map((t) => (
              <Card
                key={t.id}
                className="cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] border-l-4 border-l-secondary"
                onClick={() => navigate('/uppgifter')}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-secondary to-amber-500 flex items-center justify-center shrink-0 shadow-md shadow-secondary/25">
                    <ClipboardCheck className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-5 text-center">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center mx-auto mb-2 shadow-md shadow-emerald-500/25">
              <ClipboardCheck className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm font-medium text-foreground">Inga uppgifter!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Du har inga uppgifter idag</p>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <section>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Verktyg
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const hasWarning = action.warning && action.warning !== 'green';
            return (
              <Card
                key={action.id}
                className="cursor-pointer hover:shadow-lg transition-all active:scale-[0.97] relative overflow-hidden group"
                onClick={action.onClick}
              >
                <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                  {hasWarning && (
                    <div className="absolute top-2.5 right-2.5">
                      <span className="flex h-3 w-3 relative">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${action.warning === 'red' ? 'bg-destructive' : 'bg-warning'}`} />
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${action.warning === 'red' ? 'bg-destructive' : 'bg-warning'}`} />
                      </span>
                    </div>
                  )}
                  <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg ${action.shadowColor} group-hover:scale-105 transition-transform`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                  </div>
                  {hasWarning && (
                    <Badge
                      className={`text-[10px] px-2 py-0.5 ${
                        action.warning === 'red'
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : 'bg-warning/10 text-warning border-warning/20'
                      }`}
                      variant="outline"
                    >
                      <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                      {action.warning === 'red' ? 'Brådskande' : 'Snart'}
                    </Badge>
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
