import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo_tazama.png', 'pwa-icons/*.png'],
      manifest: {
        name: 'Tazama',
        short_name: 'Tazama',
        description: 'Tazama - Watch and discover content',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/pwa-icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png' },
          { src: '/pwa-icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
          { src: '/pwa-icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/pwa-icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/pwa-icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/pwa-icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/pwa-icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // SPA: serve cached index.html for any navigation request when offline
        navigateFallback: '/index.html',
        // Don't intercept /offline.html or /api/* with the SPA fallback
        navigateFallbackDenylist: [/^\/offline\.html$/, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },

  theme: {
    extend: {
      fontFamily: {
        logo: ['"Space Grotesk"', 'sans-serif'],
        title: ['Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
})
