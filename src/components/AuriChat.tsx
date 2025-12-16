import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CustomerData {
  name: string;
  cpf: string;
  balance: number;
  phone?: string;
}

interface SaleHistoryItem {
  id: string;
  date: string;
  total: number;
  payment_method: string;
  customer_name?: string;
  items: Array<{ product_name: string; quantity: number; unit_price: number }>;
}

interface ProductData {
  name: string;
  price: number;
  stock: number;
  category?: string;
}

interface SupplierData {
  name: string;
  cnpj?: string;
  phone?: string;
}

interface AuriContext {
  storeName?: string;
  // Clientes
  customersOwing: CustomerData[];
  customersWithCredit: CustomerData[];
  totalCustomers: number;
  // Vendas
  salesToday: number;
  salesCountToday: number;
  salesMonth: number;
  salesCountMonth: number;
  salesHistory: SaleHistoryItem[];
  firstSaleEver?: SaleHistoryItem;
  // Produtos
  totalProducts: number;
  lowStockProducts: ProductData[];
  topProducts: Array<{ name: string; quantity: number }>;
  // Fornecedores
  totalSuppliers: number;
  suppliers: SupplierData[];
  // Assinatura
  subscriptionStatus?: string;
  subscriptionDaysLeft?: number;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auri-chat`;

export const AuriChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<AuriContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carregar contexto COMPLETO do sistema
  const loadContext = useCallback(async () => {
    setContextLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar TODOS os dados em paralelo
      const [
        customersResult,
        salesResult,
        saleItemsResult,
        productsResult,
        suppliersResult,
        profileResult,
        storeResult,
      ] = await Promise.all([
        supabase.from("customers").select("*").eq("user_id", user.id),
        supabase.from("sales").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("sale_items").select("*, sales!inner(user_id)").eq("sales.user_id", user.id),
        supabase.from("products").select("*, categories(name)").eq("user_id", user.id),
        supabase.from("suppliers").select("*").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("store_settings").select("store_name").eq("user_id", user.id).single(),
      ]);

      const customers = customersResult.data || [];
      const sales = salesResult.data || [];
      const saleItems = saleItemsResult.data || [];
      const products = productsResult.data || [];
      const suppliers = suppliersResult.data || [];
      const profile = profileResult.data;
      const store = storeResult.data;

      // Processar clientes
      const customersOwing = customers
        .filter(c => c.current_balance < 0)
        .map(c => ({ name: c.name, cpf: c.cpf, balance: c.current_balance, phone: c.phone }));
      
      const customersWithCredit = customers
        .filter(c => c.current_balance > 0)
        .map(c => ({ name: c.name, cpf: c.cpf, balance: c.current_balance, phone: c.phone }));

      // Processar vendas
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const salesTodayData = sales.filter(s => new Date(s.created_at) >= today);
      const salesMonthData = sales.filter(s => new Date(s.created_at) >= firstDayOfMonth);

      // Mapear itens de venda para cada venda
      const salesWithItems: SaleHistoryItem[] = sales.slice(0, 50).map(sale => {
        const items = saleItems
          .filter(item => item.sale_id === sale.id)
          .map(item => ({
            product_name: item.product_name || "Produto",
            quantity: item.quantity,
            unit_price: Number(item.unit_price),
          }));
        
        const customer = customers.find(c => c.id === sale.customer_id);
        
        return {
          id: sale.id,
          date: sale.created_at,
          total: Number(sale.total_amount),
          payment_method: sale.payment_method,
          customer_name: customer?.name,
          items,
        };
      });

      // Primeira venda do sistema
      const firstSale = sales.length > 0 ? sales[sales.length - 1] : null;
      let firstSaleEver: SaleHistoryItem | undefined;
      if (firstSale) {
        const firstSaleItems = saleItems
          .filter(item => item.sale_id === firstSale.id)
          .map(item => ({
            product_name: item.product_name || "Produto",
            quantity: item.quantity,
            unit_price: Number(item.unit_price),
          }));
        const firstCustomer = customers.find(c => c.id === firstSale.customer_id);
        firstSaleEver = {
          id: firstSale.id,
          date: firstSale.created_at,
          total: Number(firstSale.total_amount),
          payment_method: firstSale.payment_method,
          customer_name: firstCustomer?.name,
          items: firstSaleItems,
        };
      }

      // Produtos mais vendidos
      const productSales: Record<string, number> = {};
      saleItems.forEach(item => {
        const name = item.product_name || "Produto";
        productSales[name] = (productSales[name] || 0) + item.quantity;
      });
      const topProducts = Object.entries(productSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, quantity]) => ({ name, quantity }));

      // Produtos com estoque baixo
      const lowStockProducts = products
        .filter(p => p.stock_quantity <= (p.min_stock_quantity ?? 5))
        .map(p => ({
          name: p.name,
          price: Number(p.price),
          stock: p.stock_quantity,
          category: (p.categories as any)?.name,
        }));

      // Calcular status da assinatura
      let subscriptionStatus = "expirado";
      let subscriptionDaysLeft = 0;
      const now = new Date();
      
      if (profile?.subscription_ends_at && new Date(profile.subscription_ends_at) > now) {
        subscriptionStatus = "ativo";
        subscriptionDaysLeft = Math.ceil((new Date(profile.subscription_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } else if (profile?.trial_ends_at && new Date(profile.trial_ends_at) > now) {
        subscriptionStatus = "teste";
        subscriptionDaysLeft = Math.ceil((new Date(profile.trial_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      setContext({
        storeName: store?.store_name || "Loja",
        customersOwing,
        customersWithCredit,
        totalCustomers: customers.length,
        salesToday: salesTodayData.reduce((sum, s) => sum + Number(s.total_amount), 0),
        salesCountToday: salesTodayData.length,
        salesMonth: salesMonthData.reduce((sum, s) => sum + Number(s.total_amount), 0),
        salesCountMonth: salesMonthData.length,
        salesHistory: salesWithItems,
        firstSaleEver,
        totalProducts: products.length,
        lowStockProducts,
        topProducts,
        totalSuppliers: suppliers.length,
        suppliers: suppliers.map(s => ({ name: s.name, cnpj: s.cnpj, phone: s.phone })),
        subscriptionStatus,
        subscriptionDaysLeft,
      });
    } catch (error) {
      console.error("Erro ao carregar contexto:", error);
    } finally {
      setContextLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadContext();
      inputRef.current?.focus();
    }
  }, [isOpen, loadContext]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessages: Message[]) => {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: userMessages, context }),
    });

    if (!response.ok || !response.body) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Erro ao conectar com Auri");
    }

    return response.body.getReader();
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";

    try {
      const reader = await streamChat(newMessages);
      const decoder = new TextDecoder();
      let buffer = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                if (updated[updated.length - 1]?.role === "assistant") {
                  updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                }
                return updated;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Erro no chat:", error);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente! 😊" }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Botão Flutuante */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 transition-all hover:scale-110"
        size="icon"
      >
        <Sparkles className="h-6 w-6 text-white" />
      </Button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          
          <Card className="relative w-full max-w-md h-[70vh] max-h-[600px] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Auri Suporte</CardTitle>
                  <p className="text-xs text-white/80">Assistente JTC FluxPDV</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {contextLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-violet-400" />
                    <p className="text-sm text-muted-foreground mt-2">Carregando dados do sistema...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-violet-400" />
                    <p className="font-medium">Olá! Sou a Auri 👋</p>
                    <p className="text-sm mt-2">Tenho acesso a todo o histórico do sistema!</p>
                    <div className="mt-4 space-y-2 text-xs">
                      <p className="text-muted-foreground">Experimente perguntar:</p>
                      <button 
                        onClick={() => setInput("Quem está devendo?")}
                        className="block w-full text-left px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                      >
                        💰 "Quem está devendo?"
                      </button>
                      <button 
                        onClick={() => setInput("Qual foi a primeira venda do sistema?")}
                        className="block w-full text-left px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                      >
                        📊 "Qual foi a primeira venda?"
                      </button>
                      <button 
                        onClick={() => setInput("Quais são os produtos mais vendidos?")}
                        className="block w-full text-left px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                      >
                        🏆 "Produtos mais vendidos"
                      </button>
                      <button 
                        onClick={() => setInput("Quem te criou?")}
                        className="block w-full text-left px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                      >
                        🤖 "Quem te criou?"
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                            msg.role === "user"
                              ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content || "..."}</p>
                        </div>
                      </div>
                    ))}
                    {isLoading && messages[messages.length - 1]?.role === "user" && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-2xl px-4 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite sua mensagem..."
                    disabled={isLoading || contextLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading || contextLoading}
                    size="icon"
                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default AuriChat;
