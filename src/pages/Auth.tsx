import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Truck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate('/', { replace: true });
  }, [loading, session, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast({ title: 'Inloggning misslyckades', description: error.message, variant: 'destructive' });
      return;
    }
    navigate('/', { replace: true });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: name },
      },
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Konto kunde inte skapas', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Konto skapat', description: 'Kolla din e-post för att verifiera ditt konto.' });
  }

  async function handleDemo(role: 'chef' | 'chauffeur') {
    setBusy(true);
    const email = role === 'chef' ? 'chef@demo.se' : 'chauffeur@demo.se';
    const password = 'demo1234';
    // Ensure demo users exist (idempotent)
    try {
      await supabase.functions.invoke('seed-demo', { body: {} });
    } catch {}
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast({ title: 'Demo-inloggning misslyckades', description: error.message, variant: 'destructive' });
      return;
    }
    navigate('/', { replace: true });
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) toast({ title: 'Google-inloggning misslyckades', description: error.message, variant: 'destructive' });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <Truck className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-primary">FleetFlow</h1>
        </div>

        <div className="space-y-2">
          <Button type="button" className="w-full h-12 text-base" disabled={busy} onClick={() => handleDemo('chef')}>
            Logga in som Chef (demo)
          </Button>
          <Button type="button" variant="secondary" className="w-full h-12 text-base" disabled={busy} onClick={() => handleDemo('chauffeur')}>
            Logga in som Chaufför (demo)
          </Button>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login">Logga in</TabsTrigger>
            <TabsTrigger value="signup">Skapa konto</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4 pt-4">
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <Label htmlFor="login-email">E-post</Label>
                <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="login-pass">Lösenord</Label>
                <Input id="login-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>Logga in</Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 pt-4">
            <form onSubmit={handleSignup} className="space-y-3">
              <div>
                <Label htmlFor="signup-name">Namn</Label>
                <Input id="signup-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="signup-email">E-post</Label>
                <Input id="signup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="signup-pass">Lösenord (minst 6 tecken)</Label>
                <Input id="signup-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>Skapa konto</Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">eller</span></div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogle}>Fortsätt med Google</Button>
      </Card>
    </div>
  );
}
