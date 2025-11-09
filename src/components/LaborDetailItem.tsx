import React from 'react';
import { Trash2 } from 'lucide-react';
import { LaborDetail } from '../types';

interface LaborDetailItemProps {
    detail: LaborDetail;
    isExporting: boolean;
    formatCurrency: (value: number) => string;
    onDetailChange: (id: string, field: keyof LaborDetail, value: string, addToHistory?: boolean) => void;
    onRemove: (id: string) => void;
}

const LaborDetailItem: React.FC<LaborDetailItemProps> = React.memo(({ detail, isExporting, formatCurrency, onDetailChange, onRemove }) => {
    return (
        <div className="flex items-center justify-between group py-1">
            {/* Role Input */}
            <input 
                type="text"
                value={detail.role}
                onChange={(e) => onDetailChange(detail.id, 'role', e.target.value, false)} // Atualiza o estado sem histórico
                onBlur={(e) => onDetailChange(detail.id, 'role', e.target.value, true)} // Salva no histórico ao perder o foco
                placeholder="Função"
                className={`text-slate-700 bg-transparent p-1 rounded border ${isExporting ? 'border-transparent' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'} w-2/5 text-sm`}
                readOnly={isExporting}
            />
            
            <div className="flex items-center space-x-1">
                {/* Count Input */}
                <input 
                    type="number"
                    value={detail.count}
                    onChange={(e) => onDetailChange(detail.id, 'count', e.target.value, false)}
                    onBlur={(e) => onDetailChange(detail.id, 'count', e.target.value, true)} 
                    className={`w-12 bg-transparent p-1 rounded border ${isExporting ? 'border-transparent' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'} text-sm text-right`}
                    readOnly={isExporting}
                />
                <span className="text-slate-500">x</span>
                
                {/* Cost Per Unit Input */}
                <span className="text-slate-500">R$</span>
                <input 
                    type="number"
                    step="0.01"
                    value={detail.costPerUnit}
                    onChange={(e) => onDetailChange(detail.id, 'costPerUnit', e.target.value, false)}
                    onBlur={(e) => onDetailChange(detail.id, 'costPerUnit', e.target.value, true)} 
                    className={`w-20 bg-transparent p-1 rounded border ${isExporting ? 'border-transparent' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'} text-sm text-right`}
                    readOnly={isExporting}
                />
            </div>
            
            {/* Total Cost Display */}
            <span className="font-mono text-sm w-20 text-right">{formatCurrency(detail.totalCost)}</span>
            
            {/* Remove Button (Hidden during export) */}
            {!isExporting && (
                <button onClick={() => onRemove(detail.id)} className="ml-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded">
                    <Trash2 className="w-3 h-3" />
                </button>
            )}
        </div>
    );
});

export default LaborDetailItem;