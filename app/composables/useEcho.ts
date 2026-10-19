import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

let echoInstance: Echo<'reverb'> | null = null

export const useEcho = () => {
  if (import.meta.server) {
    return {
      echo: null,
      getEcho: () => null,
      disconnectEcho: () => {},
      getSocketId: () => undefined
    }
  }

  const config = useRuntimeConfig()
  const token = useCookie('auth_token')
  const { deviceId } = useDeviceIdentifier()

  const getEcho = (): Echo<'reverb'> | null => {
    if (!token.value) {
      if (echoInstance) {
        echoInstance.disconnect()
        echoInstance = null
      }
      return null
    }

    if (echoInstance) {
      return echoInstance
    }

    // Set global Pusher for Echo compatibility
    if (typeof window !== 'undefined') {
      ;(window as any).Pusher = Pusher
    }

    let host = config.public.reverbHost || 'localhost'
    if (typeof window !== 'undefined') {
      const currentHost = window.location.hostname
      if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        if (
          !host ||
          host === 'localhost' ||
          host === '127.0.0.1' ||
          /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(host)
        ) {
          host = currentHost
        }
      } else if (
        host !== 'localhost' &&
        host !== '127.0.0.1' &&
        /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(host)
      ) {
        host = 'localhost'
      }
    }
    const port = Number(config.public.reverbPort) || 8080
    const scheme = config.public.reverbScheme || 'http'
    const key = config.public.reverbKey || 'k2sz1zlx9d0xc6plrtoy'

    const apiBase = resolveApiBase(config.public.apiBase)
    const authEndpoint = `${apiBase}/broadcasting/auth`

    echoInstance = new Echo({
      broadcaster: 'reverb',
      key,
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS: scheme === 'https',
      enabledTransports: ['ws', 'wss'],
      authEndpoint,
      auth: {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token.value}`,
          'X-Device-Id': deviceId.value || ''
        }
      }
    })

    return echoInstance
  }

  const disconnectEcho = () => {
    if (echoInstance) {
      echoInstance.disconnect()
      echoInstance = null
    }
  }

  // Watch for logout to disconnect cleanly
  if (import.meta.client) {
    watch(
      () => token.value,
      newToken => {
        if (!newToken && echoInstance) {
          disconnectEcho()
        }
      }
    )
  }

  const getSocketId = (): string | undefined => {
    if (import.meta.server || !echoInstance) return undefined
    try {
      return (echoInstance as any).socketId?.()
    } catch {
      return undefined
    }
  }

  return {
    echo: getEcho(),
    getEcho,
    disconnectEcho,
    getSocketId
  }
}
