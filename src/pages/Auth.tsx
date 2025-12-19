import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { signIn, signUp, validateInviteCode, type SignUpData } from "@/lib/auth";
import { isValidCPF } from "@/lib/cpfValidator";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, TrendingUp, Package, Loader2, Eye, EyeOff, HelpCircle, Gift, CheckCircle2, XCircle } from "lucide-react";
import { fetchCEP, fetchEstados, fetchCidades, type Estado, type Cidade } from "@/lib/location";
import logo from "@/assets/logo.jpg";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isFetchingCEP, setIsFetchingCEP] = useState(false);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [selectedEstado, setSelectedEstado] = useState("");
  const [selectedCidade, setSelectedCidade] = useState("");
  const [addressData, setAddressData] = useState({
    street: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  // Estado do código de convite
  const [hasInviteCode, setHasInviteCode] = useState<boolean | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeValidationStatus, setCodeValidationStatus] = useState<"idle" | "valid" | "invalid" | "used">("idle");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    // Verificar se já está logado
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    // Carregar estados
    fetchEstados().then(setEstados);

    // Verificar código de referência na URL
    const refCode = searchParams.get("ref");
    if (refCode) {
      setHasInviteCode(true);
      setInviteCode(refCode.toUpperCase());
      validateCode(refCode);
    }

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  useEffect(() => {
    // Carregar cidades quando estado mudar
    if (selectedEstado) {
      fetchCidades(selectedEstado).then(setCidades);
    } else {
      setCidades([]);
    }
  }, [selectedEstado]);

  const validateCode = async (code: string) => {
    if (code.length < 6) {
      setCodeValidationStatus("idle");
      return;
    }
    
    setIsValidatingCode(true);
    const result = await validateInviteCode(code);
    if (result.valid) {
      setCodeValidationStatus("valid");
    } else if (result.alreadyUsed) {
      setCodeValidationStatus("used");
    } else {
      setCodeValidationStatus("invalid");
    }
    setIsValidatingCode(false);
  };

  const handleInviteCodeChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setInviteCode(upperValue);
    if (upperValue.length >= 6) {
      validateCode(upperValue);
    } else {
      setCodeValidationStatus("idle");
    }
  };

  const handleCEPChange = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, "");
    if (cleanCEP.length === 8) {
      setIsFetchingCEP(true);
      const data = await fetchCEP(cleanCEP);
      
      if (data) {
        setAddressData({
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf,
        });
        setSelectedEstado(data.uf);
        setSelectedCidade(data.localidade);
        
        toast({
          title: "CEP encontrado!",
          description: "Endereço preenchido automaticamente.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "CEP não encontrado",
          description: "Verifique o CEP digitado.",
        });
      }
      setIsFetchingCEP(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const identifier = formData.get("identifier") as string;
    const password = formData.get("password") as string;

    try {
      await signIn(identifier, password);
      toast({
        title: "Bem-vindo!",
        description: "Login realizado com sucesso.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro no login",
        description: error.message || "Verifique suas credenciais e tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "As senhas não coincidem.",
      });
      setIsLoading(false);
      return;
    }

    // Validar CPF
    const cpfValue = (formData.get("cpf") as string).replace(/\D/g, "");
    if (!isValidCPF(cpfValue)) {
      toast({
        variant: "destructive",
        title: "CPF inválido",
        description: "Por favor, digite um CPF válido.",
      });
      setIsLoading(false);
      return;
    }

    // Validar telefone (11 dígitos com DDD)
    const phoneValue = (formData.get("phone") as string).replace(/\D/g, "");
    if (phoneValue.length !== 11) {
      toast({
        variant: "destructive",
        title: "Telefone inválido",
        description: "O telefone deve ter 11 dígitos (DDD + número).",
      });
      setIsLoading(false);
      return;
    }

    // Validar código de convite se fornecido
    if (hasInviteCode && inviteCode && codeValidationStatus !== "valid") {
      toast({
        variant: "destructive",
        title: "Código inválido",
        description: "Por favor, verifique o código de convite.",
      });
      setIsLoading(false);
      return;
    }

    // Verificar se o IP já usou este código de convite
    if (hasInviteCode && inviteCode && codeValidationStatus === "valid") {
      try {
        const response = await supabase.functions.invoke('validate-invite-ip', {
          body: { invite_code: inviteCode, action: 'check' }
        });
        
        if (response.error) {
          console.error('Erro ao verificar IP:', response.error);
        } else if (!response.data.can_use) {
          toast({
            variant: "destructive",
            title: "Código já utilizado",
            description: response.data.message || "Este dispositivo já utilizou este código de convite para criar uma conta.",
          });
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar IP:', error);
      }
    }

    const data: SignUpData = {
      fullName: formData.get("fullName") as string,
      cpf: (formData.get("cpf") as string).replace(/\D/g, ""),
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      cep: formData.get("cep") as string,
      street: addressData.street,
      number: formData.get("number") as string,
      neighborhood: addressData.neighborhood,
      city: selectedCidade,
      state: selectedEstado,
      password,
      referredByCode: hasInviteCode && codeValidationStatus === "valid" ? inviteCode : undefined,
    };

    try {
      await signUp(data);
      
      // Registrar uso do código de convite com IP
      if (hasInviteCode && inviteCode && codeValidationStatus === "valid") {
        await supabase.functions.invoke('validate-invite-ip', {
          body: { invite_code: inviteCode, action: 'register' }
        });
      }
      
      const trialMessage = hasInviteCode && codeValidationStatus === "valid" 
        ? "Você ganhou 1 mês + 3 dias de teste grátis! 🎉"
        : "Você ganhou 3 dias de teste grátis. Seja bem-vindo!";
      toast({
        title: "Conta criada!",
        description: trialMessage,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro no cadastro",
        description: error.message || "Não foi possível criar sua conta.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-accent/20 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations with enhanced glow */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/30 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent/30 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 animate-pulse" />
      <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-accent/25 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-1/4 left-1/4 w-[250px] h-[250px] bg-primary/25 rounded-full blur-[50px] animate-pulse" style={{ animationDelay: '2s' }} />
      
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 lg:gap-16 items-center relative z-10">
        {/* Seção de branding */}
        <div className="hidden lg:flex flex-col justify-center space-y-10 p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-primary to-accent rounded-3xl blur opacity-40 group-hover:opacity-60 transition duration-500" />
                <img src={logo} alt="JTC FluxPDV" className="relative w-28 h-28 rounded-2xl object-cover shadow-2xl" />
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-accent flex items-center justify-center shadow-lg animate-pulse">
                  <CheckCircle2 className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-5xl lg:text-6xl font-black gradient-text tracking-tight">
                  JTC FluxPDV
                </h1>
                <p className="text-xl text-muted-foreground font-light">
                  Sistema profissional de gestão para sua loja
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-5 p-5 rounded-2xl bg-card/60 backdrop-blur-xl border border-border/50 transition-all duration-300 hover:shadow-xl hover:border-primary/40 hover:scale-[1.02] group cursor-pointer">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-lg group-hover:shadow-primary/30 transition-all duration-300">
                <ShoppingCart className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-foreground">PDV Completo</h3>
                <p className="text-muted-foreground">Sistema de vendas rápido e eficiente</p>
              </div>
            </div>

            <div className="flex items-center gap-5 p-5 rounded-2xl bg-card/60 backdrop-blur-xl border border-border/50 transition-all duration-300 hover:shadow-xl hover:border-accent/40 hover:scale-[1.02] group cursor-pointer">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shrink-0 shadow-lg group-hover:shadow-accent/30 transition-all duration-300">
                <Package className="w-8 h-8 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-foreground">Gestão de Estoque</h3>
                <p className="text-muted-foreground">Controle total dos seus produtos</p>
              </div>
            </div>

            <div className="flex items-center gap-5 p-5 rounded-2xl bg-card/60 backdrop-blur-xl border border-border/50 transition-all duration-300 hover:shadow-xl hover:border-success/40 hover:scale-[1.02] group cursor-pointer">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-success to-success/70 flex items-center justify-center shrink-0 shadow-lg group-hover:shadow-success/30 transition-all duration-300">
                <TrendingUp className="w-8 h-8 text-success-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-foreground">Relatórios Detalhados</h3>
                <p className="text-muted-foreground">Análises completas do seu negócio</p>
              </div>
            </div>
          </div>

          <div className="pt-6 flex items-center gap-4 p-5 rounded-2xl bg-accent/10 border border-accent/30">
            <Gift className="w-8 h-8 text-accent" />
            <div>
              <p className="font-semibold text-foreground">Convide amigos e ganhe!</p>
              <p className="text-muted-foreground">
                <strong className="text-accent">1 mês grátis</strong> para cada cadastro com seu código!
              </p>
            </div>
          </div>
        </div>

        {/* Formulários */}
        <Card className="shadow-2xl border-0 bg-card/95 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
          
          <CardHeader className="text-center pb-2 relative z-10">
            <div className="flex flex-col items-center gap-4 mb-4">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-30" />
                <img src={logo} alt="JTC FluxPDV" className="relative w-20 h-20 rounded-xl object-cover shadow-xl" />
              </div>
              <div className="text-center">
                <CardTitle className="text-3xl font-black gradient-text">JTC FluxPDV</CardTitle>
                <CardDescription className="text-base mt-1">Sistema de Gestão Profissional</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 p-1 bg-muted/50">
                <TabsTrigger value="login" className="font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="register" className="font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Criar Conta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-6">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="identifier" className="text-sm font-medium">E-mail ou CPF</Label>
                    <Input
                      id="identifier"
                      name="identifier"
                      placeholder="seu@email.com ou 12345678900"
                      required
                      disabled={isLoading}
                      className="h-12 text-base bg-background/50 border-border/50 focus:border-primary focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        disabled={isLoading}
                        className="h-12 text-base pr-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>
                </form>

                {/* Mobile branding */}
                <div className="lg:hidden pt-4 border-t border-border/50">
                  <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                    <Gift className="w-5 h-5 text-accent" />
                    <span>Convide amigos e ganhe <strong className="text-accent">1 mês grátis</strong>!</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium">Nome Completo</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        required
                        disabled={isLoading}
                        className="h-11 bg-background/50 border-border/50 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cpf" className="text-sm font-medium">CPF</Label>
                      <Input
                        id="cpf"
                        name="cpf"
                        placeholder="000.000.000-00"
                        required
                        disabled={isLoading}
                        inputMode="numeric"
                        maxLength={14}
                        className={`h-11 bg-background/50 border-border/50 focus:border-primary ${cpfError ? "border-destructive" : ""}`}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, "");
                          if (value.length > 11) value = value.slice(0, 11);
                          
                          let formatted = value;
                          if (value.length > 3) {
                            formatted = value.slice(0, 3) + "." + value.slice(3);
                          }
                          if (value.length > 6) {
                            formatted = formatted.slice(0, 7) + "." + formatted.slice(7);
                          }
                          if (value.length > 9) {
                            formatted = formatted.slice(0, 11) + "-" + formatted.slice(11);
                          }
                          e.target.value = formatted;
                          
                          if (value.length === 11) {
                            if (!isValidCPF(value)) {
                              setCpfError("CPF inválido");
                            } else {
                              setCpfError(null);
                            }
                          } else {
                            setCpfError(null);
                          }
                        }}
                      />
                      {cpfError && (
                        <p className="text-xs text-destructive">{cpfError}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        disabled={isLoading}
                        className="h-11 bg-background/50 border-border/50 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">Telefone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        placeholder="(00) 00000-0000"
                        required
                        disabled={isLoading}
                        inputMode="numeric"
                        maxLength={15}
                        className={`h-11 bg-background/50 border-border/50 focus:border-primary ${phoneError ? "border-destructive" : ""}`}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, "");
                          if (value.length > 11) value = value.slice(0, 11);
                          
                          let formatted = value;
                          if (value.length > 0) {
                            formatted = "(" + value;
                          }
                          if (value.length > 2) {
                            formatted = "(" + value.slice(0, 2) + ") " + value.slice(2);
                          }
                          if (value.length > 7) {
                            formatted = "(" + value.slice(0, 2) + ") " + value.slice(2, 7) + "-" + value.slice(7);
                          }
                          e.target.value = formatted;
                          
                          if (value.length > 0 && value.length < 11) {
                            setPhoneError("Telefone deve ter 11 dígitos (DDD + número)");
                          } else {
                            setPhoneError(null);
                          }
                        }}
                      />
                      {phoneError && (
                        <p className="text-xs text-destructive">{phoneError}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cep" className="text-sm font-medium">CEP</Label>
                      <div className="relative">
                        <Input
                          id="cep"
                          name="cep"
                          placeholder="00000-000"
                          maxLength={9}
                          required
                          disabled={isLoading || isFetchingCEP}
                          inputMode="numeric"
                          className="h-11 bg-background/50 border-border/50 focus:border-primary"
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, "");
                            if (value.length > 8) value = value.slice(0, 8);
                            
                            let formatted = value;
                            if (value.length > 5) {
                              formatted = value.slice(0, 5) + "-" + value.slice(5);
                            }
                            e.target.value = formatted;
                            handleCEPChange(value);
                          }}
                        />
                        {isFetchingCEP && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Digite o CEP para preencher automaticamente
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="street" className="text-sm font-medium">Rua</Label>
                      <Input
                        id="street"
                        name="street"
                        value={addressData.street}
                        onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                        required
                        disabled={isLoading}
                        className="h-11 bg-background/50 border-border/50 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="number" className="text-sm font-medium">Número</Label>
                      <Input
                        id="number"
                        name="number"
                        required
                        disabled={isLoading}
                        className="h-11 bg-background/50 border-border/50 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="neighborhood" className="text-sm font-medium">Bairro</Label>
                      <Input
                        id="neighborhood"
                        name="neighborhood"
                        value={addressData.neighborhood}
                        onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                        required
                        disabled={isLoading}
                        className="h-11 bg-background/50 border-border/50 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-sm font-medium">Estado</Label>
                      <Select
                        value={selectedEstado}
                        onValueChange={setSelectedEstado}
                        disabled={isLoading}
                        required
                      >
                        <SelectTrigger className="h-11 bg-background/50 border-border/50">
                          <SelectValue placeholder="Selecione o estado" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {estados.map((estado) => (
                            <SelectItem key={estado.id} value={estado.sigla}>
                              {estado.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-sm font-medium">Cidade</Label>
                      <Select
                        value={selectedCidade}
                        onValueChange={setSelectedCidade}
                        disabled={isLoading || !selectedEstado}
                        required
                      >
                        <SelectTrigger className="h-11 bg-background/50 border-border/50">
                          <SelectValue placeholder={selectedEstado ? "Selecione a cidade" : "Selecione o estado primeiro"} />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50 max-h-[300px]">
                          {cidades.map((cidade) => (
                            <SelectItem key={cidade.id} value={cidade.nome}>
                              {cidade.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          required
                          disabled={isLoading}
                          className="h-11 pr-12 bg-background/50 border-border/50 focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar Senha</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          disabled={isLoading}
                          className="h-11 pr-12 bg-background/50 border-border/50 focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Código de Convite */}
                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3 text-accent">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Gift className="h-4 w-4" />
                      </div>
                      <span className="font-semibold">Código de Convite</span>
                    </div>
                    
                    {hasInviteCode === null ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Você tem um código de convite de um amigo?
                        </p>
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-11 border-accent text-accent hover:bg-accent/10 font-semibold"
                            onClick={() => setHasInviteCode(true)}
                          >
                            Sim, tenho!
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-11"
                            onClick={() => setHasInviteCode(false)}
                          >
                            Não tenho
                          </Button>
                        </div>
                      </div>
                    ) : hasInviteCode ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Digite o código de convite</Label>
                          <div className="relative">
                            <Input
                              value={inviteCode}
                              onChange={(e) => handleInviteCodeChange(e.target.value)}
                              placeholder="Ex: ABC123"
                              maxLength={6}
                              className="h-12 uppercase font-mono text-lg tracking-widest text-center bg-background/50 border-border/50"
                              disabled={isLoading}
                              autoCapitalize="characters"
                              style={{ textTransform: 'uppercase' }}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              {isValidatingCode && (
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              )}
                              {!isValidatingCode && codeValidationStatus === "valid" && (
                                <CheckCircle2 className="h-6 w-6 text-accent" />
                              )}
                              {!isValidatingCode && (codeValidationStatus === "invalid" || codeValidationStatus === "used") && (
                                <XCircle className="h-6 w-6 text-destructive" />
                              )}
                            </div>
                          </div>
                          {codeValidationStatus === "valid" && (
                            <p className="text-sm text-accent font-semibold bg-accent/10 p-2 rounded-lg text-center">
                              🎉 Código válido! Você ganhará 1 mês + 3 dias grátis!
                            </p>
                          )}
                          {codeValidationStatus === "invalid" && (
                            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg text-center">
                              Código inválido. Verifique e tente novamente.
                            </p>
                          )}
                          {codeValidationStatus === "used" && (
                            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg text-center">
                              Este código já foi utilizado por outra pessoa.
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setHasInviteCode(false);
                            setInviteCode("");
                            setCodeValidationStatus("idle");
                          }}
                        >
                          Não tenho código
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <p className="text-sm text-muted-foreground">
                          Sem código? Sem problema! Você ainda ganha <strong className="text-foreground">3 dias grátis</strong>.
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-accent hover:text-accent hover:bg-accent/10"
                          onClick={() => setHasInviteCode(true)}
                        >
                          Na verdade, tenho um código!
                        </Button>
                      </div>
                    )}
                  </div>

                  <Button type="submit" className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Criando sua conta...
                      </>
                    ) : (
                      "Criar Conta"
                    )}
                  </Button>

                  <p className="text-sm text-center text-muted-foreground">
                    {hasInviteCode && codeValidationStatus === "valid" 
                      ? "Ao criar sua conta, você ganha 1 mês + 3 dias de teste grátis! 🎉"
                      : "Ao criar sua conta, você ganha 3 dias de teste grátis"
                    }
                  </p>

                  {/* Manual de Como Criar Conta */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full h-11 border-border/50 hover:bg-muted/50" type="button">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Manual: Como Criar Minha Conta
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                          <HelpCircle className="h-5 w-5 text-primary" />
                          Manual Completo: Como Criar Sua Conta
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 text-sm">
                        {/* Introdução */}
                        <div className="bg-primary/5 p-4 rounded-lg">
                          <p className="text-muted-foreground">
                            Bem-vindo ao JTC FluxPDV! Este manual vai te guiar passo a passo no processo de criação da sua conta. 
                            Ao finalizar o cadastro, você ganhará automaticamente <strong>3 dias de teste grátis</strong> com acesso completo ao sistema.
                            Se você tiver um <strong>código de convite</strong>, ganha <strong>1 mês + 3 dias grátis</strong>!
                          </p>
                        </div>

                        {/* Passo 1 */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                            Informações Pessoais
                          </h3>
                          <div className="ml-8 space-y-2 text-muted-foreground">
                            <p><strong>Nome Completo:</strong> Digite seu nome completo (nome e sobrenome). Este nome aparecerá no sistema e nos relatórios.</p>
                            <p><strong>CPF:</strong> Digite seu CPF (apenas números ou com pontos e traço). O CPF é usado para identificação única e também pode ser usado para fazer login.</p>
                            <div className="bg-yellow-500/10 p-2 rounded text-xs border border-yellow-500/20">
                              ⚠️ <strong>Importante:</strong> O sistema valida se o CPF é válido. CPFs com dígitos verificadores incorretos serão rejeitados.
                            </div>
                            <div className="bg-muted/50 p-2 rounded text-xs">
                              💡 <strong>Dica:</strong> O CPF pode ser digitado com ou sem formatação (12345678900 ou 123.456.789-00)
                            </div>
                          </div>
                        </div>

                        {/* Passo 2 */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                            Contato
                          </h3>
                          <div className="ml-8 space-y-2 text-muted-foreground">
                            <p><strong>E-mail:</strong> Digite um e-mail válido. Este e-mail será usado para:</p>
                            <ul className="list-disc list-inside ml-2">
                              <li>Fazer login no sistema</li>
                              <li>Receber notificações importantes</li>
                              <li>Recuperação de conta (se necessário)</li>
                            </ul>
                            <p><strong>Telefone:</strong> Digite seu número de telefone com DDD. Exemplo: (98) 99999-9999</p>
                          </div>
                        </div>

                        {/* Passo 3 */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                            Endereço
                          </h3>
                          <div className="ml-8 space-y-2 text-muted-foreground">
                            <p><strong>CEP:</strong> Digite o CEP da sua localização. O sistema irá preencher automaticamente:</p>
                            <ul className="list-disc list-inside ml-2">
                              <li>Rua</li>
                              <li>Bairro</li>
                              <li>Cidade</li>
                              <li>Estado</li>
                            </ul>
                            <div className="bg-muted/50 p-2 rounded text-xs">
                              💡 <strong>Dica:</strong> Se não souber o CEP, você pode selecionar primeiro o Estado e depois a Cidade manualmente.
                            </div>
                            <p><strong>Número:</strong> Digite o número do seu endereço (casa, apartamento, sala comercial, etc.)</p>
                            <p><strong>Campos Automáticos:</strong> Após digitar o CEP, os campos Rua, Bairro, Estado e Cidade serão preenchidos automaticamente. Você pode editá-los se necessário.</p>
                          </div>
                        </div>

                        {/* Passo 4 */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                            Senha
                          </h3>
                          <div className="ml-8 space-y-2 text-muted-foreground">
                            <p><strong>Senha:</strong> Crie uma senha segura para sua conta.</p>
                            <p><strong>Confirmar Senha:</strong> Digite a mesma senha novamente para confirmar.</p>
                            <div className="bg-muted/50 p-2 rounded text-xs">
                              💡 <strong>Dicas de segurança:</strong>
                              <ul className="list-disc list-inside ml-2 mt-1">
                                <li>Use pelo menos 6 caracteres</li>
                                <li>Combine letras maiúsculas, minúsculas e números</li>
                                <li>Evite senhas óbvias como "123456" ou sua data de nascimento</li>
                              </ul>
                            </div>
                            <p>Clique no ícone do olho (👁️) para visualizar a senha enquanto digita.</p>
                          </div>
                        </div>

                        {/* Passo 5 - Código de Convite */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">5</span>
                            Código de Convite (Opcional)
                          </h3>
                          <div className="ml-8 space-y-2 text-muted-foreground">
                            <p>Se você recebeu um código de convite de um amigo:</p>
                            <ol className="list-decimal list-inside ml-2">
                              <li>Clique em "Sim, tenho um código!"</li>
                              <li>Digite o código de 8 caracteres</li>
                              <li>Aguarde a validação (ícone verde = válido)</li>
                            </ol>
                            <div className="bg-accent/10 p-2 rounded text-xs border border-accent/20">
                              🎁 <strong>Benefícios:</strong> Com código válido você ganha <strong>1 mês + 3 dias grátis</strong> (33 dias total) e seu amigo ganha mais 1 mês!
                            </div>
                            <div className="bg-destructive/10 p-2 rounded text-xs border border-destructive/20">
                              ⚠️ <strong>Atenção:</strong> Cada código só pode ser usado uma vez. Códigos já utilizados serão rejeitados.
                            </div>
                          </div>
                        </div>

                        {/* Passo 6 */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">6</span>
                            Finalizar Cadastro
                          </h3>
                          <div className="ml-8 space-y-2 text-muted-foreground">
                            <p>Após preencher todos os campos, clique no botão <strong>"Criar Conta"</strong>.</p>
                            <p>O sistema irá:</p>
                            <ul className="list-disc list-inside ml-2">
                              <li>Validar o CPF (dígitos verificadores)</li>
                              <li>Validar o código de convite (se informado)</li>
                              <li>Verificar se e-mail e CPF já não estão cadastrados</li>
                              <li>Criar sua conta no sistema</li>
                              <li>Ativar automaticamente o período de teste grátis</li>
                              <li>Redirecionar você para o Dashboard principal</li>
                            </ul>
                          </div>
                        </div>

                        {/* Após o Cadastro */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <span className="bg-accent text-accent-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">✓</span>
                            Após o Cadastro
                          </h3>
                          <div className="ml-8 space-y-2 text-muted-foreground">
                            <p>Com sua conta criada, você poderá:</p>
                            <ul className="list-disc list-inside ml-2">
                              <li>Configurar as informações da sua loja</li>
                              <li>Cadastrar produtos e categorias</li>
                              <li>Cadastrar clientes</li>
                              <li>Realizar vendas</li>
                              <li>Gerar relatórios</li>
                              <li>Compartilhar seu código de convite para ganhar mais tempo grátis</li>
                            </ul>
                            <div className="bg-accent/10 p-3 rounded-lg mt-3">
                              <p className="font-medium text-foreground">📌 Seu Código de Convite:</p>
                              <p>Após criar sua conta, você receberá um código único nas Configurações. Compartilhe com amigos e ganhe <strong>1 mês grátis</strong> para cada pessoa que se cadastrar usando seu código!</p>
                            </div>
                          </div>
                        </div>

                        {/* Login */}
                        <div className="space-y-2 border-t pt-4">
                          <h3 className="font-semibold text-foreground">Como Fazer Login</h3>
                          <div className="text-muted-foreground">
                            <p>Após criar sua conta, você pode fazer login de duas formas:</p>
                            <ul className="list-disc list-inside ml-2 mt-2">
                              <li><strong>E-mail + Senha:</strong> Use o e-mail cadastrado</li>
                              <li><strong>CPF + Senha:</strong> Use o CPF cadastrado (apenas números)</li>
                            </ul>
                          </div>
                        </div>

                        {/* Problemas Comuns */}
                        <div className="space-y-2 border-t pt-4">
                          <h3 className="font-semibold text-foreground">Problemas Comuns</h3>
                          <div className="text-muted-foreground space-y-2">
                            <p><strong>"CPF inválido":</strong> O CPF digitado não passou na validação. Verifique se digitou corretamente (11 dígitos).</p>
                            <p><strong>"As senhas não coincidem":</strong> Verifique se digitou a mesma senha nos dois campos.</p>
                            <p><strong>"CEP não encontrado":</strong> Verifique se o CEP está correto ou preencha o endereço manualmente.</p>
                            <p><strong>"E-mail já cadastrado":</strong> Este e-mail já possui uma conta. Use outro e-mail ou faça login.</p>
                            <p><strong>"CPF já cadastrado":</strong> Este CPF já possui uma conta. Faça login com suas credenciais.</p>
                            <p><strong>"Código de convite inválido":</strong> O código não existe. Verifique com quem te enviou.</p>
                            <p><strong>"Código já utilizado":</strong> Este código já foi usado por outra pessoa. Cada código só pode ser usado uma vez.</p>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
