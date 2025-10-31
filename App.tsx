import React, { useState } from 'react';
import { Estimate, CustomCost } from './types';
import Dashboard from './pages/Dashboard';
import NewEstimate from './pages/NewEstimate';
import EstimateResult from './pages/EstimateResult';
import Header from './components/Header';
import { mockEstimates } from './constants';

type Page = 'dashboard' | 'new_estimate' | 'estimate_result';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [activeEstimate, setActiveEstimate] = useState<Estimate | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>(mockEstimates);
  const [customCosts, setCustomCosts] = useState<CustomCost[]>([
    { id: 'waiter', name: 'Diária Garçom', cost: 150 },
    { id: 'cook', name: 'Diária Cozinheira', cost: 200 },
    { id: 'marketing', name: 'Marketing e Foto', cost: 250 },
  ]);

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
  };

  const handleEstimateGenerated = (estimate: Estimate) => {
    const newEstimate = { ...estimate, estimateId: `est-${Date.now()}`};
    setEstimates(prev => [newEstimate, ...prev]);
    setActiveEstimate(newEstimate);
    setCurrentPage('estimate_result');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'new_estimate':
        return <NewEstimate onEstimateGenerated={handleEstimateGenerated} customCosts={customCosts} />;
      case 'estimate_result':
        return activeEstimate ? <EstimateResult estimate={activeEstimate} /> : <Dashboard estimates={estimates} onCreateNew={handleCreateNewEstimate} onView={handleViewEstimate} customCosts={customCosts} onCustomCostsChange={setCustomCosts} />;
      case 'dashboard':
      default:
        return <Dashboard estimates={estimates} onCreateNew={handleCreateNewEstimate} onView={handleViewEstimate} customCosts={customCosts} onCustomCostsChange={setCustomCosts} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <Header onLogoClick={handleShowDashboard} />
      <main className="p-4 sm:p-6 md:p-8">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;