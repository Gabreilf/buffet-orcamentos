// Fix: Replaced component code with proper type definitions to resolve all import errors.
export interface CustomCost {
  id: string;
  name: string;
  cost: number;
}
export type CustomCosts = CustomCost[];


export interface EstimateItem {
  name: string;
  qty: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface MenuItemDetail {
  name: string;
  ingredients: EstimateItem[];
}

export interface OtherCost {
  name: string;
  cost: number;
}

export interface LaborDetail {
  role: string;
  count: number;
  costPerUnit: number;
  totalCost: number;
}

export interface EstimateTotals {
  ingredients: number;
  labor: number;
  laborDetails?: LaborDetail[];
  productionCost?: number;
  otherCosts: OtherCost[];
  tax: number;
  totalCost: number;
  suggestedPrice: number;
}

export interface Estimate {
  estimateId: string;
  tenantId: string;
  eventType: string;
  guests: number;
  menuItems: MenuItemDetail[];
  totals: EstimateTotals;
  createdAt: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  consumptionAverages?: string[];
  // Novos campos
  eventDate?: string; // Data do evento (ISO string ou YYYY-MM-DD)
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'cancelled'; // Status da entrega/envio
}