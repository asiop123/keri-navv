import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useRole } from '@/context/RoleContext';
import { Truck } from 'lucide-react';

export function AppLayout({ children }: { children: ReactNode }) {
  const { role, currentUser } = useRole();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-foreground" />
              <div className="md:hidden flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <span className="font-bold text-primary">FleetFlow</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {role === 'chef' ? '👔 Chef' : '🚛 Chaufför'}
              </span>
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                {currentUser.name.charAt(0)}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
