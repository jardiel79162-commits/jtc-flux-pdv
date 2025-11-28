import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Package, ShoppingCart, AlertTriangle, Calendar, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardData {
  salesToday: number;
  salesMonth: number;
  lowStockProducts: number;
  recentSales: number;
  subscriptionStatus: "active" | "trial" | "expired";
  trialDaysLeft?: number;
}

const Dashboard = () => {
  const [data, setData] = useState<DashboardData>({
    salesToday: 0,
    salesMonth: 0,
    lowStockProducts: 0,
    recentSales: 0,
    subscriptionStatus: "trial",
    trialDaysLeft: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Carregar perfil para status da assinatura
      const { data: profile } = await supabase
        .from("profiles")
        .select("trial_ends_at, subscription_ends_at, subscription_plan")
        .eq("id", user.id)
        .single();

      // Calcular dias restantes de teste
      let trialDaysLeft = 0;
      let subscriptionStatus: "active" | "trial" | "expired" = "expired";

      if (profile) {
        const now = new Date();

        if (profile.trial_ends_at && new Date(profile.trial_ends_at) > now) {
          const diffTime = new Date(profile.trial_ends_at).getTime() - now.getTime();
          trialDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          subscriptionStatus = "trial";
        } else if (profile.subscription_ends_at && new Date(profile.subscription_ends_at) > now) {
          subscriptionStatus = "active";
        }
      }

      // Vendas de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: salesToday } = await supabase
        .from("sales")
        .select("total_amount")
        .eq("user_id", user.id)
        .gte("created_at", today.toISOString());

      const totalToday = salesToday?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;

      // Vendas do mês
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const { data: salesMonth } = await supabase
        .from("sales")
        .select("total_amount")
        .eq("user_id", user.id)
        .gte("created_at", firstDayOfMonth.toISOString());

      const totalMonth = salesMonth?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;

      // Produtos com estoque baixo
      const { data: productsForStock, error: lowStockError } = await supabase
        .from("products")
        .select("id, stock_quantity, min_stock_quantity")
        .eq("user_id", user.id);

      if (lowStockError) {
        console.error("Erro ao carregar produtos com estoque baixo:", lowStockError);
      }

      const lowStockCount =
        productsForStock?.filter(
          (product) => product.stock_quantity <= (product.min_stock_quantity ?? 0)
        ).length || 0;

      // Vendas recentes
      const { data: recentSales } = await supabase
        .from("sales")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setData({
        salesToday: totalToday,
        salesMonth: totalMonth,
        lowStockProducts: lowStock?.length || 0,
        recentSales: recentSales?.length || 0,
        subscriptionStatus,
        trialDaysLeft,
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu negócio</p>
      </div>

      {/* Status da Assinatura */}
      {data.subscriptionStatus === "trial" && (
        <Card className="border-warning bg-warning/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-warning" />
                <CardTitle className="text-warning">Período de Teste</CardTitle>
              </div>
              <Badge variant="outline" className="border-warning text-warning">
                {data.trialDaysLeft} dias restantes
              </Badge>
            </div>
            <CardDescription>
              Aproveite seu período de teste gratuito e conheça todos os recursos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/assinatura">
              <Button variant="default">Assinar Agora</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {data.subscriptionStatus === "expired" && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <CardTitle className="text-destructive">Assinatura Expirada</CardTitle>
            </div>
            <CardDescription>
              Sua assinatura expirou. Assine um plano para continuar usando o sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/assinatura">
              <Button variant="destructive">Renovar Assinatura</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {data.subscriptionStatus === "active" && (
        <Card className="border-success bg-success/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              <CardTitle className="text-success">Assinatura Ativa</CardTitle>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {data.salesToday.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Faturamento do dia</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
            <ShoppingCart className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {data.salesMonth.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Faturamento mensal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.lowStockProducts}</div>
            <p className="text-xs text-muted-foreground">Produtos com baixo estoque</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Últimas Vendas</CardTitle>
            <Package className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.recentSales}</div>
            <p className="text-xs text-muted-foreground">Transações recentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>Acesse rapidamente as principais funcionalidades</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/pdv">
            <Button className="w-full" size="lg">
              <ShoppingCart className="w-5 h-5 mr-2" />
              Nova Venda
            </Button>
          </Link>

          <Link to="/produtos">
            <Button variant="outline" className="w-full" size="lg">
              <Package className="w-5 h-5 mr-2" />
              Gerenciar Produtos
            </Button>
          </Link>

          <Link to="/relatorios">
            <Button variant="outline" className="w-full" size="lg">
              <BarChart3 className="w-5 h-5 mr-2" />
              Ver Relatórios
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
