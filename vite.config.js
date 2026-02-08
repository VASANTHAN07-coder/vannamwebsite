import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Use environment-aware base URL
  // Development: '/' for localhost
  // Production: '/vannamwebsite/' for GitHub Pages
  base: process.env.NODE_ENV === 'production' ? '/vannamwebsite/' : '/',

  plugins: [react()],

  server: {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    fs: {
      strict: false
    }
  },

  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})
