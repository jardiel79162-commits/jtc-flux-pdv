import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Store, Save, Zap, BookOpen, ShoppingCart, Package, Users, FileText, Settings as SettingsIcon, CreditCard, History } from "lucide-react";
import { VideoPlaceholder } from "@/components/VideoPlaceholder";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ImageUpload";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
  });

  const [customCategory, setCustomCategory] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

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
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações da Loja</h1>
          <p className="text-muted-foreground">Personalize as informações da sua loja</p>
        </div>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Informações da Loja
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar Ações Rápidas</Label>
                <p className="text-sm text-muted-foreground">
                  Exibe atalhos com ícones no Dashboard
                </p>
              </div>
              <Switch
                checked={settings.quick_actions_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, quick_actions_enabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Salvando..." : "Salvar Configurações"}
        </Button>

        {/* Manual Completo do Sistema */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Manual Completo do Sistema
            </CardTitle>
          </CardHeader>
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
                  <VideoPlaceholder 
                    title="Como Fazer uma Venda" 
                    description="Assista ao tutorial completo do processo de venda"
                  />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Passo 1: Acessar a Tela de Venda</h4>
                    <p>Clique em "Venda" no menu superior ou use as ações rápidas do Dashboard (se ativadas).</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Passo 2: Adicionar Produtos ao Carrinho</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Busca por nome/código:</strong> Digite o nome ou código do produto na barra de busca</li>
                      <li><strong>Navegar produtos:</strong> Clique em "Ver Produtos" para abrir a visualização completa</li>
                      <li><strong>Selecionar quantidade:</strong> Use os botões + e - para ajustar a quantidade</li>
                      <li><strong>Múltipla seleção:</strong> Na tela de produtos, selecione vários produtos (ficam destacados em verde) e clique "Continuar"</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Passo 3: Aplicar Desconto (Opcional)</h4>
                    <p>Digite o valor do desconto no campo apropriado. O valor será subtraído do total.</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Passo 4: Selecionar Cliente (Opcional)</h4>
                    <p>Clique em "Selecionar Cliente" para associar a venda a um cliente cadastrado. Obrigatório para vendas no fiado.</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Passo 5: Escolher Forma de Pagamento</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Cartão de Crédito:</strong> Pagamento via maquininha</li>
                      <li><strong>Cartão de Débito:</strong> Pagamento via maquininha</li>
                      <li><strong>PIX:</strong> Pagamento instantâneo</li>
                      <li><strong>Dinheiro:</strong> Pagamento em espécie</li>
                      <li><strong>Fiado:</strong> Venda a prazo (requer cliente selecionado)</li>
                      <li><strong>Crédito do Cliente:</strong> Usa saldo disponível do cliente</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Passo 6: Finalizar Venda</h4>
                    <p>Clique em "Finalizar Venda". O sistema irá:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Gerar automaticamente o ID da venda (ex: ML-000001)</li>
                      <li>Atualizar o estoque dos produtos</li>
                      <li>Registrar a transação no histórico</li>
                      <li>Exibir o recibo para download (PDF ou TXT)</li>
                    </ul>
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
                  <VideoPlaceholder 
                    title="Gerenciamento de Produtos" 
                    description="Tutorial completo de cadastro e gestão de produtos"
                  />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Cadastrar Novo Produto</h4>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Acesse "Produtos" no menu</li>
                      <li>Clique em "Novo Produto"</li>
                      <li>Preencha os dados obrigatórios: Nome, Preço e Quantidade em Estoque</li>
                      <li>Adicione dados opcionais: Descrição, Código Interno, Código de Barras, Preço Promocional</li>
                      <li>Selecione ou crie uma Categoria/Subcategoria</li>
                      <li>Faça upload de fotos do produto</li>
                      <li>Defina o estoque mínimo para alertas</li>
                      <li>Clique em "Salvar"</li>
                    </ol>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Editar Produto</h4>
                    <p>Clique no ícone de edição ao lado do produto desejado. Faça as alterações e salve.</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Controle de Estoque</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>O estoque é atualizado automaticamente a cada venda</li>
                      <li>Produtos com estoque abaixo do mínimo aparecem em alerta no Dashboard</li>
                      <li>Você pode ajustar manualmente a quantidade editando o produto</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Inativar Produto</h4>
                    <p>Produtos que já foram vendidos não podem ser excluídos. Use a opção "Inativar" para removê-los da lista de vendas sem perder o histórico.</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Gerenciar Categorias</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Crie categorias para organizar seus produtos</li>
                      <li>Adicione subcategorias para maior detalhamento</li>
                      <li>Exemplo: Categoria "Bebidas" → Subcategorias "Refrigerantes", "Sucos", "Água"</li>
                    </ul>
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
                  <VideoPlaceholder 
                    title="Gerenciamento de Clientes" 
                    description="Como cadastrar clientes e gerenciar crédito/fiado"
                  />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Cadastrar Novo Cliente</h4>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Acesse "Clientes" no menu</li>
                      <li>Clique em "Novo Cliente"</li>
                      <li>Preencha: Nome, CPF, Data de Nascimento, Endereço e Telefone</li>
                      <li>Clique em "Salvar"</li>
                    </ol>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Sistema de Fiado (Crédito)</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Venda no Fiado:</strong> O valor da compra é adicionado à dívida do cliente</li>
                      <li><strong>Registrar Pagamento:</strong> Clique no botão de pagamento no perfil do cliente</li>
                      <li><strong>Pagamento Parcial:</strong> O cliente pode pagar parte da dívida (ex: R$10 de R$50)</li>
                      <li><strong>Pagamento com Troco:</strong> Se o cliente pagar mais que deve, você pode devolver o troco ou converter em crédito</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Crédito Antecipado</h4>
                    <p>O cliente pode depositar um valor antecipado que será usado automaticamente nas próximas compras.</p>
                    <p><strong>Exemplo:</strong> Cliente deposita R$200. Ao comprar R$100, o saldo vai para R$100 automaticamente.</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Visualizar Histórico</h4>
                    <p>No perfil de cada cliente você pode ver todas as transações: compras, pagamentos e créditos.</p>
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
                  <VideoPlaceholder 
                    title="Histórico de Vendas" 
                    description="Aprenda a consultar e gerenciar o histórico de vendas"
                  />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Visualizar Vendas</h4>
                    <p>Acesse "Histórico" no menu para ver todas as vendas realizadas com:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>ID da venda</li>
                      <li>Data e hora</li>
                      <li>Cliente (se houver)</li>
                      <li>Valor total</li>
                      <li>Forma de pagamento</li>
                      <li>Itens vendidos</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Cancelar Venda</h4>
                    <p>Clique no botão de cancelar ao lado da venda. O sistema irá:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Devolver os produtos ao estoque</li>
                      <li>Reverter o saldo do cliente (se venda no fiado)</li>
                      <li>Restaurar crédito usado (se aplicável)</li>
                      <li>Remover o registro da venda</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Baixar Recibo</h4>
                    <p>Clique no ícone de download para baixar o recibo em PDF ou TXT.</p>
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
                  <VideoPlaceholder 
                    title="Relatórios" 
                    description="Como gerar e exportar relatórios do sistema"
                  />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Tipos de Relatórios Disponíveis</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Vendas Diárias:</strong> Resumo das vendas do dia</li>
                      <li><strong>Vendas Mensais:</strong> Resumo das vendas do mês</li>
                      <li><strong>Período Personalizado:</strong> Selecione datas específicas</li>
                      <li><strong>Produtos Mais Vendidos:</strong> Ranking dos produtos</li>
                      <li><strong>Relatório de Clientes:</strong> Análise por cliente</li>
                      <li><strong>Relatório Financeiro:</strong> Resumo de receitas</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Exportar Relatórios</h4>
                    <p>Todos os relatórios podem ser exportados em PDF ou CSV para análise externa ou impressão.</p>
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
                  <VideoPlaceholder 
                    title="Configurações da Loja" 
                    description="Personalize sua loja e configure o sistema"
                  />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Informações Básicas</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Nome da Loja:</strong> Aparece no cabeçalho e nos recibos</li>
                      <li><strong>Telefone Comercial:</strong> Contato da loja</li>
                      <li><strong>Endereço:</strong> Localização da loja</li>
                      <li><strong>Categoria:</strong> Tipo de estabelecimento</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Personalização Visual</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Logo:</strong> Faça upload da logo da sua loja (aparece circular)</li>
                      <li><strong>Cor Primária:</strong> Personalize as cores do sistema</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Ações Rápidas</h4>
                    <p>Ative para exibir atalhos com ícones no Dashboard para acesso rápido às principais funções.</p>
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
                  <VideoPlaceholder 
                    title="Assinatura e Planos" 
                    description="Como assinar e gerenciar seu plano"
                  />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Período de Teste</h4>
                    <p>Ao criar sua conta, você ganha 3 dias de teste grátis com acesso completo ao sistema.</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Planos Disponíveis</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Plano 3 Meses:</strong> R$ 29,99 - Acesso por 90 dias</li>
                      <li><strong>Plano 1 Ano:</strong> R$ 69,99 - Acesso por 365 dias (melhor custo-benefício)</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Como Assinar</h4>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Acesse "Assinatura" no menu</li>
                      <li>Escolha o plano desejado</li>
                      <li>Clique em "Comprar" - você será direcionado ao WhatsApp</li>
                      <li>Realize o pagamento conforme instruções</li>
                      <li>Volte ao sistema e clique em "Já Paguei"</li>
                      <li>Digite o código de validação recebido</li>
                      <li>Pronto! Seu plano será ativado imediatamente</li>
                    </ol>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Após Expiração</h4>
                    <p>Quando o período expira, você terá acesso apenas à área de pagamento e consultas básicas. Renove para continuar usando todas as funcionalidades.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
