import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@pages': resolve(__dirname, './src/pages'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@store': resolve(__dirname, './src/store'),
      '@utils': resolve(__dirname, './src/utils'),
      '@i18n': resolve(__dirname, './src/i18n'),
      '@lib': resolve(__dirname, './src/lib'),
      '@data': resolve(__dirname, './src/data'),
    },
  },

  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_WS_URL || 'ws://localhost:8000',
        ws: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/viem') || id.includes('node_modules/@wagmi')) return 'web3';
          if (id.includes('node_modules/@supabase')) return 'supabase';
          if (id.includes('node_modules/react-dom')) return 'vendor';
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-router/') || id.includes('node_modules/@remix-run')) return 'vendor';
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-is')) return 'vendor';
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/@radix-ui')) return 'ui';
          if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/@hookform') || id.includes('node_modules/zod')) return 'forms';
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/clsx') || id.includes('node_modules/zustand') || id.includes('node_modules/axios')) return 'utils';
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
