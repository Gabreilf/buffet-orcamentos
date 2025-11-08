import React from 'react';
import { Zap, ArrowRight } from 'lucide-react';

interface Profile {
    plan_type: string;
    plan: string;
    query_count: number;
    query_limit: number | null;
    is_active: boolean;
}

interface PlanStatusBannerProps {
    profile: Profile;
    onUpgradeClick: () => void;
}

const PlanStatusBanner: React.FC<PlanStatusBannerProps> = ({ profile, onUpgradeClick }) => {
    const { plan_type, plan, query_count, query_limit } = profile;
    
    let message = '';
    let buttonText = '';
    let bgColor = 'bg-indigo-50';
    let textColor = 'text-indigo-800';
    let showButton = false;

    if (plan_type === 'trial') {
        const remaining = query_limit !== null ? query_limit - query_count : 0;
        message = `Você está no Plano ${plan}. Restam ${remaining} consultas gratuitas.`;
        buttonText = 'Fazer Upgrade para Plano Start';
        bgColor = 'bg-yellow-50';
        textColor = 'text-yellow-800';
        showButton = true;
        
        if (remaining <= 0) {
            message = `Seu Plano ${plan} expirou. Faça upgrade para continuar gerando orçamentos.`;
            bgColor = 'bg-red-50';
            textColor = 'text-red-800';
        }
    } else if (plan_type === 'start') {
        message = `Você está no Plano ${plan}. Limite de 19 consultas/mês.`;
        buttonText = 'Fazer Upgrade para Plano Pro (Ilimitado)';
        bgColor = 'bg-indigo-50';
        textColor = 'text-indigo-800';
        showButton = true;
    } else if (plan_type === 'pro') {
        message = `Parabéns! Você está no Plano ${plan} com consultas Ilimitadas.`;
        buttonText = 'Gerenciar Assinatura';
        bgColor = 'bg-green-50';
        textColor = 'text-green-800';
        showButton = false; // Não precisa de upgrade, mas pode ter um botão de gerenciamento se necessário
    } else {
        // Fallback
        message = `Seu plano atual é: ${plan}.`;
    }

    return (
        <div className={`flex flex-col md:flex-row items-center justify-between p-4 rounded-xl shadow-md mb-8 ${bgColor} border border-current ${textColor}`}>
            <div className="flex items-center mb-3 md:mb-0">
                <Zap className={`w-5 h-5 mr-3 ${textColor}`} />
                <p className="font-semibold text-sm sm:text-base">{message}</p>
            </div>
            
            {showButton && (
                <button
                    onClick={onUpgradeClick}
                    className={`flex items-center px-4 py-2 text-sm font-bold rounded-lg transition duration-300 ease-in-out whitespace-nowrap 
                        ${plan_type === 'trial' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                >
                    {buttonText}
                    <ArrowRight className="w-4 h-4 ml-2" />
                </button>
            )}
            
            {plan_type === 'pro' && (
                 <button
                    onClick={onUpgradeClick}
                    className={`flex items-center px-4 py-2 text-sm font-bold rounded-lg transition duration-300 ease-in-out whitespace-nowrap bg-green-600 hover:bg-green-700 text-white`}
                >
                    Gerenciar Plano
                    <ArrowRight className="w-4 h-4 ml-2" />
                </button>
            )}
        </div>
    );
};

export default PlanStatusBanner;