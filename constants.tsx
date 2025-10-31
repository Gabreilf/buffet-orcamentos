import React from 'react';
import { Estimate } from './types';

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
    <path d="M12 9.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"/>
  </svg>
);

export const mockEstimates: Estimate[] = [
  {
    estimateId: "est-0001",
    tenantId: "buffet-xyz",
    eventType: "Casamento",
    guests: 150,
    menuItems: [
        {
            name: "Churrasco Completo",
            ingredients: [
                { name: "Picanha", qty: 40, unit: "kg", unitCost: 75, totalCost: 3000 },
                { name: "Fraldinha", qty: 25, unit: "kg", unitCost: 45, totalCost: 1125 },
                { name: "Linguiça Toscana", qty: 15, unit: "kg", unitCost: 25, totalCost: 375 },
            ]
        },
        {
            name: "Mesa de Frios",
            ingredients: [
                { name: "Queijo Provolone", qty: 5, unit: "kg", unitCost: 60, totalCost: 300 },
                { name: "Salame Italiano", qty: 5, unit: "kg", unitCost: 80, totalCost: 400 },
            ]
        }
    ],
    totals: {
      ingredients: 7500,
      labor: 2050, // Added 250 for marketing
      laborDetails: [
        { role: "Cozinheiro Chefe", count: 1, costPerUnit: 400, totalCost: 400 },
        { role: "Auxiliar de Cozinha", count: 2, costPerUnit: 200, totalCost: 400 },
        { role: "Garçom", count: 5, costPerUnit: 150, totalCost: 750 },
        { role: "Copeira", count: 1, costPerUnit: 250, totalCost: 250 },
        { role: "Marketing de video e foto", count: 1, costPerUnit: 250, totalCost: 250 },
      ],
      productionCost: 7900, // ingredients + kitchen staff
      otherCosts: [
          { name: "Frete", cost: 400 }
      ],
      tax: 872,
      totalCost: 10822,
      suggestedPrice: 15150.80,
    },
    createdAt: "2024-07-28T10:00:00Z",
    status: "approved",
    consumptionAverages: [
        "Carne: 550g por pessoa",
        "Acompanhamentos: 300g por pessoa",
        "Bebidas não alcoólicas: 1L por pessoa",
        "Cerveja: 1.5L por pessoa"
    ]
  },
  {
    estimateId: "est-0002",
    tenantId: "buffet-xyz",
    eventType: "Aniversário Infantil",
    guests: 50,
    menuItems: [
        { name: "Salgadinhos", ingredients: [] },
        { name: "Bolo", ingredients: [] },
        { name: "Docinhos", ingredients: [] }
    ],
    totals: {
      ingredients: 800,
      labor: 400,
      otherCosts: [
          { name: "Frete", cost: 100 }
      ],
      tax: 104,
      totalCost: 1404,
      suggestedPrice: 1965.60,
    },
    createdAt: "2024-07-25T14:30:00Z",
    status: "sent",
  },
  {
    estimateId: "est-0003",
    tenantId: "buffet-xyz",
    eventType: "Evento Corporativo",
    guests: 200,
    menuItems: [
       { name: "Coffee Break", ingredients: [] },
       { name: "Almoço Executivo", ingredients: [] }
    ],
    totals: {
      ingredients: 12000,
      labor: 2500,
      otherCosts: [
          { name: "Frete", cost: 500 }
      ],
      tax: 1200,
      totalCost: 16200,
      suggestedPrice: 22680,
    },
    createdAt: "2024-07-22T09:00:00Z",
    status: "draft",
  },
];