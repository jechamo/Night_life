import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { nativeCsp } from './scripts/native-csp.ts'

// Theme colour shown by the OS while the shell loads (Neon Noir background).
const SHELL_BACKGROUND = '#07060d'

/** Block 11: CSP meta tag for the native bundle (`vite build --mode native`). */
function nativeShell(): Plugin {
  const csp = nativeCsp(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'))
  return {
    name: 'nightlife-native-shell',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
        injectTo: 'head-prepend',
      },
    ],
  }
}

export default defineConfig(({ mode }) => {
  const native = mode === 'native'
  const appUrl = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url))).VITE_APP_URL ?? ''
  if (native && !appUrl.startsWith('https://'))
    // Provider return URLs and App Links need the public HTTPS origin (NATIVE.md).
    throw new Error('vite --mode native requires VITE_APP_URL=https://…')
  return {
    plugins: [
      react(),
      tailwindcss(),
      // The native binary is updated by the stores: no service worker or web manifest.
      native
        ? nativeShell()
        : VitePWA({
            registerType: 'autoUpdate',
            // Registration lives in the platform adapter; updates reload only on user action.
            injectRegister: false,
            includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
            manifest: {
              id: '/',
              name: 'Nightlife Connect',
              short_name: 'Nightlife',
              description: 'Tu noche, segura y conectada.',
              lang: 'es',
              dir: 'ltr',
              start_url: '/home',
              scope: '/',
              display: 'standalone',
              orientation: 'any',
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
              // Mapbox is lazy and only fetched after a reserved map load (ADR 0010).
              globIgnores: ['**/vendor-map-*', '**/MapboxMap-*'],
              navigateFallback: '/index.html',
              runtimeCaching: [],
              cleanupOutdatedCaches: true,
              navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/functions\//],
            },
            devOptions: { enabled: false },
          }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      outDir: native ? 'dist-native' : 'dist',
      target: 'es2022',
      // PRD 6.15 A02: no public source maps in production.
      sourcemap: false,
      rolldownOptions: {
        output: {
          // Stable vendors; the large Mapbox SDK stays outside initial loading/precache.
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
              { name: 'vendor-map', test: /node_modules[\\/]mapbox-gl[\\/]/ },
              // Block 11: Capacitor plugins load only inside the native shell.
              { name: 'vendor-native', test: /node_modules[\\/](@capacitor|@aparajita)[\\/]/ },
              { name: 'vendor-ui', test: /node_modules[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
