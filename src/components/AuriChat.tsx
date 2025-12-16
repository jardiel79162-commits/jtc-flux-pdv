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

interface AuriContext {
  customersOwing?: Array<{ name: string; balance: number }>;
  salesToday?: number;
  salesMonth?: number;
  lowStockCount?: number;
  storeName?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auri-chat`;

export const AuriChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<AuriContext>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carregar contexto do sistema
  const loadContext = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Clientes devendo (saldo negativo)
      const { data: customersData } = await supabase
        .from("customers")
        .select("name, current_balance")
        .eq("user_id", user.id)
        .lt("current_balance", 0);

      // Vendas de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: salesTodayData } = await supabase
        .from("sales")
        .select("total_amount")
        .eq("user_id", user.id)
        .gte("created_at", today.toISOString());

      // Vendas do mês
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const { data: salesMonthData } = await supabase
        .from("sales")
        .select("total_amount")
        .eq("user_id", user.id)
        .gte("created_at", firstDayOfMonth.toISOString());

      // Produtos com estoque baixo
      const { data: productsData } = await supabase
        .from("products")
        .select("id, stock_quantity, min_stock_quantity")
        .eq("user_id", user.id);

      // Nome da loja
      const { data: storeData } = await supabase
        .from("store_settings")
        .select("store_name")
        .eq("user_id", user.id)
        .single();

      const lowStockCount = productsData?.filter(
        (p) => p.stock_quantity <= (p.min_stock_quantity ?? 0)
      ).length || 0;

      setContext({
        customersOwing: customersData?.map(c => ({ 
          name: c.name, 
          balance: c.current_balance 
        })) || [],
        salesToday: salesTodayData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0,
        salesMonth: salesMonthData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0,
        lowStockCount,
        storeName: storeData?.store_name || "Loja",
      });
    } catch (error) {
      console.error("Erro ao carregar contexto:", error);
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

      // Adicionar mensagem vazia do assistente
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
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Chat Card */}
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
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-violet-400" />
                    <p className="font-medium">Olá! Sou a Auri 👋</p>
                    <p className="text-sm mt-2">
                      Como posso ajudar você hoje?
                    </p>
                    <div className="mt-4 space-y-2 text-xs">
                      <p className="text-muted-foreground">Experimente perguntar:</p>
                      <button 
                        onClick={() => setInput("Quem está devendo?")}
                        className="block w-full text-left px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                      >
                        💰 "Quem está devendo?"
                      </button>
                      <button 
                        onClick={() => setInput("Como vender um produto?")}
                        className="block w-full text-left px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                      >
                        🛒 "Como vender um produto?"
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
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
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
