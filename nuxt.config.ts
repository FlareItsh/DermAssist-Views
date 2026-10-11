import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'

const currentDir = dirname(fileURLToPath(import.meta.url))
const apiCandidates = [
  join(currentDir, '../api/storage/app/public'),
  join(currentDir, '../DermAssist-API/storage/app/public')
]
const apiStoragePath = apiCandidates.find(p => existsSync(p)) || apiCandidates[0]

// Dynamically extract the host from NUXT_PUBLIC_STORAGE_BASE so @nuxt/image
// always allows the configured backend domain (ngrok, localhost, LAN IP, etc.)
const storageBaseEnv = process.env.NUXT_PUBLIC_STORAGE_BASE ?? ''
const imageDomainsFromEnv: string[] = []
if (storageBaseEnv) {
  try {
    const { hostname } = new URL(storageBaseEnv)
    if (hostname) {
      imageDomainsFromEnv.push(hostname)
    }
  } catch {
    // ignore invalid URL
  }
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
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
      storageBase: '', // Overridden by NUXT_PUBLIC_STORAGE_BASE environment variable
      reverbKey: 'k2sz1zlx9d0xc6plrtoy',
      reverbHost: 'localhost',
      reverbPort: '8080',
      reverbScheme: 'http'
    }
  },
  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui', '@nuxt/fonts', '@nuxt/icon'],
  image: {
    // Allow the storage host (ngrok, localhost, LAN, etc.) through IPX
    domains: ['localhost', '127.0.0.1', ...imageDomainsFromEnv]
  },
  nitro: {
    publicAssets: [
      {
        dir: apiStoragePath,
        baseURL: '/storage'
      }
    ]
  },
  icon: {
    clientBundle: {
      scan: true,
      sizeLimitKb: 1024
    }
  }
})
