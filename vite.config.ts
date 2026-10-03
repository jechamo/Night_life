import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Theme colour shown by the OS while the shell loads (Neon Noir background).
const SHELL_BACKGROUND = '#07060d'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered from the bundle (src/platform/app-updates) so the CSP stays
      // `script-src 'self'` and the page reloads itself when a new version is live.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        id: '/',
        name: 'Nightlife Connect',
        short_name: 'Nightlife',
        description: 'Tu noche, segura y conectada.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: SHELL_BACKGROUND,
        theme_color: SHELL_BACKGROUND,
        categories: ['lifestyle', 'social', 'entertainment'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // PRD 3.1: the service worker caches ONLY the app shell. No runtime caching,
        // so API responses (personal or sensitive data) never reach the SW cache.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // PRD 6.15 A02: no public source maps in production.
    sourcemap: false,
    rolldownOptions: {
      output: {
        // Stable vendor chunks: better long-term caching and no chunk over 500 kB.
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
            },
            {
              name: 'vendor-motion',
              test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/,
            },
            {
              name: 'vendor-data',
              test: /node_modules[\\/](@tanstack|zod|i18next|react-i18next)[\\/]/,
            },
            { name: 'vendor-ui', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
})
