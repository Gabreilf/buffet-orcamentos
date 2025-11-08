import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Configuração de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// O segredo do webhook da Kiwify deve ser configurado no painel do Supabase como um segredo de Edge Function.
const KIWIFY_WEBHOOK_SECRET = Deno.env.get('KIWIFY_WEBHOOK_SECRET');

serve(async (req) => {
  // Lidar com requisições OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reqBody = await req.json();
    
    // 1️⃣ — Verifica se o segredo do webhook é válido
    const secret = req.headers.get("x-kiwify-signature");
    
    if (!KIWIFY_WEBHOOK_SECRET) {
        console.error("ERRO DE CONFIGURAÇÃO: KIWIFY_WEBHOOK_SECRET não configurado no ambiente.");
        return new Response(JSON.stringify({ error: "Server configuration error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (secret !== KIWIFY_WEBHOOK_SECRET) {
      console.warn(`ERRO DE AUTENTICAÇÃO: Tentativa de acesso não autorizado com secret: ${secret}`);
      return new Response(JSON.stringify({ error: "Unauthorized: invalid secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2️⃣ — Captura o evento vindo da Kiwify
    const event = reqBody?.event;
    const data = reqBody?.data;
    const email = data?.buyer?.email;
    const productName = data?.product?.name;

    if (!event || !data || !email) {
      console.error("ERRO DE PAYLOAD: Payload inválido ou email ausente.", reqBody);
      return new Response(JSON.stringify({ error: "Invalid webhook payload or missing email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Inicializa o cliente Supabase com a chave de serviço (SERVICE_ROLE_KEY)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let newPlan = "free";
    let logMessage = `Evento Kiwify recebido: ${event} para ${email}.`;
    let shouldUpdate = false;

    // 3️⃣ — Gerenciamento de Estados
    
    // Define o plano com base no produto (usado em 'order.approved')
    if (productName) {
        if (productName.includes("197")) newPlan = "basic";
        else if (productName.includes("497")) newPlan = "pro";
    }

    if (event === "order.approved") {
      // Pagamento aprovado: Ativa o plano
      logMessage = `✅ Venda Aprovada. Ativando plano ${newPlan} para ${email}.`;
      shouldUpdate = true;
    } else if (event === "subscription.cancelled") {
      // Assinatura cancelada: Volta para o plano free
      newPlan = "free";
      logMessage = `❌ Assinatura Cancelada. Revertendo plano para ${newPlan} para ${email}.`;
      shouldUpdate = true;
    } else if (event === "order.refunded") {
      // Reembolso: Volta para o plano free (acesso suspenso)
      newPlan = "free";
      logMessage = `💸 Reembolso Processado. Revertendo plano para ${newPlan} para ${email}.`;
      shouldUpdate = true;
    } else if (event === "order.pending" || event === "order.refused") {
        // Pagamento pendente ou recusado: Não faz nada, o usuário permanece no plano atual (geralmente 'free')
        logMessage = `⚠️ Evento de status intermediário (${event}). Nenhuma alteração de plano necessária.`;
        shouldUpdate = false;
    } else {
        logMessage = `ℹ️ Evento desconhecido (${event}). Ignorando.`;
        shouldUpdate = false;
    }

    console.log(logMessage);

    if (shouldUpdate) {
        // Atualiza o plano no Supabase (tabela 'profiles')
        const { error } = await supabaseClient
            .from("profiles")
            .update({ plan: newPlan })
            .eq("email", email);

        if (error) {
            console.error(`ERRO DE DB: Falha ao atualizar plano para ${email} no Supabase:`, error.message);
            // Retorna 500 para que a Kiwify possa tentar novamente (se configurado)
            return new Response(JSON.stringify({ error: "Database update failed" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        console.log(`SUCESSO: Plano de ${email} atualizado para ${newPlan}.`);
    }

    return new Response(JSON.stringify({ received: true, event, plan: newPlan }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ERRO INTERNO DO WEBHOOK:", error);
    // Fallback seguro: Retorna 500 para que a Kiwify tente novamente
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});