import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { getVersion, getBuildTime } from './scripts/version-utils.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),

    // PWA plugin for service worker and manifest generation
    VitePWA({
      registerType: 'prompt', // Manual update prompt
      includeAssets: ['**/*.{png,svg,ico,wasm}'],
      manifest: {
        name: 'LENR Academy',
        short_name: 'LENR',
        description: 'Interactive tools for exploring Low Energy Nuclear Reactions and cold fusion transmutation pathways',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'any',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],

        // Increase maximum file size for sql-wasm.wasm (~44KB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB

        // Runtime caching strategies
        runtimeCaching: [
          {
            // Cache database files from S3 (network-first with cache fallback)
            urlPattern: /^https:\/\/db\.lenr\.academy\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'database-cache',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                maxEntries: 10,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache analytics and external scripts (network-first)
            urlPattern: /^https:\/\/(cloud\.umami\.is|.*\.sentry\.io)\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-scripts',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24, // 1 day
                maxEntries: 20,
              },
              networkTimeoutSeconds: 3,
            },
          },
        ],

        // Clean up old caches
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false, // Disable in development for faster HMR
      },
    }),

    // Sentry plugin for automatic source map upload
    // Only runs when SENTRY_AUTH_TOKEN is provided (production builds)
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Enable debug logging to help troubleshoot upload issues
      debug: true,

      // Specify the release name (uses git version)
      release: {
        name: getVersion(),
      },

      // Upload source maps but don't include them in the bundle
      sourcemaps: {
        // Match the build output directory structure
        assets: './dist/assets/**/*.js',
        ignore: ['node_modules/**'],
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },

      // Only upload in production builds when auth token is present
      disable: !process.env.SENTRY_AUTH_TOKEN,

      // Tell Sentry where your source files are hosted
      // This helps Sentry match source maps with incoming errors
      urlPrefix: '~/assets',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(getVersion()),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(getBuildTime()),
  },
  build: {
    // Generate source maps for production builds
    // This helps Sentry provide readable stack traces
    sourcemap: true,
  },
})
