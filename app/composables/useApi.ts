export const resolveApiBase = (configuredBase?: string): string => {
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

export const useApi = <T>(url: string | (() => string), options: any = {}) => {
  const config = useRuntimeConfig()
  const token = useCookie('auth_token')
  const { deviceId } = useDeviceIdentifier()
  const { getSocketId } = useEcho()
  const socketId = getSocketId()
  const apiBase = resolveApiBase(config.public.apiBase)

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': '1',
    'Bypass-Tunnel-Reminder': '1',
    'X-Device-Id': deviceId.value || '',
    ...options.headers,
    Authorization: token.value ? `Bearer ${token.value}` : ''
  }

  if (socketId) {
    headers['X-Socket-ID'] = socketId
  }

  return useFetch<T>(url, {
    ...options,
    baseURL: apiBase,
    headers
  })
}

export const $api = <T>(url: string, options: any = {}) => {
  const config = useRuntimeConfig()
  const token = useCookie('auth_token')
  const { deviceId } = useDeviceIdentifier()
  const { getSocketId } = useEcho()
  const socketId = getSocketId()
  const apiBase = resolveApiBase(config.public.apiBase)

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': '1',
    'Bypass-Tunnel-Reminder': '1',
    'X-Device-Id': deviceId.value || '',
    ...options.headers,
    Authorization: token.value ? `Bearer ${token.value}` : ''
  }

  if (socketId) {
    headers['X-Socket-ID'] = socketId
  }

  return $fetch<T>(url, {
    ...options,
    baseURL: apiBase,
    headers
  })
}
