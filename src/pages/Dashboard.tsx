import React, { useState } from 'react';
import { Estimate, CustomCost } from '../types';
import { updateEstimate } from '../services/estimateService';
import toast from 'react-hot-toast';

interface DashboardProps {
  estimates: Estimate[];
  customCosts: CustomCost[];
  onCreateNew: () => void;
  onView: (estimate: Estimate) => void;
  onCustomCostsChange: (costs: CustomCost[]) => void;
  onEstimateUpdated: (updatedEstimate: Estimate) => void; // Novo prop para atualizar a lista no App.tsx
}

const formatCurrency = (value: number) => {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    // Se for uma string ISO completa, usa toLocaleDateString. Se for YYYY-MM-DD, funciona diretamente.
    try {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return dateString;
    }
};

const statusMap: { [key in Estimate['status']]: { text: string; className: string } } = {
    draft: { text: 'Rascunho', className: 'bg-slate-200 text-slate-700' },
    sent: { text: 'Enviado', className: 'bg-blue-200 text-blue-700' },
    approved: { text: 'Aprovado', className: 'bg-green-200 text-green-700' },
    rejected: { text: 'Rejeitado', className: 'bg-red-200 text-red-700' },
};

const deliveryStatusOptions: { value: Estimate['deliveryStatus']; text: string; className: string }[] = [
    { value: 'pending', text: 'Pendente', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { value: 'sent', text: 'Enviado', className: 'bg-blue-100 text-blue-700 border-blue-300' },
    { value: 'delivered', text: 'Entregue', className: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'cancelled', text: 'Cancelado', className: 'bg-red-100 text-red-700 border-red-300' },
];

const Dashboard: React.FC<DashboardProps> = ({
  estimates,
  customCosts,
  onCreateNew,
  onView,
  onCustomCostsChange,
  onEstimateUpdated,
}) => {
    const [editableCustomCosts, setEditableCustomCosts] = useState<CustomCost[]>(JSON.parse(JSON.stringify(customCosts)));

    const handleCustomCostChange = (index: number, field: keyof Omit<CustomCost, 'id'>, value: string) => {
        const newCosts = [...editableCustomCosts];
        if (field === 'cost') {
            newCosts[index][field] = parseFloat(value) || 0;
        } else {
            newCosts[index][field] = value;
        }
        setEditableCustomCosts(newCosts);
    };
    
    const handleSaveChanges = () => {
        onCustomCostsChange(editableCustomCosts);
        toast.success('Custos personalizados salvos!');
    };

    const handleAddCustomCost = () => {
        setEditableCustomCosts([...editableCustomCosts, { id: `new-${Date.now()}`, name: 'Novo Custo', cost: 0 }]);
    };

    const handleRemoveCustomCost = (index: number) => {
        const newCosts = editableCustomCosts.filter((_, i) => i !== index);
        setEditableCustomCosts(newCosts);
        onCustomCostsChange(newCosts);
    };
    
    const handleEstimateFieldChange = async (estimate: Estimate, field: 'eventDate' | 'deliveryStatus', value: string) => {
        const updatedEstimate: Estimate = {
            ...estimate,
            [field]: value,
        };
        
        const toastId = toast.loading('Atualizando orçamento...');
        
        try {
            const savedEstimate = await updateEstimate(updatedEstimate);
            onEstimateUpdated(savedEstimate); // Atualiza o estado no App.tsx
            toast.success('Orçamento atualizado!', { id: toastId });
        } catch (error: any) {
            console.error("Update error:", error);
            toast.error(error.message || 'Falha ao atualizar o orçamento.', { id: toastId });
        }
    };

    const handleClearDate = (estimate: Estimate) => {
        handleEstimateFieldChange(estimate, 'eventDate', '');
    };


  return (
    <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-slate-800">Painel de Controle</h2>
            <button
            onClick={onCreateNew}
            className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300 ease-in-out shadow-lg flex items-center"
            >
                <i className="fas fa-plus mr-2"></i> Criar Novo Orçamento
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <h3 className="text-xl font-semibold text-slate-700 mb-4">Orçamentos Recentes</h3>
                {estimates.length > 0 ? (
                    <div className="space-y-4">
                        {estimates.map((estimate) => (
                            <div key={estimate.estimateId} className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-slate-200">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-bold text-lg text-slate-800">{estimate.eventType}</p>
                                        <p className="text-sm text-slate-500">{estimate.guests} convidados &bull; Criado em: {formatDate(estimate.createdAt)}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusMap[estimate.status].className}`}>
                                        {statusMap[estimate.status].text}
                                    </span>
                                </div>
                                
                                {/* Novos Campos Editáveis */}
                                <div className="grid grid-cols-2 gap-4 mb-4 border-t pt-3 border-slate-100">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Data do Evento</label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="text" // Alterado para 'text' para permitir entrada livre
                                                value={estimate.eventDate || ''}
                                                onChange={(e) => handleEstimateFieldChange(estimate, 'eventDate', e.target.value)}
                                                placeholder="AAAA-MM-DD"
                                                className="w-full p-2 border border-slate-300 rounded-md text-sm text-slate-700 pr-8"
                                            />
                                            {estimate.eventDate && (
                                                <button
                                                    onClick={() => handleClearDate(estimate)}
                                                    className="absolute right-0 top-0 bottom-0 px-2 text-slate-500 hover:text-red-500 transition"
                                                    title="Limpar Data"
                                                >
                                                    <i className="fas fa-times text-xs"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Status da Entrega</label>
                                        <select
                                            value={estimate.deliveryStatus}
                                            onChange={(e) => handleEstimateFieldChange(estimate, 'deliveryStatus', e.target.value as Estimate['deliveryStatus'])}
                                            className={`w-full p-2 border rounded-md text-sm font-medium ${deliveryStatusOptions.find(opt => opt.value === estimate.deliveryStatus)?.className || 'bg-slate-100 text-slate-700 border-slate-300'}`}
                                        >
                                            {deliveryStatusOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.text}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="mt-4 flex justify-between items-center border-t pt-3 border-slate-100">
                                    <p className="text-lg font-bold text-indigo-600">{formatCurrency(estimate.totals.suggestedPrice)}</p>
                                    <button
                                        onClick={() => onView(estimate)}
                                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                                    >
                                        Ver Detalhes <i className="fas fa-arrow-right ml-1"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white rounded-lg shadow-md border border-slate-200">
                        <i className="fas fa-file-invoice-dollar text-4xl text-slate-400 mb-4"></i>
                        <h4 className="text-xl font-semibold text-slate-700">Nenhum orçamento encontrado</h4>
                        <p className="text-slate-500 mt-2">Comece criando um novo orçamento para o seu próximo evento.</p>
                    </div>
                )}
            </div>

            <div className="lg:col-span-1">
                <div className="sticky top-8 bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-bold text-slate-800 border-b pb-3 mb-4">Custos Personalizados</h3>
                    <div className="space-y-3">
                        {editableCustomCosts.map((cost, index) => (
                            <div key={cost.id} className="flex items-center justify-between group">
                                <input
                                    type="text"
                                    value={cost.name}
                                    onChange={(e) => handleCustomCostChange(index, 'name', e.target.value)}
                                    className="text-slate-700 bg-transparent p-1 rounded border-slate-200 w-3/5"
                                />
                                <div className="flex items-center">
                                    <span className="text-slate-500 mr-1">R$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={cost.cost}
                                        onChange={(e) => handleCustomCostChange(index, 'cost', e.target.value)}
                                        className="font-medium bg-transparent p-1 rounded border-slate-200 w-24 text-right"
                                    />
                                    <button onClick={() => handleRemoveCustomCost(index)} className="ml-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <i className="fas fa-trash-alt text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                     <button onClick={handleAddCustomCost} className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm font-semibold w-full text-left">
                      <i className="fas fa-plus mr-1"></i> Adicionar Custo
                    </button>
                    <button onClick={handleSaveChanges} className="mt-6 w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300 ease-in-out shadow-lg">
                        Salvar Alterações nos Custos
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Dashboard;