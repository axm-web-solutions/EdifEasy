/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png', 'brand/*.png'],
      manifest: {
        name: 'EdiFeasy - Administracion de Condominios',
        short_name: 'EdiFeasy',
        description:
          'Plataforma SaaS para la administracion de condominios, edificios y conjuntos residenciales',
        theme_color: '#365959',
        background_color: '#f5f7fb',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'es',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // pdf.js solo lo usa el super admin (alta desde el RUT): se baja bajo demanda.
        globIgnores: ['**/assets/pdf-*.js', '**/assets/pdf.worker*'],
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd'],
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
          // Dependencias pesadas que solo usa una pantalla: en su propio chunk
          // para que actualizarlas no invalide la cache del resto.
          map: ['leaflet'],
          three: ['three'],
          tour: ['driver.js'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Las pruebas de UI con modales de antd en jsdom superan 5 s cuando la suite
    // corre en paralelo en un equipo cargado; 15 s evita falsos fallos.
    testTimeout: 15_000,
  },
})
