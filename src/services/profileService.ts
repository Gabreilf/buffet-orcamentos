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

/**
 * Uploads an avatar file to Supabase storage and returns the public URL.
 * Assumes a bucket named 'avatars' exists.
 */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}.${fileExt}`;
    const filePath = `${userId}/${fileName}`; // Ex: 'user_uuid/user_uuid.jpg'

    // 1. Upload the file
    const { error: uploadError } = await supabase.storage
        .from('avatars') // Assumindo que o bucket 'avatars' existe
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true, // Sobrescreve se já existir
        });

    if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw new Error('Falha ao fazer upload da imagem: ' + uploadError.message);
    }

    // 2. Get the public URL
    const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
        
    if (!data || !data.publicUrl) {
        throw new Error('Falha ao obter a URL pública da imagem.');
    }

    return data.publicUrl;
}