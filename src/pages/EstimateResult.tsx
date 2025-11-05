import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Estimate, EstimateItem, MenuItemDetail, OtherCost, LaborDetail } from '../types';
import { ChevronDown, Trash2, Plus, FileText, Loader2, Pencil, RotateCcw, RotateCw } from 'lucide-react';
import { generateMenuItemDetails } from '../services/geminiService';
import { saveNewEstimate, updateEstimate } from '../services/estimateService';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useUndoRedo } from '../hooks/useUndoRedo'; // Importando o novo hook

interface EstimateResultProps {
  estimate: Estimate;
  onEstimateSaved: () => void;
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
        // Regex melhorada para capturar Item, Quantidade (incluindo vírgulas ou pontos) e Unidade (ex: "Carne: 550g por pessoa" ou "Água: 1.5L/pessoa")
        // Captura: (Item): (Quantidade) (Unidade) (por pessoa ou /pessoa)
        const match = avg.match(/(.+):\s*(\d+[\.,]?\d*)\s*([a-zA-Z]+)\s*(?:por pessoa|\/pessoa)/i);
        
        if (match) {
            // Substitui vírgula por ponto para garantir que parseFloat funcione
            const quantityStr = match[2].replace(',', '.');
            return {
                id: `premise-${index}-${Date.now()}`,
                item: match[1].trim(),
                quantity: parseFloat(quantityStr), 
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
            // Usa ponto como separador decimal para consistência com o formato de IA
            const quantityFormatted = p.quantity.toFixed(2).replace(/\.?0+$/, ''); // Remove zeros finais
            return `${p.item}: ${quantityFormatted}${p.unit} por pessoa`;
        }
        return p.item;
    }).filter(s => s.trim() !== '');
};


