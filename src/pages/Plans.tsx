import React from 'react';
import { Check, Infinity, Zap } from 'lucide-react';

// URLs de Checkout da Kiwify (ATUALIZADOS)
const KIWIFY_CHECKOUT_START = "https://pay.kiwify.com.br/PGgKZs3";
const KIWIFY_CHECKOUT_PRO = "https://pay.kiwify.com.br/HOyKZsm";

const Plans: React.FC = () => {
    const plans = [
        {
            name: "Plano Start",
            price: "R$ 197",
            limit: "19 consultas/mês",
            description: "Ideal para quem está começando e precisa de orçamentos pontuais.",
            features: [
                "Acesso completo ao gerador de orçamentos IA",
                "19 consultas por mês",
                "Suporte prioritário por email",
                "Exportação de dados (CSV)"
            ],
            checkoutUrl: KIWIFY_CHECKOUT_START,
            icon: Zap,
            isPopular: false,
        },
        {
            name: "Plano Pro",
            price: "R$ 497",
            limit: "Consultas Ilimitadas",
            description: "Para buffets de alto volume que precisam de orçamentos sem interrupção.",
            features: [
                "Tudo do Plano Start",
                "Consultas ilimitadas à IA",
                "Novos recursos beta antecipados",
                "Suporte VIP via WhatsApp"
            ],
            checkoutUrl: KIWIFY_CHECKOUT_PRO,
            icon: Infinity,
            isPopular: true,
        },
    ];

    return (
        <div className="max-w-6xl mx-auto p-4">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-extrabold text-slate-800 mb-3">Escolha o Plano Perfeito para o seu Buffet</h2>
                <p className="text-xl text-slate-500">Maximize sua eficiência e pare de perder tempo com cálculos manuais.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {plans.map((plan, index) => (
                    <div 
                        key={index} 
                        className={`bg-white p-8 rounded-2xl shadow-xl flex flex-col transition-all duration-300 ${plan.isPopular ? 'border-4 border-indigo-600 scale-[1.02]' : 'border border-slate-200'}`}
                    >
                        <div className="mb-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-bold text-slate-800">{plan.name}</h3>
                                {plan.isPopular && (
                                    <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">Mais Popular</span>
                                )}
                            </div>
                            <p className="text-slate-500 mt-2">{plan.description}</p>
                        </div>

                        <div className="mb-8">
                            <p className="text-5xl font-extrabold text-indigo-600">
                                {plan.price}
                                <span className="text-xl font-medium text-slate-500 ml-2">/ único</span>
                            </p>
                            <p className="text-sm text-slate-600 mt-1 font-semibold">{plan.limit}</p>
                        </div>

                        <ul className="space-y-3 flex-grow mb-8">
                            {plan.features.map((feature, fIndex) => (
                                <li key={fIndex} className="flex items-start text-slate-700">
                                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-1" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <a 
                            href={plan.checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`w-full text-center font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-lg text-lg 
                                ${plan.isPopular 
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                    : 'bg-slate-100 text-indigo-600 hover:bg-slate-200 border border-indigo-600'
                                }`}
                        >
                            Comprar Agora
                        </a>
                    </div>
                ))}
            </div>
            
            <div className="mt-12 text-center text-slate-500">
                <p className="text-sm">
                    *Os planos são cobrados uma única vez. Não há mensalidades.
                </p>
            </div>
        </div>
    );
};

export default Plans;