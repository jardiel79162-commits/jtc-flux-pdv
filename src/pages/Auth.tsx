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
import { ShoppingCart, TrendingUp, Package, Loader2, Eye, EyeOff, HelpCircle, Gift, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Check, User, MapPin, Ticket, Mail, ExternalLink } from "lucide-react";
import { fetchCEP, fetchEstados, fetchCidades, type Estado, type Cidade } from "@/lib/location";
import logo from "@/assets/logo.jpg";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

  // Estado do passo do cadastro (1, 2 ou 3)
  const [registerStep, setRegisterStep] = useState(1);

  // Dados do formulário de cadastro
  const [formData, setFormData] = useState({
    fullName: "",
    cpf: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    cep: "",
    number: "",
  });

  // Estado do código de convite
  const [hasInviteCode, setHasInviteCode] = useState<boolean | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeValidationStatus, setCodeValidationStatus] = useState<"idle" | "valid" | "invalid" | "used">("idle");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Estado para conta bloqueada
  const [showBlockedAccountDialog, setShowBlockedAccountDialog] = useState(false);
  
  // Estado para conta criada (email enviado)
  const [accountCreated, setAccountCreated] = useState(false);

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

  const formatCPF = (value: string) => {
    let v = value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    
    let formatted = v;
    if (v.length > 3) {
      formatted = v.slice(0, 3) + "." + v.slice(3);
    }
    if (v.length > 6) {
      formatted = formatted.slice(0, 7) + "." + formatted.slice(7);
    }
    if (v.length > 9) {
      formatted = formatted.slice(0, 11) + "-" + formatted.slice(11);
    }
    return formatted;
  };

  const formatPhone = (value: string) => {
    let v = value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    
    let formatted = v;
    if (v.length > 0) {
      formatted = "(" + v;
    }
    if (v.length > 2) {
      formatted = "(" + v.slice(0, 2) + ") " + v.slice(2);
    }
    if (v.length > 7) {
      formatted = "(" + v.slice(0, 2) + ") " + v.slice(2, 7) + "-" + v.slice(7);
    }
    return formatted;
  };

  const formatCEPInput = (value: string) => {
    let v = value.replace(/\D/g, "");
    if (v.length > 8) v = v.slice(0, 8);
    
    if (v.length > 5) {
      return v.slice(0, 5) + "-" + v.slice(5);
    }
    return v;
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formDataEvent = new FormData(e.currentTarget);
    const identifier = formDataEvent.get("identifier") as string;
    const password = formDataEvent.get("password") as string;

    try {
      // Verificar se é CPF e se está bloqueado
      const cleanIdentifier = identifier.replace(/\D/g, "");
      const isCPF = /^\d{11}$/.test(cleanIdentifier);
      
      if (isCPF) {
        const { data: isBlocked } = await supabase.rpc('is_cpf_blocked', {
          check_cpf: cleanIdentifier
        });
        
        if (isBlocked) {
          setShowBlockedAccountDialog(true);
          setIsLoading(false);
          return;
        }
      }

      await signIn(identifier, password);
      toast({
        title: "Bem-vindo!",
        description: "Login realizado com sucesso.",
      });
    } catch (error: any) {
      // Verificar se é erro de email não confirmado
      const errorMessage = error.message?.toLowerCase() || "";
      if (errorMessage.includes("email not confirmed") || errorMessage.includes("email_not_confirmed")) {
        toast({
          variant: "destructive",
          title: "E-mail não confirmado",
          description: "Você ainda não fez a confirmação na sua caixa de entrada. Verifique seu e-mail e clique no link de confirmação.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: error.message || "Verifique suas credenciais e tente novamente.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivateAccount = () => {
    const message = encodeURIComponent("Olá 👋 gostaria de solicitar a reativação da minha conta do JTC FLUX PDV 🔄💻. Desde já, agradeço 🙏");
    window.open(`https://wa.me/5598981091476?text=${message}`, "_blank");
    setShowBlockedAccountDialog(false);
  };

  // Detectar tipo de email
  const getEmailProvider = (email: string): "gmail" | "outlook" | "unknown" => {
    const lowerEmail = email.toLowerCase();
    if (lowerEmail.includes("@gmail.com")) return "gmail";
    if (lowerEmail.includes("@outlook.com") || lowerEmail.includes("@hotmail.com") || lowerEmail.includes("@live.com")) return "outlook";
    return "unknown";
  };

  const isValidEmailProvider = (email: string): boolean => {
    const provider = getEmailProvider(email);
    return provider === "gmail" || provider === "outlook";
  };

  const openEmailApp = () => {
    const provider = getEmailProvider(formData.email);
    if (provider === "gmail") {
      window.open("https://mail.google.com", "_blank");
    } else if (provider === "outlook") {
      window.open("https://outlook.live.com", "_blank");
    }
  };

  // Validação do passo 1 (Dados Pessoais)
  const validateStep1 = () => {
    if (!formData.fullName.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Nome completo é obrigatório" });
      return false;
    }

    const cpfValue = formData.cpf.replace(/\D/g, "");
    if (!isValidCPF(cpfValue)) {
      toast({ variant: "destructive", title: "Erro", description: "CPF inválido" });
      return false;
    }

    if (!formData.email.includes("@")) {
      toast({ variant: "destructive", title: "Erro", description: "Email inválido" });
      return false;
    }

    // Validar se o email é Gmail ou Outlook
    if (!isValidEmailProvider(formData.email)) {
      toast({ variant: "destructive", title: "Erro", description: "Só aceitamos emails @gmail.com ou @outlook.com" });
      return false;
    }

    const phoneValue = formData.phone.replace(/\D/g, "");
    if (phoneValue.length !== 11) {
      toast({ variant: "destructive", title: "Erro", description: "Telefone deve ter 11 dígitos (DDD + número)" });
      return false;
    }

    if (formData.password.length < 6) {
      toast({ variant: "destructive", title: "Erro", description: "Senha deve ter no mínimo 6 caracteres" });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({ variant: "destructive", title: "Erro", description: "As senhas não coincidem" });
      return false;
    }

    return true;
  };

  // Validação do passo 2 (Endereço)
  const validateStep2 = () => {
    const cepValue = formData.cep.replace(/\D/g, "");
    if (cepValue.length !== 8) {
      toast({ variant: "destructive", title: "Erro", description: "CEP inválido" });
      return false;
    }

    if (!addressData.street.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Rua é obrigatória" });
      return false;
    }

    if (!formData.number.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Número é obrigatório" });
      return false;
    }

    if (!addressData.neighborhood.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Bairro é obrigatório" });
      return false;
    }

    if (!selectedEstado) {
      toast({ variant: "destructive", title: "Erro", description: "Estado é obrigatório" });
      return false;
    }

    if (!selectedCidade) {
      toast({ variant: "destructive", title: "Erro", description: "Cidade é obrigatória" });
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (registerStep === 1 && validateStep1()) {
      setRegisterStep(2);
    } else if (registerStep === 2 && validateStep2()) {
      setRegisterStep(3);
    }
  };

  const handleGoToEmailVerification = async () => {
    // Validar código de convite se fornecido
    if (hasInviteCode && inviteCode && codeValidationStatus !== "valid") {
      toast({
        variant: "destructive",
        title: "Código inválido",
        description: "Por favor, verifique o código de convite.",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Verificar se o CPF está bloqueado
      const cpfValue = formData.cpf.replace(/\D/g, "");
      const { data: isBlocked, error: blockError } = await supabase.rpc('is_cpf_blocked', {
        check_cpf: cpfValue
      });
      
      if (blockError) {
        console.error('Erro ao verificar CPF:', blockError);
      } else if (isBlocked) {
        toast({
          variant: "destructive",
          title: "CPF bloqueado",
          description: "Este CPF não pode ser utilizado para criar uma nova conta.",
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
              description: response.data.message || "Este dispositivo já utilizou este código de convite.",
            });
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error('Erro ao verificar IP:', error);
        }
      }

      const data: SignUpData = {
        fullName: formData.fullName,
        cpf: cpfValue,
        email: formData.email,
        phone: formData.phone,
        cep: formData.cep,
        street: addressData.street,
        number: formData.number,
        neighborhood: addressData.neighborhood,
        city: selectedCidade,
        state: selectedEstado,
        password: formData.password,
        referredByCode: hasInviteCode && codeValidationStatus === "valid" ? inviteCode : undefined,
      };

      await signUp(data);
      
      // Registrar uso do código de convite com IP
      if (hasInviteCode && inviteCode && codeValidationStatus === "valid") {
        await supabase.functions.invoke('validate-invite-ip', {
          body: { invite_code: inviteCode, action: 'register' }
        });
      }
      
      // Conta criada com sucesso, ir para etapa de verificação
      setAccountCreated(true);
      setRegisterStep(4);
      
      toast({
        title: "Conta criada!",
        description: "Enviamos um link de confirmação para seu e-mail.",
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

  const handlePreviousStep = () => {
    if (registerStep > 1) {
      setRegisterStep(registerStep - 1);
    }
  };

  const resetForm = () => {
    setRegisterStep(1);
    setFormData({
      fullName: "",
      cpf: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      cep: "",
      number: "",
    });
    setAddressData({ street: "", neighborhood: "", city: "", state: "" });
    setSelectedEstado("");
    setSelectedCidade("");
    setHasInviteCode(null);
    setInviteCode("");
    setCodeValidationStatus("idle");
    setAccountCreated(false);
  };

  const StepIndicator = ({ step, label, icon: Icon }: { step: number; label: string; icon: any }) => (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
        registerStep === step 
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
          : registerStep > step 
            ? "bg-accent text-accent-foreground" 
            : "bg-muted text-muted-foreground"
      }`}>
        {registerStep > step ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
      </div>
      <span className={`text-xs font-medium ${
        registerStep === step ? "text-primary" : "text-muted-foreground"
      }`}>
        {label}
      </span>
    </div>
  );

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
            <Tabs defaultValue="login" className="w-full" onValueChange={() => setRegisterStep(1)}>
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
                {/* Indicadores de passos */}
                <div className="flex justify-center items-center gap-2 mb-6">
                  <StepIndicator step={1} label="Dados" icon={User} />
                  <div className={`flex-1 h-1 rounded-full max-w-8 transition-colors duration-300 ${registerStep > 1 ? 'bg-accent' : 'bg-muted'}`} />
                  <StepIndicator step={2} label="Endereço" icon={MapPin} />
                  <div className={`flex-1 h-1 rounded-full max-w-8 transition-colors duration-300 ${registerStep > 2 ? 'bg-accent' : 'bg-muted'}`} />
                  <StepIndicator step={3} label="Código" icon={Ticket} />
                  <div className={`flex-1 h-1 rounded-full max-w-8 transition-colors duration-300 ${registerStep > 3 ? 'bg-accent' : 'bg-muted'}`} />
                  <StepIndicator step={4} label="E-mail" icon={Mail} />
                </div>

                {/* Passo 1: Dados Pessoais */}
                {registerStep === 1 && (
                  <div className="space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="font-semibold text-lg">Dados Pessoais</h3>
                      <p className="text-sm text-muted-foreground">Preencha suas informações básicas</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium">Nome Completo</Label>
                      <Input
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                        disabled={isLoading}
                        className="h-11 bg-background/50 border-border/50 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cpf" className="text-sm font-medium">CPF</Label>
                      <Input
                        id="cpf"
                        placeholder="000.000.000-00"
                        value={formData.cpf}
                        onChange={(e) => {
                          const formatted = formatCPF(e.target.value);
                          setFormData({ ...formData, cpf: formatted });
                          const clean = formatted.replace(/\D/g, "");
                          if (clean.length === 11) {
                            setCpfError(!isValidCPF(clean) ? "CPF inválido" : null);
                          } else {
                            setCpfError(null);
                          }
                        }}
                        required
                        disabled={isLoading}
                        inputMode="numeric"
                        maxLength={14}
                        className={`h-11 bg-background/50 border-border/50 focus:border-primary ${cpfError ? "border-destructive" : ""}`}
                      />
                      {cpfError && <p className="text-xs text-destructive">{cpfError}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        disabled={isLoading}
                        className="h-11 bg-background/50 border-border/50 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">Telefone</Label>
                      <Input
                        id="phone"
                        placeholder="(00) 00000-0000"
                        value={formData.phone}
                        onChange={(e) => {
                          const formatted = formatPhone(e.target.value);
                          setFormData({ ...formData, phone: formatted });
                          const clean = formatted.replace(/\D/g, "");
                          if (clean.length > 0 && clean.length < 11) {
                            setPhoneError("Telefone deve ter 11 dígitos");
                          } else {
                            setPhoneError(null);
                          }
                        }}
                        required
                        disabled={isLoading}
                        inputMode="numeric"
                        maxLength={15}
                        className={`h-11 bg-background/50 border-border/50 focus:border-primary ${phoneError ? "border-destructive" : ""}`}
                      />
                      {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Mínimo 6 caracteres"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                            disabled={isLoading}
                            className="h-11 pr-10 bg-background/50 border-border/50 focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Repita a senha"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            required
                            disabled={isLoading}
                            className="h-11 pr-10 bg-background/50 border-border/50 focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <Button 
                      type="button" 
                      onClick={handleNextStep} 
                      className="w-full h-12 text-base font-bold mt-4"
                      disabled={isLoading}
                    >
                      Próximo
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                )}

                {/* Passo 2: Endereço */}
                {registerStep === 2 && (
                  <div className="space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="font-semibold text-lg">Endereço</h3>
                      <p className="text-sm text-muted-foreground">Digite o CEP para preenchimento automático</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cep" className="text-sm font-medium">CEP</Label>
                      <div className="relative">
                        <Input
                          id="cep"
                          placeholder="00000-000"
                          value={formData.cep}
                          onChange={(e) => {
                            const formatted = formatCEPInput(e.target.value);
                            setFormData({ ...formData, cep: formatted });
                            handleCEPChange(formatted);
                          }}
                          maxLength={9}
                          required
                          disabled={isLoading || isFetchingCEP}
                          inputMode="numeric"
                          className="h-11 bg-background/50 border-border/50 focus:border-primary"
                        />
                        {isFetchingCEP && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="street" className="text-sm font-medium">Rua</Label>
                      <Input
                        id="street"
                        value={addressData.street}
                        onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                        required
                        disabled={isLoading}
                        className="h-11 bg-background/50 border-border/50 focus:border-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="number" className="text-sm font-medium">Número</Label>
                        <Input
                          id="number"
                          value={formData.number}
                          onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                          required
                          disabled={isLoading}
                          className="h-11 bg-background/50 border-border/50 focus:border-primary"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="neighborhood" className="text-sm font-medium">Bairro</Label>
                        <Input
                          id="neighborhood"
                          value={addressData.neighborhood}
                          onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                          required
                          disabled={isLoading}
                          className="h-11 bg-background/50 border-border/50 focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Estado</Label>
                        <Select value={selectedEstado} onValueChange={setSelectedEstado} disabled={isLoading}>
                          <SelectTrigger className="h-11 bg-background/50 border-border/50">
                            <SelectValue placeholder="Selecione" />
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
                        <Label className="text-sm font-medium">Cidade</Label>
                        <Select value={selectedCidade} onValueChange={setSelectedCidade} disabled={isLoading || !selectedEstado}>
                          <SelectTrigger className="h-11 bg-background/50 border-border/50">
                            <SelectValue placeholder="Selecione" />
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
                    </div>

                    <div className="flex gap-3 mt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handlePreviousStep}
                        className="flex-1 h-12"
                        disabled={isLoading}
                      >
                        <ChevronLeft className="mr-2 h-5 w-5" />
                        Voltar
                      </Button>
                      <Button 
                        type="button" 
                        onClick={handleNextStep}
                        className="flex-1 h-12"
                        disabled={isLoading}
                      >
                        Próximo
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Passo 3: Código de Convite */}
                {registerStep === 3 && (
                  <div className="space-y-6">
                    <div className="text-center mb-4">
                      <h3 className="font-semibold text-lg">Código de Convite</h3>
                      <p className="text-sm text-muted-foreground">Você tem um código de convite de um amigo?</p>
                    </div>

                    {hasInviteCode === null ? (
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-14 border-accent text-accent hover:bg-accent/10 font-semibold"
                            onClick={() => setHasInviteCode(true)}
                          >
                            <Gift className="mr-2 h-5 w-5" />
                            Sim, tenho!
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-14"
                            onClick={() => setHasInviteCode(false)}
                          >
                            Não tenho
                          </Button>
                        </div>
                      </div>
                    ) : hasInviteCode ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Digite o código</Label>
                          <div className="relative">
                            <Input
                              value={inviteCode}
                              onChange={(e) => handleInviteCodeChange(e.target.value)}
                              placeholder="Ex: ABC123"
                              maxLength={8}
                              className="h-14 uppercase font-mono text-xl tracking-widest text-center bg-background/50 border-border/50"
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
                            <p className="text-sm text-accent font-semibold bg-accent/10 p-3 rounded-lg text-center">
                              🎉 Código válido! Você ganhará 1 mês + 3 dias grátis!
                            </p>
                          )}
                          {codeValidationStatus === "invalid" && (
                            <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg text-center">
                              Código inválido. Verifique e tente novamente.
                            </p>
                          )}
                          {codeValidationStatus === "used" && (
                            <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg text-center">
                              Este código já foi utilizado.
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
                          Na verdade, não tenho código
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-muted/30 rounded-xl p-5 border border-border/50 text-center">
                        <p className="text-muted-foreground">
                          Sem código? Sem problema! Você ainda ganha <strong className="text-foreground">3 dias grátis</strong>.
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-3 text-accent hover:text-accent hover:bg-accent/10"
                          onClick={() => setHasInviteCode(true)}
                        >
                          Na verdade, tenho um código!
                        </Button>
                      </div>
                    )}

                    <div className="flex gap-3 mt-6">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handlePreviousStep}
                        className="flex-1 h-12"
                        disabled={isLoading}
                      >
                        <ChevronLeft className="mr-2 h-5 w-5" />
                        Voltar
                      </Button>
                      <Button 
                        type="button" 
                        onClick={handleGoToEmailVerification}
                        className="flex-1 h-12"
                        disabled={isLoading || hasInviteCode === null || (hasInviteCode && codeValidationStatus !== "valid" && inviteCode.length > 0)}
                      >
                        Próximo
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </Button>
                    </div>

                    <p className="text-xs text-center text-muted-foreground">
                      {hasInviteCode && codeValidationStatus === "valid" 
                        ? "Você ganhará 1 mês + 3 dias de teste grátis! 🎉"
                        : "Você ganhará 3 dias de teste grátis"
                      }
                    </p>
                  </div>
                )}

                {/* Passo 4: Verificação de E-mail */}
                {registerStep === 4 && (
                  <div className="space-y-6">
                    <div className="text-center mb-4">
                      <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-10 h-10 text-accent" />
                      </div>
                      <h3 className="font-semibold text-xl text-accent">Conta Criada!</h3>
                      <p className="text-sm text-muted-foreground mt-3">
                        Foi enviado um link de confirmação para o e-mail:
                      </p>
                      <p className="font-bold text-primary text-lg mt-2 break-all">
                        {formData.email}
                      </p>
                    </div>

                    <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
                      <p className="text-sm text-amber-700 dark:text-amber-400 text-center">
                        <strong>⚠️ Importante:</strong> Você precisa confirmar seu e-mail antes de fazer login. Verifique também a pasta de spam!
                      </p>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                      <p className="text-sm text-muted-foreground text-center">
                        <strong>Lembrete:</strong> Só aceitamos e-mails <span className="text-primary font-medium">@gmail.com</span> ou <span className="text-primary font-medium">@outlook.com</span>
                      </p>
                    </div>

                    <Button 
                      type="button" 
                      onClick={openEmailApp}
                      className="w-full h-14 text-base font-bold bg-gradient-to-r from-primary to-primary/80"
                    >
                      <ExternalLink className="mr-2 h-5 w-5" />
                      {getEmailProvider(formData.email) === "gmail" ? "Abrir Gmail" : "Abrir Outlook"}
                    </Button>

                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={resetForm}
                      className="w-full h-12"
                    >
                      Voltar para o Login
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      {hasInviteCode && codeValidationStatus === "valid" 
                        ? "🎉 Você ganhou 1 mês + 3 dias de teste grátis!"
                        : "Você ganhou 3 dias de teste grátis!"
                      }
                    </p>
                  </div>
                )}

                {/* Manual de Como Criar Conta */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full h-11 border-border/50 hover:bg-muted/50 mt-4" type="button">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Manual: Como Criar Minha Conta
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-xl">
                        <HelpCircle className="h-5 w-5 text-primary" />
                        Manual: Como Criar Sua Conta
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 text-sm">
                      <div className="bg-primary/5 p-4 rounded-lg">
                        <p className="text-muted-foreground">
                          O cadastro é dividido em <strong>4 etapas simples</strong>. Siga as instruções abaixo:
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                          Etapa 1: Dados Pessoais
                        </h3>
                        <div className="ml-8 space-y-1 text-muted-foreground">
                          <p>• <strong>Nome Completo:</strong> Seu nome e sobrenome</p>
                          <p>• <strong>CPF:</strong> Será validado automaticamente</p>
                          <p>• <strong>E-mail:</strong> Só aceitamos @gmail.com ou @outlook.com</p>
                          <p>• <strong>Telefone:</strong> 11 dígitos com DDD</p>
                          <p>• <strong>Senha:</strong> Mínimo 6 caracteres</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                          Etapa 2: Endereço
                        </h3>
                        <div className="ml-8 space-y-1 text-muted-foreground">
                          <p>• <strong>CEP:</strong> Digite para preenchimento automático</p>
                          <p>• Complete os campos restantes se necessário</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                          Etapa 3: Código de Convite
                        </h3>
                        <div className="ml-8 space-y-1 text-muted-foreground">
                          <p>• Com código: <strong className="text-accent">1 mês + 3 dias grátis</strong></p>
                          <p>• Sem código: <strong>3 dias grátis</strong></p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                          Etapa 4: Verificação de E-mail
                        </h3>
                        <div className="ml-8 space-y-1 text-muted-foreground">
                          <p>• Confirme seu e-mail clicando no link enviado</p>
                          <p>• Use o botão para abrir Gmail ou Outlook</p>
                          <p>• Após confirmar, clique em "Criar Conta"</p>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de conta bloqueada */}
      <AlertDialog open={showBlockedAccountDialog} onOpenChange={setShowBlockedAccountDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Conta Bloqueada
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta conta foi bloqueada. Se você acredita que isso foi um erro ou deseja solicitar a reativação, entre em contato conosco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivateAccount} className="bg-accent hover:bg-accent/90">
              Solicitar Reativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Auth;
