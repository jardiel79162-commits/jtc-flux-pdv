import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SubscriptionBlockerProps {
  isTrial?: boolean;
  isEmployee?: boolean;
}

export const SubscriptionBlocker = ({ isTrial = false, isEmployee = false }: SubscriptionBlockerProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSubscribe = () => {
    navigate("/assinatura");
  };

  // Versão simplificada para funcionários bloqueados
  if (isEmployee) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl">Acesso Bloqueado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              A assinatura da loja está vencida ou inativa.
            </p>
            <p className="text-center text-foreground font-medium">
              Entre em contato com o seu administrador para atualizar o plano da loja.
            </p>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Versão completa para admins
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
      <Card className="max-w-lg w-full shadow-2xl border-2 border-destructive">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isTrial ? "Período de Teste Expirado" : "Assinatura Vencida"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-3">
            <p className="text-lg text-muted-foreground">
              Você não pode utilizar estas funções pois {isTrial ? "seu período de teste" : "seu plano"} já venceu.
            </p>
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-foreground">Funcionalidades bloqueadas:</h3>
              <ul className="text-sm text-muted-foreground space-y-1 text-left">
                <li>• Realizar vendas no PDV</li>
                <li>• Adicionar novos produtos</li>
                <li>• Cadastrar clientes</li>
                <li>• Editar informações</li>
              </ul>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <Button
              onClick={handleSubscribe}
              className="w-full h-14 text-lg bg-gradient-to-r from-primary to-accent hover:from-primary-hover hover:to-accent-hover"
              size="lg"
            >
              <CreditCard className="mr-2 h-5 w-5" />
              Assinar Agora
            </Button>
            
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full h-12"
              size="lg"
            >
              <LogOut className="mr-2 h-5 w-5" />
              Sair da Conta
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground pt-2">
            Entre em contato com o suporte caso tenha dúvidas sobre sua assinatura.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionBlocker;
