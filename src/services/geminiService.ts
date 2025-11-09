import { GoogleGenAI, Type } from "@google/genai";
import { Estimate, CustomCost, MenuItemDetail } from '../types';
import { supabase } from '../integrations/supabase/client'; // Importando o cliente Supabase

// A chave da API é injetada pelo Vite/Vercel através do define no vite.config.ts
const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;

// Função para inicializar o cliente Gemini
const getGeminiClient = () => {
    if (!apiKey) {
        // Implementação da verificação dinâmica solicitada
        alert("⚠️ A chave da API Gemini (GEMINI_API_KEY) não está configurada. Vá até as configurações e adicione sua chave para continuar.");
        throw new Error("GEMINI_API_KEY ausente");
    }
    return new GoogleGenAI({ apiKey });
};

/**
 * Verifica o limite de consultas do usuário e incrementa a contagem se permitido.
 * @throws {Error} Se o usuário não estiver autenticado ou o limite for atingido.
 */
const checkAndIncrementQueryCount = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error("Usuário não autenticado. Faça login para gerar orçamentos.");
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('query_count, query_limit, plan_type, is_active')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        console.error("Erro ao buscar perfil:", profileError);
        // CORREÇÃO: Removendo 'new' duplicado
        throw new Error("Perfil de usuário não encontrado ou erro de acesso.");
    }
    
    // Lógica de verificação de limite
    const isTrialExpired = profile.plan_type === 'trial' && profile.query_count >= profile.query_limit;
    
    if (!profile.is_active && isTrialExpired) {
        throw new Error("Seu período de teste terminou. Ative um plano para continuar.");
    }

    // Se query_limit for null, é ilimitado. Caso contrário, verifica o limite.
    if (profile.query_limit !== null && profile.query_count >= profile.query_limit) {
        throw new Error("Você atingiu o limite de consultas do seu plano. Faça upgrade para continuar.");
    }

    // Incrementa a contagem de consultas
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ query_count: profile.query_count + 1 })
        .eq('id', user.id);

    if (updateError) {
        console.error("Erro ao incrementar query_count:", updateError);
        // Não lançamos um erro fatal aqui, apenas logamos, para não bloquear a IA se o DB falhar na atualização.
    }
};


const menuItemSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "Nome do prato/item principal do menu." },
        ingredients: {
            type: Type.ARRAY,
            description: "Lista de ingredientes e seus custos.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "Nome do ingrediente." },
                    qty: { type: Type.NUMBER, description: "Quantidade total necessária." },
                    unit: { type: Type.STRING, description: "Unidade de medida (kg, g, L, ml, unidade, caixa, pacote)." },
                    unitCost: { type: Type.NUMBER, description: "Custo estimado por unidade, baseado em preços médios de mercado no Brasil." },
                    totalCost: { type: Type.NUMBER, description: "Custo total do item (quantidade * custo unitário)." },
                },
                required: ["name", "qty", "unit", "unitCost", "totalCost"],
            }
        }
    },
    required: ["name", "ingredients"],
};

