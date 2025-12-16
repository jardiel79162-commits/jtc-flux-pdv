import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Lock, Clock, AlertCircle, PartyPopper, RefreshCw } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import confetti from "canvas-confetti";
import giftBoxImage from "@/assets/gift-box.jpg";

interface RedemptionResult {
  success: boolean;
  error?: string;
  benefit_type?: string;
  days_added?: number;
}

const WeeklyRedemption = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [redemptionResult, setRedemptionResult] = useState<RedemptionResult | null>(null);

  // Verifica se o usuário é admin
  const checkAdminStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error) {
        console.error("Erro ao verificar role:", error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error("Erro ao verificar admin:", error);
      return false;
    }
  }, []);

  // Gera um novo código
  const generateCode = async () => {
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.rpc("create_weekly_code_for_user", {
        p_user_id: user.id,
      });

      if (error) throw error;

      setGeneratedCode(data as string);
      setTimeRemaining(2); // Inicia timer de 2 segundos
      
      toast({
        title: "Código gerado!",
        description: `Seu código: ${data}`,
      });
    } catch (error: any) {
      console.error("Erro ao gerar código:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o código.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeRemaining]);

  useEffect(() => {
    const init = async () => {
      const adminStatus = await checkAdminStatus();
      setIsAdmin(adminStatus);
      setIsLoading(false);
    };

    init();
  }, [checkAdminStatus]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
  };

  const handleRedeem = async () => {
    if (code.length !== 6) {
      toast({
        title: "Código inválido",
        description: "O código deve ter exatamente 6 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setIsRedeeming(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.rpc("redeem_weekly_code", {
        p_user_id: user.id,
        p_code: code,
      });

      if (error) throw error;

      const result = data as unknown as RedemptionResult;
      setRedemptionResult(result);

      if (result.success) {
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.6 },
          colors: ["#4C6FFF", "#00E0A4", "#FFD700"],
        });

        toast({
          title: "🎉 Parabéns!",
          description: `Você ganhou ${result.benefit_type} de assinatura!`,
        });

        // Reseta após 3 segundos para permitir novo resgate
        setTimeout(() => {
          setRedemptionResult(null);
          setCode("");
          setGeneratedCode("");
        }, 3000);
      } else {
        toast({
          title: "Erro no resgate",
          description: result.error || "Código inválido ou já utilizado.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Erro ao resgatar:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível resgatar o código.",
        variant: "destructive",
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      );
    }

    // Não é admin
    if (!isAdmin) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-8 pb-8">
              <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground">
                Este módulo está disponível apenas para administradores da loja.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Resgate bem-sucedido
    if (redemptionResult?.success) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <Card className="w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-br from-primary/20 to-accent/20 p-6">
              <PartyPopper className="w-20 h-20 text-primary mx-auto animate-bounce" />
            </div>
            <CardContent className="pt-6 pb-8 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                🎉 Parabéns!
              </h2>
              <p className="text-lg text-muted-foreground mb-4">
                Você resgatou com sucesso:
              </p>
              <div className="bg-gradient-to-r from-primary to-accent text-white rounded-xl py-4 px-6 mb-4">
                <p className="text-3xl font-bold">{redemptionResult.benefit_type}</p>
                <p className="text-sm opacity-90">+{redemptionResult.days_added} dias de assinatura</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Seu plano foi atualizado automaticamente!
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Interface de resgate
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md overflow-hidden">
          <div className="bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 p-6 relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(76,111,255,0.1),transparent_70%)]" />
            <img 
              src={giftBoxImage} 
              alt="Caixa de presente" 
              className="w-36 h-36 mx-auto object-contain relative z-10 drop-shadow-2xl animate-pulse"
            />
          </div>
          
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="w-6 h-6 text-primary" />
              <CardTitle className="text-2xl">Flux Resgate Semanal</CardTitle>
            </div>
            <CardDescription>
              Gere seu código e resgate seu benefício!
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Botão Regenerar e Código Gerado */}
            <div className="space-y-3">
              <Button
                onClick={generateCode}
                disabled={isGenerating}
                variant="outline"
                className="w-full h-12 text-base font-semibold"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                    Gerando...
                  </div>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2" />
                    {generatedCode ? "Regenerar Código" : "Gerar Código"}
                  </>
                )}
              </Button>

              {generatedCode && (
                <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Seu código:</p>
                  <p className="text-3xl font-mono font-bold text-primary tracking-[0.3em]">
                    {generatedCode}
                  </p>
                  {timeRemaining > 0 && (
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <Clock className="w-4 h-4 text-destructive" />
                      <span className="text-sm text-destructive font-medium">
                        {timeRemaining}s
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input de código */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Código de Resgate
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={code}
                onChange={handleCodeChange}
                maxLength={6}
                className="text-center text-3xl font-mono tracking-[0.5em] h-16"
                disabled={isRedeeming}
              />
              <p className="text-xs text-muted-foreground text-center">
                Digite os 6 dígitos do código gerado
              </p>
            </div>

            {/* Botão de resgatar */}
            <Button
              onClick={handleRedeem}
              disabled={code.length !== 6 || isRedeeming}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300"
            >
              {isRedeeming ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Resgatando...
                </div>
              ) : (
                <>
                  <Gift className="w-5 h-5 mr-2" />
                  RESGATAR
                </>
              )}
            </Button>

            {/* Aviso */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                Clique em "Gerar Código" para obter seu código exclusivo. Cada código só pode ser utilizado uma vez.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <PageLoader pageName="Flux Resgate Semanal">
      {renderContent()}
    </PageLoader>
  );
};

export default WeeklyRedemption;
