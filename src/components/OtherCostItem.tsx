import React from 'react';
import { Trash2 } from 'lucide-react';
import { OtherCost } from '../types';

interface OtherCostItemProps {
    cost: OtherCost;
    isExporting: boolean;
    onCostChange: (id: string, field: keyof OtherCost, value: string, addToHistory?: boolean) => void;
    onRemove: (id: string) => void;
}

const OtherCostItem: React.FC<OtherCostItemProps> = React.memo(({ cost, isExporting, onCostChange, onRemove }) => {
    return (
        <div className="flex justify-between items-center group py-1">
            {/* Name Input */}
            <input 
                key={cost.id + '-name'}
                type="text"
                value={cost.name}
                onChange={(e) => onCostChange(cost.id, 'name', e.target.value, false)} // Atualiza o estado sem histórico
                onBlur={(e) => onCostChange(cost.id, 'name', e.target.value, true)} // Salva no histórico ao perder o foco
                placeholder="Nome do Custo"
                className={`text-slate-500 bg-transparent p-1 rounded border ${isExporting ? 'border-transparent' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'} w-3/5 text-sm`}
                readOnly={isExporting}
            />
            <div className="flex items-center">
                <span className="text-slate-500 mr-1">R$</span>
                {/* Cost Input */}
                <input 
                    key={cost.id + '-cost'}
                    type="number"
                    step="0.01"
                    value={cost.cost}
                    onChange={(e) => onCostChange(cost.id, 'cost', e.target.value, false)}
                    onBlur={(e) => onCostChange(cost.id, 'cost', e.target.value, true)}
                    className={`font-medium bg-transparent p-1 rounded border ${isExporting ? 'border-transparent' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'} w-24 text-right text-sm`}
                    readOnly={isExporting}
                />
                {!isExporting && (
                    <button onClick={() => onRemove(cost.id)} className="ml-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded">
                        <Trash2 className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    );
});

export default OtherCostItem;