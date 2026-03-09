import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ClipboardList, Plus, CheckCircle2, MessageSquare } from 'lucide-react';
import { mockTasks, mockUsers, mockVehicles, getUserById, getVehicleById } from '@/data/mockData';
import { useRole } from '@/context/RoleContext';
import { Task } from '@/types';
import { toast } from 'sonner';

export default function Tasks() {
  const { role, currentUser } = useRole();
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [createOpen, setCreateOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const drivers = mockUsers.filter(u => u.role === 'chauffeur');

  let filtered = [...tasks];
  if (role === 'chauffeur') filtered = filtered.filter(t => t.assignedTo === currentUser.id);
  if (filter === 'pending') filtered = filtered.filter(t => t.status !== 'completed');
  if (filter === 'completed') filtered = filtered.filter(t => t.status === 'completed');
  filtered.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  const statusLabel: Record<string, string> = { pending: 'Väntande', in_progress: 'Pågående', completed: 'Klar' };
  const statusColor = (s: string) => {
    if (s === 'completed') return 'bg-success text-success-foreground';
    if (s === 'in_progress') return 'bg-warning text-warning-foreground';
    return 'bg-muted text-muted-foreground';
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const newTask: Task = {
      id: `task-${Date.now()}`, title: fd.get('title') as string,
      description: fd.get('description') as string, deadline: fd.get('deadline') as string,
      status: 'pending', assignedTo: fd.get('assignedTo') as string,
      vehicleId: (fd.get('vehicleId') as string) || undefined, createdBy: currentUser.id,
    };
    setTasks([newTask, ...tasks]);
    setCreateOpen(false);
    toast.success('Uppgift skapad!');
  };

  const handleComplete = (taskId: string) => {
    setTasks(tasks.map(t => t.id === taskId ? {
      ...t, status: 'completed' as const, completedAt: new Date().toISOString(), completionComment: comment
    } : t));
    setCompleteOpen(null);
    setComment('');
    toast.success('Uppgift markerad som klar!');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" /> Uppgifter
          </h1>
          <p className="text-muted-foreground mt-1">{filtered.length} uppgifter</p>
        </div>
        {role === 'chef' && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
                <Plus className="h-4 w-4 mr-2" /> Ny uppgift
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Skapa uppgift</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Titel *</Label>
                  <Input name="title" required placeholder="T.ex. Kontrollera däcktryck" />
                </div>
                <div className="space-y-1.5">
                  <Label>Beskrivning *</Label>
                  <Textarea name="description" required placeholder="Beskriv uppgiften..." rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Tilldela till *</Label>
                    <Select name="assignedTo" defaultValue={drivers[0]?.id}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Deadline *</Label>
                    <Input name="deadline" type="date" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Fordon (valfritt)</Label>
                  <Select name="vehicleId">
                    <SelectTrigger><SelectValue placeholder="Välj fordon" /></SelectTrigger>
                    <SelectContent>
                      {mockVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.regNr} – {v.brand} {v.model}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
                  Skapa uppgift
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Alla</Button>
        <Button variant={filter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('pending')}>Aktiva</Button>
        <Button variant={filter === 'completed' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('completed')}>Klara</Button>
      </div>

      <div className="space-y-3">
        {filtered.map(t => {
          const assignee = getUserById(t.assignedTo);
          const vehicle = t.vehicleId ? getVehicleById(t.vehicleId) : undefined;
          return (
            <Card key={t.id} className={t.status === 'completed' ? 'opacity-70' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold">{t.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {assignee && <Badge variant="secondary" className="text-xs">{assignee.name}</Badge>}
                      {vehicle && <Badge variant="outline" className="text-xs">{vehicle.regNr}</Badge>}
                      <span className="text-xs text-muted-foreground">Deadline: {t.deadline}</span>
                    </div>
                    {t.completionComment && (
                      <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{t.completionComment}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={statusColor(t.status)}>{statusLabel[t.status]}</Badge>
                    {t.status !== 'completed' && role === 'chauffeur' && (
                      <Dialog open={completeOpen === t.id} onOpenChange={open => { setCompleteOpen(open ? t.id : null); setComment(''); }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Klar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Markera som klar</DialogTitle></DialogHeader>
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">"{t.title}"</p>
                            <div className="space-y-1.5">
                              <Label>Kommentar (valfritt)</Label>
                              <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="T.ex. Däcktryck kontrollerat, allt OK." rows={3} />
                            </div>
                            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50">
                              <p className="text-sm text-muted-foreground">📷 Ladda upp bild (kvitto/signatur)</p>
                            </div>
                            <Button onClick={() => handleComplete(t.id)} className="w-full bg-success text-success-foreground hover:bg-success/90 font-semibold">
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Markera som klar
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
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
