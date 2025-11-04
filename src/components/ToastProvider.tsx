import React from 'react';
import { Toaster } from 'react-hot-toast';

const ToastProvider: React.FC = () => {
  return <Toaster position="top-right" />;
};

export default ToastProvider;