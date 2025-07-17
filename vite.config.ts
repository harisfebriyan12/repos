import { defineConfig, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const config: UserConfig = {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      hmr: {
        overlay: false
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            icons: ['lucide-react']
          }
        }
      },
      chunkSizeWarningLimit: 1000
    },
  };

  if (command === 'build') {
    config.base = '/haris/';
  }

  return config;
});