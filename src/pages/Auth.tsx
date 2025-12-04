import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { signIn, signUp, type SignUpData } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, TrendingUp, Package, Loader2, Eye, EyeOff, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { fetchCEP, fetchEstados, fetchCidades, type Estado, type Cidade } from "@/lib/location";
import logo from "@/assets/logo.jpg";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const Auth = () => {
  const navigate = useNavigate();
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

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    // Carregar cidades quando estado mudar
    if (selectedEstado) {
      fetchCidades(selectedEstado).then(setCidades);
    } else {
      setCidades([]);
    }
  }, [selectedEstado]);

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
    };

    try {
      await signUp(data);
      toast({
        title: "Conta criada!",
        description: "Você ganhou 3 dias de teste grátis. Seja bem-vindo!",
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Seção de branding */}
        <div className="hidden lg:flex flex-col justify-center space-y-6 p-8">
          <div className="flex items-center gap-4 mb-6">
            <img src={logo} alt="JTC FluxPDV" className="w-20 h-20 rounded-full object-cover" />
            <div className="space-y-1">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                JTC FluxPDV
              </h1>
              <p className="text-xl text-muted-foreground">
                Sistema completo de gestão para sua loja
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">PDV Completo</h3>
                <p className="text-sm text-muted-foreground">Sistema de vendas rápido e eficiente</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold">Gestão de Estoque</h3>
                <p className="text-sm text-muted-foreground">Controle total dos seus produtos</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Relatórios Detalhados</h3>
                <p className="text-sm text-muted-foreground">Análises completas do seu negócio</p>
              </div>
            </div>
          </div>
        </div>

        {/* Formulários */}
        <Card className="shadow-2xl">
          <CardHeader className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
              <img src={logo} alt="JTC FluxPDV" className="w-16 h-16 rounded-full object-cover" />
              <CardTitle className="text-3xl">JTC FluxPDV</CardTitle>
            </div>
            <CardDescription>Entre na sua conta ou crie uma nova</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Criar Conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="identifier">E-mail ou CPF</Label>
                    <Input
                      id="identifier"
                      name="identifier"
                      placeholder="seu@email.com ou 12345678900"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        disabled={isLoading}
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

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome Completo</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf"
                        name="cpf"
                        placeholder="000.000.000-00"
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        placeholder="(00) 00000-0000"
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cep">CEP</Label>
                      <div className="relative">
                        <Input
                          id="cep"
                          name="cep"
                          placeholder="00000-000"
                          maxLength={9}
                          required
                          disabled={isLoading || isFetchingCEP}
                          onChange={(e) => {
                            const value = e.target.value
                              .replace(/\D/g, "")
                              .replace(/^(\d{5})(\d)/, "$1-$2");
                            e.target.value = value;
                            handleCEPChange(value);
                          }}
                        />
                        {isFetchingCEP && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Digite o CEP para preencher o endereço automaticamente
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="street">Rua</Label>
                      <Input
                        id="street"
                        name="street"
                        value={addressData.street}
                        onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="number">Número</Label>
                      <Input
                        id="number"
                        name="number"
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        name="neighborhood"
                        value={addressData.neighborhood}
                        onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">Estado</Label>
                      <Select
                        value={selectedEstado}
                        onValueChange={setSelectedEstado}
                        disabled={isLoading}
                        required
                      >
                        <SelectTrigger>
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
                      <Label htmlFor="city">Cidade</Label>
                      <Select
                        value={selectedCidade}
                        onValueChange={setSelectedCidade}
                        disabled={isLoading || !selectedEstado}
                        required
                      >
                        <SelectTrigger>
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
                      <Label htmlFor="password">Senha</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          required
                          disabled={isLoading}
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
                      <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          disabled={isLoading}
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

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Criando..." : "Criar Conta"}
                  </Button>

                  <p className="text-sm text-center text-muted-foreground">
                    Ao criar sua conta, você ganha 3 dias de teste grátis
                  </p>

                  {/* Manual de Como Criar Conta */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full mt-2" type="button">
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

                        {/* Passo 5 */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">5</span>
                            Finalizar Cadastro
                          </h3>
                          <div className="ml-8 space-y-2 text-muted-foreground">
                            <p>Após preencher todos os campos, clique no botão <strong>"Criar Conta"</strong>.</p>
                            <p>O sistema irá:</p>
                            <ul className="list-disc list-inside ml-2">
                              <li>Validar todos os dados informados</li>
                              <li>Criar sua conta no sistema</li>
                              <li>Ativar automaticamente 3 dias de teste grátis</li>
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
                            </ul>
                            <div className="bg-accent/10 p-3 rounded-lg mt-3">
                              <p className="font-medium text-foreground">📌 Importante:</p>
                              <p>Seu período de teste de 3 dias começa imediatamente após o cadastro. Aproveite para explorar todas as funcionalidades do sistema!</p>
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
                            <p><strong>"As senhas não coincidem":</strong> Verifique se digitou a mesma senha nos dois campos.</p>
                            <p><strong>"CEP não encontrado":</strong> Verifique se o CEP está correto ou preencha o endereço manualmente.</p>
                            <p><strong>"E-mail já cadastrado":</strong> Este e-mail já possui uma conta. Use outro e-mail ou faça login.</p>
                            <p><strong>"CPF já cadastrado":</strong> Este CPF já possui uma conta. Faça login com suas credenciais.</p>
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