const estimateSchema = {
    type: Type.OBJECT,
    properties: {
        eventType: { type: Type.STRING, description: "Tipo de evento (ex: Casamento, Aniversário, Corporativo)." },
        guests: { type: Type.INTEGER, description: "Número de convidados." },
        consumptionAverages: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista das médias de consumo por pessoa usadas para o cálculo (ex: '0.5kg de carne por pessoa')." },
        menuItems: {
            type: Type.ARRAY,
            description: "Lista de pratos do menu, cada um com seus respectivos ingredientes.",
            items: menuItemSchema, // Reutilizando o esquema
        },
        totals: {
            type: Type.OBJECT,
            description: "Resumo dos custos totais e preço sugerido.",
            properties: {
                ingredients: { type: Type.NUMBER, description: "Custo total de todos os ingredientes de todos os pratos." },
                labor: { type: Type.NUMBER, description: "Custo total com mão de obra (soma de todos os profissionais)." },
                laborDetails: {
                    type: Type.ARRAY,
                    description: "Detalhamento da mão de obra.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            role: { type: Type.STRING, description: "Função do profissional (ex: Cozinheiro, Garçom, Marketing de video e foto)." },
                            count: { type: Type.INTEGER, description: "Quantidade de profissionais para essa função." },
                            costPerUnit: { type: Type.NUMBER, description: "Custo por profissional (diária, hora, etc.)." },
                            totalCost: { type: Type.NUMBER, description: "Custo total para essa função (count * costPerUnit)." },
                        },
                        required: ["role", "count", "costPerUnit", "totalCost"],
                    },
                },
                productionCost: { type: Type.NUMBER, description: "Custo de produção (soma de ingredientes + equipe de cozinha)." },
                otherCosts: { 
                    type: Type.ARRAY,
                    description: "Lista de outros custos, como frete, aluguel de equipamentos, etc.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Nome do custo (ex: Frete)." },
                            cost: { type: Type.NUMBER, description: "Valor do custo." }
                        },
                        required: ["name", "cost"]
                    }
                },
                tax: { type: Type.NUMBER, description: "Valor estimado de impostos (Simples Nacional, etc)." },
                totalCost: { type: Type.NUMBER, description: "Soma de todos os custos (ingredientes + mão de obra + outros custos + impostos)." },
                suggestedPrice: { type: Type.NUMBER, description: "Preço de venda sugerido, aplicando uma margem de lucro padrão de 40% sobre o custo total." },
            },
            required: ["ingredients", "labor", "otherCosts", "tax", "totalCost", "suggestedPrice"],
        },
    },
    required: ["eventType", "guests", "menuItems", "totals", "consumptionAverages"],
};

/**
 * Testa a conectividade com a API Gemini.
 * @returns {Promise<boolean>} True se a conexão for bem-sucedida.
 */
export const testGeminiConnectivity = async (): Promise<boolean> => {
    try {
        const ai = getGeminiClient();
        // Tenta uma chamada simples para verificar a autenticação e a conectividade.
        // Usamos um modelo leve e uma requisição mínima.
        await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Hello",
            config: {
                maxOutputTokens: 1,
            }
        });
        console.log("Gemini API connection successful.");
        return true;
    } catch (error) {
        console.error("Gemini API connection failed:", error);
        // Se o erro for devido à chave ausente, o getGeminiClient já lançou o erro.
        if (error instanceof Error && error.message === "GEMINI_API_KEY ausente") {
            return false;
        }
        return false;
    }
};

/**
 * Gera os detalhes de ingredientes e custos para um único item de menu.
 */
export const generateMenuItemDetails = async (menuItemName: string, guests: number): Promise<MenuItemDetail> => {
    // 1. Verifica e incrementa o contador antes de chamar a IA
    await checkAndIncrementQueryCount();
    
    try {
        const ai = getGeminiClient();
        
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Calcule os ingredientes e custos necessários para preparar o prato "${menuItemName}" para um evento com ${guests} convidados.

            Sua tarefa é:
            1.  Determinar a quantidade de cada ingrediente com base no número de convidados.
            2.  Estimar o custo unitário de cada ingrediente (em BRL).
            3.  Calcular o custo total de cada ingrediente (quantidade * custo unitário).
            
            O resultado DEVE ser um objeto JSON que siga estritamente o schema fornecido.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: menuItemSchema,
            },
        });
        
        const jsonResponse = JSON.parse(result.text);
        return jsonResponse as MenuItemDetail;

    } catch (error) {
        console.error("Error calling Gemini API for menu item generation:", error);
        if (error instanceof SyntaxError) {
             throw new Error("A IA retornou um formato inválido ao calcular a receita. Tente novamente.");
        }
        // Se for um erro de chave, a função getGeminiClient já lançou uma mensagem clara.
        if (error instanceof Error && error.message.includes("GEMINI_API_KEY ausente")) {
             throw new Error("A chave da API Gemini está ausente. Por favor, configure-a.");
        }
        // Propaga erros de limite de consulta
        if (error instanceof Error && (error.message.includes("limite de consultas") || error.message.includes("período de teste"))) {
             throw error;
        }
        throw new Error("Não foi possível calcular a receita. Verifique a chave da API e tente novamente.");
    }
};


