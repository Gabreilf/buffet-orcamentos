import { supabase } from '../integrations/supabase/client';
import { Estimate } from '../types';

/**
 * Fetches all estimates belonging to the currently authenticated user.
 */
export async function fetchEstimates(): Promise<Estimate[]> {
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching estimates:', error);
    throw new Error('Failed to load estimates.');
  }

  // The data structure from Supabase matches the Estimate type, 
  // but we need to ensure the user_id is present for RLS checks.
  return data as Estimate[];
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

  // Mapeamento explícito dos campos para o schema do banco de dados
  const insertData = {
    user_id: user.id,
    event_type: estimate.eventType,
    guests: estimate.guests,
    status: estimate.status,
    menu_items: estimate.menuItems, // JSONB column
    totals: estimate.totals, // JSONB column
    consumption_averages: estimate.consumptionAverages, // JSONB column
  };

  const { data, error } = await supabase
    .from('estimates')
    .insert(insertData)
    .select()
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

  // Mapeamento explícito dos campos para o schema do banco de dados
  const updateData = {
    event_type: estimate.eventType,
    guests: estimate.guests,
    status: estimate.status,
    menu_items: estimate.menuItems,
    totals: estimate.totals,
    consumption_averages: estimate.consumptionAverages,
    // user_id não é atualizado, mas a RLS garante que apenas o dono possa atualizar
  };

  const { data, error } = await supabase
    .from('estimates')
    .update(updateData)
    .eq('id', estimate.estimateId)
    .select()
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
  };

  return updatedEstimate;
}