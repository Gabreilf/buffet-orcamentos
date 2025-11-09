import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Estimate, EstimateItem, MenuItemDetail, OtherCost, LaborDetail, EstimateTotals } from '../types';
import { ChevronDown, Trash2, Plus, FileText, Loader2, Pencil, RotateCcw, RotateCw, Download } from 'lucide-react';
import { generateMenuItemDetails } from '../services/geminiService';
import { saveNewEstimate, updateEstimate } from '../services/estimateService';
import toast from 'react-hot-toast';
import { useUndoRedo } from '../hooks/useUndoRedo'; 
import OtherCostItem from '../components/OtherCostItem'; // Importando o novo componente
import LaborDetailItem from '../components/LaborDetailItem'; // Corrigido: Caminho correto

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

// Tipo para gerenciar o estado local da data (Dia, Mês, Ano)
interface DateParts {
    day: string;
    month: string;
    year: string;
}

// Função auxiliar para extrair D/M/A de YYYY-MM-DD
const parseDateParts = (dateString: string | undefined): DateParts => {
    if (!dateString) return { day: '', month: '', year: '' };
    
    // Espera YYYY-MM-DD do banco de dados
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return {
            year: parts[0] || '',
            month: parts[1] || '',
            day: parts[2] || '',
        };
    }
    return { day: '', month: '', year: '' };
};