export const generateEstimateFromText = async (text: string, customCosts: CustomCost[]): Promise<Estimate> => {
    // 1. Verifica e incrementa o contador antes de chamar a IA
    await checkAndIncrementQueryCount();
    
    try {
        const ai = getGeminiClient();
        
        const customCostsString = customCosts
            .map(cost => `- Custo de "${cost.name}": ${cost.cost} BRL`)
            .join('\n');

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analise o seguinte pedido para um buffet e transforme-o em um orçamento detalhado em formato JSON.

            Pedido do cliente: "${text}"

            Use os seguintes custos personalizados fornecidos pelo dono do buffet como base para seus cálculos de mão de obra e outros custos fixos:
            ${customCostsString}

            Sua tarefa é extrair as informações, decompor os pratos em ingredientes, estimar as quantidades totais, pesquisar preços médios de mercado (em Reais, BRL), e calcular todos os custos para gerar um orçamento completo.
            
            Regras de Cálculo:
            1.  **Ingredientes**: Baseie as quantidades na sua vasta base de conhecimento sobre receitas e porções por pessoa. Agrupe os ingredientes sob seu respectivo prato no campo 'menuItems'.
            2.  **Mão de obra**: Estime a equipe necessária usando os custos personalizados fornecidos que se aplicam (ex: Garçom, Cozinheiro). Inclua outros custos personalizados onde fizer sentido (ex: Marketing). Detalhe cada função (role, count, costPerUnit, totalCost).
            3.  **Custo de Produção**: Calcule como a soma do Custo de Ingredientes + o custo apenas da equipe de cozinha (cozinheiros, auxiliares).
            4.  **Outros Custos**: Se houver custos personalizados que não se encaixam em mão de obra (ex: um custo de frete fixo), inclua-os em 'otherCosts'. Estime também um custo de frete variável de R$2.50 por convidado, a menos que um custo fixo de frete seja fornecido.
            5.  **Impostos**: Calcule 8% sobre a soma de ingredientes + mão de obra + outros custos.
            6.  **Custo Total**: Some todos os custos: ingredientes, mão de obra total, outros custos e impostos.
            7.  **Preço Sugerido**: Aplique uma margem de 40% sobre o Custo Total (Preço = Custo Total * 1.4).
            8.  **Médias de Consumo**: No campo 'consumptionAverages', liste as premissas de consumo por pessoa que você usou para os cálculos (ex: "Carne: 500g/pessoa").

            O resultado DEVE ser um objeto JSON que siga estritamente o schema fornecido.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: estimateSchema,
            },
        });
        
        const jsonResponse = JSON.parse(result.text);
        
        // Construct a full Estimate object, adding missing fields
        const estimateData: Estimate = {
            ...jsonResponse,
            estimateId: `temp-${Date.now()}`,
            tenantId: 'buffet-xyz', // Placeholder
            createdAt: new Date().toISOString(),
            status: 'draft' as const,
        };

        return estimateData;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        // Se o erro for de parsing, a mensagem será mais clara.
        if (error instanceof SyntaxError) {
             throw new Error("A IA retornou um formato inválido. Tente novamente ou simplifique o pedido.");
        }
        // Se for um erro de chave, a função getGeminiClient já lançou uma mensagem clara.
        if (error instanceof Error && error.message.includes("GEMINI_API_KEY ausente")) {
             throw new Error("A chave da API Gemini está ausente. Por favor, configure-a.");
        }
        // Propaga erros de limite de consulta
        if (error instanceof Error && (error.message.includes("limite de consultas") || error.message.includes("período de teste"))) {
             throw error;
        }
        throw new Error("Não foi possível gerar o orçamento. Verifique a chave da API e tente novamente.");
    }
};