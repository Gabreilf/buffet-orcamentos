import React, { useState, useEffect, useCallback } from 'react';
import { Estimate, CustomCost } from './types';
import Dashboard from './pages/Dashboard';
import NewEstimate from './pages/NewEstimate';
import EstimateResult from './pages/EstimateResult';
import Login from './pages/Login';
import ProfileAndPlans from './pages/ProfileAndPlans'; // Importando a nova página
import Header from './components/Header';
import { fetchEstimates } from './services/estimateService';
import Spinner from './components/Spinner';
import { useAuth } from './hooks/useAuth';

type Page = 'dashboard' | 'new_estimate' | 'estimate_result' | 'plans'; // Mantendo 'plans' como nome da rota

interface AccessDeniedProps {
    message: string;
    showPlansButton: boolean;
    onViewPlans: () => void;
}

const AccessDenied: React.FC<AccessDeniedProps> = ({ message, showPlansButton, onViewPlans }) => (
    <div className="max-w-xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-2xl text-center border border-red-200">
        <h2 className="text-3xl font-bold text-red-600 mb-4">Acesso Bloqueado</h2>
        <p className="text-slate-700 mb-6">
            {message}
        </p>
        {showPlansButton && (
            <button
                onClick={onViewPlans}
                className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition duration-300 ease-in-out shadow-lg"
            >
                Ver Planos de Assinatura
            </button>
        )}
        <p className="text-sm text-slate-500 mt-4">
            Por favor, verifique o status do seu pagamento ou entre em contato com o suporte.
        </p>
    </div>
);

const App: React.FC = () => {
  const { session, user, isLoading: isAuthLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [activeEstimate, setActiveEstimate] = useState<Estimate | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customCosts, setCustomCosts] = useState<CustomCost[]>([
    { id: 'waiter', name: 'Diária Garçom', cost: 150 },
    { id: 'cook', name: 'Diária Cozinheira', cost: 200 },
    { id: 'marketing', name: 'Marketing e Foto', cost: 250 },
  ]);

  // Função para carregar orçamentos
  const loadEstimates = useCallback(async () => {
    // Só carrega se estiver autenticado
    if (!session) {
        setEstimates([]);
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);
    try {
      const fetchedEstimates = await fetchEstimates();
      setEstimates(fetchedEstimates);
    } catch (error) {
      console.error("Failed to fetch estimates:", error);
      // Se falhar (ex: token expirado), o useAuth deve lidar com o redirecionamento
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Função para atualizar um único orçamento na lista
  const handleEstimateUpdated = (updatedEstimate: Estimate) => {
      setEstimates(prevEstimates => 
          prevEstimates.map(e => 
              e.estimateId === updatedEstimate.estimateId ? updatedEstimate : e
          )
      );
      // Se o orçamento ativo for o que foi atualizado, atualize-o também
      if (activeEstimate && activeEstimate.estimateId === updatedEstimate.estimateId) {
          setActiveEstimate(updatedEstimate);
      }
  };

  // Recarrega orçamentos quando a sessão muda (login/logout)
  useEffect(() => {
    if (session && user?.profile?.is_active) {
        loadEstimates();
    } else if (!isAuthLoading) {
        // Se não houver sessão ou se o usuário estiver inativo e a autenticação terminou de carregar, limpa o estado
        setEstimates([]);
        setIsLoading(false);
    }
  }, [session, user, isAuthLoading, loadEstimates]);

  const handleCreateNewEstimate = () => {
    setActiveEstimate(null);
    setCurrentPage('new_estimate');
  };
  
  const handleViewEstimate = (estimate: Estimate) => {
    setActiveEstimate(estimate);
    setCurrentPage('estimate_result');
  };
  
  const handleShowDashboard = () => {
    setActiveEstimate(null);
    setCurrentPage('dashboard');
    // Reload estimates when returning to dashboard to ensure fresh data
    loadEstimates(); 
  };
  
  const handleViewPlans = () => {
      setCurrentPage('plans');
  };

  const handleEstimateGenerated = (estimate: Estimate) => {
    setActiveEstimate(estimate);
    setCurrentPage('estimate_result');
  };

  const renderPage = () => {
    if (isAuthLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Spinner message="Verificando autenticação..." />
            </div>
        );
    }

    if (!session) {
        return <Login />;
    }
    
    // Lógica de verificação de limite de trial
    const profile = user?.profile;
    const isTrialExpired = profile && profile.plan_type === 'trial' && profile.query_count >= profile.query_limit;
    
    // 3. Verificação de Ativação (Bloqueio por Inatividade ou Trial Expirado)
    if (profile && !profile.is_active) {
        console.log("LOG: Login bloqueado. Usuário inativo.");
        return (
            <AccessDenied 
                message="Sua conta está inativa. Isso pode ocorrer devido a um pagamento pendente, cancelamento ou reembolso."
                showPlansButton={false}
                onViewPlans={handleViewPlans}
            />
        );
    }
    
    if (isTrialExpired) {
        console.log("LOG: Login bloqueado. Trial expirado.");
        // Se o usuário está no trial e atingiu o limite, bloqueia o acesso ao dashboard/new_estimate
        if (currentPage !== 'plans') {
            return (
                <AccessDenied 
                    message={`Seu período de teste (limite de ${profile.query_limit} consultas) terminou. Ative um plano para continuar.`}
                    showPlansButton={true}
                    onViewPlans={handleViewPlans}
                />
            );
        }
    }
    
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Spinner message="Carregando orçamentos..." />
            </div>
        );
    }

    switch (currentPage) {
      case 'new_estimate':
        return <NewEstimate 
            onEstimateGenerated={handleEstimateGenerated} 
            customCosts={customCosts} 
            userProfile={user?.profile} // Passando o perfil
            onViewPlans={handleViewPlans} // Passando o handler de navegação
        />;
      case 'estimate_result':
        // Usamos a key para forçar a remontagem do componente EstimateResult sempre que o orçamento ativo mudar.
        return activeEstimate ? <EstimateResult key={activeEstimate.estimateId} estimate={activeEstimate} onEstimateSaved={loadEstimates} /> : <Dashboard estimates={estimates} onCreateNew={handleCreateNewEstimate} onView={handleViewEstimate} customCosts={customCosts} onCustomCostsChange={setCustomCosts} onEstimateUpdated={handleEstimateUpdated} userProfile={user?.profile} onViewPlans={handleViewPlans} />;
      case 'plans':
          return <ProfileAndPlans />;
      case 'dashboard':
      default:
        return <Dashboard estimates={estimates} onCreateNew={handleCreateNewEstimate} onView={handleViewEstimate} customCosts={customCosts} onCustomCostsChange={setCustomCosts} onEstimateUpdated={handleEstimateUpdated} userProfile={user?.profile} onViewPlans={handleViewPlans} />;
    }
  };

  const currentPlanName = user?.profile?.plan || 'Teste';
  
  // Define se o botão de voltar deve ser exibido
  const showBackButton = currentPage !== 'dashboard';

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <Header 
        onLogoClick={handleShowDashboard} 
        session={session} 
        onProfileClick={handleViewPlans} 
        currentPlanName={currentPlanName} // Passando o nome do plano
        onBackClick={showBackButton ? handleShowDashboard : undefined} // Passa a função se não estiver no dashboard
      />
      <main className="p-4 sm:p-6 md:p-8">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;