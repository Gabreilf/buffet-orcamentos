import React, { useState, useMemo, useCallback } from 'react';
import { Estimate, EstimateItem, MenuItemDetail, OtherCost } from '../types';
import { ChevronDown, Trash2, Plus, FileText, Loader2 } from 'lucide-react';
import { generateMenuItemDetails } from '../services/geminiService';

interface EstimateResultProps {
  estimate: Estimate;
}

const formatCurrency = (value: number) => {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Lista de unidades comuns para seleção
const commonUnits = [
    'kg', 'g', 'L', 'ml', 'unidade', 'caixa', 'pacote', 'lata', 'litro', 'fardo'
];

// Tipo interno para gerenciar as premissas de forma estruturada
interface StructuredPremise {
  id: string;
  item: string;
  quantity: number;
  unit: string;
}

// Função para converter string[] (do AI) para StructuredPremise[]
const parsePremises = (averages: string[]): StructuredPremise[] => {
    return averages.map((avg, index) => {
        // Regex para capturar Item, Quantidade e Unidade (ex: "Carne: 550g por pessoa")
        const match = avg.match(/(.+):\s*(\d+\.?\d*)\s*([a-zA-Z]+)\s*por pessoa/i);
        if (match) {
            return {
                id: `premise-${index}-${Date.now()}`,
                item: match[1].trim(),
                quantity: parseFloat(match[2]),
                unit: match[3].trim(),
            };
        }
        // Fallback para strings não parseáveis
        return { id: `premise-${index}-${Date.now()}`, item: avg, quantity: 0, unit: '' };
    });
};

// Função para converter StructuredPremise[] de volta para string[] (para salvar no Estimate)
const serializePremises = (structured: StructuredPremise[]): string[] => {
    return structured.map(p => {
        if (p.quantity > 0 && p.unit) {
            return `${p.item}: ${p.quantity}${p.unit} por pessoa`;
        }
        return p.item;
    }).filter(s => s.trim() !== '');
};


const EstimateResult: React.FC<EstimateResultProps> = ({ estimate: initialEstimate }) => {
  const [estimate, setEstimate] = useState(initialEstimate);
  const [margin, setMargin] = useState(40);
  const [isLaborExpanded, setIsLaborExpanded] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<number, boolean>>({});
  
  // Estado estruturado para edição das premissas
  const [structuredAverages, setStructuredAverages] = useState<StructuredPremise[]>(() => parsePremises(initialEstimate.consumptionAverages || []));

  // Novo estado para adicionar receita
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [isRecipeLoading, setIsRecipeLoading] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);


  const toggleMenuExpansion = (index: number) => {
    setExpandedMenus(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const recalculateTotals = useCallback((menuItems: MenuItemDetail[], otherCosts: OtherCost[]) => {
    const newTotals = { ...estimate.totals };

    newTotals.ingredients = menuItems.reduce((acc, menuItem) => {
        return acc + menuItem.ingredients.reduce((subAcc, item) => subAcc + (item.totalCost || 0), 0);
    }, 0);
    
    const otherCostsTotal = otherCosts.reduce((acc, cost) => acc + (cost.cost || 0), 0);

    // Recalculate labor total based on laborDetails (if available)
    const laborTotal = newTotals.laborDetails?.reduce((acc, d) => acc + d.totalCost, 0) || 0;
    newTotals.labor = laborTotal;

    const kitchenStaffCost = newTotals.laborDetails?.filter(d => d.role.toLowerCase().includes('cozinheir') || d.role.toLowerCase().includes('auxiliar')).reduce((acc, d) => acc + d.totalCost, 0) || 0;
    newTotals.productionCost = newTotals.ingredients + kitchenStaffCost;
    
    // Tax calculation based on ingredients + labor + other costs
    const baseForTax = newTotals.ingredients + newTotals.labor + otherCostsTotal;
    newTotals.tax = baseForTax * 0.08;
    newTotals.totalCost = baseForTax + newTotals.tax;
    
    newTotals.otherCosts = otherCosts;
    return newTotals;
  }, [estimate.totals]);


  const handleItemChange = (menuItemIndex: number, itemIndex: number, field: keyof EstimateItem, value: string) => {
      const newMenuItems = JSON.parse(JSON.stringify(estimate.menuItems));
      const item = newMenuItems[menuItemIndex].ingredients[itemIndex];
      
      if(field === 'name' || field === 'unit') {
        item[field] = value;
      } else {
        // Ensure numeric fields are parsed correctly
        (item as any)[field] = parseFloat(value) || 0;
      }

      if (field === 'qty' || field === 'unitCost') {
          item.totalCost = item.qty * item.unitCost;
      }

      const newTotals = recalculateTotals(newMenuItems, estimate.totals.otherCosts);
      setEstimate({...estimate, menuItems: newMenuItems, totals: newTotals });
  }
  
  const handleAddItem = (menuItemIndex: number) => {
      const newMenuItems = JSON.parse(JSON.stringify(estimate.menuItems));
      newMenuItems[menuItemIndex].ingredients.push({
          name: 'Novo Item',
          qty: 1,
          unit: 'unidade', // Default unit
          unitCost: 0,
          totalCost: 0,
      });
      const newTotals = recalculateTotals(newMenuItems, estimate.totals.otherCosts);
      setEstimate({...estimate, menuItems: newMenuItems, totals: newTotals });
  };
  
  const handleRemoveItem = (menuItemIndex: number, itemIndex: number) => {
      const newMenuItems = JSON.parse(JSON.stringify(estimate.menuItems));
      newMenuItems[menuItemIndex].ingredients.splice(itemIndex, 1);
      const newTotals = recalculateTotals(newMenuItems, estimate.totals.otherCosts);
      setEstimate({...estimate, menuItems: newMenuItems, totals: newTotals });
  };
  
  const handleOtherCostChange = (index: number, field: keyof OtherCost, value: string) => {
      const newOtherCosts = JSON.parse(JSON.stringify(estimate.totals.otherCosts));
      const item = newOtherCosts[index];
      
      if (field === 'cost') {
          item[field] = parseFloat(value) || 0;
      } else {
          item[field] = value;
      }
      
      const newTotals = recalculateTotals(estimate.menuItems, newOtherCosts);
      setEstimate({...estimate, totals: newTotals });
  };
  
  const handleAddOtherCost = () => {
      const newOtherCosts = JSON.parse(JSON.stringify(estimate.totals.otherCosts));
      newOtherCosts.push({ name: 'Novo Custo', cost: 0 });
      const newTotals = recalculateTotals(estimate.menuItems, newOtherCosts);
      setEstimate({...estimate, totals: newTotals });
  };
  
  const handleRemoveOtherCost = (index: number) => {
      const newOtherCosts = JSON.parse(JSON.stringify(estimate.totals.otherCosts));
      newOtherCosts.splice(index, 1);
      const newTotals = recalculateTotals(estimate.menuItems, newOtherCosts);
      setEstimate({...estimate, totals: newTotals });
  };

  const handleAddRecipe = async () => {
      if (!newRecipeName.trim()) {
          setRecipeError("Por favor, insira o nome da receita.");
          return;
      }
      
      setIsRecipeLoading(true);
      setRecipeError(null);
      
      try {
          const newMenuItem = await generateMenuItemDetails(newRecipeName, estimate.guests);
          
          const newMenuItems = [...estimate.menuItems, newMenuItem];
          const newTotals = recalculateTotals(newMenuItems, estimate.totals.otherCosts);
          
          setEstimate(prev => ({
              ...prev,
              menuItems: newMenuItems,
              totals: newTotals,
          }));
          
          // Expandir o novo item automaticamente
          setExpandedMenus(prev => ({
              ...prev,
              [newMenuItems.length - 1]: true,
          }));

          setNewRecipeName('');
          setIsAddingRecipe(false);
          
      } catch (e: any) {
          setRecipeError(e.message || "Erro ao calcular a receita pela IA.");
      } finally {
          setIsRecipeLoading(false);
      }
  };
  
  // --- Handlers for Structured Consumption Averages ---
  const handleStructuredPremiseChange = (id: string, field: keyof Omit<StructuredPremise, 'id'>, value: string | number) => {
      let newAverages: StructuredPremise[] = [];
      
      setStructuredAverages(prev => {
          newAverages = prev.map(p => {
              if (p.id === id) {
                  if (field === 'quantity') {
                      return { ...p, [field]: parseFloat(value as string) || 0 };
                  }
                  return { ...p, [field]: value as string };
              }
              return p;
          });
          return newAverages;
      });
      
      // 1. Sincroniza de volta para o estado principal do Estimate (string array)
      setEstimate(prevEst => {
          const serializedAverages = serializePremises(newAverages);
          
          // 2. Recalcula as quantidades dos ingredientes
          const updatedMenuItems = prevEst.menuItems.map(menuItem => ({
              ...menuItem,
              ingredients: menuItem.ingredients.map(ingredient => {
                  const premise = newAverages.find(p => 
                      ingredient.name.toLowerCase().includes(p.item.toLowerCase()) && p.quantity > 0
                  );
                  
                  if (premise) {
                      // Se a premissa for encontrada, recalcula a quantidade total (qty)
                      // Nota: Assumimos que a unidade da premissa (p.unit) é a mesma unidade do ingrediente (ingredient.unit)
                      const newQty = premise.quantity * prevEst.guests;
                      const newTotalCost = newQty * ingredient.unitCost;
                      
                      return {
                          ...ingredient,
                          qty: newQty,
                          totalCost: newTotalCost,
                          unit: premise.unit, // Atualiza a unidade do ingrediente para corresponder à premissa
                      };
                  }
                  return ingredient;
              })
          }));
          
          // 3. Recalcula os totais financeiros com os novos ingredientes
          const newTotals = recalculateTotals(updatedMenuItems, prevEst.totals.otherCosts);
          
          return {
              ...prevEst,
              consumptionAverages: serializedAverages,
              menuItems: updatedMenuItems,
              totals: newTotals,
          };
      });
  };

  const handleAddStructuredPremise = () => {
      const newPremise: StructuredPremise = {
          id: `premise-${Date.now()}`,
          item: 'Novo Item',
          quantity: 100,
          unit: 'g',
      };
      
      setStructuredAverages(prev => {
          const newAverages = [...prev, newPremise];
          setEstimate(prevEst => ({
              ...prevEst,
              consumptionAverages: serializePremises(newAverages),
          }));
          return newAverages;
      });
  };

  const handleRemoveStructuredPremise = (id: string) => {
      setStructuredAverages(prev => {
          const newAverages = prev.filter(p => p.id !== id);
          setEstimate(prevEst => ({
              ...prevEst,
              consumptionAverages: serializePremises(newAverages),
          }));
          return newAverages;
      });
  };
  // -----------------------------------------

  const updatedTotals = useMemo(() => {
    const totalCost = estimate.totals.totalCost;
    const suggestedPrice = totalCost * (1 + margin / 100);
    return { ...estimate.totals, suggestedPrice };
  }, [estimate.totals, margin]);

  return (
    <div className="container mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Detalhes do Orçamento</h2>
              <p className="text-slate-500">{estimate.eventType} para {estimate.guests} convidados.</p>
            </div>
            <button className="bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-200 transition flex items-center">
              <FileText className="w-4 h-4 mr-2 text-red-500" />
              Exportar PDF
            </button>
          </div>
          
          {/* Editable Consumption Averages Section (Structured) */}
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <h4 className="font-bold text-sm text-indigo-800 mb-3">Premissas de Cálculo (por pessoa)</h4>
              <p className="text-xs text-indigo-700 mb-3 bg-indigo-100 p-2 rounded">
                  *Nota: Alterar as premissas aqui recalcula a **quantidade total** dos ingredientes correspondentes (ex: 'Carne' afeta 'Picanha' e 'Fraldinha').
              </p>
              <div className="space-y-2">
                  {structuredAverages.map((p) => (
                      <div key={p.id} className="flex items-center space-x-2 group">
                          <input
                              type="text"
                              value={p.item}
                              onChange={(e) => handleStructuredPremiseChange(p.id, 'item', e.target.value)}
                              placeholder="Item (ex: Carne)"
                              className="flex-1 bg-white p-2 rounded border border-indigo-300 focus:border-indigo-500 text-sm text-slate-700"
                          />
                          <input
                              type="number"
                              value={p.quantity}
                              onChange={(e) => handleStructuredPremiseChange(p.id, 'quantity', e.target.value)}
                              placeholder="Qtde"
                              className="w-20 bg-white p-2 rounded border border-indigo-300 focus:border-indigo-500 text-sm text-slate-700 text-right"
                          />
                          <input
                              type="text"
                              value={p.unit}
                              onChange={(e) => handleStructuredPremiseChange(p.id, 'unit', e.target.value)}
                              placeholder="Unidade"
                              className="w-20 bg-white p-2 rounded border border-indigo-300 focus:border-indigo-500 text-sm text-slate-700"
                          />
                          <span className="text-sm text-slate-500 whitespace-nowrap">/ pessoa</span>
                          <button 
                              onClick={() => handleRemoveStructuredPremise(p.id)} 
                              className="ml-2 text-red-500 hover:text-red-700 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                  ))}
              </div>
              <button onClick={handleAddStructuredPremise} className="mt-3 text-indigo-600 hover:text-indigo-800 text-sm font-semibold flex items-center p-1 -ml-1">
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Premissa
              </button>
          </div>
          {/* End Editable Consumption Averages Section */}

          <div className="space-y-6">
            {estimate.menuItems.map((menuItem, menuItemIndex) => {
              const isExpanded = expandedMenus[menuItemIndex] || false;
              return (
                <div key={menuItemIndex} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button 
                    onClick={() => toggleMenuExpansion(menuItemIndex)}
                    className="flex justify-between items-center w-full p-4 bg-slate-50 hover:bg-slate-100 transition duration-150"
                  >
                    <h3 className="text-lg font-semibold text-slate-700">{menuItem.name}</h3>
                    <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isExpanded && (
                    <div className="p-4 pt-2 bg-white">
                      <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-white">
                              <tr>
                                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-2/5">Item</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Qtde.</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Un.</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Preço Unit. (R$)</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Custo Total</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                              {menuItem.ingredients.map((item, itemIndex) => (
                                <tr key={itemIndex} className="hover:bg-slate-50">
                                  <td className="p-2 whitespace-nowrap">
                                    <input 
                                      type="text" 
                                      value={item.name} 
                                      onChange={(e) => handleItemChange(menuItemIndex, itemIndex, 'name', e.target.value)} 
                                      className="w-full bg-transparent p-1 rounded border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                    />
                                  </td>
                                  <td className="p-2 whitespace-nowrap">
                                    <input 
                                      type="number" 
                                      value={item.qty} 
                                      onChange={(e) => handleItemChange(menuItemIndex, itemIndex, 'qty', e.target.value)} 
                                      className="w-20 bg-transparent p-1 rounded border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm text-right"
                                    />
                                  </td>
                                  <td className="p-2 whitespace-nowrap text-sm text-slate-500">
                                    <select
                                      value={item.unit}
                                      onChange={(e) => handleItemChange(menuItemIndex, itemIndex, 'unit', e.target.value)}
                                      className="w-20 bg-white p-1 rounded border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                    >
                                      {commonUnits.map(unit => (
                                        <option key={unit} value={unit}>{unit}</option>
                                      ))}
                                      {/* Adiciona a unidade atual se ela não estiver na lista (para itens gerados pela IA) */}
                                      {!commonUnits.includes(item.unit) && <option value={item.unit}>{item.unit}</option>}
                                    </select>
                                  </td>
                                  <td className="p-2 whitespace-nowrap">
                                    <input 
                                      type="number" 
                                      step="0.01" 
                                      value={item.unitCost} 
                                      onChange={(e) => handleItemChange(menuItemIndex, itemIndex, 'unitCost', e.target.value)} 
                                      className="w-24 bg-transparent p-1 rounded border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm text-right"
                                    />
                                  </td>
                                  <td className="p-2 whitespace-nowrap text-sm font-semibold text-slate-700">{formatCurrency(item.totalCost)}</td>
                                  <td className="p-2 whitespace-nowrap text-right">
                                    <button onClick={() => handleRemoveItem(menuItemIndex, itemIndex)} className="text-red-500 hover:text-red-700 p-1 rounded">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button onClick={() => handleAddItem(menuItemIndex)} className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm font-semibold flex items-center p-1">
                            <Plus className="w-4 h-4 mr-1" /> Adicionar Ingrediente Manualmente
                          </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Add Recipe Section */}
          <div className="mt-8 p-4 border-2 border-dashed border-indigo-300 rounded-lg bg-indigo-50">
              <h3 className="text-lg font-bold text-indigo-800 mb-3">Adicionar Nova Receita (via IA)</h3>
              
              {isAddingRecipe ? (
                  <div className="space-y-4">
                      {recipeError && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-md text-sm">{recipeError}</div>}
                      <input
                          type="text"
                          value={newRecipeName}
                          onChange={(e) => setNewRecipeName(e.target.value)}
                          placeholder="Ex: Inhoque de batata com molho bolonhesa"
                          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                          disabled={isRecipeLoading}
                      />
                      <div className="flex space-x-3">
                          <button
                              onClick={handleAddRecipe}
                              disabled={isRecipeLoading || !newRecipeName.trim()}
                              className="flex-1 bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition duration-300 ease-in-out shadow-md flex items-center justify-center"
                          >
                              {isRecipeLoading ? (
                                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              ) : (
                                  <Plus className="w-5 h-5 mr-2" />
                              )}
                              Calcular Receita para {estimate.guests} Convidados
                          </button>
                          <button
                              onClick={() => { setIsAddingRecipe(false); setNewRecipeName(''); setRecipeError(null); }}
                              className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition"
                          >
                              Cancelar
                          </button>
                      </div>
                  </div>
              ) : (
                  <button
                      onClick={() => setIsAddingRecipe(true)}
                      className="w-full bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-600 transition duration-300 ease-in-out shadow-md flex items-center justify-center"
                  >
                      <Plus className="w-5 h-5 mr-2" /> Adicionar Receita com IA
                  </button>
              )}
          </div>
        </div>

        {/* Sidebar: Financial Summary */}
        <div className="lg:col-span-1">
            <div className="sticky top-8 bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-3 mb-4">Resumo Financeiro</h3>
                
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Custo Ingredientes:</span> <span className="font-medium">{formatCurrency(estimate.totals.ingredients)}</span></div>
                    
                    {estimate.totals.productionCost !== undefined && (
                      <div className="flex justify-between"><span className="text-slate-500">Custo Produção:</span> <span className="font-medium">{formatCurrency(estimate.totals.productionCost)}</span></div>
                    )}

                    <div 
                      className="cursor-pointer p-1 -m-1 rounded hover:bg-slate-50 transition"
                      onClick={() => setIsLaborExpanded(!isLaborExpanded)}
                      aria-expanded={isLaborExpanded}
                    >
                      <div className="flex justify-between">
                        <span className="text-slate-500">Custo Mão de Obra:</span>
                        <span className="font-medium flex items-center">
                          {formatCurrency(estimate.totals.labor)}
                          {estimate.totals.laborDetails && estimate.totals.laborDetails.length > 0 && (
                            <ChevronDown className={`w-4 h-4 ml-2 text-slate-400 transition-transform duration-200 ${isLaborExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </span>
                      </div>
                    </div>
                    {isLaborExpanded && estimate.totals.laborDetails && (
                        <div className="pl-4 mt-2 space-y-1 border-l-2 border-slate-200">
                          {estimate.totals.laborDetails.map((detail, index) => (
                              <div key={index} className="flex justify-between text-xs">
                                  <span className="text-slate-500">{detail.count}x {detail.role}</span>
                                  <span className="font-mono">{formatCurrency(detail.totalCost)}</span>
                              </div>
                          ))}
                        </div>
                    )}
                    
                    <div className="pt-2 border-t border-slate-100">
                      <h4 className="text-xs font-semibold text-slate-600 mb-2">Outros Custos</h4>
                      {estimate.totals.otherCosts.map((cost, index) => (
                          <div key={index} className="flex justify-between items-center group py-1">
                              <input 
                                  type="text"
                                  value={cost.name}
                                  onChange={(e) => handleOtherCostChange(index, 'name', e.target.value)}
                                  className="text-slate-500 bg-transparent p-1 rounded border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 w-3/5 text-sm"
                              />
                              <div className="flex items-center">
                                  <span className="text-slate-500 mr-1">R$</span>
                                  <input 
                                      type="number"
                                      step="0.01"
                                      value={cost.cost}
                                      onChange={(e) => handleOtherCostChange(index, 'cost', e.target.value)}
                                      className="font-medium bg-transparent p-1 rounded border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 w-24 text-right text-sm"
                                  />
                                  <button onClick={() => handleRemoveOtherCost(index)} className="ml-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded">
                                      <Trash2 className="w-3 h-3" />
                                  </button>
                              </div>
                          </div>
                      ))}
                      <button onClick={handleAddOtherCost} className="mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center p-1 -ml-1">
                        <Plus className="w-3 h-3 mr-1" /> Adicionar Custo
                      </button>
                    </div>


                    <div className="flex justify-between pt-2 border-t border-slate-200"><span className="text-slate-500">Impostos (8%):</span> <span className="font-medium">{formatCurrency(estimate.totals.tax)}</span></div>
                </div>

                <div className="my-4 border-t border-dashed"></div>
                
                <div className="flex justify-between text-lg font-bold p-3 bg-slate-100 rounded-lg">
                    <span className="text-slate-800">CUSTO TOTAL:</span>
                    <span className="text-red-600">{formatCurrency(estimate.totals.totalCost)}</span>
                </div>
                
                <div className="mt-6">
                    <label htmlFor="margin-slider" className="block text-sm font-medium text-slate-700 mb-2">
                        Simular Preço de Venda (Margem: <span className="font-bold text-indigo-600">{margin}%</span>)
                    </label>
                    <input 
                        id="margin-slider"
                        type="range"
                        min="10"
                        max="200"
                        step="5"
                        value={margin}
                        onChange={(e) => setMargin(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer range-lg"
                    />
                </div>

                <div className="mt-4 flex justify-between text-2xl font-bold p-3 bg-green-100 text-green-800 rounded-lg">
                    <span>Preço Sugerido:</span>
                    <span>{formatCurrency(updatedTotals.suggestedPrice)}</span>
                </div>
                 <div className="mt-1 text-right text-sm text-slate-500">
                     Lucro Bruto: {formatCurrency(updatedTotals.suggestedPrice - estimate.totals.totalCost)}
                 </div>
                 
                 <button className="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition duration-300 ease-in-out shadow-lg">
                    Salvar Orçamento
                 </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default EstimateResult;