import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
const BACKEND_HOST = 'localhost:8080'; // Change to phone's IP (e.g. '192.168.1.5:8080') if testing with a physical device

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://${BACKEND_HOST}`,
        changeOrigin: true
      },
      '/ws': {
        target: `ws://${BACKEND_HOST}`,
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../assets/shell',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
})
