import { resolveApiBase } from '~/utils/resolveApiBase'

export const useStorage = () => {
  const config = useRuntimeConfig()

  /**
   * Resolve the canonical base storage URL:
   * 1. Explicit `storageBase` (NUXT_PUBLIC_STORAGE_BASE)
   * 2. Derived from `backendUrl` (NUXT_PUBLIC_BACKEND_URL + '/storage')
   * 3. Derived from `apiBase` via `resolveApiBase` (minus '/api' + '/storage')
   * 4. Empty string fallback (routes to local relative '/storage')
   */
  const resolveBaseUrl = (): string => {
    const rawStorage = (config.public.storageBase as string)?.trim()
    if (rawStorage) {
      return rawStorage.replace(/\/+$/, '')
    }

    const rawBackend = (config.public.backendUrl as string)?.trim()
    if (rawBackend) {
      return `${rawBackend.replace(/\/+$/, '')}/storage`
    }

    const rawApi = resolveApiBase(config.public.apiBase as string)
    if (rawApi) {
      const root = rawApi.replace(/\/api\/?$/, '')
      if (root) {
        return `${root.replace(/\/+$/, '')}/storage`
      }
    }

    return ''
  }

  const defaultStorageBase = resolveBaseUrl()

  /**
   * Helper to construct a full, accessible storage URL from a relative path or legacy URL.
   * e.g. "avatars/photo.jpg" -> "https://api.laravel.cloud/storage/avatars/photo.jpg"
   */
  const getStorageUrl = (path: string | null | undefined): string => {
    if (!path || typeof path !== 'string') {
      return ''
    }

    let cleanPath = path.trim()
    if (!cleanPath) {
      return ''
    }

    // Handle full external URLs (Google avatars, UI-Avatars, Cloudflare R2, AWS S3, etc.)
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      // If pointing to external third-party service or public cloud CDN, return as-is
      if (
        !cleanPath.includes('localhost') &&
        !cleanPath.includes('127.0.0.1') &&
        !cleanPath.includes('192.168.') &&
        !cleanPath.includes('10.') &&
        !cleanPath.includes('DermAssist-API.test') &&
        !cleanPath.includes('ngrok')
      ) {
        return cleanPath
      }

      // If it's a legacy local or loopback URL stored in DB (e.g. from local seeder or ngrok)
      // Extract the relative path after '/storage/'
      const storageIndex = cleanPath.indexOf('/storage/')
      if (storageIndex !== -1) {
        cleanPath = cleanPath.substring(storageIndex + 9)
      } else {
        try {
          const urlObj = new URL(cleanPath)
          cleanPath = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname
        } catch {
          // ignore parsing error
        }
      }
    }

    // Clean leading slashes and redundant 'storage/' prefixes
    cleanPath = cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath
    if (cleanPath.startsWith('storage/')) {
      cleanPath = cleanPath.substring(8)
    }

    // If a base storage URL is resolved (from storageBase, backendUrl, or apiBase)
    if (defaultStorageBase) {
      let base = defaultStorageBase

      if (typeof window !== 'undefined') {
        const currentHost = window.location.hostname
        // Wi-Fi / LAN IP mobile testing ONLY:
        // When tester accesses the app from a phone on private Wi-Fi (e.g. 192.168.x.x or 10.x.x.x),
        // adjust localhost URLs to point to that local LAN IP.
        const isPrivateLan = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(currentHost)
        if (isPrivateLan) {
          try {
            const url = new URL(base)
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
              url.hostname = currentHost
              base = url.toString().replace(/\/+$/, '')
            }
          } catch {
            // ignore
          }
        }
      }

      return `${base}/${cleanPath}`
    }

    // Final fallback (local development without explicit backend env vars)
    return `/storage/${cleanPath}`
  }

  return {
    getStorageUrl
  }
}
