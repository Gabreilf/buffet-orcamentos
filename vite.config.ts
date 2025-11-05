import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Define a base path para a raiz do domínio, padrão para Vercel
      base: '/', 
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Injeta a chave da API Gemini como process.env.API_KEY para compatibilidade com o serviço
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // Injeta as chaves Supabase para o cliente (se não estiverem no .env.local, use as da Vercel)
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // Adicionando alias explícito para React para tentar forçar a resolução única
          'react': path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        }
      }
    };
});