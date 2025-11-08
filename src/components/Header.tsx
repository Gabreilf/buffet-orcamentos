import React from 'react';
import { Logo } from '../constants';
import { supabase } from '../integrations/supabase/client';
import toast from 'react-hot-toast';
import { User } from 'lucide-react';

interface HeaderProps {
  onLogoClick: () => void;
  session: any; // Pass session data to conditionally show logout
  onProfileClick: () => void; // Nova prop para navegar para a página de perfil
  currentPlanName: string; // Nova prop para exibir o nome do plano
}

const Header: React.FC<HeaderProps> = ({ onLogoClick, session, onProfileClick, currentPlanName }) => {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Falha ao sair: ' + error.message);
    } else {
      toast.success('Você saiu com sucesso!');
    }
  };

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 relative">
          
          {/* Lado Esquerdo: Botão de Sair */}
          {session && (
            <div className="absolute left-4 sm:left-6 lg:left-8">
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-red-500 hover:text-red-700 transition py-2 px-3 rounded-lg hover:bg-red-50"
                title="Sair da Conta"
              >
                Sair
              </button>
            </div>
          )}
          
          {/* Logo e Título Centralizados */}
          <div 
            className="flex items-center cursor-pointer mx-auto"
            onClick={onLogoClick}
          >
            <Logo className="h-8 w-8 text-indigo-600" />
            <h1 className="ml-3 text-2xl font-bold text-slate-800 tracking-tight">
              Orça<span className="text-indigo-600">Buffet</span>
            </h1>
          </div>
          
          {/* Lado Direito: Plano e Botão de Perfil */}
          {session && (
            <div className="absolute right-4 sm:right-6 lg:right-8 flex items-center space-x-3">
              <span className="hidden sm:inline text-sm font-medium text-slate-600">
                Plano: <span className="font-bold text-indigo-600">{currentPlanName}</span>
              </span>
              <button
                onClick={onProfileClick}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
                title="Perfil e Planos"
              >
                <User className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;