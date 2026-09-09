import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

const isDev = process.env.NODE_ENV !== 'production'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-11-01',
  devtools: { enabled: isDev },
  app: {
    // The stylesheet has the `page-*` classes. `out-in` so the two pages never
    // overlap: they are full-width sections and a cross-fade of two of them
    // reads as a flicker.
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Votaciones SIPEU',
      htmlAttrs: { lang: 'es' },
      meta: [
        { name: 'robots', content: 'noindex, nofollow, noarchive' },
        { name: 'theme-color', content: '#0048a0' },
      ],
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: isDev ? ['localhost', '127.0.0.1', '.trycloudflare.com'] : undefined,
    },
    optimizeDeps: {
      include: ['better-auth/vue', 'zod'],
    },
  },
  alias: {
    '#db': resolve('./server/db'),
    '#server-utils': resolve('./server/utils'),
  },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@vueuse/nuxt'],

  icon: {
    provider: 'server',
    fallbackToApi: false,
    collections: ['lucide', 'simple-icons'],
    serverBundle: {
      collections: ['lucide', 'simple-icons'],
    },
  },

  nitro: {
    compressPublicAssets: true,
    alias: {
      '#db': resolve('./server/db'),
      '#server-utils': resolve('./server/utils'),
    },
    typescript: {
      tsConfig: {
        compilerOptions: {
          paths: {
            '#db': ['../server/db/index.ts'],
            '#db/*': ['../server/db/*'],
            '#server-utils/*': ['../server/utils/*'],
          },
        },
      },
    },
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/**': {
      headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
    },
    '/_nuxt/**': {
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    },
  },

  experimental: {
    payloadExtraction: false,
    renderJsonPayloads: true,
  },
})
