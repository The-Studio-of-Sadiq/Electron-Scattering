import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // GitHub Pages serves the app under /<repo>/; set VITE_BASE for that build.
    base: process.env.VITE_BASE || '/',
    plugins: [react(), tailwindcss()],
    // The ELSEPA WebAssembly worker loads public/elsepa/elsepa.js via dynamic import().
    worker: { format: 'es' as const },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
  };
});
