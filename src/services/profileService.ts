import { supabase } from '../integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    email: string | null;
    plan_type: string;
    query_count: number;
    query_limit: number | null;
    is_active: boolean;
    manual_override: boolean;
}

/**
 * Fetches the full profile data for the current user.
 */
export async function fetchProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, email, plan_type, query_count, query_limit, is_active, manual_override')
        .eq('id', userId)
        .single();

    if (error) {
        console.error("Error fetching profile:", error);
        throw new Error('Falha ao carregar o perfil.');
    }
    
    return data as Profile;
}

/**
 * Updates the user's profile data.
 */
export async function updateProfile(profileData: Partial<Profile>): Promise<Profile> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error('Usuário não autenticado. Não é possível atualizar o perfil.');
    }
    
    const updatePayload: Partial<Profile> = {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        avatar_url: profileData.avatar_url,
        // Outros campos como plan_type, query_limit, etc., não devem ser atualizados pelo cliente.
    };

    const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id)
        .select('id, first_name, last_name, avatar_url, email, plan_type, query_count, query_limit, is_active, manual_override')
        .single();

    if (error) {
        console.error('Error updating profile:', error);
        throw new Error('Falha ao atualizar o perfil: ' + error.message);
    }

    return data as Profile;
}