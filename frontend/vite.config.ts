import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: false, 
      filename: "stats.html",
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  server: {
    port: 5173,
  },
  build: {
    cssCodeSplit: true,
    assetsInlineLimit: 8192,
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return "vendor";
          }
        },
      },
    },
  },  
  esbuild: {
    keepNames: false,
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx'],
  },
});