import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, AlertTriangle, Construction, ShieldAlert, Car, Star, Plus, MapPin } from 'lucide-react';
import { mockCommunityWarnings, mockRestAreaReviews, getUserById } from '@/data/mockData';
import { useRole } from '@/context/RoleContext';
import { CommunityWarning, RestAreaReview } from '@/types';
import { toast } from 'sonner';

const warningIcons: Record<string, typeof AlertTriangle> = {
  roadwork: Construction, accident: Car, police: ShieldAlert, bad_restarea: AlertTriangle,
};
const warningLabels: Record<string, string> = {
  roadwork: 'Vägarbete', accident: 'Olycka', police: 'Poliskontroll', bad_restarea: 'Dålig rastplats',
};
const warningColors: Record<string, string> = {
  roadwork: 'bg-warning text-warning-foreground',
  accident: 'bg-destructive text-destructive-foreground',
  police: 'bg-primary text-primary-foreground',
  bad_restarea: 'bg-muted text-muted-foreground',
};

export default function Community() {
  const { currentUser } = useRole();
  const [warnings, setWarnings] = useState<CommunityWarning[]>(mockCommunityWarnings);
  const [reviews, setReviews] = useState<RestAreaReview[]>(mockRestAreaReviews);
  const [warnOpen, setWarnOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [tab, setTab] = useState<'warnings' | 'reviews'>('warnings');

  const handleAddWarning = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const w: CommunityWarning = {
      id: `warn-${Date.now()}`, type: fd.get('type') as CommunityWarning['type'],
      description: fd.get('description') as string,
      lat: 59.33 + Math.random() * 2, lng: 15 + Math.random() * 3,
      userId: currentUser.id, createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    setWarnings([w, ...warnings]);
    setWarnOpen(false);
    toast.success('Varning rapporterad!');
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const r: RestAreaReview = {
      id: `review-${Date.now()}`, name: fd.get('name') as string,
      rating: Number(fd.get('rating')), comment: fd.get('comment') as string,
      userId: currentUser.id,
      maxLengthM: fd.get('maxLength') ? Number(fd.get('maxLength')) : undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setReviews([r, ...reviews]);
    setReviewOpen(false);
    toast.success('Recension tillagd!');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" /> Community
        </h1>
        <p className="text-muted-foreground mt-1">Varningar och rastplatsrecensioner</p>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'warnings' ? 'default' : 'outline'} onClick={() => setTab('warnings')}>
          <AlertTriangle className="h-4 w-4 mr-1" /> Varningar ({warnings.length})
        </Button>
        <Button variant={tab === 'reviews' ? 'default' : 'outline'} onClick={() => setTab('reviews')}>
          <Star className="h-4 w-4 mr-1" /> Rastplatser ({reviews.length})
        </Button>
      </div>

      {tab === 'warnings' && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" /> Kartvy
                </CardTitle>
                <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
                      <Plus className="h-4 w-4 mr-1" /> Rapportera
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Rapportera varning</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddWarning} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label>Typ *</Label>
                        <Select name="type" defaultValue="roadwork">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(warningLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Beskrivning *</Label>
                        <Textarea name="description" required placeholder="T.ex. Vägarbete E4 vid Nyköping, 1 fil stängd" rows={3} />
                      </div>
                      <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">Rapportera</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="aspect-video rounded-lg bg-muted flex items-center justify-center border-2 border-dashed border-border relative overflow-hidden">
                <div className="text-center space-y-2">
                  <MapPin className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">Kartvy med varningar</p>
                  <p className="text-xs text-muted-foreground">Integreras med kart-API i framtiden</p>
                </div>
                {warnings.map((w, i) => {
                  const Icon = warningIcons[w.type] || AlertTriangle;
                  return (
                    <div key={w.id} className="absolute" style={{ top: `${20 + i * 25}%`, left: `${15 + i * 20}%` }}>
                      <div className={`p-1.5 rounded-full shadow-lg ${warningColors[w.type]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {warnings.map(w => {
              const Icon = warningIcons[w.type] || AlertTriangle;
              const user = getUserById(w.userId);
              return (
                <Card key={w.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${warningColors[w.type]}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className={warningColors[w.type]}>{warningLabels[w.type]}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleString('sv-SE')}</span>
                        </div>
                        <p className="text-sm mt-1">{w.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">Rapporterad av {user?.name || 'Okänd'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {tab === 'reviews' && (
        <>
          <div className="flex justify-end">
            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
                  <Plus className="h-4 w-4 mr-1" /> Ny recension
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Recensera rastplats</DialogTitle></DialogHeader>
                <form onSubmit={handleAddReview} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Rastplatsens namn *</Label>
                    <Input name="name" required placeholder="T.ex. Rasta Gränna" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Betyg (1–5) *</Label>
                      <Select name="rating" defaultValue="3">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{'⭐'.repeat(n)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Max längd (m)</Label>
                      <Input name="maxLength" type="number" placeholder="18" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kommentar *</Label>
                    <Textarea name="comment" required placeholder="Beskriv rastplatsen..." rows={3} />
                  </div>
                  <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">Publicera</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {reviews.map(r => {
              const user = getUserById(r.userId);
              return (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{r.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm">{'⭐'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                          {r.maxLengthM && <Badge variant="outline" className="text-xs">Max {r.maxLengthM}m</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{r.comment}</p>
                        <p className="text-xs text-muted-foreground mt-1">{user?.name} · {r.createdAt}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
