import { supabase } from '../integrations/supabase/client';
import { Estimate } from '../types';

/**
 * Fetches all estimates belonging to the currently authenticated user.
 */
export async function fetchEstimates(): Promise<Estimate[]> {
  const { data, error } = await supabase
    .from('estimates')
    .select('id, user_id, created_at, event_type, guests, status, menu_items, totals, consumption_averages, event_date, delivery_status')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching estimates:', error);
    throw new Error('Failed to load estimates.');
  }

  // Mapeia a resposta do DB para o tipo Estimate
  return data.map(item => ({
    estimateId: item.id,
    tenantId: 'buffet-xyz', // Placeholder
    createdAt: item.created_at,
    eventType: item.event_type,
    guests: item.guests,
    status: item.status,
    menuItems: item.menu_items,
    totals: item.totals,
    consumptionAverages: item.consumption_averages,
    eventDate: item.event_date, // Novo campo
    deliveryStatus: item.delivery_status, // Novo campo
  })) as Estimate[];
}

/**
 * Saves a new estimate to the database.
 * Assumes the Estimate object passed already contains all necessary fields 
 * (except for the auto-generated Supabase ID and user_id, which is retrieved from session).
 */
export async function saveNewEstimate(estimate: Omit<Estimate, 'estimateId' | 'tenantId' | 'createdAt'>): Promise<Estimate> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not authenticated. Cannot save estimate.');
  }
  
  // Helper para garantir que strings vazias sejam salvas como NULL no DB
  const getDbDate = (dateString: string | undefined) => {
      if (!dateString || dateString.trim() === '') {
          return null;
      }
      return dateString;
  };

  // Mapeamento explícito dos campos para o schema do banco de dados
  const insertData = {
    user_id: user.id,
    event_type: estimate.eventType,
    guests: estimate.guests,
    status: estimate.status,
    menu_items: estimate.menuItems, // JSONB column
    totals: estimate.totals, // JSONB column
    consumption_averages: estimate.consumptionAverages, // JSONB column
    event_date: getDbDate(estimate.eventDate), // Conversão para NULL se vazio
    delivery_status: estimate.deliveryStatus, // Novo campo
  };

  const { data, error } = await supabase
    .from('estimates')
    .insert(insertData)
    .select('id, created_at, event_type, guests, status, menu_items, totals, consumption_averages, event_date, delivery_status')
    .single();

  if (error) {
    console.error('Error saving new estimate:', error);
    // Lançamos o erro original para que o frontend possa exibir a mensagem de falha
    throw new Error('Failed to save the new estimate: ' + error.message);
  }

  // Mapeia a resposta do DB de volta para o tipo Estimate
  const savedEstimate: Estimate = {
    estimateId: data.id,
    tenantId: 'buffet-xyz', // Mantendo o placeholder
    createdAt: data.created_at,
    eventType: data.event_type,
    guests: data.guests,
    status: data.status,
    menuItems: data.menu_items,
    totals: data.totals,
    consumptionAverages: data.consumption_averages,
    eventDate: data.event_date, // Novo campo
    deliveryStatus: data.delivery_status, // Novo campo
  };

  return savedEstimate;
}

/**
 * Updates an existing estimate in the database.
 */
export async function updateEstimate(estimate: Estimate): Promise<Estimate> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not authenticated. Cannot update estimate.');
  }
  
  // Helper para garantir que strings vazias sejam salvas como NULL no DB
  const getDbDate = (dateString: string | undefined) => {
      if (!dateString || dateString.trim() === '') {
          return null;
      }
      return dateString;
  };

  // Mapeamento explícito dos campos para o schema do banco de dados
  const updateData = {
    event_type: estimate.eventType,
    guests: estimate.guests,
    status: estimate.status,
    menu_items: estimate.menuItems,
    totals: estimate.totals,
    consumption_averages: estimate.consumptionAverages,
    event_date: getDbDate(estimate.eventDate), // Conversão para NULL se vazio
    delivery_status: estimate.deliveryStatus, // Novo campo
    // user_id não é atualizado, mas a RLS garante que apenas o dono possa atualizar
  };

  const { data, error } = await supabase
    .from('estimates')
    .update(updateData)
    .eq('id', estimate.estimateId)
    .select('id, created_at, event_type, guests, status, menu_items, totals, consumption_averages, event_date, delivery_status')
    .single();

  if (error) {
    console.error('Error updating estimate:', error);
    throw new Error('Failed to update the estimate: ' + error.message);
  }

  // Map DB response back to Estimate type
  const updatedEstimate: Estimate = {
    estimateId: data.id,
    tenantId: 'buffet-xyz',
    createdAt: data.created_at,
    eventType: data.event_type,
    guests: data.guests,
    status: data.status,
    menuItems: data.menu_items,
    totals: data.totals,
    consumptionAverages: data.consumption_averages,
    eventDate: data.event_date, // Novo campo
    deliveryStatus: data.delivery_status, // Novo campo
  };

  return updatedEstimate;
}