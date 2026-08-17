import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Use relative asset paths so the same build works on GitHub Pages,
// local previews and repositories with any name.
const base = process.env.VITE_BASE_PATH || './';

const pages = {
  index: resolve(__dirname, 'index.html'),
  dashboard: resolve(__dirname, 'dashboard.html'),
  analise: resolve(__dirname, 'analise.html'),
  resultados: resolve(__dirname, 'resultados.html'),
  resultadosR: resolve(__dirname, 'resultados-r.html'),
  bioinformatica: resolve(__dirname, 'bioinformatica.html'),
  sobre: resolve(__dirname, 'sobre.html'),
};

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: { input: pages },
  },
  optimizeDeps: { exclude: ['lucide-react'] },
});
