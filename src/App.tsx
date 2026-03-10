import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider, useRole } from "@/context/RoleContext";
import { AppLayout } from "@/components/layout/AppLayout";
import ChefDashboard from "@/pages/chef/Dashboard";
import ChauffeurMyDay from "@/pages/chauffeur/MyDay";
import Vehicles from "@/pages/Vehicles";
import VehicleDetail from "@/pages/VehicleDetail";
import AddVehicle from "@/pages/AddVehicle";
import RoutePlanning from "@/pages/RoutePlanning";
import Reminders from "@/pages/Reminders";
import Documents from "@/pages/Documents";
import Tasks from "@/pages/Tasks";
import SignScanning from "@/pages/SignScanning";
import Economy from "@/pages/Economy";
import Community from "@/pages/Community";
import Besiktning from "@/pages/Besiktning";
import Lastsäkring from "@/pages/Lastsäkring";
import NotFound from "@/pages/NotFound";
import Install from "@/pages/Install";

const queryClient = new QueryClient();

function AppRoutes() {
  const { role } = useRole();

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={role === 'chef' ? <ChefDashboard /> : <ChauffeurMyDay />} />
        <Route path="/fordon" element={<Vehicles />} />
        <Route path="/fordon/ny" element={<AddVehicle />} />
        <Route path="/fordon/:id" element={<VehicleDetail />} />
        <Route path="/ruttplanering" element={<RoutePlanning />} />
        <Route path="/paminnelser" element={<Reminders />} />
        <Route path="/dokument" element={<Documents />} />
        <Route path="/uppgifter" element={<Tasks />} />
        <Route path="/skyltskanning" element={<SignScanning />} />
        <Route path="/ekonomi" element={<Economy />} />
        <Route path="/community" element={<Community />} />
        <Route path="/install" element={<Install />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RoleProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </RoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
