import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: { noDiscovery: true, exclude: ['three'] },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
