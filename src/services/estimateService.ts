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

  // Prepare data for insertion, mapping Estimate fields to DB columns
  const { totals, menuItems, consumptionAverages, ...rest } = estimate;
  
  const insertData = {
    ...rest,
    user_id: user.id,
    menu_items: menuItems, // JSONB column
    totals: totals, // JSONB column
    consumption_averages: consumptionAverages, // JSONB column
    // The DB will auto-generate 'id' and 'created_at'
  };

  const { data, error } = await supabase
    .from('estimates')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error saving new estimate:', error);
    throw new Error('Failed to save the new estimate.');
  }

  // Map DB response back to Estimate type
  const savedEstimate: Estimate = {
    estimateId: data.id,
    tenantId: 'buffet-xyz', // Placeholder, should be managed by profiles later
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

  // Prepare data for update
  const { estimateId, totals, menuItems, consumptionAverages, ...rest } = estimate;
  
  const updateData = {
    ...rest,
    menu_items: menuItems,
    totals: totals,
    consumption_averages: consumptionAverages,
    // user_id is implicitly checked by RLS policy
  };

  const { data, error } = await supabase
    .from('estimates')
    .update(updateData)
    .eq('id', estimateId)
    .select()
    .single();

  if (error) {
    console.error('Error updating estimate:', error);
    throw new Error('Failed to update the estimate.');
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