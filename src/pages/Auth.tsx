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
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
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

  // Estado para email não confirmado no login
  const [showUnconfirmedEmailUI, setShowUnconfirmedEmailUI] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");

  const handleResendConfirmationEmail = async (emailToResend?: string) => {
    const email = emailToResend || formData.email || unconfirmedEmail;
    if (!email) return;

    setIsResendingConfirmation(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/confirmar-email`,
        },
      });

      if (error) throw error;

      toast({
        title: "E-mail reenviado",
        description: "Enviamos um novo link de confirmação. Verifique também o spam.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Não foi possível reenviar",
        description: error?.message || "Tente novamente em instantes.",
      });
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  useEffect(() => {
    const redirectIfConfirmed = (session: any) => {
      const confirmedAt = session?.user?.email_confirmed_at ?? session?.user?.confirmed_at;
      if (session && confirmedAt) {
        navigate("/dashboard");
      }
    };

    // Verificar se já está logado (somente se e-mail já estiver confirmado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      redirectIfConfirmed(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      redirectIfConfirmed(session);
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
        // Guardar o email e mostrar a UI de reenvio
        const formDataEvent = new FormData(e.currentTarget);
        const usedIdentifier = formDataEvent.get("identifier") as string;
        
        // Se for CPF, precisamos buscar o email associado
        const cleanIdentifier = usedIdentifier.replace(/\D/g, "");
        const isCPF = /^\d{11}$/.test(cleanIdentifier);
        
        if (isCPF) {
          // Buscar email pelo CPF
          const { data } = await supabase.rpc('get_user_email_by_cpf', { search_cpf: cleanIdentifier });
          if (data && data.length > 0) {
            setUnconfirmedEmail(data[0].email);
          }
        } else {
          setUnconfirmedEmail(usedIdentifier);
        }
        
        setShowUnconfirmedEmailUI(true);
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
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-500 ${
        registerStep === step 
          ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 scale-110" 
          : registerStep > step 
            ? "bg-gradient-to-br from-accent to-accent/80 text-white shadow-md shadow-accent/20" 
            : "bg-muted/50 text-muted-foreground border border-border/50"
      }`}>
        {registerStep > step ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
      </div>
      <span className={`text-xs font-semibold transition-colors duration-300 ${
        registerStep === step ? "text-primary" : registerStep > step ? "text-accent" : "text-muted-foreground"
      }`}>
        {label}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/25 via-background to-accent/20 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Enhanced background decorations with floating animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-primary/40 to-primary/10 rounded-full blur-[120px] -translate-x-1/3 -translate-y-1/3 animate-[pulse_4s_ease-in-out_infinite]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-accent/40 to-accent/10 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 animate-[pulse_5s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] bg-primary/15 rounded-full blur-[80px] animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/3 left-1/4 w-[300px] h-[300px] bg-accent/20 rounded-full blur-[70px] animate-[pulse_7s_ease-in-out_infinite]" />
        
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      </div>
      
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 lg:gap-20 items-center relative z-10">
        {/* Seção de branding - Redesenhada */}
        <div className="hidden lg:flex flex-col justify-center space-y-8 p-8">
          <div className="space-y-8">
            <div className="flex items-center gap-7">
              <div className="relative group">
                <div className="absolute -inset-3 bg-gradient-to-r from-primary via-accent to-primary rounded-full blur-lg opacity-50 group-hover:opacity-70 transition-all duration-700 animate-[pulse_3s_ease-in-out_infinite]" />
                <div className="relative">
                  <img src={logo} alt="JTC FluxPDV" className="relative w-32 h-32 rounded-full object-cover shadow-2xl ring-2 ring-white/20" />
                  <div className="absolute -bottom-1 -right-1 w-11 h-11 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-lg shadow-accent/30">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h1 className="text-5xl xl:text-6xl font-black tracking-tight">
                  <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">JTC FluxPDV</span>
                </h1>
                <p className="text-lg text-muted-foreground/90 font-normal max-w-xs">
                  O sistema de gestão que sua loja merece
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {[
              { icon: ShoppingCart, title: "PDV Rápido e Intuitivo", desc: "Vendas em segundos com interface simplificada", gradient: "from-primary to-primary/70", shadow: "shadow-primary/20" },
              { icon: Package, title: "Controle de Estoque", desc: "Gerencie produtos e fornecedores facilmente", gradient: "from-accent to-accent/70", shadow: "shadow-accent/20" },
              { icon: TrendingUp, title: "Relatórios Inteligentes", desc: "Métricas e insights para seu negócio crescer", gradient: "from-success to-success/70", shadow: "shadow-success/20" },
            ].map((item, i) => (
              <div 
                key={i}
                className="flex items-center gap-5 p-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] hover:shadow-xl group cursor-pointer"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shrink-0 shadow-lg ${item.shadow} group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-5 p-5 rounded-2xl bg-gradient-to-r from-accent/15 to-accent/5 border border-accent/30 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <Gift className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="font-bold text-foreground">Programa de Indicação</p>
              <p className="text-sm text-muted-foreground">
                Convide amigos e ganhe <span className="text-accent font-bold">1 mês grátis</span>!
              </p>
            </div>
          </div>
        </div>

        {/* Card do formulário - Redesenhado */}
        <Card className="shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-white/10 bg-card/90 backdrop-blur-2xl relative overflow-hidden rounded-3xl">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-primary/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-accent/15 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle,transparent_30%,rgba(0,0,0,0.02)_70%)] pointer-events-none" />
          
          <CardHeader className="text-center pb-4 pt-8 relative z-10">
            <div className="flex flex-col items-center gap-5 mb-2">
              <div className="relative group">
                <div className="absolute -inset-3 bg-gradient-to-r from-primary to-accent rounded-full blur-md opacity-40 group-hover:opacity-60 transition-all duration-500" />
                <img src={logo} alt="JTC FluxPDV" className="relative w-20 h-20 rounded-full object-cover shadow-xl ring-2 ring-white/10" />
              </div>
              <div className="text-center space-y-1">
                <CardTitle className="text-3xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">JTC FluxPDV</CardTitle>
                <CardDescription className="text-base text-muted-foreground">Acesse sua conta ou crie uma nova</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 px-6 pb-8">
            <Tabs defaultValue="login" className="w-full" onValueChange={() => setRegisterStep(1)}>
              <TabsList className="grid w-full grid-cols-2 mb-8 p-1.5 bg-muted/30 rounded-xl h-14">
                <TabsTrigger 
                  value="login" 
                  className="font-bold text-base rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
                >
                  Entrar
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  className="font-bold text-base rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
                >
                  Criar Conta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-6">
                {/* UI de email não confirmado */}
                {showUnconfirmedEmailUI ? (
                  <div className="space-y-6">
                    <div className="text-center mb-4">
                      <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                        <Mail className="w-10 h-10 text-amber-500" />
                      </div>
                      <h3 className="font-semibold text-xl text-amber-600">E-mail não confirmado</h3>
                      <p className="text-sm text-muted-foreground mt-3">
                        Você ainda não confirmou seu e-mail:
                      </p>
                      <p className="font-bold text-primary text-lg mt-2 break-all">
                        {unconfirmedEmail}
                      </p>
                    </div>

                    <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
                      <p className="text-sm text-amber-700 dark:text-amber-400 text-center">
                        ⚠️ Para acessar sua conta, você precisa clicar no link de confirmação que enviamos para seu e-mail.
                      </p>
                    </div>

                    <Button 
                      type="button" 
                      onClick={() => {
                        const provider = getEmailProvider(unconfirmedEmail);
                        if (provider === "gmail") {
                          window.open("https://mail.google.com", "_blank");
                        } else if (provider === "outlook") {
                          window.open("https://outlook.live.com", "_blank");
                        }
                      }}
                      className="w-full h-14 text-base font-bold bg-gradient-to-r from-primary to-primary/80"
                    >
                      <ExternalLink className="mr-2 h-5 w-5" />
                      {getEmailProvider(unconfirmedEmail) === "gmail" ? "Abrir Gmail" : "Abrir Outlook"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleResendConfirmationEmail(unconfirmedEmail)}
                      className="w-full h-12"
                      disabled={isResendingConfirmation}
                    >
                      {isResendingConfirmation ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Reenviando...
                        </>
                      ) : (
                        "Reenviar e-mail de confirmação"
                      )}
                    </Button>

                    <Button 
                      type="button" 
                      variant="ghost"
                      onClick={() => {
                        setShowUnconfirmedEmailUI(false);
                        setUnconfirmedEmail("");
                      }}
                      className="w-full h-12"
                    >
                      Voltar para o Login
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="identifier" className="text-sm font-semibold text-foreground/90">E-mail ou CPF</Label>
                      <div className="relative group">
                        <Input
                          id="identifier"
                          name="identifier"
                          placeholder="seu@email.com ou 000.000.000-00"
                          required
                          disabled={isLoading}
                          className="h-14 text-base bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl pl-5 placeholder:text-muted-foreground/50 transition-all duration-300"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="password" className="text-sm font-semibold text-foreground/90">Senha</Label>
                      <div className="relative group">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          required
                          disabled={isLoading}
                          className="h-14 text-base pr-14 bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl pl-5 placeholder:text-muted-foreground/50 transition-all duration-300"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors duration-200 p-1"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-14 text-base font-bold bg-gradient-to-r from-primary via-primary to-primary/90 hover:from-primary/90 hover:via-primary hover:to-primary shadow-lg hover:shadow-xl hover:shadow-primary/25 transition-all duration-300 rounded-full" 
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        "Entrar na Conta"
                      )}
                    </Button>
                  </form>
                )}

                {/* Mobile branding - Redesenhado */}
                <div className="lg:hidden pt-6 border-t border-border/30 mt-6">
                  <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20">
                    <Gift className="w-6 h-6 text-accent" />
                    <span className="text-sm text-muted-foreground">Convide amigos e ganhe <strong className="text-accent font-bold">1 mês grátis</strong>!</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="register" className="space-y-5">
                {/* Indicadores de passos - Redesenhado */}
                <div className="flex justify-center items-center gap-3 mb-8 py-2">
                  <StepIndicator step={1} label="Dados" icon={User} />
                  <div className={`flex-1 h-1 rounded-full max-w-10 transition-all duration-500 ${registerStep > 1 ? 'bg-gradient-to-r from-accent to-accent/70' : 'bg-muted/50'}`} />
                  <StepIndicator step={2} label="Endereço" icon={MapPin} />
                  <div className={`flex-1 h-1 rounded-full max-w-10 transition-all duration-500 ${registerStep > 2 ? 'bg-gradient-to-r from-accent to-accent/70' : 'bg-muted/50'}`} />
                  <StepIndicator step={3} label="Código" icon={Ticket} />
                  <div className={`flex-1 h-1 rounded-full max-w-10 transition-all duration-500 ${registerStep > 3 ? 'bg-gradient-to-r from-accent to-accent/70' : 'bg-muted/50'}`} />
                  <StepIndicator step={4} label="E-mail" icon={Mail} />
                </div>

                {/* Passo 1: Dados Pessoais - Redesenhado */}
                {registerStep === 1 && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="text-center mb-6">
                      <h3 className="font-bold text-xl text-foreground">Dados Pessoais</h3>
                      <p className="text-sm text-muted-foreground mt-1">Preencha suas informações básicas</p>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="fullName" className="text-sm font-semibold text-foreground/90">Nome Completo</Label>
                      <Input
                        id="fullName"
                        placeholder="Digite seu nome completo"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                        disabled={isLoading}
                        className="h-12 bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="cpf" className="text-sm font-semibold text-foreground/90">CPF</Label>
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
                        className={`h-12 bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300 ${cpfError ? "border-destructive ring-destructive/20" : ""}`}
                      />
                      {cpfError && <p className="text-xs text-destructive font-medium">{cpfError}</p>}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-sm font-semibold text-foreground/90">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        disabled={isLoading}
                        className="h-12 bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300"
                      />
                      <p className="text-xs text-muted-foreground">Apenas @gmail.com ou @outlook.com</p>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="phone" className="text-sm font-semibold text-foreground/90">Telefone</Label>
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
                        className={`h-12 bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300 ${phoneError ? "border-destructive ring-destructive/20" : ""}`}
                      />
                      {phoneError && <p className="text-xs text-destructive font-medium">{phoneError}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Label htmlFor="password" className="text-sm font-semibold text-foreground/90">Senha</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Min. 6 caracteres"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                            disabled={isLoading}
                            className="h-12 pr-11 bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors duration-200"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="confirmPassword" className="text-sm font-semibold text-foreground/90">Confirmar</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Repita a senha"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            required
                            disabled={isLoading}
                            className="h-12 pr-11 bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors duration-200"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <Button 
                      type="button" 
                      onClick={handleNextStep} 
                      className="w-full h-14 text-base font-bold mt-6 bg-gradient-to-r from-primary via-primary to-primary/90 hover:from-primary/90 hover:via-primary hover:to-primary shadow-lg hover:shadow-xl hover:shadow-primary/25 transition-all duration-300 rounded-full"
                      disabled={isLoading}
                    >
                      Próximo
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                )}

                {/* Passo 2: Endereço - Redesenhado */}
                {registerStep === 2 && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="text-center mb-6">
                      <h3 className="font-bold text-xl text-foreground">Endereço</h3>
                      <p className="text-sm text-muted-foreground mt-1">Digite o CEP para preenchimento automático</p>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="cep" className="text-sm font-semibold text-foreground/90">CEP</Label>
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
                          className="h-12 bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300"
                        />
                        {isFetchingCEP && (
                          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-primary" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="street" className="text-sm font-semibold text-foreground/90">Rua</Label>
                      <Input
                        id="street"
                        placeholder="Nome da rua"
                        value={addressData.street}
                        onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                        required
                        disabled={isLoading}
                        className="h-12 bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Label htmlFor="number" className="text-sm font-semibold text-foreground/90">Número</Label>
                        <Input
                          id="number"
                          placeholder="Nº"
                          value={formData.number}
                          onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                          required
                          disabled={isLoading}
                          className="h-12 bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="neighborhood" className="text-sm font-semibold text-foreground/90">Bairro</Label>
                        <Input
                          id="neighborhood"
                          placeholder="Seu bairro"
                          value={addressData.neighborhood}
                          onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                          required
                          disabled={isLoading}
                          className="h-12 bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-foreground/90">Estado</Label>
                        <Select value={selectedEstado} onValueChange={setSelectedEstado} disabled={isLoading}>
                          <SelectTrigger className="h-12 bg-muted/30 border-border/40 rounded-xl">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50 rounded-xl">
                            {estados.map((estado) => (
                              <SelectItem key={estado.id} value={estado.sigla}>
                                {estado.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-foreground/90">Cidade</Label>
                        <Select value={selectedCidade} onValueChange={setSelectedCidade} disabled={isLoading || !selectedEstado}>
                          <SelectTrigger className="h-12 bg-muted/30 border-border/40 rounded-xl">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50 max-h-[300px] rounded-xl">
                            {cidades.map((cidade) => (
                              <SelectItem key={cidade.id} value={cidade.nome}>
                                {cidade.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handlePreviousStep}
                        className="flex-1 h-14 rounded-xl border-border/50 hover:bg-muted/50"
                        disabled={isLoading}
                      >
                        <ChevronLeft className="mr-2 h-5 w-5" />
                        Voltar
                      </Button>
                      <Button 
                        type="button" 
                        onClick={handleNextStep}
                        className="flex-1 h-14 rounded-full bg-gradient-to-r from-primary via-primary to-primary/90 shadow-lg hover:shadow-xl hover:shadow-primary/25 transition-all duration-300"
                        disabled={isLoading}
                      >
                        Próximo
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Passo 3: Código de Convite - Redesenhado */}
                {registerStep === 3 && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="text-center mb-6">
                      <h3 className="font-bold text-xl text-foreground">Código de Convite</h3>
                      <p className="text-sm text-muted-foreground mt-1">Você tem um código de convite de um amigo?</p>
                    </div>

                    {hasInviteCode === null ? (
                      <div className="space-y-5">
                        <div className="flex gap-4">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-16 border-2 border-accent/50 text-accent hover:bg-accent/10 hover:border-accent font-bold text-base rounded-xl transition-all duration-300"
                            onClick={() => setHasInviteCode(true)}
                          >
                            <Gift className="mr-2 h-6 w-6" />
                            Sim, tenho!
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-16 border-border/50 hover:bg-muted/50 font-medium text-base rounded-xl"
                            onClick={() => setHasInviteCode(false)}
                          >
                            Não tenho
                          </Button>
                        </div>
                      </div>
                    ) : hasInviteCode ? (
                      <div className="space-y-5">
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold text-foreground/90">Digite o código</Label>
                          <div className="relative">
                            <Input
                              value={inviteCode}
                              onChange={(e) => handleInviteCodeChange(e.target.value)}
                              placeholder="Ex: ABC123"
                              maxLength={8}
                              className="h-16 uppercase font-mono text-2xl tracking-[0.3em] text-center bg-muted/30 border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300"
                              disabled={isLoading}
                              autoCapitalize="characters"
                              style={{ textTransform: 'uppercase' }}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              {isValidatingCode && (
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              )}
                              {!isValidatingCode && codeValidationStatus === "valid" && (
                                <CheckCircle2 className="h-7 w-7 text-accent" />
                              )}
                              {!isValidatingCode && (codeValidationStatus === "invalid" || codeValidationStatus === "used") && (
                                <XCircle className="h-7 w-7 text-destructive" />
                              )}
                            </div>
                          </div>
                          {codeValidationStatus === "valid" && (
                            <div className="bg-gradient-to-r from-accent/15 to-accent/5 p-4 rounded-xl border border-accent/30 text-center">
                              <p className="text-sm text-accent font-bold">
                                🎉 Código válido! Você ganhará 1 mês + 3 dias grátis!
                              </p>
                            </div>
                          )}
                          {codeValidationStatus === "invalid" && (
                            <div className="bg-destructive/10 p-4 rounded-xl border border-destructive/30 text-center">
                              <p className="text-sm text-destructive font-medium">
                                Código inválido. Verifique e tente novamente.
                              </p>
                            </div>
                          )}
                          {codeValidationStatus === "used" && (
                            <div className="bg-destructive/10 p-4 rounded-xl border border-destructive/30 text-center">
                              <p className="text-sm text-destructive font-medium">
                                Este código já foi utilizado.
                              </p>
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground w-full"
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
                      <div className="bg-muted/20 rounded-2xl p-6 border border-border/30 text-center">
                        <p className="text-muted-foreground">
                          Sem código? Sem problema! Você ainda ganha <strong className="text-foreground">3 dias grátis</strong>.
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-4 text-accent hover:text-accent hover:bg-accent/10 font-medium"
                          onClick={() => setHasInviteCode(true)}
                        >
                          Na verdade, tenho um código!
                        </Button>
                      </div>
                    )}

                    <div className="flex gap-3 mt-8">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handlePreviousStep}
                        className="flex-1 h-14 rounded-xl border-border/50 hover:bg-muted/50"
                        disabled={isLoading}
                      >
                        <ChevronLeft className="mr-2 h-5 w-5" />
                        Voltar
                      </Button>
                      <Button 
                        type="button" 
                        onClick={handleGoToEmailVerification}
                        className="flex-1 h-14 rounded-full bg-gradient-to-r from-primary via-primary to-primary/90 shadow-lg hover:shadow-xl hover:shadow-primary/25 transition-all duration-300"
                        disabled={isLoading || hasInviteCode === null || (hasInviteCode && codeValidationStatus !== "valid" && inviteCode.length > 0)}
                      >
                        Próximo
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </Button>
                    </div>

                    <p className="text-xs text-center text-muted-foreground pt-2">
                      {hasInviteCode && codeValidationStatus === "valid" 
                        ? "Você ganhará 1 mês + 3 dias de teste grátis! 🎉"
                        : "Você ganhará 3 dias de teste grátis"
                      }
                    </p>
                  </div>
                )}

                {/* Passo 4: Verificação de E-mail - Redesenhado */}
                {registerStep === 4 && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="text-center mb-6">
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/10">
                        <Mail className="w-12 h-12 text-primary" />
                      </div>
                      <h3 className="font-bold text-2xl text-foreground">
                        Confirme seu {getEmailProvider(formData.email) === "gmail" ? "Gmail" : "Outlook"}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-3">
                        Foi enviado um link de confirmação para:
                      </p>
                      <p className="font-bold text-primary text-lg mt-2 break-all bg-primary/5 py-2 px-4 rounded-lg inline-block">
                        {formData.email}
                      </p>
                    </div>

                    <div className="bg-gradient-to-r from-destructive/15 to-destructive/5 rounded-xl p-5 border border-destructive/30">
                      <p className="text-sm text-destructive text-center font-bold">
                        ⚠️ Sua conta só será ativada após confirmar o e-mail!
                      </p>
                      <p className="text-xs text-destructive/80 text-center mt-2">
                        Sem a confirmação, você não conseguirá fazer login.
                      </p>
                    </div>

                    <div className="bg-muted/20 rounded-xl p-4 border border-border/30 text-center">
                      <p className="text-sm text-muted-foreground">
                        <strong>Lembrete:</strong> Só aceitamos <span className="text-primary font-semibold">@gmail.com</span> ou <span className="text-primary font-semibold">@outlook.com</span>
                      </p>
                    </div>

                    <Button 
                      type="button" 
                      onClick={openEmailApp}
                      className="w-full h-16 text-lg font-bold bg-gradient-to-r from-primary via-primary to-primary/90 hover:from-primary/90 hover:via-primary hover:to-primary shadow-xl hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 rounded-xl"
                    >
                      <ExternalLink className="mr-3 h-6 w-6" />
                      {getEmailProvider(formData.email) === "gmail" ? "Abrir Gmail" : "Abrir Outlook"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleResendConfirmationEmail()}
                      className="w-full h-14 rounded-xl border-border/50 hover:bg-muted/50"
                      disabled={isResendingConfirmation}
                    >
                      {isResendingConfirmation ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Reenviando...
                        </>
                      ) : (
                        "Reenviar e-mail de confirmação"
                      )}
                    </Button>

                    <Button 
                      type="button" 
                      variant="ghost"
                      onClick={resetForm}
                      className="w-full h-12 text-muted-foreground hover:text-foreground"
                    >
                      Voltar para o Login
                    </Button>

                    <p className="text-sm text-center text-muted-foreground pt-2">
                      {hasInviteCode && codeValidationStatus === "valid" 
                        ? "🎉 Após confirmar, você terá 1 mês + 3 dias grátis!"
                        : "Após confirmar, você terá 3 dias de teste grátis!"
                      }
                    </p>
                  </div>
                )}

                {/* Manual de Como Criar Conta - Redesenhado */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="w-full h-12 text-muted-foreground hover:text-foreground hover:bg-muted/30 mt-6 rounded-xl" type="button">
                      <HelpCircle className="mr-2 h-5 w-5" />
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
