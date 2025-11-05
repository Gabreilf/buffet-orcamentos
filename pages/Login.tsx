import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../src/integrations/supabase/client';

const Login: React.FC = () => {
  return (
    <div className="flex justify-center items-center min-h-[80vh] p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl border border-slate-200">
        <h2 className="text-3xl font-bold text-center text-slate-800 mb-6">Bem-vindo ao OrçaBuffet</h2>
        <Auth
          supabaseClient={supabase}
          providers={[]} // Desabilitando provedores sociais por enquanto
          // Adicionando a propriedade onlyThirdPartyProviders={false} para garantir que o email/senha seja a opção principal
          onlyThirdPartyProviders={false} 
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#4f46e5', // indigo-600
                  brandAccent: '#4338ca', // indigo-700
                },
              },
            },
          }}
          theme="light"
          localization={{
            variables: {
              sign_in: {
                email_label: 'Seu email',
                password_label: 'Sua senha',
                button_label: 'Entrar',
                social_provider_text: 'Entrar com {{provider}}',
                link_text: 'Já tem uma conta? Entre',
              },
              sign_up: {
                email_label: 'Seu email',
                password_label: 'Crie uma senha',
                button_label: 'Cadastrar',
                link_text: 'Não tem uma conta? Cadastre-se',
              },
              forgotten_password: {
                link_text: 'Esqueceu sua senha?',
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default Login;