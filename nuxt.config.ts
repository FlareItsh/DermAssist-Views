import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'

const currentDir = dirname(fileURLToPath(import.meta.url))
const apiCandidates = [
  join(currentDir, '../api/storage/app/public'),
  join(currentDir, '../DermAssist-API/storage/app/public')
]
const apiStoragePath = apiCandidates.find(p => existsSync(p))

// Dynamically extract hosts from all relevant environment variables so @nuxt/image
// always allows the configured backend domain (Vercel, Laravel Cloud, S3, ngrok, localhost, LAN IP, etc.)
const candidateEnvUrls = [
  process.env.NUXT_PUBLIC_STORAGE_BASE ?? '',
  process.env.NUXT_PUBLIC_BACKEND_URL ?? '',
  process.env.NUXT_PUBLIC_API_BASE ?? ''
]

const imageDomainsFromEnv: string[] = [
  'lh3.googleusercontent.com',
  'googleusercontent.com',
  'ui-avatars.com',
  'images.unsplash.com'
]

for (const rawUrl of candidateEnvUrls) {
  if (rawUrl) {
    try {
      const { hostname } = new URL(rawUrl)
      if (hostname && !imageDomainsFromEnv.includes(hostname)) {
        imageDomainsFromEnv.push(hostname)
      }
    } catch {
      // ignore invalid URL
    }
  }
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      meta: [
        { name: 'theme-color', content: '#0f172a' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/DALogo.png' },
        { rel: 'apple-touch-icon', href: '/icons/pwa-192x192.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' }
      ]
    }
  },
  experimental: {
    appManifest: false
  },
  routeRules: {
    '/Doctor/Scan': { ssr: false },
    '/Doctor/Scan/**': { ssr: false },
    '/Patient/Scan': { ssr: false },
    '/Patient/Scan/**': { ssr: false },
    '/doctor/scan': { ssr: false },
    '/doctor/scan/**': { ssr: false },
    '/patient/scan': { ssr: false },
    '/patient/scan/**': { ssr: false }
  },
  css: ['./app/assets/css/main.css', 'vue-sonner/style.css'],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['vue-sonner']
    }
  },
  runtimeConfig: {
    public: {
      apiBase: '', // Overridden by NUXT_PUBLIC_API_BASE environment variable
      backendUrl: '', // Overridden by NUXT_PUBLIC_BACKEND_URL environment variable
      storageBase: '', // Overridden by NUXT_PUBLIC_STORAGE_BASE environment variable
      reverbKey: 'k2sz1zlx9d0xc6plrtoy',
      reverbHost: 'localhost',
      reverbPort: '8080',
      reverbScheme: 'http'
    }
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@vercel/analytics',
    '@vite-pwa/nuxt'
  ],
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'DermAssist - Deep Learning Dermatology Platform',
      short_name: 'DermAssist',
      description: 'AI-Powered Skin Disease Diagnosis & Teleconsultation',
      theme_color: '#0f172a',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait-primary',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: '/icons/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icons/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icons/pwa-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: undefined,
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}']
    },
    client: {
      installPrompt: true
    },
    devOptions: {
      enabled: false,
      type: 'module'
    }
  },
  image: {
    // Allow the storage host (ngrok, localhost, LAN, etc.) through IPX
    domains: ['localhost', '127.0.0.1', ...imageDomainsFromEnv]
  },
  nitro: {
    ...(apiStoragePath
      ? {
          publicAssets: [
            {
              dir: apiStoragePath,
              baseURL: '/storage'
            }
          ]
        }
      : {})
  },
  icon: {
    clientBundle: {
      scan: true,
      sizeLimitKb: 1024
    }
  }
})
