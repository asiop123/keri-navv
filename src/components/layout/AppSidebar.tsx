import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Truck, ClipboardList, FileText, Bell,
  MapPin, Calendar, UserCog, ScanLine, Fuel, Users
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useRole } from '@/context/RoleContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const chefItems = [
  { title: 'Översikt', url: '/', icon: LayoutDashboard },
  { title: 'Fordon', url: '/fordon', icon: Truck },
  { title: 'Uppgifter', url: '/uppgifter', icon: ClipboardList },
  { title: 'Dokument', url: '/dokument', icon: FileText },
  { title: 'Påminnelser', url: '/paminnelser', icon: Bell },
  { title: 'Ekonomi', url: '/ekonomi', icon: Fuel },
  { title: 'Community', url: '/community', icon: Users },
];

const chauffeurItems = [
  { title: 'Min dag', url: '/', icon: Calendar },
  { title: 'Ruttplanering', url: '/ruttplanering', icon: MapPin },
  { title: 'Fordon', url: '/fordon', icon: Truck },
  { title: 'Skyltskanning', url: '/skyltskanning', icon: ScanLine },
  { title: 'Dokument', url: '/dokument', icon: FileText },
  { title: 'Påminnelser', url: '/paminnelser', icon: Bell },
  { title: 'Ekonomi', url: '/ekonomi', icon: Fuel },
  { title: 'Community', url: '/community', icon: Users },
];

export function AppSidebar() {
  const { role, setRole, currentUser } = useRole();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const items = role === 'chef' ? chefItems : chauffeurItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Truck className="h-7 w-7 text-secondary" />
            <span className="text-lg font-bold text-sidebar-foreground tracking-tight">FleetFlow</span>
          </div>
        )}
        {collapsed && <Truck className="h-6 w-6 text-secondary mx-auto" />}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
              {role === 'chef' ? 'Ledningscentral' : 'Arbetsyta'}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-foreground font-semibold"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="space-y-3">
            <div className="text-xs text-sidebar-foreground/60 uppercase tracking-wider flex items-center gap-1">
              <UserCog className="h-3 w-3" /> Rollväxlare
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={role === 'chef' ? 'default' : 'ghost'}
                className={role === 'chef' ? 'flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs font-semibold' : 'flex-1 text-sidebar-foreground/70 hover:text-sidebar-foreground text-xs'}
                onClick={() => setRole('chef')}>Chef</Button>
              <Button size="sm" variant={role === 'chauffeur' ? 'default' : 'ghost'}
                className={role === 'chauffeur' ? 'flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs font-semibold' : 'flex-1 text-sidebar-foreground/70 hover:text-sidebar-foreground text-xs'}
                onClick={() => setRole('chauffeur')}>Chaufför</Button>
            </div>
            <div className="text-xs text-sidebar-foreground/50 truncate">{currentUser.name}</div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
