import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Calendar, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Subscription = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"3_months" | "1_year" | null>(null);

  const plans = [
    {
      id: "3_months" as const,
      name: "Plano 3 Meses",
      price: 29.99,
      duration: "90 dias",
      features: [
        "Acesso completo ao PDV",
        "Gestão de produtos e estoque",
        "Relatórios detalhados",
        "Suporte por WhatsApp",
      ],
    },
    {
      id: "1_year" as const,
      name: "Plano 1 Ano",
      price: 69.99,
      duration: "365 dias",
      badge: "Mais Popular",
      features: [
        "Acesso completo ao PDV",
        "Gestão de produtos e estoque",
        "Relatórios detalhados",
        "Suporte prioritário",
        "Economia de 41%",
      ],
    },
  ];

  const handleBuyPlan = (planType: "3_months" | "1_year") => {
    const plan = plans.find((p) => p.id === planType);
    if (!plan) return;

    const message = encodeURIComponent(
      `Olá, tudo bem? Gostaria de falar sobre o ${plan.name} no valor de R$ ${plan.price.toFixed(2)}.`
    );
    window.open(`https://wa.me/5598981091476?text=${message}`, "_blank");
    
    setSelectedPlan(planType);
    setShowCodeInput(true);
  };

  const handleValidateCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsValidating(true);

    const formData = new FormData(e.currentTarget);
    const code = formData.get("code") as string;

    try {
      // Buscar código
      const { data: codeData, error: codeError } = await supabase
        .from("subscription_codes")
        .select("*")
        .eq("code", code)
        .eq("plan_type", selectedPlan)
        .is("used_by", null)
        .single();

      if (codeError || !codeData) {
        toast({
          variant: "destructive",
          title: "Código inválido",
          description: "Verifique o código: esse código é inválido ou já foi utilizado.",
        });
        return;
      }

      // Marcar código como usado e ativar assinatura
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const duration = selectedPlan === "3_months" ? 90 : 365;
      const subscriptionEndsAt = new Date();
      subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + duration);

      // Atualizar código
      await supabase
        .from("subscription_codes")
        .update({
          used_by: user.id,
          used_at: new Date().toISOString(),
        })
        .eq("id", codeData.id);

      // Atualizar perfil
      await supabase
        .from("profiles")
        .update({
          subscription_plan: selectedPlan,
          subscription_ends_at: subscriptionEndsAt.toISOString(),
          trial_ends_at: null,
        })
        .eq("id", user.id);

      toast({
        title: "Assinatura ativada!",
        description: "Seu plano foi ativado com sucesso. Aproveite!",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao validar código.",
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold mb-2">Assinatura</h1>
        <p className="text-muted-foreground">Escolha o plano ideal para o seu negócio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={plan.badge ? "border-primary shadow-lg" : ""}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="mt-2">
                    <span className="text-3xl font-bold text-foreground">
                      R$ {plan.price.toFixed(2)}
                    </span>
                  </CardDescription>
                </div>
                {plan.badge && (
                  <Badge className="bg-primary">{plan.badge}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{plan.duration}</span>
              </div>

              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-success" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                size="lg"
                onClick={() => handleBuyPlan(plan.id)}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Comprar Agora
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {showCodeInput && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Validar Código de Ativação</CardTitle>
            <CardDescription>
              Digite o código de 6 dígitos que você recebeu após o pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleValidateCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código de Ativação</Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="000000"
                  maxLength={6}
                  required
                  disabled={isValidating}
                  className="text-center text-2xl tracking-widest"
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCodeInput(false)}
                  disabled={isValidating}
                >
                  Deixar para Depois
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isValidating}
                >
                  {isValidating ? "Validando..." : "Ativar Assinatura"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Como funciona?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
              1
            </div>
            <div>
              <h3 className="font-semibold mb-1">Escolha seu plano</h3>
              <p className="text-sm text-muted-foreground">
                Selecione o plano que melhor se adapta às suas necessidades
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
              2
            </div>
            <div>
              <h3 className="font-semibold mb-1">Entre em contato via WhatsApp</h3>
              <p className="text-sm text-muted-foreground">
                Você será redirecionado para nosso WhatsApp para realizar o pagamento
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
              3
            </div>
            <div>
              <h3 className="font-semibold mb-1">Receba seu código</h3>
              <p className="text-sm text-muted-foreground">
                Após o pagamento, você receberá um código de ativação de 6 dígitos
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
              4
            </div>
            <div>
              <h3 className="font-semibold mb-1">Ative sua assinatura</h3>
              <p className="text-sm text-muted-foreground">
                Digite o código aqui no site e sua assinatura será ativada imediatamente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Subscription;
