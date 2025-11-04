import React from 'react';
import { Logo } from '../constants';
import { supabase } from '../src/integrations/supabase/client';
import toast from 'react-hot-toast';

interface HeaderProps {
  onLogoClick: () => void;
  session: any; // Pass session data to conditionally show logout
}

const Header: React.FC<HeaderProps> = ({ onLogoClick, session }) => {
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
        <div className="flex items-center justify-between h-16">
          <div 
            className="flex items-center cursor-pointer"
            onClick={onLogoClick}
          >
            <Logo className="h-8 w-8 text-indigo-600" />
            <h1 className="ml-3 text-2xl font-bold text-slate-800 tracking-tight">
              Orça<span className="text-indigo-600">Buffet</span>
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <span className="text-sm font-medium text-slate-500 hidden sm:inline">
                  {session.user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-red-500 hover:text-red-700 transition"
                >
                  Sair
                </button>
              </>
            ) : (
              <span className="text-sm font-medium text-slate-500">Buffet XYZ</span>
            )}
            <img className="h-8 w-8 rounded-full" src="https://picsum.photos/100" alt="User Avatar" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;