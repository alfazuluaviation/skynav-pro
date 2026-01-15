import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        '/geoserver': {
          target: 'https://geoaisweb.decea.mil.br',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon-192x192.png', 'icons/icon-512x512.png', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'SkyFPL - Planejador de Voo',
          short_name: 'SkyFPL',
          description: 'Planejador de voo para pilotos brasileiros com navegação aeronáutica',
          theme_color: '#0d1117',
          background_color: '#020617',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/icons/icon-144x144.png',
              sizes: '144x144',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/geoaisweb\.decea\.mil\.br\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'geoserver-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                }
              }
            }
          ]
        }
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
