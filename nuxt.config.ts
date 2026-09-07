import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'

const currentDir = dirname(fileURLToPath(import.meta.url))
const apiStoragePath = join(currentDir, '../api/storage/app/public')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['./app/assets/css/main.css', 'vue-sonner/style.css'],
  vite: {
    plugins: [tailwindcss()]
  },
  runtimeConfig: {
    public: {
      apiBase: '', // Overridden by NUXT_PUBLIC_API_BASE environment variable
      storageBase: '' // Overridden by NUXT_PUBLIC_STORAGE_BASE environment variable
    }
  },
  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui', '@nuxt/fonts', '@nuxt/icon'],
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
