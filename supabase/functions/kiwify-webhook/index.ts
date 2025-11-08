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
    let newIsActive = false;
    let logMessage = `Evento Kiwify recebido: ${event} para ${email}.`;
    let shouldUpdate = false;
    let updatePayload: { plan?: string, is_active?: boolean } = {};

    // 3️⃣ — Gerenciamento de Estados
    
    // Define o plano com base no produto (usado em 'order.approved')
    if (productName) {
        if (productName.includes("197")) newPlan = "basic";
        else if (productName.includes("497")) newPlan = "pro";
    }

    if (event === "order.approved") {
      // Pagamento aprovado: Ativa o plano e o status
      newIsActive = true;
      logMessage = `✅ Venda Aprovada. Ativando plano ${newPlan} e is_active=true para ${email}.`;
      shouldUpdate = true;
      updatePayload = { plan: newPlan, is_active: newIsActive };
    } else if (event === "subscription.cancelled" || event === "order.refunded") {
      // Assinatura cancelada ou reembolso: Volta para o plano free e desativa
      newPlan = "free";
      newIsActive = false;
      logMessage = `❌ Acesso Suspenso (${event}). Revertendo plano para ${newPlan} e is_active=false para ${email}.`;
      shouldUpdate = true;
      updatePayload = { plan: newPlan, is_active: newIsActive };
    } else if (event === "order.pending" || event === "order.refused") {
        // Pagamento pendente ou recusado: Não faz nada.
        logMessage = `⚠️ Evento de status intermediário (${event}). Nenhuma alteração de plano ou status necessária.`;
        shouldUpdate = false;
    } else {
        logMessage = `ℹ️ Evento desconhecido (${event}). Ignorando.`;
        shouldUpdate = false;
    }

    console.log(logMessage);

    if (shouldUpdate) {
        // 4️⃣ — Lógica de Manual Override
        
        // 4.1 Busca o estado atual do perfil
        const { data: profile, error: fetchError } = await supabaseClient
            .from("profiles")
            .select("manual_override, is_active")
            .eq("email", email)
            .single();

        if (fetchError) {
            console.error(`ERRO DE DB: Falha ao buscar perfil para ${email}:`, fetchError.message);
            // Continua a tentativa de atualização, mas loga o erro
        }
        
        const currentManualOverride = profile?.manual_override ?? false;
        const currentIsActive = profile?.is_active ?? false;

        let finalUpdatePayload = updatePayload;
        
        // Se o usuário está sendo ativado (newIsActive=true) E o override manual está ativo,
        // NÃO atualizamos o status de ativação (is_active), apenas o plano.
        if (newIsActive === true && currentManualOverride === true) {
            console.log(`AVISO: Tentativa de ativação automática bloqueada para ${email} devido a manual_override=true.`);
            // Remove is_active do payload, mantendo o plano
            delete finalUpdatePayload.is_active;
        }
        
        // Se o usuário está sendo desativado (newIsActive=false) E o override manual está ativo,
        // PERMITIMOS a desativação (pois reembolso/cancelamento deve sempre suspender o acesso).
        // Se o admin quiser reativar, ele terá que desativar o manual_override.
        if (newIsActive === false && currentManualOverride === true) {
            console.log(`INFO: Desativação automática permitida para ${email} apesar de manual_override=true (Evento: ${event}).`);
        }
        
        // Se o payload final estiver vazio, não há nada para atualizar
        if (Object.keys(finalUpdatePayload).length === 0) {
            console.log(`INFO: Nenhuma alteração de plano ou status necessária após verificação de override para ${email}.`);
            return new Response(JSON.stringify({ received: true, event, plan: newPlan, status: "No change needed" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 5️⃣ — Atualiza o plano e/ou status no Supabase
        const { error } = await supabaseClient
            .from("profiles")
            .update(finalUpdatePayload)
            .eq("email", email);

        if (error) {
            console.error(`ERRO DE DB: Falha ao atualizar plano/status para ${email} no Supabase:`, error.message);
            // Retorna 500 para que a Kiwify possa tentar novamente (se configurado)
            return new Response(JSON.stringify({ error: "Database update failed" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        console.log(`SUCESSO: Plano/Status de ${email} atualizado para ${JSON.stringify(finalUpdatePayload)}.`);
    }

    return new Response(JSON.stringify({ received: true, event, plan: newPlan, is_active: newIsActive }), {
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