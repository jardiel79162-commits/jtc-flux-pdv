import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Store, Save, Zap, BookOpen, ShoppingCart, Package, Users, FileText, Settings as SettingsIcon, CreditCard, History, Smartphone, Eye, EyeOff, Gift, Copy, Check, Share2, Download, CheckCircle, Loader2, UserCog } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ImageUpload";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    store_name: "",
    commercial_phone: "",
    store_address: "",
    operation_type: "",
    primary_color: "#4C6FFF",
    logo_url: "",
    category: "",
    has_employees: false,
    quick_actions_enabled: false,
    hide_trial_message: false,
    pix_key_type: "",
    pix_key: "",
    pix_receiver_name: "",
  });

  const [customCategory, setCustomCategory] = useState("");
  
  // Estados para controlar seções abertas
  const [storeInfoOpen, setStoreInfoOpen] = useState(false);
  const [pixConfigOpen, setPixConfigOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [employeesConfigOpen, setEmployeesConfigOpen] = useState(false);
  const [inviteCodeOpen, setInviteCodeOpen] = useState(false);
  const [downloadAppOpen, setDownloadAppOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  // PWA Install states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Estado do código de convite
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetchSettings();
    fetchInviteCode();

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      toast({
        title: "App instalado com sucesso!",
        description: "O JTC FluxPDV foi adicionado à sua tela inicial",
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const fetchInviteCode = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("invite_code")
      .eq("id", user.id)
      .single();

    if (data?.invite_code) {
      setInviteCode(data.invite_code);
    }
  };


  const handleCopyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast({
        title: "Código copiado!",
        description: "Compartilhe com seus amigos",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/auth?ref=${inviteCode}`;
    if (navigator.share) {
      navigator.share({
        title: "JTC FluxPDV - Convite",
        text: `Use meu código de convite ${inviteCode} e ganhe 1 mês + 3 dias grátis!`,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copiado!",
        description: "Compartilhe o link com seus amigos",
      });
    }
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      setIsInstalling(true);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setIsInstalling(false);
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    } else {
      toast({
        title: "Instalação manual necessária",
        description: "Use o menu do navegador → 'Adicionar à tela inicial'",
      });
    }
  };

  const fetchSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("store_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      toast({ title: "Erro ao carregar configurações", variant: "destructive" });
    } else if (data) {
      setSettings({
        store_name: data.store_name || "",
        commercial_phone: data.commercial_phone || "",
        store_address: data.store_address || "",
        operation_type: data.operation_type || "",
        primary_color: data.primary_color || "#4C6FFF",
        logo_url: data.logo_url || "",
        category: data.category || "",
        has_employees: data.has_employees || false,
        quick_actions_enabled: data.quick_actions_enabled || false,
        hide_trial_message: data.hide_trial_message || false,
        pix_key_type: data.pix_key_type || "",
        pix_key: data.pix_key || "",
        pix_receiver_name: data.pix_receiver_name || "",
      });
      
      // Se a categoria não está na lista padrão, é uma categoria personalizada
      const predefinedCategories = ["mercado", "padaria", "mercearia", "bazar", "papelaria", "restaurante", "lanchonete", "farmacia", "pet_shop"];
      if (data.category && !predefinedCategories.includes(data.category)) {
        setCustomCategory(data.category);
        setSettings(prev => ({ ...prev, category: "outros" }));
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Se a categoria for "outros", usar a categoria personalizada
    const finalSettings = {
      ...settings,
      category: settings.category === "outros" && customCategory ? customCategory : settings.category
    };

    const { data: existing } = await supabase
      .from("store_settings")
      .select("id")
      .eq("user_id", user.id)
      .single();

    let error;
    if (existing) {
      const result = await supabase
        .from("store_settings")
        .update(finalSettings)
        .eq("user_id", user.id);
      error = result.error;
    } else {
      const result = await supabase
        .from("store_settings")
        .insert([{ ...finalSettings, user_id: user.id }]);
      error = result.error;
    }

    setLoading(false);

    if (error) {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas com sucesso!" });
      // Disparar evento para atualizar o menu
      window.dispatchEvent(new CustomEvent('store-settings-updated'));
    }
  };

  const getPixKeyPlaceholder = () => {
    switch (settings.pix_key_type) {
      case "cpf":
        return "000.000.000-00";
      case "cnpj":
        return "00.000.000/0000-00";
      case "email":
        return "email@exemplo.com";
      case "phone":
        return "+5500000000000";
      case "random":
        return "Chave aleatória (32 caracteres)";
      default:
        return "Selecione o tipo de chave primeiro";
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Configurações da Loja</h1>
          <p className="text-sm md:text-base text-muted-foreground">Personalize as informações da sua loja</p>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 w-full max-w-2xl">
        {/* Informações da Loja */}
        <Card className="overflow-hidden">
          <Collapsible open={storeInfoOpen} onOpenChange={setStoreInfoOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setStoreInfoOpen(!storeInfoOpen)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                    <Store className="h-5 w-5 shrink-0" />
                    Informações da Loja
                  </CardTitle>
                  <div className="shrink-0">
                    {storeInfoOpen ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 overflow-hidden">
                <div className="space-y-2">
                  <Label>Nome da Loja *</Label>
                  <Input
                    value={settings.store_name}
                    onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                    placeholder="Ex: Minha Loja"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Telefone Comercial</Label>
                  <Input
                    value={settings.commercial_phone}
                    onChange={(e) => setSettings({ ...settings, commercial_phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Endereço da Loja</Label>
                  <Input
                    value={settings.store_address}
                    onChange={(e) => setSettings({ ...settings, store_address: e.target.value })}
                    placeholder="Rua, número, bairro, cidade - estado"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Categoria da Loja *</Label>
                  <Select
                    value={settings.category}
                    onValueChange={(value) => {
                      setSettings({ ...settings, category: value });
                      if (value !== "outros") {
                        setCustomCategory("");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mercado">Mercado</SelectItem>
                      <SelectItem value="padaria">Padaria</SelectItem>
                      <SelectItem value="mercearia">Mercearia</SelectItem>
                      <SelectItem value="bazar">Bazar</SelectItem>
                      <SelectItem value="papelaria">Papelaria</SelectItem>
                      <SelectItem value="restaurante">Restaurante</SelectItem>
                      <SelectItem value="lanchonete">Lanchonete</SelectItem>
                      <SelectItem value="farmacia">Farmácia</SelectItem>
                      <SelectItem value="pet_shop">Pet Shop</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {settings.category === "outros" && (
                    <Input
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Digite a categoria da sua loja"
                      className="mt-2"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Operação</Label>
                  <Input
                    value={settings.operation_type}
                    onChange={(e) => setSettings({ ...settings, operation_type: e.target.value })}
                    placeholder="Ex: Varejo, E-commerce, Atacado"
                  />
                </div>

                <ImageUpload
                  bucket="store-logos"
                  currentImageUrl={settings.logo_url}
                  onImageUploaded={(url) => setSettings({ ...settings, logo_url: url })}
                  label="Logo da Loja"
                />

                <div className="space-y-2">
                  <Label>Cor Primária do Sistema</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={settings.primary_color}
                      onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={settings.primary_color}
                      onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                      placeholder="#4C6FFF"
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Configuração PIX */}
        <Card className="overflow-hidden">
          <Collapsible open={pixConfigOpen} onOpenChange={setPixConfigOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setPixConfigOpen(!pixConfigOpen)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                    <Smartphone className="h-5 w-5 shrink-0" />
                    Configuração PIX
                  </CardTitle>
                  <div className="shrink-0">
                    {pixConfigOpen ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 overflow-hidden">
                <p className="text-sm text-muted-foreground">
                  Configure sua chave PIX para receber pagamentos. A loja só poderá aceitar pagamentos via PIX se uma chave estiver cadastrada.
                </p>

                <div className="space-y-2">
                  <Label>Tipo de Chave PIX</Label>
                  <Select
                    value={settings.pix_key_type}
                    onValueChange={(value) => setSettings({ ...settings, pix_key_type: value, pix_key: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de chave" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="random">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Chave PIX</Label>
                  <Input
                    value={settings.pix_key}
                    onChange={(e) => setSettings({ ...settings, pix_key: e.target.value })}
                    placeholder={getPixKeyPlaceholder()}
                    disabled={!settings.pix_key_type}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nome do Recebedor</Label>
                  <Input
                    value={settings.pix_receiver_name}
                    onChange={(e) => setSettings({ ...settings, pix_receiver_name: e.target.value })}
                    placeholder="Nome que aparecerá no PIX"
                    disabled={!settings.pix_key_type}
                  />
                </div>

                {settings.pix_key && settings.pix_receiver_name && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">
                      ✓ PIX configurado! A loja pode receber pagamentos via PIX.
                    </p>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Ações Rápidas */}
        <Card className="overflow-hidden">
          <Collapsible open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setQuickActionsOpen(!quickActionsOpen)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                    <Zap className="h-5 w-5 shrink-0" />
                    Ações Rápidas
                  </CardTitle>
                  <div className="shrink-0">
                    {quickActionsOpen ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-6 overflow-hidden">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <Label className="text-sm">Ativar Ações Rápidas</Label>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Exibe atalhos com ícones no Dashboard
                    </p>
                  </div>
                  <Switch
                    checked={settings.quick_actions_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, quick_actions_enabled: checked })}
                    className="shrink-0"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <Label className="text-sm">Ocultar Mensagem do Período de Teste</Label>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Esconde o aviso de teste/assinatura no Dashboard
                    </p>
                  </div>
                  <Switch
                    checked={settings.hide_trial_message}
                    onCheckedChange={(checked) => setSettings({ ...settings, hide_trial_message: checked })}
                    className="shrink-0"
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Configuração de Funcionários */}
        <Card className="overflow-hidden">
          <Collapsible open={employeesConfigOpen} onOpenChange={setEmployeesConfigOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setEmployeesConfigOpen(!employeesConfigOpen)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                    <UserCog className="h-5 w-5 shrink-0" />
                    Funcionários
                  </CardTitle>
                  <div className="shrink-0">
                    {employeesConfigOpen ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 overflow-hidden">
                <p className="text-xs md:text-sm text-muted-foreground">
                  Configure se sua loja possui outros funcionários além de você. Ao ativar, você poderá cadastrar funcionários com permissões específicas.
                </p>

                <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <Label className="text-sm font-medium">Minha loja tem funcionários</Label>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Ative para cadastrar funcionários e definir permissões de acesso
                    </p>
                  </div>
                  <Switch
                    checked={settings.has_employees}
                    onCheckedChange={(checked) => setSettings({ ...settings, has_employees: checked })}
                    className="shrink-0"
                  />
                </div>

                {settings.has_employees && (
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm text-primary font-medium">
                      ✓ Após salvar, a opção "Funcionários" aparecerá no menu para gerenciar sua equipe.
                    </p>
                  </div>
                )}

                {!settings.has_employees && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs md:text-sm text-muted-foreground">
                      <strong>Apenas você:</strong> Todas as funcionalidades estarão disponíveis apenas para sua conta de administrador.
                    </p>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Meu Código de Convite */}
        <Card className="border-accent/30 bg-accent/5 overflow-hidden">
          <Collapsible open={inviteCodeOpen} onOpenChange={setInviteCodeOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setInviteCodeOpen(!inviteCodeOpen)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full gap-2">
                  <CardTitle className="flex items-center gap-2 text-accent text-sm md:text-base">
                    <Gift className="h-5 w-5 shrink-0" />
                    Meu Código de Convite
                  </CardTitle>
                  <div className="shrink-0">
                    {inviteCodeOpen ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 overflow-hidden">
                <p className="text-xs md:text-sm text-muted-foreground">
                  Compartilhe seu código e ganhe <strong className="text-accent">1 mês grátis</strong> quando alguém se cadastrar usando ele!
                </p>

                <div className="bg-background rounded-xl p-4 md:p-6 text-center space-y-4 border border-accent/20">
                  <div className="text-2xl md:text-4xl font-mono font-bold tracking-widest text-primary break-all">
                    {inviteCode || "Carregando..."}
                  </div>
                  
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button
                      onClick={handleCopyCode}
                      variant="outline"
                      className="gap-2"
                      disabled={!inviteCode}
                      size="sm"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copiado!" : "Copiar"}
                    </Button>
                    
                    <Button
                      onClick={handleShare}
                      className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                      disabled={!inviteCode}
                      size="sm"
                    >
                      <Share2 className="h-4 w-4" />
                      Compartilhar
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 md:p-4 text-xs md:text-sm space-y-2">
                  <h4 className="font-semibold text-foreground">Como funciona:</h4>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Você ganha <strong>1 mês grátis</strong> para cada pessoa que usar seu código</li>
                    <li>• Seu amigo ganha <strong>1 mês + 3 dias grátis</strong> ao se cadastrar</li>
                    <li>• Cada dispositivo só pode usar o código <strong>uma vez</strong></li>
                  </ul>
                </div>

              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Baixar App */}
        <Card className="border-primary/30 bg-primary/5 overflow-hidden">
          <Collapsible open={downloadAppOpen} onOpenChange={setDownloadAppOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setDownloadAppOpen(!downloadAppOpen)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full gap-2">
                  <CardTitle className="flex items-center gap-2 text-primary text-sm md:text-base">
                    <Download className="h-5 w-5 shrink-0" />
                    Baixar App
                  </CardTitle>
                  <div className="shrink-0">
                    {downloadAppOpen ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 overflow-hidden">
                <p className="text-xs md:text-sm text-muted-foreground">
                  Instale o JTC FluxPDV como um aplicativo no seu celular! Acesso rápido e sem barra do navegador.
                </p>

                {isInstalled ? (
                  <div className="p-3 md:p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-green-600 text-sm md:text-base">App já instalado!</p>
                      <p className="text-xs md:text-sm text-muted-foreground">O JTC FluxPDV está na sua tela inicial</p>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={handleInstallApp}
                    className="w-full h-12 md:h-14 text-sm md:text-lg gap-2 md:gap-3"
                    disabled={isInstalling}
                  >
                  {isInstalling ? (
                      <>
                        <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin shrink-0" />
                        Instalando...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                        📲 Clique para instalar
                      </>
                    )}
                  </Button>
                )}

                <div className="bg-muted/50 rounded-lg p-3 md:p-4 text-xs md:text-sm space-y-2 md:space-y-3">
                  <h4 className="font-semibold text-foreground">Benefícios do App:</h4>
                  <ul className="text-muted-foreground space-y-1">
                    <li>✅ Acesso rápido pela tela inicial</li>
                    <li>✅ Abre em tela cheia</li>
                    <li>✅ Carrega mais rápido</li>
                    <li>✅ Experiência mais fluida</li>
                  </ul>
                </div>

                {!isInstalled && (
                  <div className="bg-muted/50 rounded-lg p-3 md:p-4 text-xs md:text-sm space-y-2 md:space-y-3">
                    <h4 className="font-semibold text-foreground">📱 Como instalar manualmente:</h4>
                    <div className="space-y-2">
                      <div className="border-l-2 border-primary pl-3">
                        <p className="font-medium">No Android:</p>
                        <p className="text-muted-foreground">Menu (⋮) → "Adicionar à tela inicial"</p>
                      </div>
                      <div className="border-l-2 border-primary pl-3">
                        <p className="font-medium">No iPhone/iPad:</p>
                        <p className="text-muted-foreground">Compartilhar (↑) → "Adicionar à Tela de Início"</p>
                      </div>
                    </div>
                  </div>
                )}

              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Button onClick={handleSave} disabled={loading} className="w-full h-12">
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Salvando..." : "Salvar Configurações"}
        </Button>

        {/* Manual Completo do Sistema */}
        <Card className="mt-6">
          <Collapsible open={manualOpen} onOpenChange={setManualOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setManualOpen(!manualOpen)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 shrink-0" />
                    Manual Completo do Sistema
                  </CardTitle>
                  <div className="shrink-0">
                    {manualOpen ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {/* Como Fazer uma Venda */}
                  <AccordionItem value="vendas">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                        Como Fazer uma Venda
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Passo 1: Acessar a Tela de Venda</h4>
                        <p>No menu superior, clique em "Venda". Você também pode usar as ações rápidas do Dashboard se estiverem ativadas nas configurações.</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Passo 2: Adicionar Produtos</h4>
                        <p>Existem 3 formas de adicionar produtos:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Busca por nome:</strong> Digite o nome do produto na barra de busca e clique no produto desejado</li>
                          <li><strong>Busca por código de barras:</strong> Digite o código de barras na busca</li>
                          <li><strong>Leitor de código:</strong> Clique no ícone da câmera para escanear o código de barras do produto</li>
                          <li><strong>Navegar produtos:</strong> Clique em "Ver Produtos" para abrir a lista completa. Selecione os produtos desejados (ficam destacados em verde) e clique "Continuar"</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Passo 3: Ajustar Quantidades</h4>
                        <p>No carrinho, use os botões + e - para ajustar a quantidade de cada produto. Clique no X para remover um produto.</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Passo 4: Aplicar Desconto (Opcional)</h4>
                        <p>Se quiser dar desconto, digite o valor em reais no campo "Desconto". O valor será subtraído do total automaticamente.</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Passo 5: Selecionar Cliente (Se necessário)</h4>
                        <p>Clique em "Selecionar Cliente" para associar a venda a um cliente cadastrado. Isso é <strong>obrigatório</strong> para vendas no fiado.</p>
                        <p>Se o cliente tiver crédito disponível, o valor será descontado automaticamente do total.</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Passo 6: Escolher Forma de Pagamento</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Cartão de Crédito:</strong> Cliente paga na maquininha de cartão</li>
                          <li><strong>Cartão de Débito:</strong> Cliente paga na maquininha de cartão</li>
                          <li><strong>PIX:</strong> Sistema gera QR Code para o cliente pagar (precisa configurar PIX nas Configurações)</li>
                          <li><strong>Dinheiro:</strong> Cliente paga em espécie</li>
                          <li><strong>Fiado:</strong> Venda a prazo - o valor fica como dívida do cliente (precisa selecionar um cliente)</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Passo 7: Finalizar Venda</h4>
                        <p>Clique em "Finalizar Venda". O sistema irá:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Gerar o ID da venda automaticamente (ex: ML-000001)</li>
                          <li>Atualizar o estoque dos produtos vendidos</li>
                          <li>Registrar a venda no histórico</li>
                          <li>Mostrar opção de baixar o recibo em PDF ou TXT</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Usando o Leitor de Código de Barras</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Clique no ícone da câmera ao lado da busca</li>
                          <li>Permita o acesso à câmera quando solicitado</li>
                          <li>Aponte a câmera para o código de barras do produto</li>
                          <li>O produto será adicionado automaticamente ao carrinho</li>
                          <li>Se precisar de luz, use o botão de flash</li>
                        </ol>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Gerenciamento de Produtos */}
                  <AccordionItem value="produtos">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        Gerenciamento de Produtos
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Cadastrar um Produto</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>No menu, clique em "Produtos"</li>
                          <li>Clique no botão "Novo Produto"</li>
                          <li>Preencha o <strong>Nome</strong> do produto</li>
                          <li>Digite o <strong>Preço de Custo</strong> (quanto você pagou pelo produto)</li>
                          <li>Digite o <strong>Preço de Venda</strong> (quanto vai vender para o cliente)</li>
                          <li>Informe o <strong>Estoque Atual</strong> (quantidade disponível)</li>
                          <li>Adicione uma <strong>Descrição</strong> (opcional)</li>
                          <li>Digite ou escaneie o <strong>Código de Barras</strong> (opcional)</li>
                          <li>Se tiver promoção, coloque o <strong>Preço Promocional</strong></li>
                          <li>Selecione a <strong>Categoria</strong> do produto</li>
                          <li>Se o produto tem fornecedor, ative "Tem Fornecedor?" e selecione</li>
                          <li>Faça upload de <strong>Fotos</strong> do produto (opcional)</li>
                          <li>Clique em "Salvar"</li>
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Editar um Produto</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Na lista de produtos, encontre o produto desejado</li>
                          <li>Clique no ícone de lápis (editar)</li>
                          <li>Faça as alterações necessárias</li>
                          <li>Clique em "Salvar"</li>
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Excluir um Produto</h4>
                        <p>Clique no ícone de lixeira ao lado do produto. <strong>Atenção:</strong> Produtos que já foram vendidos não podem ser excluídos. Nesse caso, você pode inativá-los.</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Controle de Estoque</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>O estoque é <strong>atualizado automaticamente</strong> a cada venda</li>
                          <li>Para ajustar manualmente, edite o produto e altere o campo "Estoque Atual"</li>
                          <li>A <strong>margem de lucro</strong> é calculada automaticamente (Preço de Venda - Preço de Custo)</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Criar Categorias</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Na página de Produtos, clique na aba "Categorias"</li>
                          <li>Clique em "Nova Categoria"</li>
                          <li>Digite o nome da categoria (ex: Bebidas, Alimentos, etc.)</li>
                          <li>Clique em "Salvar"</li>
                        </ol>
                        <p className="mt-2">Você também pode criar <strong>subcategorias</strong>: ao criar uma nova categoria, selecione uma categoria pai.</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Importar/Exportar Produtos</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Exportar:</strong> Clique no menu (3 pontos) → "Exportar CSV" para baixar todos os produtos</li>
                          <li><strong>Importar:</strong> Clique no menu → "Importar CSV" para adicionar produtos em massa</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Gerenciamento de Fornecedores */}
                  <AccordionItem value="fornecedores">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        Gerenciamento de Fornecedores
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Cadastrar um Fornecedor</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>No menu, clique em "Fornecedores"</li>
                          <li>Clique em "Novo Fornecedor"</li>
                          <li>Preencha o <strong>Nome</strong> do fornecedor</li>
                          <li>Selecione o tipo de documento: <strong>CPF</strong> ou <strong>CNPJ</strong></li>
                          <li>Digite o número do documento (os pontos e traços aparecem automaticamente)</li>
                          <li>Adicione <strong>Telefone</strong>, <strong>E-mail</strong> e <strong>Endereço</strong> (opcionais)</li>
                          <li>Informe o <strong>Nome do Contato</strong> (pessoa responsável)</li>
                          <li>Adicione <strong>Observações</strong> se necessário</li>
                          <li>Clique em "Salvar"</li>
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Vincular Fornecedor a Produto</h4>
                        <p>Ao cadastrar ou editar um produto, ative "Tem Fornecedor?" e selecione o fornecedor na lista. Isso ajuda a controlar de onde vem cada produto.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Gerenciamento de Clientes */}
                  <AccordionItem value="clientes">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Gerenciamento de Clientes
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Cadastrar um Cliente</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>No menu, clique em "Clientes"</li>
                          <li>Clique em "Novo Cliente"</li>
                          <li>Preencha o <strong>Nome Completo</strong></li>
                          <li>Digite o <strong>CPF</strong> (os pontos e traços aparecem automaticamente)</li>
                          <li>Informe a <strong>Data de Nascimento</strong></li>
                          <li>Digite o <strong>Endereço</strong> completo</li>
                          <li>Adicione o <strong>Telefone</strong></li>
                          <li>Clique em "Salvar"</li>
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Sistema de Fiado (Venda a Prazo)</h4>
                        <p>O fiado permite vender para o cliente pagar depois:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Na tela de Venda, adicione os produtos</li>
                          <li>Clique em "Selecionar Cliente" e escolha o cliente</li>
                          <li>Escolha a forma de pagamento "Fiado"</li>
                          <li>Finalize a venda - o valor será adicionado à dívida do cliente</li>
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Registrar Pagamento de Fiado</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Acesse "Clientes" no menu</li>
                          <li>Encontre o cliente e clique no ícone de dinheiro (pagamento)</li>
                          <li>Digite o valor que o cliente está pagando</li>
                          <li>Se pagar mais que deve, escolha: devolver troco ou converter em crédito</li>
                          <li>Confirme o pagamento</li>
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Crédito Antecipado</h4>
                        <p>O cliente pode deixar dinheiro adiantado que será usado nas próximas compras:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>No perfil do cliente, clique em "Adicionar Crédito"</li>
                          <li>Digite o valor que o cliente está depositando</li>
                          <li>Confirme - o crédito será usado automaticamente nas próximas vendas</li>
                        </ol>
                        <p className="mt-2"><strong>Exemplo:</strong> Cliente deposita R$200. Na próxima compra de R$80, sobra R$120 de crédito.</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Visualizar Histórico do Cliente</h4>
                        <p>Clique no cliente para ver todas as transações: compras, pagamentos e créditos depositados.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Histórico de Vendas */}
                  <AccordionItem value="historico">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        Histórico de Vendas
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Visualizar Vendas</h4>
                        <p>No menu, clique em "Histórico" para ver todas as vendas. Cada venda mostra:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>ID da venda (ex: ML-000001)</li>
                          <li>Data e hora</li>
                          <li>Nome do cliente (se houver)</li>
                          <li>Valor total</li>
                          <li>Forma de pagamento</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Ver Detalhes da Venda</h4>
                        <p>Clique no ícone de <strong>olho</strong> para ver:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Todos os produtos vendidos</li>
                          <li>Quantidade e preço de cada item</li>
                          <li>Lucro obtido em cada produto</li>
                          <li>Lucro total da venda</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Baixar Recibo</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Clique no ícone de <strong>download</strong></li>
                          <li>Escolha o formato: <strong>PDF</strong> (com logo) ou <strong>TXT</strong> (texto simples)</li>
                          <li>O arquivo será baixado automaticamente</li>
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Cancelar uma Venda</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Encontre a venda que deseja cancelar</li>
                          <li>Clique no ícone de <strong>cancelar</strong> (círculo com traço)</li>
                          <li>Confirme o cancelamento</li>
                        </ol>
                        <p className="mt-2">Ao cancelar, o sistema automaticamente:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Devolve os produtos ao estoque</li>
                          <li>Remove a dívida do cliente (se foi fiado)</li>
                          <li>Restaura o crédito usado (se aplicável)</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Relatórios */}
                  <AccordionItem value="relatorios">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Relatórios
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Gerar um Relatório</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>No menu, clique em "Relatórios"</li>
                          <li>Digite a <strong>Data Inicial</strong> (ex: 01/12/2024) - as barras aparecem automaticamente</li>
                          <li>Digite a <strong>Data Final</strong> (ex: 31/12/2024)</li>
                          <li>Clique em "Filtrar"</li>
                        </ol>
                        <p className="mt-2">Para ver <strong>todas as vendas</strong> de todos os tempos, ative a opção "Ver todas as vendas".</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Informações do Relatório</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Faturamento:</strong> Total de vendas no período (quanto entrou)</li>
                          <li><strong>Lucro:</strong> Faturamento menos o custo dos produtos (quanto sobrou)</li>
                          <li><strong>Margem:</strong> Percentual de lucro sobre o faturamento</li>
                          <li><strong>Vendas:</strong> Quantidade total de vendas realizadas</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Analisar Lucro por Venda</h4>
                        <p>Clique no ícone de <strong>olho</strong> ao lado de cada venda para ver o lucro detalhado de cada produto vendido.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Configurações da Loja */}
                  <AccordionItem value="config">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <SettingsIcon className="h-4 w-4 text-primary" />
                        Configurações da Loja
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Informações da Loja</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Acesse "Configurações" no menu</li>
                          <li>Clique em "Informações da Loja" para expandir</li>
                          <li>Preencha o <strong>Nome da Loja</strong> (aparece no topo e nos recibos)</li>
                          <li>Digite o <strong>Telefone Comercial</strong></li>
                          <li>Informe o <strong>Endereço</strong> completo</li>
                          <li>Selecione a <strong>Categoria</strong> (mercado, padaria, etc.)</li>
                          <li>Faça upload da <strong>Logo</strong> da sua loja</li>
                          <li>Escolha a <strong>Cor Primária</strong> do sistema</li>
                          <li>Clique em "Salvar Configurações"</li>
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Configurar o PIX (Passo a Passo)</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Acesse "Configurações" no menu</li>
                          <li>Clique em "Configuração PIX" para expandir</li>
                          <li>Em <strong>Tipo de Chave PIX</strong>, selecione uma opção:
                            <ul className="list-disc list-inside ml-4 mt-1">
                              <li><strong>CPF:</strong> Use seu CPF (ex: 123.456.789-00)</li>
                              <li><strong>CNPJ:</strong> Use o CNPJ da empresa (ex: 12.345.678/0001-00)</li>
                              <li><strong>E-mail:</strong> Use um e-mail (ex: loja@email.com)</li>
                              <li><strong>Telefone:</strong> Use seu número (ex: +5598981091476)</li>
                              <li><strong>Chave Aleatória:</strong> Use a chave gerada pelo banco (32 caracteres)</li>
                            </ul>
                          </li>
                          <li>Digite sua <strong>Chave PIX</strong> no campo</li>
                          <li>Digite o <strong>Nome do Recebedor</strong> (nome que aparece quando alguém paga)</li>
                          <li>Clique em "Salvar Configurações"</li>
                        </ol>
                        <p className="mt-2 text-xs"><strong>Pronto!</strong> Agora quando você fizer uma venda com PIX, o sistema gera o QR Code automaticamente para o cliente pagar.</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Ativar Ações Rápidas</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Clique em "Ações Rápidas" para expandir</li>
                          <li>Ative o switch "Ativar Ações Rápidas"</li>
                          <li>Clique em "Salvar Configurações"</li>
                        </ol>
                        <p className="mt-2">As ações rápidas são atalhos com ícones que aparecem no Dashboard para acessar as funções mais usadas rapidamente.</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Ocultar Mensagem do Período de Teste</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Clique em "Ações Rápidas" para expandir</li>
                          <li>Ative o switch "Ocultar Mensagem do Período de Teste"</li>
                          <li>Clique em "Salvar Configurações"</li>
                        </ol>
                        <p className="mt-2">Isso esconde o aviso de teste/assinatura no Dashboard. Desative para voltar a exibir a mensagem.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Baixar o App */}
                  <AccordionItem value="app">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-primary" />
                        Baixar o App no Celular
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Por que Baixar o App?</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Acesso rápido pela tela inicial do celular</li>
                          <li>Abre em tela cheia (sem barra do navegador)</li>
                          <li>Carrega mais rápido</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Instalar no Android</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Acesse "Configurações" no menu</li>
                          <li>Clique em "Baixar App"</li>
                          <li>Clique no botão "Instalar App"</li>
                          <li>Se não aparecer o botão, use o menu do navegador (⋮) → "Adicionar à tela inicial"</li>
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Instalar no iPhone/iPad</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Abra o sistema no Safari</li>
                          <li>Toque no ícone de Compartilhar (↑)</li>
                          <li>Role para baixo e toque em "Adicionar à Tela de Início"</li>
                          <li>Confirme tocando em "Adicionar"</li>
                        </ol>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Sistema de Convite */}
                  <AccordionItem value="convite">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-accent" />
                        Sistema de Convite
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Funciona</h4>
                        <p>Você tem um código de convite único. Quando alguém se cadastra usando seu código, vocês dois ganham dias grátis!</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Benefícios</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Você (quem convida):</strong> Ganha +30 dias grátis</li>
                          <li><strong>Seu amigo:</strong> Ganha 33 dias grátis (1 mês + 3 dias)</li>
                          <li>Você pode convidar <strong>quantas pessoas quiser</strong>!</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Compartilhar seu Código</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Acesse "Configurações"</li>
                          <li>Clique em "Meu Código de Convite"</li>
                          <li>Clique em "Copiar" para copiar o código</li>
                          <li>Ou clique em "Compartilhar" para enviar o link completo</li>
                          <li>Envie para seus amigos por WhatsApp, Instagram, etc.</li>
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Regras</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Seu código pode ser usado por várias pessoas diferentes</li>
                          <li>Cada pessoa só pode usar um código por dispositivo</li>
                          <li>O benefício é aplicado na hora do cadastro</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Assinatura */}
                  <AccordionItem value="assinatura">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        Assinatura e Planos
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Período de Teste</h4>
                        <p>Ao criar sua conta, você ganha <strong>3 dias grátis</strong> para testar todas as funcionalidades. Se usou um código de convite, ganha <strong>33 dias grátis</strong>!</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Planos Disponíveis</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Plano 3 Meses:</strong> R$ 29,99 - Acesso por 90 dias</li>
                          <li><strong>Plano 1 Ano:</strong> R$ 69,99 - Acesso por 365 dias (mais econômico!)</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Como Assinar (Passo a Passo)</h4>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Acesse "Assinatura" no menu</li>
                          <li>Escolha o plano que deseja (3 meses ou 1 ano)</li>
                          <li>Clique em "Comprar"</li>
                          <li>Você será redirecionado para o WhatsApp</li>
                          <li>Envie a mensagem e siga as instruções de pagamento</li>
                          <li>Após pagar, volte ao sistema</li>
                          <li>Clique em "Já Paguei"</li>
                          <li>Digite o <strong>código de 6 dígitos</strong> que você recebeu</li>
                          <li>Clique em "Validar" - seu plano será ativado na hora!</li>
                        </ol>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">O que Acontece Quando Expira?</h4>
                        <p>Quando seu período acabar, você ainda poderá acessar o sistema, mas só conseguirá ver os dados. Para voltar a vender e fazer alterações, é só renovar a assinatura.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
