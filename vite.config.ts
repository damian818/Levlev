import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'pwa-icon.svg', 'manifest.json'],
        manifest: {
          name: 'LevLev | Personal Finance with Heart',
          short_name: 'LevLev',
          description: 'Personal finance with heart. Multi-currency and inflation intelligence tracker with global live exchange rates, custom reporting currency, and financial forecasting.',
          theme_color: '#0a0b0d',
          background_color: '#0a0b0d',
          display: 'standalone',
          share_target: {
            action: '/',
            method: 'GET',
            params: {
              title: 'title',
              text: 'text',
              url: 'url'
            }
          },
          icons: [
            {
              src: '/pwa-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable'
            },
            {
              src: '/pwa-icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any'
            }
          ]
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/dolarapi\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'fx-rates-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/api\.argentinadatos\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'inflation-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
