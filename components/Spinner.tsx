
import React from 'react';

interface SpinnerProps {
  message: string;
}

const Spinner: React.FC<SpinnerProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-xl text-center">
      <div className="w-16 h-16 border-4 border-t-4 border-t-indigo-500 border-gray-200 rounded-full animate-spin"></div>
      <p className="mt-4 text-lg font-semibold text-slate-700">{message}</p>
      <p className="mt-1 text-sm text-slate-500">Isso pode levar alguns segundos...</p>
    </div>
  );
};

export default Spinner;
