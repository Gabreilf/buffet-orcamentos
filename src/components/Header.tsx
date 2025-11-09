import React from 'react';
import { Logo } from '../constants';
import { supabase } from '../integrations/supabase/client';
import toast from 'react-hot-toast';
import { User, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  onLogoClick: () => void;
  session: any; // Pass session data to conditionally show profile button
  onProfileClick: () => void; // Prop para navegar para a página de perfil
  currentPlanName: string; // Prop para exibir o nome do plano
  onBackClick?: () => void; // Novo prop para o botão de voltar
}

const Header: React.FC<HeaderProps> = ({ onLogoClick, session, onProfileClick, currentPlanName, onBackClick }) => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 relative">
          
          {/* Lado Esquerdo: Botão Voltar ou Espaçador */}
          <div className="w-16 sm:w-20 lg:w-24 flex items-center">
            {onBackClick ? (
              <button
                onClick={onBackClick}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              // Espaçador com largura suficiente para manter o alinhamento centralizado do logo
              <div className="w-9 h-9"></div> 
            )}
          </div>
          
          {/* Logo e Título Centralizados */}
          <div 
            className="flex items-center cursor-pointer mx-auto absolute left-1/2 transform -translate-x-1/2"
            onClick={onLogoClick}
          >
            <Logo className="h-8 w-8 text-indigo-600" />
            <h1 className="ml-3 text-2xl font-bold text-slate-800 tracking-tight hidden sm:block">
              Orça<span className="text-indigo-600">Buffet</span>
            </h1>
            <h1 className="ml-3 text-2xl font-bold text-slate-800 tracking-tight sm:hidden">
              Orça<span className="text-indigo-600">B</span>
            </h1>
          </div>
          
          {/* Lado Direito: Plano e Botão de Perfil */}
          {session && (
            <div className="w-16 sm:w-20 lg:w-24 flex justify-end items-center space-x-3">
              <span className="hidden lg:inline text-sm font-medium text-slate-600">
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