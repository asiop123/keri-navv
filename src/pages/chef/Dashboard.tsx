import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, ClipboardList, Bell, Users } from 'lucide-react';
import { mockVehicles, mockTasks, mockReminders, mockUsers, getDriverForVehicle } from '@/data/mockData';
import { getReminderStatus, getDaysUntil } from '@/types';
import { useNavigate } from 'react-router-dom';

export default function ChefDashboard() {
  const navigate = useNavigate();
  const drivers = mockUsers.filter(u => u.role === 'chauffeur');
  const pendingTasks = mockTasks.filter(t => t.status !== 'completed');
  const urgentReminders = mockReminders
    .filter(r => r.status === 'active')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const statusColor = (s: string) => {
    if (s === 'red') return 'bg-destructive text-destructive-foreground';
    if (s === 'yellow') return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Översikt</h1>
        <p className="text-muted-foreground mt-1">Välkommen tillbaka, Anna</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/fordon')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockVehicles.length}</p>
              <p className="text-xs text-muted-foreground">Fordon</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{drivers.length}</p>
              <p className="text-xs text-muted-foreground">Förare</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/uppgifter')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingTasks.length}</p>
              <p className="text-xs text-muted-foreground">Uppgifter</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/paminnelser')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockReminders.filter(r => getReminderStatus(r.dueDate) === 'red').length}</p>
              <p className="text-xs text-muted-foreground">Brådskande</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Fordon & förare
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockVehicles.map(v => {
              const driver = getDriverForVehicle(v.id);
              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate(`/fordon/${v.id}`)}
                >
                  <div>
                    <p className="font-semibold">{v.brand} {v.model}</p>
                    <p className="text-sm text-muted-foreground">{v.regNr}</p>
                  </div>
                  <div className="text-right">
                    {driver ? (
                      <Badge variant="secondary" className="text-xs">{driver.name}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Ingen förare</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-destructive" />
              Kommande påminnelser
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {urgentReminders.map(r => {
              const status = getReminderStatus(r.dueDate);
              const days = getDaysUntil(r.dueDate);
              return (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.dueDate}</p>
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
    </div>
  );
}
