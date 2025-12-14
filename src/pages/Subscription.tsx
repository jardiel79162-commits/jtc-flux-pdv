import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Calendar, CreditCard, Copy, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Subscription = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    paymentId: string;
    qrCodeBase64: string;
    pixCopyPaste: string;
    amount: number;
    planName: string;
  } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>('pending');
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Limpar intervalo ao desmontar
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  // Iniciar verificação automática quando pagamento é criado
  useEffect(() => {
    if (paymentData && paymentStatus === 'pending') {
      // Verificar a cada 5 segundos
      checkIntervalRef.current = setInterval(() => {
        checkPaymentStatus();
      }, 5000);

      return () => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
      };
    }
  }, [paymentData, paymentStatus]);

  const handleBuyPlan = async (planType: "3_months" | "1_year") => {
    setIsGenerating(true);
    setPaymentData(null);
    setPaymentStatus('pending');

    try {
      const { data, error } = await supabase.functions.invoke('create-pix-payment', {
        body: { planType },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setPaymentData({
        paymentId: data.paymentId,
        qrCodeBase64: data.qrCodeBase64,
        pixCopyPaste: data.pixCopyPaste,
        amount: data.amount,
        planName: data.planName,
      });

      toast({
        title: "PIX gerado!",
        description: "Escaneie o QR Code ou copie o código para pagar.",
      });
    } catch (error: any) {
      console.error('Error creating payment:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao gerar pagamento PIX.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentData || isCheckingStatus) return;

    setIsCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { paymentId: paymentData.paymentId },
      });

      if (error) throw error;

      if (data.status === 'approved') {
        setPaymentStatus('approved');
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
        toast({
          title: "Pagamento confirmado!",
          description: "Sua assinatura foi ativada com sucesso!",
        });
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleCopyPix = async () => {
    if (!paymentData?.pixCopyPaste) return;

    try {
      await navigator.clipboard.writeText(paymentData.pixCopyPaste);
      toast({
        title: "Código copiado!",
        description: "Cole no aplicativo do seu banco para pagar.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível copiar o código.",
      });
    }
  };

  const handleCancelPayment = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    setPaymentData(null);
    setPaymentStatus('pending');
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold mb-2">Assinatura</h1>
        <p className="text-muted-foreground">Escolha o plano ideal para o seu negócio</p>
      </div>

      {!paymentData ? (
        <>
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
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Gerando PIX...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Pagar com PIX
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

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
                  <h3 className="font-semibold mb-1">Escaneie o QR Code PIX</h3>
                  <p className="text-sm text-muted-foreground">
                    Use o aplicativo do seu banco para escanear ou copie o código
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Pagamento confirmado automaticamente</h3>
                  <p className="text-sm text-muted-foreground">
                    Assim que o pagamento for confirmado, sua assinatura é ativada instantaneamente
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-primary max-w-lg mx-auto">
          <CardHeader className="text-center">
            {paymentStatus === 'approved' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <CardTitle className="text-success">Pagamento Confirmado!</CardTitle>
                <CardDescription>
                  Sua assinatura foi ativada com sucesso. Redirecionando...
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle>Pagar {paymentData.planName}</CardTitle>
                <CardDescription>
                  Escaneie o QR Code ou copie o código PIX
                </CardDescription>
              </>
            )}
          </CardHeader>
          
          {paymentStatus !== 'approved' && (
            <CardContent className="space-y-6">
              <div className="text-center">
                <span className="text-3xl font-bold">
                  R$ {paymentData.amount.toFixed(2)}
                </span>
              </div>

              {paymentData.qrCodeBase64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${paymentData.qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="w-64 h-64 rounded-lg border"
                  />
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm text-center text-muted-foreground">
                  Ou copie o código PIX:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentData.pixCopyPaste || ''}
                    readOnly
                    className="flex-1 px-3 py-2 text-xs rounded-md border bg-muted truncate"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyPix}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                {isCheckingStatus ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>Aguardando pagamento...</span>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={checkPaymentStatus}
                disabled={isCheckingStatus}
              >
                {isCheckingStatus ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Verificar Pagamento
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={handleCancelPayment}
              >
                Cancelar e escolher outro plano
              </Button>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
};

export default Subscription;
