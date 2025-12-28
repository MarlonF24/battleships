import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    
    // This ensures CSS is bundled into files instead of being inlined in index.html
    cssCodeSplit: false, 
    assetsInlineLimit: 0, // Prevents inlining small assets as base64
  },
  esbuild: {
    keepNames: true // Keep class and function names during minification
  }
});