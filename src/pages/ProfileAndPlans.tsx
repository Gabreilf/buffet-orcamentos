import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Infinity, Zap, User, Loader2, Save, ChevronDown, Upload } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { fetchProfile, updateProfile, uploadAvatar } from '../services/profileService';
import toast from 'react-hot-toast';

// URLs de Checkout da Kiwify
const KIWIFY_CHECKOUT_START = "https://pay.kiwify.com.br/PGgKZs3";
const KIWIFY_CHECKOUT_PRO = "https://pay.kiwify.com.br/HOyKZsm";

interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    email: string | null;
    plan_type: string;
    query_count: number;
    query_limit: number | null;
    is_active: boolean;
    manual_override: boolean;
}

const ProfileAndPlans: React.FC = () => {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isProfileExpanded, setIsProfileExpanded] = useState(false); // Novo estado para expansão
    const fileInputRef = useRef<HTMLInputElement>(null); // Referência para o input de arquivo
    
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        avatar_url: '',
    });

    const loadProfile = useCallback(async () => {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setIsLoading(false);
            return;
        }

        try {
            const fetchedProfile = await fetchProfile(user.id);
            setProfile(fetchedProfile);
            setFormData({
                first_name: fetchedProfile.first_name || '',
                last_name: fetchedProfile.last_name || '',
                avatar_url: fetchedProfile.avatar_url || '',
            });
        } catch (error) {
            toast.error('Falha ao carregar dados do perfil.');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;

        setIsSaving(true);
        const toastId = toast.loading('Salvando perfil...');

        try {
            const updatedProfile = await updateProfile(formData);
            setProfile(updatedProfile);
            toast.success('Perfil atualizado com sucesso!', { id: toastId });
        } catch (error: any) {
            toast.error(error.message || 'Erro ao salvar o perfil.', { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !profile) return;

        setIsSaving(true);
        const toastId = toast.loading('Fazendo upload da imagem...');

        try {
            const publicUrl = await uploadAvatar(file, profile.id);
            
            // Atualiza o estado local do formulário e salva no banco de dados
            const updatedFormData = { ...formData, avatar_url: publicUrl };
            setFormData(updatedFormData);
            
            const updatedProfile = await updateProfile(updatedFormData);
            setProfile(updatedProfile);
            
            toast.success('Foto de perfil atualizada!', { id: toastId });
        } catch (error: any) {
            toast.error(error.message || 'Erro ao fazer upload da imagem.', { id: toastId });
        } finally {
            setIsSaving(false);
            // Limpa o valor do input para permitir o upload do mesmo arquivo novamente
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    
    const getPlanDetails = () => {
        if (!profile) return { name: 'Teste', limit: '3 consultas', color: 'text-slate-500' };
        
        const { plan_type, query_count, query_limit } = profile;
        
        let name = 'Teste';
        let limit = `${query_count}/${query_limit} consultas`;
        let color = 'text-slate-500';
        
        if (plan_type === 'start') {
            name = 'Start';
            limit = `19 consultas/mês`;
            color = 'text-indigo-600';
        } else if (plan_type === 'pro') {
            name = 'Pro';
            limit = 'Consultas Ilimitadas';
            color = 'text-green-600';
        }
        
        // Se for trial, mostra a contagem atual
        if (plan_type === 'trial') {
            limit = `${query_count}/${query_limit} consultas`;
            if (query_limit !== null && query_count >= query_limit) {
                color = 'text-red-600';
                limit = 'Limite Atingido';
            }
        }
        
        return { name, limit, color };
    };
    
    const planDetails = getPlanDetails();

    const plans = [
        {
            name: "Plano Start",
            price: "R$ 197",
            limit: "19 consultas/mês",
            description: "Ideal para quem está começando e precisa de orçamentos pontuais.",
            features: [
                "Acesso completo ao gerador de orçamentos IA",
                "19 consultas por mês",
                "Suporte prioritário via WhatsApp",
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
                "Suporte VIP via WhatsApp",
                "Avaliação estratégica de marketing para seu negócio" // Novo benefício
            ],
            checkoutUrl: KIWIFY_CHECKOUT_PRO,
            icon: Infinity,
            isPopular: true,
        },
    ];

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="ml-3 text-slate-700">Carregando perfil...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-4">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-extrabold text-slate-800 mb-3">Configurações da Conta</h2>
                <p className="text-xl text-slate-500">Gerencie seu perfil e seu plano de assinatura.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Coluna 1: Perfil e Status do Plano */}
                <div className="lg:col-span-1 space-y-8">
                    
                    {/* Card de Status do Plano */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                        
                        {/* Botão de Suporte WhatsApp (Movido para o topo) */}
                        <a
                            href="https://wa.me/5521973741689"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mb-4 w-full bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition duration-300 ease-in-out shadow-lg flex items-center justify-center"
                            title="Suporte via WhatsApp"
                        >
                            <i className="fab fa-whatsapp mr-2"></i> Falar com Suporte
                        </a>
                        
                        <h3 className="text-xl font-bold text-slate-800 border-b pb-3 mb-4">Status do Plano</h3>
                        
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <Zap className={`w-6 h-6 mr-3 ${planDetails.color}`} />
                                <div>
                                    <p className="text-lg font-semibold text-slate-700">Plano Atual: <span className={planDetails.color}>{planDetails.name}</span></p>
                                    <p className="text-sm text-slate-500">Email: {profile?.email}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <p className="text-sm font-medium text-slate-700">
                                Limite de Consultas: <span className={`font-bold ${planDetails.color}`}>{planDetails.limit}</span>
                            </p>
                            {profile?.plan_type === 'trial' && profile.query_limit !== null && (
                                <div className="mt-2 h-2 bg-slate-200 rounded-full">
                                    <div 
                                        className={`h-full rounded-full ${profile.query_count >= profile.query_limit ? 'bg-red-500' : 'bg-indigo-500'}`}
                                        style={{ width: `${Math.min(100, (profile.query_count / profile.query_limit) * 100)}%` }}
                                    ></div>
                                </div>
                            )}
                        </div>
                        
                        {profile?.is_active === false && (
                            <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                                <p className="text-sm font-semibold text-red-700">Conta Inativa: Verifique seu pagamento.</p>
                            </div>
                        )}
                        
                    </div>
                    
                    {/* Card de Edição de Perfil (Minimizado/Expandido) */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                        <button 
                            onClick={() => setIsProfileExpanded(prev => !prev)}
                            className="flex justify-between items-center w-full border-b pb-3 mb-4"
                        >
                            <h3 className="text-xl font-bold text-slate-800">Meu Perfil</h3>
                            <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${isProfileExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isProfileExpanded && (
                            <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
                                <div className="flex flex-col items-center mb-6">
                                    <div className="relative w-24 h-24">
                                        <img 
                                            src={formData.avatar_url || `https://ui-avatars.com/api/?name=${formData.first_name}+${formData.last_name}&background=4f46e5&color=fff&bold=true`}
                                            alt="Avatar"
                                            className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100 shadow-md"
                                        />
                                        {/* Botão de Upload */}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isSaving}
                                            className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1.5 rounded-full border-2 border-white hover:bg-indigo-700 transition disabled:bg-indigo-400"
                                            title="Carregar Foto"
                                        >
                                            <Upload className="w-4 h-4" />
                                        </button>
                                        {/* Input de Arquivo Oculto */}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleAvatarUpload}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                    <p className="mt-2 text-sm text-slate-500">A foto de perfil é opcional.</p>
                                </div>
                                
                                <div>
                                    <label htmlFor="first_name" className="block text-sm font-medium text-slate-700">Primeiro Nome</label>
                                    <input
                                        type="text"
                                        id="first_name"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Seu primeiro nome"
                                    />
                                </div>
                                
                                <div>
                                    <label htmlFor="last_name" className="block text-sm font-medium text-slate-700">Sobrenome</label>
                                    <input
                                        type="text"
                                        id="last_name"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Seu sobrenome"
                                    />
                                </div>
                                
                                <div>
                                    <label htmlFor="avatar_url" className="block text-sm font-medium text-slate-700">URL da Foto de Perfil (Opcional)</label>
                                    <input
                                        type="url"
                                        id="avatar_url"
                                        name="avatar_url"
                                        value={formData.avatar_url}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="https://exemplo.com/sua-foto.jpg"
                                    />
                                </div>
                                
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition duration-300 ease-in-out shadow-lg disabled:bg-indigo-400 flex items-center justify-center"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-5 h-5 mr-2" />
                                    )}
                                    Salvar Alterações
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Coluna 2 & 3: Planos de Assinatura */}
                <div className="lg:col-span-2">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Opções de Upgrade</h3>
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
                                        <span className="text-xl font-medium text-slate-500 ml-2">/ mês</span>
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
                </div>
            </div>
        </div>
    );
};

export default ProfileAndPlans;