const EstimateResult: React.FC<EstimateResultProps> = ({ estimate: initialEstimate, onEstimateSaved }) => {
  // Substituindo useState por useUndoRedo
  const [estimate, estimateActions] = useUndoRedo(initialEstimate);
  const { set: setEstimate, undo, redo, canUndo, canRedo } = estimateActions;
  
  const [margin, setMargin] = useState(40);
  const [isLaborExpanded, setIsLaborExpanded] = useState(false);
  const [isProductionExpanded, setIsProductionExpanded] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<number, boolean>>({});
  const [isExporting, setIsExporting] = useState(false); 
  
  // Estado estruturado para edição das premissas
  const [structuredAverages, setStructuredAverages] = useState<StructuredPremise[]>(() => parsePremises(initialEstimate.consumptionAverages || []));
  const [isPremiseEditing, setIsPremiseEditing] = useState(false); 

  // Novo estado para adicionar receita
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [isRecipeLoading, setIsRecipeLoading] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sincroniza o estado estruturado das premissas quando o estimate muda (ex: após undo/redo)
  useEffect(() => {
      setStructuredAverages(parsePremises(estimate.consumptionAverages || []));
  }, [estimate.consumptionAverages]);


  const toggleMenuExpansion = (index: number) => {
    setExpandedMenus(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getKitchenStaffCost = useCallback(() => {
      return estimate.totals.laborDetails?.filter(d => d.role.toLowerCase().includes('cozinheir') || d.role.toLowerCase().includes('auxiliar')).reduce((acc, d) => acc + d.totalCost, 0) || 0;
  }, [estimate.totals.laborDetails]);

  const recalculateTotals = useCallback((menuItems: MenuItemDetail[], otherCosts: OtherCost[], laborDetails?: LaborDetail[]) => {
    const newTotals = { ...estimate.totals };

    newTotals.ingredients = menuItems.reduce((acc, menuItem) => {
        return acc + menuItem.ingredients.reduce((subAcc, item) => subAcc + (item.totalCost || 0), 0);
    }, 0);
    
    const otherCostsTotal = otherCosts.reduce((acc, cost) => acc + (cost.cost || 0), 0);

    // Use os laborDetails passados ou os existentes
    const currentLaborDetails = laborDetails || newTotals.laborDetails;

    // Recalculate labor total based on laborDetails
    const laborTotal = currentLaborDetails?.reduce((acc, d) => acc + (d.totalCost || 0), 0) || 0;
    newTotals.labor = laborTotal;
    newTotals.laborDetails = currentLaborDetails; // Atualiza os detalhes no objeto totals

    const kitchenStaffCost = currentLaborDetails?.filter(d => d.role.toLowerCase().includes('cozinheir') || d.role.toLowerCase().includes('auxiliar')).reduce((acc, d) => acc + (d.totalCost || 0), 0) || 0;
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
  
  const handleLaborDetailChange = (index: number, field: keyof LaborDetail, value: string) => {
      if (!estimate.totals.laborDetails) return;

      const newLaborDetails = JSON.parse(JSON.stringify(estimate.totals.laborDetails));
      const detail = newLaborDetails[index];

      if (field === 'role') {
          detail[field] = value;
      } else {
          const numericValue = parseFloat(value) || 0;
          (detail as any)[field] = numericValue;
      }

      // Recalcula o totalCost para este item
      detail.totalCost = detail.count * detail.costPerUnit;

      const newTotals = recalculateTotals(estimate.menuItems, estimate.totals.otherCosts, newLaborDetails);
      setEstimate({...estimate, totals: newTotals });
  };

  const handleAddLaborDetail = () => {
      const newLaborDetails = [...(estimate.totals.laborDetails || []), {
          role: 'Novo Profissional',
          count: 1,
          costPerUnit: 0,
          totalCost: 0,
      }];
      const newTotals = recalculateTotals(estimate.menuItems, estimate.totals.otherCosts, newLaborDetails);
      setEstimate({...estimate, totals: newTotals });
  };

  const handleRemoveLaborDetail = (index: number) => {
      if (!estimate.totals.laborDetails) return;
      const newLaborDetails = estimate.totals.laborDetails.filter((_, i) => i !== index);
      const newTotals = recalculateTotals(estimate.menuItems, estimate.totals.otherCosts, newLaborDetails);
      setEstimate({...estimate, totals: newTotals });
  };
  
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
          
          setEstimate({
              ...estimate,
              menuItems: newMenuItems,
              totals: newTotals,
          });
          
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
          const newTotals = recalculateTotals(updatedMenuItems, prevEst.totals.otherCosts, prevEst.totals.laborDetails);
          
          return {
              ...prevEst,
              consumptionAverages: serializedAverages,
              menuItems: updatedMenuItems,
              totals: newTotals,
          };
      });
  };

  const handleSavePremises = () => {
      // A lógica de atualização do estimate já está em handleStructuredPremiseChange
      // Aqui apenas desativamos o modo de edição.
      setIsPremiseEditing(false);
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
          setEstimate({
              ...estimate,
              consumptionAverages: serializePremises(newAverages),
          });
          return newAverages;
      });
  };

  const handleRemoveStructuredPremise = (id: string) => {
      setStructuredAverages(prev => {
          const newAverages = prev.filter(p => p.id !== id);
          setEstimate({
              ...estimate,
              consumptionAverages: serializePremises(newAverages),
          });
          return newAverages;
      });
  };
  // -----------------------------------------

  const handleSaveEstimate = async () => {
      setIsSaving(true);
      const toastId = toast.loading('Salvando orçamento...');
      
      // Ensure the suggested price is updated before saving
      const estimateToSave = {
          ...estimate,
          totals: updatedTotals,
      };

      try {
          let savedEstimate: Estimate;
          
          if (estimateToSave.estimateId.startsWith('temp-')) {
              // New estimate (generated by AI, not yet saved)
              savedEstimate = await saveNewEstimate(estimateToSave);
              toast.success('Novo orçamento salvo com sucesso!', { id: toastId });
          } else {
              // Existing estimate (update)
              savedEstimate = await updateEstimate(estimateToSave);
              toast.success('Orçamento atualizado com sucesso!', { id: toastId });
          }
          
          // Update local state with definitive IDs/timestamps from DB
          // NOTE: We use the direct set function from useUndoRedo here, but we don't want this to be undoable.
          // Since useUndoRedo doesn't expose a non-history set, we rely on the next render cycle to update the state.
          // For simplicity, we'll let the next render cycle handle the state update via initialEstimate change if needed, 
          // but for now, we rely on the parent component reloading the data.
          
          // To ensure the local state reflects the saved data immediately:
          setEstimate(savedEstimate);
          
          onEstimateSaved(); // Notify App.tsx to reload the list
          
      } catch (e: any) {
          console.error("Save error:", e);
          toast.error(e.message || 'Falha ao salvar o orçamento. Verifique sua autenticação.', { id: toastId });
      } finally {
          setIsSaving(false);
      }
  };
  
  const handleExportPDF = async () => {
      setIsExporting(true);
      const toastId = toast.loading('Gerando PDF...');
      
      const input = document.getElementById('estimate-content');
      if (!input) {
          toast.error('Conteúdo do orçamento não encontrado.', { id: toastId });
          setIsExporting(false);
          return;
      }

      try {
          // 1. Captura o conteúdo HTML como uma imagem (canvas)
          const canvas = await html2canvas(input, {
              scale: 2, // Aumenta a escala para melhor qualidade
              useCORS: true,
              logging: false,
          });

          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' portrait, 'mm' units, 'a4' size
          const imgProps = pdf.getImageProperties(imgData);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

          // 2. Adiciona a imagem ao PDF
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          
          // 3. Salva o arquivo
          const filename = `Orcamento_${estimate.eventType.replace(/\s/g, '_')}_${estimate.guests}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
          pdf.save(filename);
          
          toast.success('PDF gerado com sucesso!', { id: toastId });

      } catch (error) {
          console.error("PDF Export Error:", error);
          toast.error('Falha ao gerar o PDF.', { id: toastId });
      } finally {
          setIsExporting(false);
      }
  };


  const updatedTotals = useMemo(() => {
    const totalCost = estimate.totals.totalCost;
    const suggestedPrice = totalCost * (1 + margin / 100);
    return { ...estimate.totals, suggestedPrice };
  }, [estimate.totals, margin]);
  
  const kitchenStaffCost = getKitchenStaffCost();

  return (
    <div className="container mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg" id="estimate-content">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Detalhes do Orçamento</h2>
              <p className="text-slate-500">{estimate.eventType} para {estimate.guests} convidados.</p>
            </div>
            <div className="flex space-x-2">
                {/* Undo/Redo Buttons */}
                <button
                    onClick={undo}
                    disabled={!canUndo}
                    className={`p-2 rounded-lg transition ${canUndo ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-50 text-slate-400 cursor-not-allowed'}`}
                    title="Desfazer (Ctrl+Z)"
                >
                    <RotateCcw className="w-5 h-5" />
                </button>
                <button
                    onClick={redo}
                    disabled={!canRedo}
                    className={`p-2 rounded-lg transition ${canRedo ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-50 text-slate-400 cursor-not-allowed'}`}
                    title="Refazer (Ctrl+Y)"
                >
                    <RotateCw className="w-5 h-5" />
                </button>
                
                {/* Export PDF Button */}
                <button 
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-200 transition flex items-center disabled:opacity-60"
                >
                  {isExporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                      <FileText className="w-4 h-4 mr-2 text-red-500" />
                  )}
                  {isExporting ? 'Exportando...' : 'Exportar PDF'}
                </button>
            </div>
          </div>
          
          {/* Editable Consumption Averages Section (Structured) */}
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg relative">
              <div className="flex justify-between items-start mb-3">
                  <h4 className="font-bold text-sm text-indigo-800">Premissas de Consumo (por pessoa)</h4>
                  <button 
                      onClick={() => setIsPremiseEditing(prev => !prev)}
                      className={`p-1 rounded transition-colors ${isPremiseEditing ? 'bg-indigo-200 text-indigo-800' : 'text-indigo-600 hover:bg-indigo-100'}`}
                      title={isPremiseEditing ? "Sair do modo de edição" : "Editar premissas"}
                  >
                      <Pencil className="w-4 h-4" />
                  </button>
              </div>
              
              <p className="text-xs text-indigo-700 mb-3 bg-indigo-100 p-2 rounded">
                  *Nota: Alterar as premissas aqui recalcula a **quantidade total** dos ingredientes correspondentes (ex: 'Carne' afeta 'Picanha' e 'Fraldinha').
              </p>
              
              <div className="space-y-2">
                  {structuredAverages.map((p) => (
                      <div key={p.id} className="flex items-center space-x-2 group">
                          {isPremiseEditing ? (
                              <input
                                  type="text"
                                  value={p.item}
                                  onChange={(e) => handleStructuredPremiseChange(p.id, 'item', e.target.value)}
                                  placeholder="Item (ex: Carne)"
                                  className="flex-1 bg-white p-2 rounded border border-indigo-300 focus:border-indigo-500 text-sm text-slate-700"
                              />
                          ) : (
                              <span className="flex-1 p-2 text-sm text-slate-700 truncate">{p.item}</span>
                          )}
                          
                          {isPremiseEditing ? (
                              <input
                                  type="number"
                                  value={p.quantity}
                                  onChange={(e) => handleStructuredPremiseChange(p.id, 'quantity', e.target.value)}
                                  placeholder="Qtde"
                                  className="w-20 bg-white p-2 rounded border border-indigo-300 focus:border-indigo-500 text-sm text-slate-700 text-right"
                              />
                          ) : (
                              // Formatação para exibir o número com precisão, mas sem zeros desnecessários
                              <span className="w-20 p-2 text-sm text-slate-700 text-right font-medium">
                                  {p.quantity.toFixed(2).replace(/\.?0+$/, '')}
                              </span>
                          )}
                          
                          {isPremiseEditing ? (
                              <select
                                  value={p.unit}
                                  onChange={(e) => handleStructuredPremiseChange(p.id, 'unit', e.target.value)}
                                  className="w-20 bg-white p-2 rounded border border-indigo-300 focus:border-indigo-500 text-sm text-slate-700"
                              >
                                  {commonUnits.map(unit => (
                                      <option key={unit} value={unit}>{unit}</option>
                                  ))}
                                  {!commonUnits.includes(p.unit) && p.unit && <option value={p.unit}>{p.unit}</option>}
                              </select>
                          ) : (
                              <span className="w-20 p-2 text-sm text-slate-700">{p.unit}</span>
                          )}
                          
                          <span className="text-sm text-slate-500 whitespace-nowrap">/ pessoa</span>
                          
                          {isPremiseEditing && (
                              <button 
                                  onClick={() => handleRemoveStructuredPremise(p.id)} 
                                  className="ml-2 text-red-500 hover:text-red-700 p-1 rounded transition-opacity"
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          )}
                      </div>
                  ))}
              </div>
              
              {isPremiseEditing && (
                  <>
                      <button onClick={handleAddStructuredPremise} className="mt-3 text-indigo-600 hover:text-indigo-800 text-sm font-semibold flex items-center p-1 -ml-1">
                          <Plus className="w-4 h-4 mr-1" /> Adicionar Premissa
                      </button>
                      <button onClick={handleSavePremises} className="mt-4 w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300 ease-in-out shadow-md">
                          Salvar Premissas
                      </button>
                  </>
              )}
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
                                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Unidade</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Custo Unit. (R$)</th>
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
                                      {!commonUnits.includes(item.unit) && item.unit && <option value={item.unit}>{item.unit}</option>}
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
                    
                    {/* Custo de Produção Expandível */}
                    {estimate.totals.productionCost !== undefined && (
                        <div 
                            className="cursor-pointer p-1 -m-1 rounded hover:bg-slate-50 transition"
                            onClick={() => setIsProductionExpanded(!isProductionExpanded)}
                            aria-expanded={isProductionExpanded}
                        >
                            <div className="flex justify-between">
                                <span className="text-slate-800 font-semibold">Custo Produção:</span>
                                <span className="font-bold flex items-center text-slate-800">
                                    {formatCurrency(estimate.totals.productionCost)}
                                    <ChevronDown className={`w-4 h-4 ml-2 text-slate-400 transition-transform duration-200 ${isProductionExpanded ? 'rotate-180' : ''}`} />
                                </span>
                            </div>
                        </div>
                    )}
                    {isProductionExpanded && estimate.totals.productionCost !== undefined && (
                        <div className="pl-4 mt-2 space-y-1 border-l-2 border-slate-200 bg-slate-50 p-2 rounded">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Ingredientes:</span>
                                <span className="font-mono">{formatCurrency(estimate.totals.ingredients)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Equipe de Cozinha:</span>
                                <span className="font-mono">{formatCurrency(kitchenStaffCost)}</span>
                            </div>
                        </div>
                    )}
                    {/* Fim Custo de Produção Expandível */}

                    <div 
                      className="cursor-pointer p-1 -m-1 rounded hover:bg-slate-50 transition"
                      onClick={() => setIsLaborExpanded(!isLaborExpanded)}
                      aria-expanded={isLaborExpanded}
                    >
                      <div className="flex justify-between">
                        <span className="text-slate-500">Custo Mão de Obra Total:</span>
                        <span className="font-medium flex items-center">
                          {formatCurrency(estimate.totals.labor)}
                          {estimate.totals.laborDetails && estimate.totals.laborDetails.length > 0 && (
                            <ChevronDown className={`w-4 h-4 ml-2 text-slate-400 transition-transform duration-200 ${isLaborExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </span>
                      </div>
                    </div>
                    {isLaborExpanded && estimate.totals.laborDetails && (
                        <div className="pl-4 mt-2 space-y-2 border-l-2 border-slate-200">
                          {estimate.totals.laborDetails.map((detail, index) => (
                              <div key={index} className="flex items-center justify-between group py-1">
                                  {/* Role Input */}
                                  <input 
                                      type="text"
                                      value={detail.role}
                                      onChange={(e) => handleLaborDetailChange(index, 'role', e.target.value)}
                                      placeholder="Função"
                                      className="text-slate-700 bg-transparent p-1 rounded border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 w-2/5 text-sm"
                                  />
                                  
                                  <div className="flex items-center space-x-1">
                                      {/* Count Input */}
                                      <input 
                                          type="number"
                                          value={detail.count}
                                          onChange={(e) => handleLaborDetailChange(index, 'count', e.target.value)}
                                          className="w-12 bg-transparent p-1 rounded border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm text-right"
                                      />
                                      <span className="text-slate-500">x</span>
                                      
                                      {/* Cost Per Unit Input */}
                                      <span className="text-slate-500">R$</span>
                                      <input 
                                          type="number"
                                          step="0.01"
                                          value={detail.costPerUnit}
                                          onChange={(e) => handleLaborDetailChange(index, 'costPerUnit', e.target.value)}
                                          className="w-20 bg-transparent p-1 rounded border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm text-right"
                                      />
                                  </div>
                                  
                                  {/* Total Cost Display */}
                                  <span className="font-mono text-sm w-20 text-right">{formatCurrency(detail.totalCost)}</span>
                                  
                                  {/* Remove Button */}
                                  <button onClick={() => handleRemoveLaborDetail(index)} className="ml-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded">
                                      <Trash2 className="w-3 h-3" />
                                  </button>
                              </div>
                          ))}
                          <button onClick={handleAddLaborDetail} className="mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center p-1 -ml-1">
                            <Plus className="w-3 h-3 mr-1" /> Adicionar Profissional
                          </button>
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
                                  placeholder="Nome do Custo"
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
                        Simular Preço de Venda (Margem de Lucro: <span className="font-bold text-indigo-600">{margin}%</span>)
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
                 
                 <button 
                    onClick={handleSaveEstimate}
                    disabled={isSaving}
                    className="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition duration-300 ease-in-out shadow-lg disabled:bg-indigo-400 flex items-center justify-center"
                 >
                    {isSaving ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        'Salvar Orçamento'
                    )}
                 </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default EstimateResult;