// Função para garantir que OtherCosts e LaborDetails tenham IDs únicos
const ensureUniqueIds = (estimate: Estimate): Estimate => {
    const newEstimate = JSON.parse(JSON.stringify(estimate));
    
    // 1. Garante que totals existe e está completo
    if (!newEstimate.totals) {
        newEstimate.totals = {
            ingredients: 0,
            labor: 0,
            otherCosts: [],
            tax: 0,
            totalCost: 0,
            suggestedPrice: 0,
            laborDetails: [],
            productionCost: 0,
        } as EstimateTotals;
    }
    
    // 2. OtherCosts: Garante que é um array e adiciona IDs
    newEstimate.totals.otherCosts = (newEstimate.totals.otherCosts || []).map((cost: OtherCost) => ({
        ...cost,
        id: cost.id || `other-${Date.now()}-${Math.random()}`,
    }));
    
    // 3. LaborDetails: Garante que é um array e adiciona IDs
    newEstimate.totals.laborDetails = (newEstimate.totals.laborDetails || []).map((detail: LaborDetail) => ({
        ...detail,
        id: detail.id || `labor-${Date.now()}-${Math.random()}`,
    }));
    
    return newEstimate;
};


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
                id: `premise-${index}-${Date.now()}-${Math.random()}`,
                item: match[1].trim(),
                quantity: parseFloat(quantityStr), 
                unit: match[3].trim(),
            };
        }
        // Fallback para strings não parseáveis
        return { id: `premise-${index}-${Date.now()}-${Math.random()}`, item: avg, quantity: 0, unit: '' };
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
  // Substituindo useState por useUndoRedo, garantindo IDs únicos no estado inicial
  const [estimate, estimateActions] = useUndoRedo(ensureUniqueIds(initialEstimate));
  const { set: setEstimate, undo, redo, canUndo, canRedo } = estimateActions;
  
  const [margin, setMargin] = useState(40);
  const [taxRate, setTaxRate] = useState(8); // Novo estado para a taxa de imposto (em %)
  const [isLaborExpanded, setIsLaborExpanded] = useState(false);
  const [isProductionExpanded, setIsProductionExpanded] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<number, boolean>>({});
  const [isExporting, setIsExporting] = useState(false); 
  
  // Estado local para as partes da data
  const [dateParts, setDateParts] = useState<DateParts>(() => parseDateParts(initialEstimate.eventDate));
  
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
      // Sincroniza as partes da data quando o estimate muda (ex: após undo/redo)
      setDateParts(parseDateParts(estimate.eventDate));
  }, [estimate.consumptionAverages, estimate.eventDate]);


  const toggleMenuExpansion = (index: number) => {
    setExpandedMenus(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getKitchenStaffCost = useCallback((laborDetails: LaborDetail[] | undefined) => {
      // Garante que laborDetails não é nulo
      return (laborDetails || []).filter(d => d.role.toLowerCase().includes('cozinheir') || d.role.toLowerCase().includes('auxiliar')).reduce((acc, d) => acc + (d.totalCost || 0), 0) || 0;
  }, []);

  // Recalcula todos os totais com base nos dados brutos e na taxa de imposto atual
  const recalculateTotals = useCallback((menuItems: MenuItemDetail[], otherCosts: OtherCost[], laborDetails: LaborDetail[], currentTaxRate: number) => {
    
    const newTotals: Partial<Estimate['totals']> = {};

    newTotals.ingredients = menuItems.reduce((acc, menuItem) => {
        return acc + menuItem.ingredients.reduce((subAcc, item) => subAcc + (item.totalCost || 0), 0);
    }, 0);
    
    const otherCostsTotal = otherCosts.reduce((acc, cost) => acc + (cost.cost || 0), 0);

    // Recalculate labor total based on laborDetails
    const laborTotal = laborDetails.reduce((acc, d) => acc + (d.totalCost || 0), 0) || 0;
    newTotals.labor = laborTotal;
    newTotals.laborDetails = laborDetails; // Atualiza os detalhes no objeto totals

    const kitchenStaffCost = (laborDetails || []).filter(d => d.role.toLowerCase().includes('cozinheir') || d.role.toLowerCase().includes('auxiliar')).reduce((acc, d) => acc + (d.totalCost || 0), 0) || 0;
    newTotals.productionCost = (newTotals.ingredients || 0) + kitchenStaffCost;
    
    // Tax calculation based on ingredients + labor + other costs
    const baseForTax = (newTotals.ingredients || 0) + (newTotals.labor || 0) + otherCostsTotal;
    newTotals.tax = baseForTax * (currentTaxRate / 100);
    newTotals.totalCost = baseForTax + (newTotals.tax || 0);
    
    newTotals.otherCosts = otherCosts;
    
    // O preço sugerido será calculado no useMemo principal
    return newTotals as EstimateTotals; // Garantindo que o retorno seja EstimateTotals completo
  }, []);


  const handleItemChange = (menuItemIndex: number, itemIndex: number, field: keyof EstimateItem, value: string) => {
      // Usando a forma funcional para garantir que estamos trabalhando com o estado mais recente
      setEstimate(prevEst => {
          const newMenuItems = JSON.parse(JSON.stringify(prevEst.menuItems));
          const item = newMenuItems[menuItemIndex].ingredients[itemIndex];
          
          if(field === 'name' || field === 'unit') {
            item[field] = value;
          } else {
            (item as any)[field] = parseFloat(value) || 0;
          }

          if (field === 'qty' || field === 'unitCost') {
              item.totalCost = item.qty * item.unitCost;
          }

          const newTotals = recalculateTotals(newMenuItems, prevEst.totals.otherCosts || [], prevEst.totals.laborDetails || [], taxRate);
          
          // Atualiza o estado sem adicionar ao histórico (addToHistory: false)
          return {...prevEst, menuItems: newMenuItems, totals: newTotals };
      }, false);
  }
  
  // Função de mudança para LaborDetails (usada no onChange para números e onBlur para todos)
  const handleLaborDetailChange = useCallback((id: string, field: keyof LaborDetail, value: string, addToHistory: boolean = false) => {
      // Usando a forma funcional para garantir que estamos trabalhando com o estado mais recente
      setEstimate(prevEst => {
          const currentLaborDetails = prevEst.totals.laborDetails || [];
          if (currentLaborDetails.length === 0) return prevEst;

          const newLaborDetails = JSON.parse(JSON.stringify(currentLaborDetails));
          const index = newLaborDetails.findIndex((d: LaborDetail) => d.id === id);
          if (index === -1) return prevEst;
          
          const detail = newLaborDetails[index];

          if (field === 'role') {
              detail[field] = value;
          } else {
              const numericValue = parseFloat(value) || 0;
              (detail as any)[field] = numericValue;
          }

          // Recalcula o totalCost para este item
          detail.totalCost = detail.count * detail.costPerUnit;

          const newTotals = recalculateTotals(prevEst.menuItems, prevEst.totals.otherCosts || [], newLaborDetails, taxRate);
          
          // Atualiza o estado
          return {...prevEst, totals: newTotals };
      }, addToHistory);
  }, [recalculateTotals, taxRate, setEstimate]); // Dependências estáveis

  const handleAddLaborDetail = () => {
      setEstimate(prevEst => {
          const newLaborDetails = [...(prevEst.totals.laborDetails || []), {
              id: `labor-${Date.now()}-${Math.random()}`, // ID ÚNICO
              role: 'Novo Profissional',
              count: 1,
              costPerUnit: 0,
              totalCost: 0,
          }];
          const newTotals = recalculateTotals(prevEst.menuItems, prevEst.totals.otherCosts || [], newLaborDetails, taxRate);
          // Adiciona ao histórico (padrão: true)
          return {...prevEst, totals: newTotals };
      });
  };

  const handleRemoveLaborDetail = (id: string) => {
      setEstimate(prevEst => {
          const currentLaborDetails = prevEst.totals.laborDetails || [];
          if (currentLaborDetails.length === 0) return prevEst;
          
          const newLaborDetails = currentLaborDetails.filter(d => d.id !== id);
          const newTotals = recalculateTotals(prevEst.menuItems, prevEst.totals.otherCosts || [], newLaborDetails, taxRate);
          // Adiciona ao histórico (padrão: true)
          return {...prevEst, totals: newTotals };
      });
  };
  
  const handleAddItem = (menuItemIndex: number) => {
      setEstimate(prevEst => {
          const newMenuItems = JSON.parse(JSON.stringify(prevEst.menuItems));
          newMenuItems[menuItemIndex].ingredients.push({
              name: 'Novo Item',
              qty: 1,
              unit: 'unidade', // Default unit
              unitCost: 0,
              totalCost: 0,
          });
          const newTotals = recalculateTotals(newMenuItems, prevEst.totals.otherCosts || [], prevEst.totals.laborDetails || [], taxRate);
          // Adiciona ao histórico (padrão: true)
          return {...prevEst, menuItems: newMenuItems, totals: newTotals };
      });
  };
  
  const handleRemoveItem = (menuItemIndex: number, itemIndex: number) => {
      setEstimate(prevEst => {
          const newMenuItems = JSON.parse(JSON.stringify(prevEst.menuItems));
          newMenuItems[menuItemIndex].ingredients.splice(itemIndex, 1);
          const newTotals = recalculateTotals(newMenuItems, prevEst.totals.otherCosts || [], prevEst.totals.laborDetails || [], taxRate);
          // Adiciona ao histórico (padrão: true)
          return {...prevEst, menuItems: newMenuItems, totals: newTotals };
      });
  };
  
  // Função de mudança para OtherCost (usada no onChange para números e onBlur para todos)
  const handleOtherCostChange = useCallback((id: string, field: keyof OtherCost, value: string, addToHistory: boolean = false) => {
      // Usando a forma funcional para garantir que estamos trabalhando com o estado mais recente
      setEstimate(prevEst => {
          // 1. Garante que otherCosts é um array
          const currentOtherCosts = prevEst.totals.otherCosts || [];
          
          // 2. Cria uma cópia profunda para modificação
          const newOtherCosts = JSON.parse(JSON.stringify(currentOtherCosts));
          
          const index = newOtherCosts.findIndex((c: OtherCost) => c.id === id);
          if (index === -1) return prevEst;
          
          const item = newOtherCosts[index];
          
          // 3. Atualiza o campo
          if (field === 'cost') {
              // Para campos numéricos, converte o valor
              item[field] = parseFloat(value) || 0;
          } else {
              // Para campos de texto (name)
              item[field] = value;
          }
          
          // 4. Recalcula os totais
          const newTotals = recalculateTotals(prevEst.menuItems, newOtherCosts, prevEst.totals.laborDetails || [], taxRate);
          
          // 5. Retorna o novo estado completo
          return {
              ...prevEst, 
              totals: {
                  ...prevEst.totals,
                  ...newTotals,
                  otherCosts: newOtherCosts, // Garante que a lista de custos atualizada está no objeto totals
              }
          };
      }, addToHistory);
  }, [recalculateTotals, taxRate, setEstimate]); // Dependências estáveis
  
  const handleAddOtherCost = () => {
      setEstimate(prevEst => {
          const newOtherCosts = JSON.parse(JSON.stringify(prevEst.totals.otherCosts || []));
          newOtherCosts.push({ 
              id: `other-${Date.now()}-${Math.random()}`, // ID ÚNICO
              name: 'Novo Custo', 
              cost: 0 
          });
          const newTotals = recalculateTotals(prevEst.menuItems, newOtherCosts, prevEst.totals.laborDetails || [], taxRate);
          // Adiciona ao histórico (padrão: true)
          return {...prevEst, totals: newTotals };
      });
  };
  
  const handleRemoveOtherCost = (id: string) => {
      setEstimate(prevEst => {
          const currentOtherCosts = prevEst.totals.otherCosts || [];
          const newOtherCosts = currentOtherCosts.filter(c => c.id !== id);
          const newTotals = recalculateTotals(prevEst.menuItems, newOtherCosts, prevEst.totals.laborDetails || [], taxRate);
          // Adiciona ao histórico (padrão: true)
          return {...prevEst, totals: newTotals };
      });
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
          const newTotals = recalculateTotals(newMenuItems, estimate.totals.otherCosts || [], estimate.totals.laborDetails || [], taxRate);
          
          // Adiciona ao histórico (padrão: true)
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
  const handleStructuredPremiseChange = (id: string, field: keyof Omit<StructuredPremise, 'id'>, value: string | number, addToHistory: boolean = false) => {
      let newAverages: StructuredPremise[] = [];
      
      // 1. Atualiza o estado local estruturado das premissas
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
      
      // 2. Calcula o novo estado do Estimate (usando a forma funcional)
      setEstimate(prevEst => {
          const serializedAverages = serializePremises(newAverages);
          
          // 3. Recalcula as quantidades dos ingredientes
          const updatedMenuItems = prevEst.menuItems.map(menuItem => ({
              ...menuItem,
              ingredients: menuItem.ingredients.map(ingredient => {
                  const premise = newAverages.find(p => 
                      ingredient.name.toLowerCase().includes(p.item.toLowerCase()) && p.quantity > 0
                  );
                  
                  if (premise) {
                      // Se a premissa for encontrada, recalcula a quantidade total (qty)
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
          
          // 4. Recalcula os totais financeiros com os novos ingredientes
          const newTotals = recalculateTotals(updatedMenuItems, prevEst.totals.otherCosts || [], prevEst.totals.laborDetails || [], taxRate);
          
          return {
              ...prevEst,
              consumptionAverages: serializedAverages,
              menuItems: updatedMenuItems,
              totals: newTotals,
          };
      }, addToHistory);
  };

  const handleSavePremises = () => {
      // A lógica de atualização do estimate já está em handleStructuredPremiseChange
      // Aqui apenas desativamos o modo de edição e adicionamos o estado final ao histórico.
      setIsPremiseEditing(false);
      setEstimate(estimate, true); // Força a adição do estado atual ao histórico
  };

  const handleAddStructuredPremise = () => {
      const newPremise: StructuredPremise = {
          id: `premise-${Date.now()}-${Math.random()}`,
          item: 'Novo Item',
          quantity: 100,
          unit: 'g',
      };
      
      setStructuredAverages(prev => {
          const newAverages = [...prev, newPremise];
          // Adiciona ao histórico (padrão: true)
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
          // Adiciona ao histórico (padrão: true)
          setEstimate(prevEst => ({
              ...prevEst,
              consumptionAverages: serializePremises(newAverages),
          }));
          return newAverages;
      });
  };
  // -----------------------------------------
  
  // Handler para edição do tipo de evento
  const handleEventTypeChange = (value: string) => {
      // Atualiza o estado sem adicionar ao histórico (addToHistory: false)
      setEstimate({ ...estimate, eventType: value }, false);
  };
  
  // --- Handlers para as partes da data ---
  const handleDatePartChange = (part: keyof DateParts, value: string) => {
      // Permite apenas números e limita o tamanho
      const numericValue = value.replace(/[^0-9]/g, '');
      
      setDateParts(prev => {
          const newParts = {
              ...prev,
              [part]: numericValue.slice(0, part === 'year' ? 4 : 2)
          };
          
          // Tenta combinar e atualizar o estimate imediatamente (para que o undo/redo funcione)
          const day = newParts.day.padStart(2, '0');
          const month = newParts.month.padStart(2, '0');
          const year = newParts.year.padStart(4, '0');
          
          let newDateString = '';
          
          if (day.length === 2 && month.length === 2 && year.length === 4) {
              newDateString = `${year}-${month}-${day}`;
          } else if (newParts.day === '' && newParts.month === '' && newParts.year === '') {
              newDateString = '';
          }
          
          // Atualiza o estimate apenas se a string final for válida ou vazia
          if (newDateString !== (estimate.eventDate || '')) {
              // Atualiza o estado sem adicionar ao histórico (addToHistory: false)
              setEstimate({ ...estimate, eventDate: newDateString }, false);
          }
          
          return newParts;
      });
  };
  
  // Handler para limpar a data do evento
  const handleClearEventDate = () => {
      setDateParts({ day: '', month: '', year: '' });
      // Adiciona ao histórico (padrão: true)
      setEstimate({ ...estimate, eventDate: '' });
  };
  
  // Handler para mudança da taxa de imposto
  const handleTaxRateChange = (value: string) => {
      const newRate = parseFloat(value) || 0;
      setTaxRate(newRate);
      
      // Recalcula os totais imediatamente (sem adicionar ao histórico)
      setEstimate(prevEst => {
          const newTotals = recalculateTotals(prevEst.menuItems, prevEst.totals.otherCosts || [], prevEst.totals.laborDetails || [], newRate);
          return { ...prevEst, totals: newTotals };
      }, false);
  };
  
  // Handler para salvar a taxa de imposto no histórico (onBlur)
  const handleTaxRateBlur = () => {
      // Força a adição do estado atual ao histórico
      setEstimate(estimate, true);
  };


  const handleSaveEstimate = async () => {
      setIsSaving(true);
      const toastId = toast.loading('Salvando orçamento...');
      
      // Garante que a data atual (que está no estimate.eventDate) e o preço sugerido estão corretos
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
          
          // To ensure the local state reflects the saved data immediately:
          // Adiciona ao histórico (padrão: true)
          setEstimate(savedEstimate);
          
          onEstimateSaved(); // Notify App.tsx to reload the list
          
      } catch (e: any) {
          console.error("Save error:", e);
          toast.error(e.message || 'Falha ao salvar o orçamento. Verifique sua autenticação.', { id: toastId });
      } finally {
          setIsSaving(false);
      }
  };
  
  /**
   * Gera e baixa o arquivo CSV detalhado do orçamento.
   */
  const handleExportCSV = () => {
      setIsExporting(true);
      const toastId = toast.loading('Gerando CSV...');
      
      const SEPARATOR = ';';
      const DATE_CREATED = new Date(estimate.createdAt).toLocaleDateString('pt-BR');
      
      // Função auxiliar para formatar números para CSV (usando ponto como separador decimal)
      const formatNumber = (value: number) => (value || 0).toFixed(2).replace('.', ',');

      const headers = [
          "Descrição do Item", 
          "Quantidade", 
          "Unidade", 
          "Custo Unitário (R$)", 
          "Custo Total (R$)", 
          "Categoria", 
          "Data de Criação"
      ];
      
      const rows: string[][] = [];

      // 1. Itens do Menu (Ingredientes)
      estimate.menuItems.forEach(menuItem => {
          menuItem.ingredients.forEach(item => {
              rows.push([
                  item.name,
                  formatNumber(item.qty),
                  item.unit,
                  formatNumber(item.unitCost),
                  formatNumber(item.totalCost),
                  `Ingrediente: ${menuItem.name}`,
                  DATE_CREATED
              ]);
          });
      });

      // 2. Mão de Obra
      (updatedTotals.laborDetails || []).forEach(detail => {
          rows.push([
              detail.role,
              detail.count.toString(),
              'Diária/Unidade',
              formatNumber(detail.costPerUnit),
              formatNumber(detail.totalCost),
              'Mão de Obra',
              DATE_CREATED
          ]);
      });

      // 3. Outros Custos
      (updatedTotals.otherCosts || []).forEach(cost => {
          rows.push([
              cost.name,
              '1', // Quantidade fixa 1 para custos fixos
              'Unidade',
              formatNumber(cost.cost),
              formatNumber(cost.cost),
              'Outros Custos',
              DATE_CREATED
          ]);
      });
      
      // 4. Resumo (Custo Total e Preço Sugerido)
      rows.push([
          "CUSTO TOTAL (Incluindo Impostos)",
          '1',
          'Total',
          formatNumber(updatedTotals.totalCost),
          formatNumber(updatedTotals.totalCost),
          'Resumo',
          DATE_CREATED
      ]);
      rows.push([
          "PREÇO SUGERIDO (Margem de " + margin + "%)",
          '1',
          'Total',
          formatNumber(updatedTotals.suggestedPrice),
          formatNumber(updatedTotals.suggestedPrice),
          'Resumo',
          DATE_CREATED
      ]);


      const csvContent = [headers, ...rows]
          .map(e => e.map(cell => `"${cell.replace(/"/g, '""')}"`).join(SEPARATOR)) // Envolve células em aspas e usa ;
          .join("\n");

      // Adiciona o BOM (Byte Order Mark) para garantir que caracteres especiais (acentos) funcionem no Excel
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "orcamento_buffet.csv";
      link.click();
      
      toast.success('CSV gerado com sucesso!', { id: toastId });
      setIsExporting(false);
  };


  const updatedTotals = useMemo(() => {
    // Garante que estimate.totals existe e tem as propriedades necessárias para o cálculo
    const safeTotals = estimate.totals || { otherCosts: [], laborDetails: [] };
    
    // Recalcula os totais usando a taxa de imposto atual
    const recalculated = recalculateTotals(
        estimate.menuItems, 
        safeTotals.otherCosts || [], 
        safeTotals.laborDetails || [], 
        taxRate
    );
    
    const totalCost = recalculated.totalCost;
    const suggestedPrice = totalCost * (1 + margin / 100);
    return { ...recalculated, suggestedPrice };
  }, [
      estimate.menuItems, 
      // Usando fallback no array de dependências para evitar o erro de leitura de undefined
      estimate.totals?.otherCosts || [], 
      estimate.totals?.laborDetails || [], 
      margin, 
      taxRate, 
      recalculateTotals
  ]);
  
  const kitchenStaffCost = getKitchenStaffCost(updatedTotals.laborDetails);

  // Componente auxiliar para renderizar o Resumo Financeiro (usado tanto na tela quanto no PDF)
  const FinancialSummary = () => {
    // Verificação de segurança extra
    if (!updatedTotals) {
        return null;
    }
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 border-b pb-3 mb-4">Resumo Financeiro</h3>
            
            <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Custo Ingredientes:</span> <span className="font-medium">{formatCurrency(updatedTotals.ingredients)}</span></div>
                
                {/* Custo de Produção Expandível */}
                {updatedTotals.productionCost !== undefined && (
                    <div 
                        className={`p-1 -m-1 rounded transition ${isExporting ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'}`}
                        onClick={() => !isExporting && setIsProductionExpanded(!isProductionExpanded)}
                        aria-expanded={isProductionExpanded}
                    >
                        <div className="flex justify-between">
                            <span className="text-slate-800 font-semibold">Custo Produção:</span>
                            <span className="font-bold flex items-center text-slate-800">
                                {formatCurrency(updatedTotals.productionCost)}
                                {!isExporting && <ChevronDown className={`w-4 h-4 ml-2 text-slate-400 transition-transform duration-200 ${isProductionExpanded ? 'rotate-180' : ''}`} />}
                            </span>
                        </div>
                    </div>
                )}
                {/* Conteúdo do Custo de Produção. Renderizado condicionalmente, mas forçado a aparecer no PDF */}
                {(isProductionExpanded || isExporting) && updatedTotals.productionCost !== undefined && (
                    <div className="pl-4 mt-2 space-y-1 border-l-2 border-slate-200 bg-slate-50 p-2 rounded">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Ingredientes:</span>
                            <span className="font-mono">{formatCurrency(updatedTotals.ingredients)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Equipe de Cozinha:</span>
                            <span className="font-mono">{formatCurrency(kitchenStaffCost)}</span>
                        </div>
                    </div>
                )}
                {/* Fim Custo de Produção Expandível */}

                <div 
                  className={`p-1 -m-1 rounded transition ${isExporting ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'}`}
                  onClick={() => !isExporting && setIsLaborExpanded(!isLaborExpanded)}
                  aria-expanded={isLaborExpanded}
                >
                  <div className="flex justify-between">
                    <span className="text-slate-500">Custo Mão de Obra Total:</span>
                    <span className="font-medium flex items-center">
                      {formatCurrency(updatedTotals.labor)}
                      {/* Verifica se laborDetails existe antes de verificar o length */}
                      {((updatedTotals.laborDetails || []).length > 0 && !isExporting) && (
                        <ChevronDown className={`w-4 h-4 ml-2 text-slate-400 transition-transform duration-200 ${isLaborExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </span>
                  </div>
                </div>
                {/* Conteúdo da Mão de Obra. Garante que laborDetails é um array vazio se for undefined/null */}
                {(isLaborExpanded || isExporting) && (updatedTotals.laborDetails || []).length > 0 && (
                    <div className={`pl-4 mt-2 space-y-2 border-l-2 border-slate-200 ${isExporting ? 'bg-white' : ''}`}>
                      {(updatedTotals.laborDetails || []).map((detail) => (
                          <LaborDetailItem 
                              key={detail.id}
                              detail={detail}
                              isExporting={isExporting}
                              formatCurrency={formatCurrency}
                              onDetailChange={handleLaborDetailChange}
                              onRemove={handleRemoveLaborDetail}
                          />
                      ))}
                      {!isExporting && (
                          <button onClick={handleAddLaborDetail} className="mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center p-1 -ml-1">
                            <Plus className="w-3 h-3 mr-1" /> Adicionar Profissional
                          </button>
                      )}
                    </div>
                )}
                
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-600 mb-2">Outros Custos</h4>
                  {/* Corrigido: updatedTotals.otherCosts é garantido como objeto pelo useMemo, mas o fallback é bom */}
                  {(updatedTotals.otherCosts || []).map((cost) => (
                      <OtherCostItem
                          key={cost.id}
                          cost={cost}
                          isExporting={isExporting}
                          onCostChange={handleOtherCostChange}
                          onRemove={handleRemoveOtherCost}
                      />
                  ))}
                  {!isExporting && (
                      <button onClick={handleAddOtherCost} className="mt-2 text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center p-1 -ml-1">
                        <Plus className="w-3 h-3 mr-1" /> Adicionar Custo
                      </button>
                  )}
                </div>

                {/* Campo de Edição de Impostos */}
                <div className="flex justify-between pt-2 border-t border-slate-200 items-center">
                    <span className="text-slate-500">Impostos:</span>
                    <div className="flex items-center">
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={taxRate}
                            onChange={(e) => handleTaxRateChange(e.target.value)}
                            onBlur={handleTaxRateBlur}
                            className={`w-12 bg-transparent p-1 rounded border text-sm text-right ${isExporting ? 'border-transparent' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                            readOnly={isExporting}
                        />
                        <span className="text-slate-500 ml-1">%</span>
                        <span className="font-medium ml-3">{formatCurrency(updatedTotals.tax)}</span>
                    </div>
                </div>
            </div>

            <div className="my-4 border-t border-dashed"></div>
            
            <div className="flex justify-between text-lg font-bold p-3 bg-slate-100 rounded-lg">
                <span className="text-slate-800">CUSTO TOTAL:</span>
                <span className="text-red-600">{formatCurrency(updatedTotals.totalCost)}</span>
            </div>
            
            {!isExporting && (
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
            )}

            <div className="mt-4 flex justify-between text-2xl font-bold p-3 bg-green-100 text-green-800 rounded-lg">
                <span>Preço Sugerido:</span>
                <span>{formatCurrency(updatedTotals.suggestedPrice)}</span>
            </div>
             <div className="mt-1 text-right text-sm text-slate-500">
                 Lucro Bruto: {formatCurrency(updatedTotals.suggestedPrice - updatedTotals.totalCost)}
             </div>
             
             {!isExporting && (
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
             )}
        </div>
    );
  };


  return (
    <div className="container mx-auto p-0 sm:p-4"> {/* Adicionando padding responsivo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Coluna Principal (Conteúdo do PDF) */}
        <div className="lg:col-span-2 space-y-8" id="estimate-content">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg"> {/* Padding responsivo */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Detalhes do Orçamento</h2>
                      <div className="flex flex-wrap items-center space-x-2 text-slate-500 mt-1">
                          {/* Campo de Edição do Tipo de Evento */}
                          <input
                              type="text"
                              value={estimate.eventType}
                              onChange={(e) => handleEventTypeChange(e.target.value)}
                              onBlur={() => setEstimate(estimate, true)} // Adiciona ao histórico ao perder o foco
                              className="text-lg sm:text-xl font-bold text-slate-800 bg-transparent p-1 -ml-1 rounded border border-slate-200 focus:border-indigo-500 w-full sm:w-auto"
                          />
                          <span className="text-base sm:text-lg font-normal">para {estimate.guests} convidados.</span>
                      </div>
                      
                      {/* Campo de Edição da Data do Evento */}
                      <div className="mt-2 flex items-center space-x-2 text-sm text-slate-500">
                          <span className="font-medium">Data do Evento:</span>
                          <div className="relative flex items-center space-x-1">
                              {/* Input Dia */}
                              <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={dateParts.day}
                                  onChange={(e) => handleDatePartChange('day', e.target.value)}
                                  onBlur={() => setEstimate(estimate, true)} // Adiciona ao histórico ao perder o foco
                                  placeholder="DD"
                                  maxLength={2}
                                  className="w-10 bg-transparent p-1 rounded border border-slate-200 focus:border-indigo-500 text-sm text-center"
                              />
                              <span className="text-slate-500">/</span>
                              {/* Input Mês */}
                              <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={dateParts.month}
                                  onChange={(e) => handleDatePartChange('month', e.target.value)}
                                  onBlur={() => setEstimate(estimate, true)} // Adiciona ao histórico ao perder o foco
                                  placeholder="MM"
                                  maxLength={2}
                                  className="w-10 bg-transparent p-1 rounded border border-slate-200 focus:border-indigo-500 text-sm text-center"
                              />
                              <span className="text-slate-500">/</span>
                              {/* Input Ano */}
                              <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={dateParts.year}
                                  onChange={(e) => handleDatePartChange('year', e.target.value)}
                                  onBlur={() => setEstimate(estimate, true)} // Adiciona ao histórico ao perder o foco
                                  placeholder="AAAA"
                                  maxLength={4}
                                  className="w-16 bg-transparent p-1 rounded border border-slate-200 focus:border-indigo-500 text-sm text-center"
                              />
                              
                              {(dateParts.day || dateParts.month || dateParts.year) && (
                                  <button
                                      onClick={handleClearEventDate}
                                      className="absolute right-0 top-0 bottom-0 px-1 text-slate-500 hover:text-red-500 transition"
                                      title="Limpar Data"
                                  >
                                      <i className="fas fa-times text-xs"></i>
                                  </button>
                              )}
                          </div>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-4 sm:mt-0"> {/* Ajuste de margem para mobile */}
                        {/* Undo/Redo Buttons (Hidden during export) */}
                        {!isExporting && (
                            <>
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
                            </>
                        )}
                        
                        {/* Export CSV Button */}
                        <button 
                            onClick={handleExportCSV}
                            disabled={isExporting}
                            className="bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-200 transition flex items-center disabled:opacity-60 text-sm"
                        >
                          {isExporting ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                              <Download className="w-4 h-4 mr-2 text-green-500" />
                          )}
                          {isExporting ? 'Gerando CSV...' : 'Exportar CSV'}
                        </button>
                    </div>
                </div>
                
                {/* Editable Consumption Averages Section (Structured) */}
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg relative">
                    <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-sm text-indigo-800">Premissas de Consumo (por pessoa)</h4>
                        {!isExporting && (
                            <button 
                                onClick={() => setIsPremiseEditing(prev => !prev)}
                                className={`p-1 rounded transition-colors ${isPremiseEditing ? 'bg-indigo-200 text-indigo-800' : 'text-indigo-600 hover:bg-indigo-100'}`}
                                title={isPremiseEditing ? "Sair do modo de edição" : "Editar premissas"}
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    
                    <p className="text-xs text-indigo-700 mb-3 bg-indigo-100 p-2 rounded">
                        *Nota: Alterar as premissas aqui recalcula a **quantidade total** dos ingredientes correspondentes (ex: 'Carne' afeta 'Picanha' e 'Fraldinha').
                    </p>
                    
                    <div className="space-y-2">
                        {structuredAverages.map((p) => (
                            <div key={p.id} className="flex flex-wrap items-center gap-2 group"> {/* Usando flex-wrap e gap para mobile */}
                                {(isPremiseEditing || isExporting) ? (
                                    <input
                                        type="text"
                                        value={p.item}
                                        onChange={(e) => handleStructuredPremiseChange(p.id, 'item', e.target.value, false)}
                                        onBlur={(e) => handleStructuredPremiseChange(p.id, 'item', e.target.value, true)} // Salva no histórico
                                        placeholder="Item (ex: Carne)"
                                        className={`flex-1 min-w-[100px] p-2 rounded border text-sm text-slate-700 ${isExporting ? 'border-transparent' : 'bg-white border-indigo-300 focus:border-indigo-500'}`}
                                        readOnly={isExporting}
                                    />
                                ) : (
                                    <span className="flex-1 min-w-[100px] p-2 text-sm text-slate-700 truncate">{p.item}</span>
                                )}
                                
                                <div className="flex items-center space-x-1">
                                    {(isPremiseEditing || isExporting) ? (
                                        <input
                                            type="number"
                                            value={p.quantity}
                                            onChange={(e) => handleStructuredPremiseChange(p.id, 'quantity', e.target.value, false)}
                                            onBlur={(e) => handleStructuredPremiseChange(p.id, 'quantity', e.target.value, true)} // Salva no histórico
                                            placeholder="Qtde"
                                            className={`w-16 p-2 rounded border text-sm text-slate-700 text-right ${isExporting ? 'border-transparent' : 'bg-white border-indigo-300 focus:border-indigo-500'}`}
                                            readOnly={isExporting}
                                        />
                                    ) : (
                                        // Formatação para exibir o número com precisão, mas sem zeros desnecessários
                                        <span className="w-16 p-2 text-sm text-slate-700 text-right font-medium">
                                            {p.quantity.toFixed(2).replace(/\.?0+$/, '')}
                                        </span>
                                    )}
                                    
                                    {(isPremiseEditing || isExporting) ? (
                                        <select
                                            value={p.unit}
                                            onChange={(e) => handleStructuredPremiseChange(p.id, 'unit', e.target.value, false)}
                                            onBlur={(e) => handleStructuredPremiseChange(p.id, 'unit', e.target.value, true)} // Salva no histórico
                                            className={`w-16 p-2 rounded border text-sm text-slate-700 ${isExporting ? 'bg-transparent border-transparent appearance-none' : 'bg-white border-indigo-300 focus:border-indigo-500'}`}
                                            disabled={isExporting}
                                        >
                                            {commonUnits.map(unit => (
                                                <option key={unit} value={unit}>{unit}</option>
                                            ))}
                                            {!commonUnits.includes(p.unit) && p.unit && <option value={p.unit}>{p.unit}</option>}
                                        </select>
                                    ) : (
                                        <span className="w-16 p-2 text-sm text-slate-700">{p.unit}</span>
                                    )}
                                    
                                    <span className="text-sm text-slate-500 whitespace-nowrap">/ pessoa</span>
                                </div>
                                
                                {isPremiseEditing && !isExporting && (
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
                    
                    {isPremiseEditing && !isExporting && (
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
                      // Usamos o estado local expandedMenus para controlar a visualização na tela
                      const isExpanded = expandedMenus[menuItemIndex] || false;
                      return (
                        <div key={menuItemIndex} className="border border-slate-200 rounded-lg overflow-hidden">
                          <button 
                            onClick={() => toggleMenuExpansion(menuItemIndex)}
                            className={`flex justify-between items-center w-full p-4 bg-slate-50 hover:bg-slate-100 transition duration-150 ${isExporting ? 'cursor-default' : ''}`}
                            disabled={isExporting}
                          >
                            <h3 className="text-lg font-semibold text-slate-700">{menuItem.name}</h3>
                            {!isExporting && <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
                          </button>
                          
                          {/* O conteúdo é renderizado condicionalmente, mas será forçado a aparecer no PDF */}
                          {(isExpanded || isExporting) && (
                            <div className="p-2 sm:p-4 pt-2 bg-white">
                              {/* Adicionando overflow-x-auto para permitir rolagem horizontal em telas pequenas */}
                              <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-white">
                                      <tr>
                                        {/* Aumentando a largura da coluna Item */}
                                        <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[150px]">Item</th> 
                                        <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[60px]">Qtde.</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[80px]">Unidade</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[100px]">Custo Unit. (R$)</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[100px]">Custo Total</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-12">Ação</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                      {menuItem.ingredients.map((item, itemIndex) => (
                                        <tr key={itemIndex} className="hover:bg-slate-50">
                                          {/* Removendo whitespace-nowrap da célula e garantindo que o input quebre linha */}
                                          <td className="p-2">
                                            <input 
                                              type="text" 
                                              value={item.name} 
                                              onChange={(e) => handleItemChange(menuItemIndex, itemIndex, 'name', e.target.value)} 
                                              onBlur={() => setEstimate(estimate, true)} // Adiciona ao histórico ao perder o foco
                                              className={`w-full bg-transparent p-1 rounded border text-sm whitespace-normal ${isExporting ? 'border-transparent' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                                              readOnly={isExporting}
                                            />
                                          </td>
                                          <td className="p-2 whitespace-nowrap">
                                            <input 
                                              type="number" 
                                              value={item.qty} 
                                              onChange={(e) => handleItemChange(menuItemIndex, itemIndex, 'qty', e.target.value)} 
                                              onBlur={() => setEstimate(estimate, true)} // Adiciona ao histórico ao perder o foco
                                              className={`w-20 bg-transparent p-1 rounded border text-sm text-right ${isExporting ? 'border-transparent' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                                              readOnly={isExporting}
                                            />
                                          </td>
                                          <td className="p-2 whitespace-nowrap text-sm text-slate-500">
                                            <select
                                              value={item.unit}
                                              onChange={(e) => handleItemChange(menuItemIndex, itemIndex, 'unit', e.target.value)}
                                              onBlur={() => setEstimate(estimate, true)} // Mantendo onBlur para selects
                                              className={`w-20 p-1 rounded border text-sm ${isExporting ? 'bg-transparent border-transparent appearance-none' : 'bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                                              disabled={isExporting}
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
                                              onBlur={() => setEstimate(estimate, true)} // Adiciona ao histórico ao perder o foco
                                              className={`w-24 bg-transparent p-1 rounded border text-sm text-right ${isExporting ? 'border-transparent' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                                              readOnly={isExporting}
                                            />
                                          </td>
                                          <td className="p-2 whitespace-nowrap text-sm font-semibold text-slate-700">{formatCurrency(item.totalCost)}</td>
                                          <td className="p-2 whitespace-nowrap text-right">
                                            {!isExporting && (
                                                <button onClick={() => handleRemoveItem(menuItemIndex, itemIndex)} className="text-red-500 hover:text-red-700 p-1 rounded">
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {!isExporting && (
                                      <button onClick={() => handleAddItem(menuItemIndex)} className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm font-semibold flex items-center p-1">
                                        <Plus className="w-4 h-4 mr-1" /> Adicionar Ingrediente Manualmente
                                      </button>
                                  )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
                
                {/* Add Recipe Section (Hidden during export) */}
                {!isExporting && (
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
                )}
            </div>
            
            {/* Resumo Financeiro INCLUÍDO na área de conteúdo para exportação */}
            <div className="mt-8 lg:hidden"> {/* Mostra o resumo financeiro no fluxo principal em mobile */}
                <FinancialSummary />
            </div>
        </div>

        {/* Sidebar: Financial Summary (Apenas para visualização na tela) */}
        <div className="lg:col-span-1 hidden lg:block"> {/* Oculta em mobile, mostra em desktop */}
            <div className="sticky top-8">
                <FinancialSummary />
            </div>
        </div>

      </div>
    </div>
  );
};

export default EstimateResult;