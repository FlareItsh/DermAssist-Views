export function resolveApiBase(configuredBase?: string): string {
  const fallback = 'http://localhost:8000/api'
  const rawBase = configuredBase?.trim() || fallback

  if (import.meta.client && typeof window !== 'undefined') {
    try {
      const url = new URL(rawBase)
      const currentHost = window.location.hostname

      if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
        if (
          url.hostname !== 'localhost' &&
          url.hostname !== '127.0.0.1' &&
          /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(url.hostname)
        ) {
          url.hostname = currentHost
          return url.toString().replace(/\/+$/, '')
        }
      } else {
        if (
          url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1' ||
          /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(url.hostname)
        ) {
          url.hostname = currentHost
          return url.toString().replace(/\/+$/, '')
        }
      }
      return url.toString().replace(/\/+$/, '')
    } catch {
      return rawBase.replace(/\/+$/, '')
    }
  }

  return rawBase.replace(/\/+$/, '')
}

export default resolveApiBase
