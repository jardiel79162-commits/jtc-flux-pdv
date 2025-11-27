import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Subscription from "./pages/Subscription";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<Auth />} />
          
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/assinatura" element={<Subscription />} />
            <Route path="/produtos" element={<div className="text-center py-20"><h2 className="text-2xl">Produtos - Em construção</h2></div>} />
            <Route path="/pdv" element={<div className="text-center py-20"><h2 className="text-2xl">PDV - Em construção</h2></div>} />
            <Route path="/relatorios" element={<div className="text-center py-20"><h2 className="text-2xl">Relatórios - Em construção</h2></div>} />
            <Route path="/configuracoes" element={<div className="text-center py-20"><h2 className="text-2xl">Configurações - Em construção</h2></div>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
