import { GoogleGenAI, Type } from "@google/genai";
import { Estimate, CustomCost } from '../types';

// Assume process.env.API_KEY is configured in the environment
const apiKey = process.env.API_KEY as string;

if (!apiKey) {
    console.error("GEMINI_API_KEY is not set. Please check your environment configuration.");
    // Throwing an error here prevents further execution if the key is missing
    // but we will let the try/catch handle it in the function below for runtime safety.
}

const ai = new GoogleGenAI({ apiKey });

const estimateSchema = {
    type: Type.OBJECT,
    properties: {
        eventType: { type: Type.STRING, description: "Tipo de evento (ex: Casamento, Aniversário, Corporativo)." },
        guests: { type: Type.INTEGER, description: "Número de convidados." },
        consumptionAverages: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista das médias de consumo por pessoa usadas para o cálculo (ex: '0.5kg de carne por pessoa')." },
        menuItems: {
            type: Type.ARRAY,
            description: "Lista de pratos do menu, cada um com seus respectivos ingredientes.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "Nome do prato ou categoria (ex: Churrasco, Mesa de Frios)." },
                    ingredients: {
                        type: Type.ARRAY,
                        description: "Ingredientes necessários para este prato.",
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
            }
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

export const generateEstimateFromText = async (text: string, customCosts: CustomCost[]): Promise<Estimate> => {
    if (!apiKey) {
        throw new Error("A chave da API Gemini não está configurada. Por favor, verifique suas variáveis de ambiente.");
    }
    
    try {
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
            2.  **Mão de obra**: Estime a equipe necessária usando os custos personalizados fornecidos que se aplicam (ex: Garçom, Cozinheira). Inclua outros custos personalizados onde fizer sentido (ex: Marketing). Detalhe cada função (role, count, costPerUnit, totalCost).
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
        throw new Error("Não foi possível gerar o orçamento. Verifique a chave da API e tente novamente.");
    }
};