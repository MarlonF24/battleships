import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    cssCodeSplit: true, // Enable CSS code splitting for better caching
    assetsInlineLimit: 8192, // Inline assets smaller than 8KB as base64
    sourcemap: true, // Generate source maps for easier debugging
    minify: 'esbuild', // Use esbuild for faster minification
  },
  esbuild: {
    keepNames: true // Keep class and function names during minification
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx'], // Ensure Vite resolves .tsx extensions
  },
});