import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  X,
  History,
  UserCog,
  Truck,
  Inbox,
} from "lucide-react";
import { User, Session } from "@supabase/supabase-js";
import logo from "@/assets/logo.jpg";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { SubscriptionBlocker } from "@/components/SubscriptionBlocker";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasEmployees, setHasEmployees] = useState(false);
  const { permissions, loading, canAccessRoute, subscriptionActive } = useUserPermissions();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchStoreSettings = async () => {
    if (!user || !permissions.isAdmin) return;

    const { data: settings } = await supabase
      .from("store_settings")
      .select("has_employees")
      .eq("user_id", user.id)
      .single();
    
    if (settings) {
      setHasEmployees(settings.has_employees || false);
    }
  };

  useEffect(() => {
    if (!loading && user) {
      fetchStoreSettings();
    }
  }, [loading, user, permissions.isAdmin]);

  // Escutar evento de atualização das configurações
  useEffect(() => {
    const handleSettingsUpdate = () => {
      fetchStoreSettings();
    };

    window.addEventListener('store-settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('store-settings-updated', handleSettingsUpdate);
    };
  }, [user, permissions.isAdmin]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const allMenuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", permission: true },
    { icon: Package, label: "Produtos", path: "/produtos", permission: canAccessRoute("/produtos") },
    { icon: ShoppingCart, label: "Venda", path: "/pdv", permission: canAccessRoute("/pdv") },
    { icon: Users, label: "Clientes", path: "/clientes", permission: canAccessRoute("/clientes") },
    { icon: Truck, label: "Fornecedores", path: "/fornecedores", permission: true },
    { icon: History, label: "Histórico", path: "/historico", permission: true },
    { icon: Inbox, label: "Caixa de Correios", path: "/caixa-correios", permission: true },
    { icon: BarChart3, label: "Relatórios", path: "/relatorios", permission: true },
    { icon: UserCog, label: "Funcionários", path: "/funcionarios", permission: permissions.isAdmin && hasEmployees },
    { icon: Settings, label: "Configurações", path: "/configuracoes", permission: canAccessRoute("/configuracoes") },
    { icon: CreditCard, label: "Assinatura", path: "/assinatura", permission: canAccessRoute("/assinatura") },
  ];

  const menuItems = allMenuItems.filter(item => item.permission);

  // Mostrar bloqueador se for funcionário e assinatura inativa
  if (permissions.isEmployee && !subscriptionActive) {
    return <SubscriptionBlocker isEmployee={true} />;
  }

  if (loading || !user || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-40 flex items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
          <img src={logo} alt="JTC FluxPDV Logo" className="w-10 h-10 rounded-full object-cover" />
          <h1 className="text-xl font-bold text-primary">JTC FluxPDV</h1>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </header>

      {/* Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-background pt-16">
          <nav className="p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive"
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLogout();
              }}
            >
              <LogOut className="w-5 h-5" />
              Sair
            </Button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="pt-16 min-h-screen overflow-x-hidden">
        <div className="p-4 md:p-8 w-full max-w-full overflow-x-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
