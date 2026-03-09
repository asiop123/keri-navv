import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, MapPin, Bell, ClipboardList } from 'lucide-react';
import { mockTasks, mockReminders, getVehiclesForDriver } from '@/data/mockData';
import { useRole } from '@/context/RoleContext';
import { getReminderStatus, getDaysUntil } from '@/types';
import { useNavigate } from 'react-router-dom';

export default function ChauffeurMyDay() {
  const { currentUser } = useRole();
  const navigate = useNavigate();
  const myVehicles = getVehiclesForDriver(currentUser.id);
  const myTasks = mockTasks.filter(t => t.assignedTo === currentUser.id && t.status !== 'completed');
  const myReminders = mockReminders
    .filter(r => r.relatedType === 'user' && r.relatedId === currentUser.id)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const statusColor = (s: string) => {
    if (s === 'red') return 'bg-destructive text-destructive-foreground';
    if (s === 'yellow') return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Min dag</h1>
        <p className="text-muted-foreground mt-1">Hej {currentUser.name.split(' ')[0]}! Här är din översikt.</p>
      </div>

      <Button
        size="lg"
        className="w-full md:w-auto bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold text-base h-14 px-8"
        onClick={() => navigate('/ruttplanering')}
      >
        <MapPin className="h-5 w-5 mr-2" />
        Planera ny resa
      </Button>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Mina fordon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myVehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga fordon tilldelade.</p>
            ) : (
              myVehicles.map(v => (
                <div
                  key={v.id}
                  className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate(`/fordon/${v.id}`)}
                >
                  <p className="font-semibold">{v.brand} {v.model}</p>
                  <p className="text-sm text-muted-foreground">{v.regNr} · {v.weightKg.toLocaleString()} kg</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-warning" />
              Mina uppgifter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga aktiva uppgifter.</p>
            ) : (
              myTasks.map(t => (
                <div key={t.id} className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-sm">{t.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">Deadline: {t.deadline}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-destructive" />
            Mina påminnelser
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {myReminders.map(r => {
            const status = getReminderStatus(r.dueDate);
            const days = getDaysUntil(r.dueDate);
            return (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.message}</p>
                </div>
                <Badge className={statusColor(status)}>
                  {days <= 0 ? 'Förfallen' : `${days} dagar`}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
