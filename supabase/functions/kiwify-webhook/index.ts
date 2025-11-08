import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Configuração de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// O segredo do webhook da Kiwify deve ser configurado no painel do Supabase como um segredo de Edge Function.
// O nome da variável de ambiente será KIWIFY_WEBHOOK_SECRET.
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
        console.error("KIWIFY_WEBHOOK_SECRET não configurado no ambiente.");
        return new Response(JSON.stringify({ error: "Server configuration error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (secret !== KIWIFY_WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2️⃣ — Captura o evento vindo da Kiwify
    const event = reqBody?.event;
    const data = reqBody?.data;

    if (!event || !data) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Inicializa o cliente Supabase com a chave de serviço (SERVICE_ROLE_KEY)
    // Isso permite ignorar o RLS e atualizar a tabela de usuários/planos.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3️⃣ — Se for uma venda aprovada
    if (event === "order.approved") {
      const email = data?.buyer?.email;
      const productName = data?.product?.name;

      // Define plano com base no produto
      let plan = "free";
      if (productName && productName.includes("197")) plan = "basic";
      if (productName && productName.includes("497")) plan = "pro";

      // Atualiza o plano no Supabase (assumindo que a tabela é 'profiles' ou 'users')
      // Vou usar 'profiles' que é a tabela padrão de perfis que criamos.
      const { error } = await supabaseClient
        .from("profiles") // Usando 'profiles' em vez de 'users'
        .update({ plan })
        .eq("email", email);

      if (error) {
        console.error(`Erro ao atualizar plano para ${email}:`, error.message);
        return new Response(JSON.stringify({ error: "Database update failed" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`✅ Plano atualizado: ${email} → ${plan}`);
    }

    // 4️⃣ — Se for uma assinatura cancelada
    if (event === "subscription.cancelled") {
      const email = data?.buyer?.email;
      
      const { error } = await supabaseClient
        .from("profiles") // Usando 'profiles' em vez de 'users'
        .update({ plan: "free" })
        .eq("email", email);
        
      if (error) {
        console.error(`Erro ao cancelar assinatura para ${email}:`, error.message);
        return new Response(JSON.stringify({ error: "Database update failed" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log(`❌ Assinatura cancelada: ${email}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});