import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'

const currentDir = dirname(fileURLToPath(import.meta.url))
// Corrected path: API project is DermAssist-API, not api
const apiStoragePath = join(currentDir, '../DermAssist-API/storage/app/public')

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
      storageBase: '' // Overridden by NUXT_PUBLIC_STORAGE_BASE environment variable
    }
  },
  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui', '@nuxt/fonts', '@nuxt/icon'],
  image: {
    // Allow the storage host (ngrok, localhost, LAN, etc.) through IPX
    domains: ['localhost', '127.0.0.1', ...imageDomainsFromEnv],
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
