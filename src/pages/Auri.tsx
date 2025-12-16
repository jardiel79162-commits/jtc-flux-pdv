import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Send, Loader2, Sparkles, Menu, Plus, Trash2, MessageSquare 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface AuriContext {
  storeName?: string;
  customersOwing: Array<{ name: string; cpf: string; balance: number; phone?: string }>;
  customersWithCredit: Array<{ name: string; cpf: string; balance: number }>;
  totalCustomers: number;
  salesToday: number;
  salesCountToday: number;
  salesMonth: number;
  salesCountMonth: number;
  salesHistory: Array<{
    id: string;
    date: string;
    total: number;
    payment_method: string;
    customer_name?: string;
    items: Array<{ product_name: string; quantity: number; unit_price: number }>;
  }>;
  firstSaleEver?: any;
  totalProducts: number;
  lowStockProducts: Array<{ name: string; price: number; stock: number; category?: string }>;
  topProducts: Array<{ name: string; quantity: number }>;
  totalSuppliers: number;
  suppliers: Array<{ name: string; cnpj?: string; phone?: string }>;
  subscriptionStatus?: string;
  subscriptionDaysLeft?: number;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auri-chat`;

const Auri = () => {
  const [showSidebar, setShowSidebar] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<AuriContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadConversations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("auri_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("auri_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data?.map(m => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })) || []);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    }
  }, []);

  const createConversation = useCallback(async (firstMessage: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const title = firstMessage.length > 40 ? firstMessage.substring(0, 40) + "..." : firstMessage;

      const { data, error } = await supabase
        .from("auri_conversations")
        .insert({ user_id: user.id, title })
        .select()
        .single();

      if (error) throw error;
      
      setConversations(prev => [data, ...prev]);
      setCurrentConversationId(data.id);
      return data.id;
    } catch (error) {
      console.error("Erro ao criar conversa:", error);
      return null;
    }
  }, []);

  const saveMessage = useCallback(async (conversationId: string, role: "user" | "assistant", content: string) => {
    try {
      const { error } = await supabase
        .from("auri_messages")
        .insert({ conversation_id: conversationId, role, content });

      if (error) throw error;

      await supabase
        .from("auri_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    } catch (error) {
      console.error("Erro ao salvar mensagem:", error);
    }
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from("auri_conversations")
        .delete()
        .eq("id", conversationId);

      if (error) throw error;

      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }

      toast({ title: "Conversa excluída" });
    } catch (error) {
      console.error("Erro ao excluir conversa:", error);
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  }, [currentConversationId, toast]);

  const selectConversation = useCallback((conversation: Conversation) => {
    setCurrentConversationId(conversation.id);
    loadMessages(conversation.id);
    setShowSidebar(false);
  }, [loadMessages]);

  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
    setShowSidebar(false);
  }, []);

  const loadContext = useCallback(async () => {
    setContextLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      const customersOwing = customers
        .filter(c => c.current_balance < 0)
        .map(c => ({ name: c.name, cpf: c.cpf, balance: c.current_balance, phone: c.phone }));
      
      const customersWithCredit = customers
        .filter(c => c.current_balance > 0)
        .map(c => ({ name: c.name, cpf: c.cpf, balance: c.current_balance }));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const salesTodayData = sales.filter(s => new Date(s.created_at) >= today);
      const salesMonthData = sales.filter(s => new Date(s.created_at) >= firstDayOfMonth);

      const salesWithItems = sales.slice(0, 50).map(sale => {
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

      const firstSale = sales.length > 0 ? sales[sales.length - 1] : null;
      let firstSaleEver = undefined;
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

      const productSales: Record<string, number> = {};
      saleItems.forEach(item => {
        const name = item.product_name || "Produto";
        productSales[name] = (productSales[name] || 0) + item.quantity;
      });
      const topProducts = Object.entries(productSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, quantity]) => ({ name, quantity }));

      const lowStockProducts = products
        .filter(p => p.stock_quantity <= (p.min_stock_quantity ?? 5))
        .map(p => ({
          name: p.name,
          price: Number(p.price),
          stock: p.stock_quantity,
          category: (p.categories as any)?.name,
        }));

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
    loadContext();
    loadConversations();
    inputRef.current?.focus();
  }, [loadContext, loadConversations]);

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
      body: JSON.stringify({ messages: userMessages.map(m => ({ role: m.role, content: m.content })), context }),
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

    let conversationId = currentConversationId;
    
    if (!conversationId) {
      conversationId = await createConversation(userMessage.content);
      if (!conversationId) {
        setIsLoading(false);
        toast({ title: "Erro ao criar conversa", variant: "destructive" });
        return;
      }
    }

    await saveMessage(conversationId, "user", userMessage.content);

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

      if (assistantContent && conversationId) {
        await saveMessage(conversationId, "assistant", assistantContent);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Hoje";
    if (days === 1) return "Ontem";
    if (days < 7) return `${days} dias atrás`;
    return date.toLocaleDateString("pt-BR");
  };

  return (
    <div className="h-[calc(100vh-64px)] flex bg-background">
      {/* Sidebar - Mobile Overlay */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setShowSidebar(false)} 
        />
      )}

      {/* Sidebar */}
      <div className={`
        ${showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"} 
        fixed md:relative z-50 md:z-0
        w-72 h-full flex flex-col bg-card border-r transition-transform duration-200
      `}>
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-violet-500 to-purple-600">
          <h3 className="font-bold text-white">Histórico</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={startNewConversation}
            className="text-white hover:bg-white/20"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma conversa ainda
              </p>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    currentConversationId === conv.id 
                      ? "bg-violet-100 dark:bg-violet-900/30" 
                      : "hover:bg-muted"
                  }`}
                  onClick={() => selectConversation(conv)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conv.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(conv.updated_at)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-violet-500 to-purple-600">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white hover:bg-white/20"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white">Auri</h2>
              <p className="text-xs text-white/80">
                {contextLoading ? "Carregando dados..." : "Assistente Inteligente"}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-violet-400" />
                <h3 className="text-xl font-semibold mb-2">Olá! Eu sou a Auri</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Sua assistente inteligente do JTC FluxPDV. Pergunte sobre vendas, clientes, produtos, fornecedores ou qualquer coisa sobre seu negócio!
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted p-4 rounded-2xl">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-background">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Digite sua mensagem..."
              disabled={isLoading || contextLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading || contextLoading}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auri;
