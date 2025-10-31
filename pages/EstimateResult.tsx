import React, { useState, useMemo, useCallback } from 'react';
import { Estimate, EstimateItem, MenuItemDetail, OtherCost } from '../types';

interface EstimateResultProps {
  estimate: Estimate;
}

const formatCurrency = (value: number) => {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const EstimateResult: React.FC<EstimateResultProps> = ({ estimate: initialEstimate }) => {
  const [estimate, setEstimate] = useState(initialEstimate);
  const [margin, setMargin] = useState(40);
  const [isLaborExpanded, setIsLaborExpanded] = useState(false);

  const recalculateTotals = useCallback((menuItems: MenuItemDetail[], otherCosts: OtherCost[]) => {
    const newTotals = { ...estimate.totals };

    newTotals.ingredients = menuItems.reduce((acc, menuItem) => {
        return acc + menuItem.ingredients.reduce((subAcc, item) => subAcc + (item.totalCost || 0), 0);
    }, 0);
    
    const otherCostsTotal = otherCosts.reduce((acc, cost) => acc + (cost.cost || 0), 0);

    const kitchenStaffCost = newTotals.laborDetails?.filter(d => d.role.toLowerCase().includes('cozinheir') || d.role.toLowerCase().includes('auxiliar')).reduce((acc, d) => acc + d.totalCost, 0) || 0;
    newTotals.productionCost = newTotals.ingredients + kitchenStaffCost;
    
    newTotals.tax = (newTotals.ingredients + newTotals.labor + otherCostsTotal) * 0.08;
    newTotals.totalCost = newTotals.ingredients + newTotals.labor + otherCostsTotal + newTotals.tax;
    
    newTotals.otherCosts = otherCosts;
    return newTotals;
  }, [estimate.totals]);


  const handleItemChange = (menuItemIndex: number, itemIndex: number, field: keyof EstimateItem, value: string) => {
      const newMenuItems = JSON.parse(JSON.stringify(estimate.menuItems));
      const item = newMenuItems[menuItemIndex].ingredients[itemIndex];
      
      if(field === 'name' || field === 'unit') {
        item[field] = value;
      } else {
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
          unit: 'unidade',
          unitCost: 0,
          totalCost: 0,
      });
      setEstimate({...estimate, menuItems: newMenuItems });
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
              <i className="fas fa-file-pdf mr-2 text-red-500"></i>
              Exportar PDF
            </button>
          </div>
          
          {estimate.consumptionAverages && estimate.consumptionAverages.length > 0 && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <h4 className="font-bold text-sm text-indigo-800 mb-2">Premissas de Cálculo (por pessoa)</h4>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                {estimate.consumptionAverages.map((avg, index) => (
                  <li key={index}>{avg}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-6">
            {estimate.menuItems.map((menuItem, menuItemIndex) => (
              <div key={menuItemIndex}>
                <h3 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-2">{menuItem.name}</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-2/5">Item</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Qtde.</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Un.</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Preço Unit.</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Custo Total</th>
                          <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {menuItem.ingredients.map((item, itemIndex) => (
                          <tr key={itemIndex} className="hover:bg-slate-50">
                            <td className="p-2 whitespace-nowrap"><input type="text" value={item.name} onChange={(e) => handleItemChange(menuItemIndex, itemIndex, 'name', e.target.value)} className="w-full bg-transparent p-1 rounded border-slate-200"/></td>
                            <td className="p-2 whitespace-nowrap"><input type="number" value={item.qty} onChange={(e) => handleItemChange(menuItemIndex, itemIndex, 'qty', e.target.value)} className="w-20 bg-transparent p-1 rounded border-slate-200"/></td>
                            <td className="p-2 whitespace-nowrap text-sm text-slate-500">{item.unit}</td>
                            <td className="p-2 whitespace-nowrap"><input type="number" step="0.01" value={item.unitCost} onChange={(e) => handleItemChange(menuItemIndex, itemIndex, 'unitCost', e.target.value)} className="w-24 bg-transparent p-1 rounded border-slate-200"/></td>
                            <td className="p-2 whitespace-nowrap text-sm font-semibold text-slate-700">{formatCurrency(item.totalCost)}</td>
                            <td className="p-2 whitespace-nowrap text-right"><button onClick={() => handleRemoveItem(menuItemIndex, itemIndex)} className="text-red-500 hover:text-red-700"><i className="fas fa-trash-alt"></i></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button onClick={() => handleAddItem(menuItemIndex)} className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-semibold">
                      <i className="fas fa-plus mr-1"></i> Adicionar Ingrediente
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar: Financial Summary */}
        <div className="lg:col-span-1">
            <div className="sticky top-8 bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-3 mb-4">Resumo Financeiro</h3>
                
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Custo Ingredientes:</span> <span className="font-medium">{formatCurrency(estimate.totals.ingredients)}</span></div>
                    
                    {estimate.totals.productionCost && (
                      <div className="flex justify-between"><span className="text-slate-500">Custo Produção:</span> <span className="font-medium">{formatCurrency(estimate.totals.productionCost)}</span></div>
                    )}

                    <div 
                      className="cursor-pointer"
                      onClick={() => setIsLaborExpanded(!isLaborExpanded)}
                      aria-expanded={isLaborExpanded}
                    >
                      <div className="flex justify-between">
                        <span className="text-slate-500">Custo Mão de Obra:</span>
                        <span className="font-medium flex items-center">
                          {formatCurrency(estimate.totals.labor)}
                          {estimate.totals.laborDetails && estimate.totals.laborDetails.length > 0 && (
                            <i className={`fas fa-chevron-down ml-2 text-xs text-slate-400 transition-transform duration-200 ${isLaborExpanded ? 'rotate-180' : ''}`}></i>
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
                    
                    {estimate.totals.otherCosts.map((cost, index) => (
                        <div key={index} className="flex justify-between items-center group">
                            <input 
                                type="text"
                                value={cost.name}
                                onChange={(e) => handleOtherCostChange(index, 'name', e.target.value)}
                                className="text-slate-500 bg-transparent p-0 border-0 focus:ring-0 w-3/5"
                            />
                             <div className="flex items-center">
                                <span className="text-slate-500 mr-1">R$</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    value={cost.cost}
                                    onChange={(e) => handleOtherCostChange(index, 'cost', e.target.value)}
                                    className="font-medium bg-transparent p-1 rounded border-slate-200 w-24 text-right"
                                />
                                <button onClick={() => handleRemoveOtherCost(index)} className="ml-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <i className="fas fa-trash-alt text-xs"></i>
                                </button>
                             </div>
                        </div>
                    ))}
                     <button onClick={handleAddOtherCost} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold">
                      <i className="fas fa-plus mr-1"></i> Adicionar Custo
                    </button>


                    <div className="flex justify-between pt-2 border-t border-slate-200"><span className="text-slate-500">Impostos (Estimado):</span> <span className="font-medium">{formatCurrency(estimate.totals.tax)}</span></div>
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
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
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