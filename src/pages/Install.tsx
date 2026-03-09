import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, CheckCircle, Share, MoreVertical } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 space-y-8">
      <div className="text-center space-y-3">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <span className="text-3xl">🚛</span>
        </div>
        <h1 className="text-2xl font-bold">Installera FleetFlow</h1>
        <p className="text-muted-foreground text-sm">
          Installera appen på din telefon för snabb åtkomst, offline-stöd och en äkta app-upplevelse.
        </p>
      </div>

      {isInstalled ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-6 text-center space-y-2">
          <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
          <h2 className="font-bold text-lg">Redan installerad!</h2>
          <p className="text-sm text-muted-foreground">FleetFlow är installerad på din enhet.</p>
        </div>
      ) : deferredPrompt ? (
        <div className="space-y-4">
          <Button onClick={handleInstall} className="w-full h-14 text-lg font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Download className="h-5 w-5 mr-2" />
            Installera nu
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Ingen app store behövs – installeras direkt från webbläsaren
          </p>
        </div>
      ) : isIOS ? (
        <div className="bg-muted/50 rounded-xl p-5 space-y-4">
          <h2 className="font-bold text-center">Installera på iPhone/iPad</h2>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <span>Tryck på <Share className="h-4 w-4 inline" /> <strong>Dela</strong>-knappen i Safari</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <span>Scrolla ner och välj <strong>"Lägg till på hemskärmen"</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <span>Tryck <strong>"Lägg till"</strong></span>
            </li>
          </ol>
        </div>
      ) : (
        <div className="bg-muted/50 rounded-xl p-5 space-y-4">
          <h2 className="font-bold text-center">Installera på Android</h2>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <span>Tryck på <MoreVertical className="h-4 w-4 inline" /> <strong>menyn</strong> i Chrome</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <span>Välj <strong>"Installera app"</strong> eller <strong>"Lägg till på startskärmen"</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <span>Tryck <strong>"Installera"</strong></span>
            </li>
          </ol>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-center">Varför installera?</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '⚡', title: 'Snabbare', desc: 'Startar direkt' },
            { icon: '📍', title: 'GPS-navigation', desc: 'Navigera i realtid' },
            { icon: '📴', title: 'Offline-stöd', desc: 'Fungerar utan nät' },
            { icon: '🔔', title: 'Påminnelser', desc: 'Missa aldrig service' },
          ].map((f, i) => (
            <div key={i} className="bg-card rounded-lg p-3 border border-border text-center">
              <div className="text-xl mb-1">{f.icon}</div>
              <div className="text-xs font-semibold">{f.title}</div>
              <div className="text-[10px] text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
