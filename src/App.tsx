import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { RoleProvider } from "@/context/RoleContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import Auth from "@/pages/Auth";

const queryClient = new QueryClient();

function HomeRoute() {
  const { role } = useAuth();
  return role === 'chef' ? <ChefDashboard /> : <ChauffeurMyDay />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/ruttplanering" element={
        <ProtectedRoute><RoutePlanning /></ProtectedRoute>
      } />
      <Route path="*" element={
        <ProtectedRoute>
          <AppLayout>
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/fordon" element={<Vehicles />} />
              <Route path="/fordon/ny" element={<AddVehicle />} />
              <Route path="/fordon/:id" element={<VehicleDetail />} />
              <Route path="/paminnelser" element={<Reminders />} />
              <Route path="/dokument" element={<Documents />} />
              <Route path="/uppgifter" element={<Tasks />} />
              <Route path="/skyltskanning" element={<SignScanning />} />
              <Route path="/ekonomi" element={<Economy />} />
              <Route path="/community" element={<Community />} />
              <Route path="/besiktning" element={<Besiktning />} />
              <Route path="/lastsäkring" element={<Lastsäkring />} />
              <Route path="/install" element={<Install />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RoleProvider>
            <AppRoutes />
          </RoleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
