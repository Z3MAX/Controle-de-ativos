import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          neon: ['@neondatabase/serverless'],
          xlsx: ['xlsx']
        },
      },
    },
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 3000,
    host: true
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'xlsx', 'lucide-react'],
    exclude: []
  },
  define: {
    global: 'globalThis',
  }
})
