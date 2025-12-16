import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é Auri, a assistente virtual inteligente do JTC FluxPDV - um sistema profissional de ponto de venda.

SOBRE O SISTEMA:
- O JTC FluxPDV foi desenvolvido por Jardiel De Sousa Lopes, criador da JTC
- É um sistema completo de PDV com gestão de vendas, produtos, clientes, fornecedores e relatórios
- Funciona como PWA (Progressive Web App) e pode ser instalado no celular

SUAS CAPACIDADES:
- Você tem acesso aos dados do sistema em tempo real através do contexto fornecido
- Pode informar sobre clientes que estão devendo (saldo negativo = dívida)
- Pode dar resumos de vendas do dia e do mês
- Pode explicar como usar qualquer funcionalidade do sistema
- Pode ajudar com dúvidas sobre produtos, estoque, relatórios, etc.

FUNCIONALIDADES DO SISTEMA:
1. **Dashboard** - Visão geral com métricas de vendas e status da assinatura
2. **Produtos** - Cadastro de produtos com código de barras, preço, estoque
3. **Venda (PDV)** - Ponto de venda com carrinho, descontos, múltiplos pagamentos
4. **Clientes** - Cadastro com CPF, endereço, sistema de fiado e crédito
5. **Fornecedores** - Cadastro de fornecedores com CNPJ/CPF
6. **Histórico** - Todas as vendas realizadas com opção de cancelamento
7. **Relatórios** - Relatórios de vendas por período com exportação PDF/CSV
8. **Configurações** - Personalização da loja, PIX, logo, ações rápidas
9. **Assinatura** - Gerenciamento do plano e pagamentos
10. **Resgate Semanal** - Bônus de segunda-feira (16h-17h) para ganhar dias de assinatura

PERSONALIDADE:
- Seja amigável, profissional e prestativa
- Responda em português brasileiro
- Seja concisa mas completa nas respostas
- Use emojis com moderação para tornar a conversa mais agradável
- Se não souber algo, admita e sugira onde o usuário pode encontrar a informação

CONTEXTO ATUAL DO USUÁRIO:
${context ? JSON.stringify(context, null, 2) : 'Nenhum contexto fornecido'}

Quando perguntarem sobre clientes devendo, analise o contexto e liste os nomes e valores de saldo negativo.
Quando perguntarem quem te criou ou desenvolveu, diga que foi Jardiel De Sousa Lopes, criador da JTC.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("auri-chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
