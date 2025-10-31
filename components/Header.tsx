
import React from 'react';
import { Logo } from '../constants';

interface HeaderProps {
  onLogoClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
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
            <span className="text-sm font-medium text-slate-500">Buffet XYZ</span>
            <img className="h-8 w-8 rounded-full" src="https://picsum.photos/100" alt="User Avatar" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
