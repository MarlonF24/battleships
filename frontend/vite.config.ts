import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 5173,
  },
  build: {
    cssCodeSplit: true,
    assetsInlineLimit: 8192,
    sourcemap: true,
    minify: 'esbuild',
  },
  esbuild: {
    keepNames: true,
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx'],
  },
});