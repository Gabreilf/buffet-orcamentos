import { useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';

// Estendendo o tipo User para incluir o perfil
interface UserWithProfile extends User {
  profile: {
    is_active: boolean;
    plan: string;
    // Adicione outros campos do perfil que você precisa
  } | null;
}

interface AuthState {
  session: Session | null;
  user: UserWithProfile | null;
  isLoading: boolean;
}

// Função auxiliar para buscar o perfil
const fetchUserProfile = async (user: User): Promise<UserWithProfile> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('is_active, plan')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error("Failed to fetch user profile:", error);
        return { ...user, profile: null };
    }
    
    return { ...user, profile: data };
};


export const useAuth = (): AuthState => {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    const handleSession = async (session: Session | null) => {
        if (session) {
            const userWithProfile = await fetchUserProfile(session.user);
            setAuthState({ session, user: userWithProfile, isLoading: false });
            console.log("LOG: Usuário autenticado. Status ativo:", userWithProfile.profile?.is_active);
        } else {
            setAuthState({ session: null, user: null, isLoading: false });
            console.log("LOG: Usuário deslogado.");
        }
    };

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Ignora eventos que não alteram o estado principal de login/logout
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
        
        handleSession(session);
      }
    );

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, []);

  return authState;
};