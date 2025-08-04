import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    // Otimizações para evitar problemas de build
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 3000,
    open: true
  },
  // Configurações para variáveis de ambiente
  define: {
    'process.env': process.env
  },
  // Otimizações para dependências
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['@neondatabase/serverless']
  }
})
