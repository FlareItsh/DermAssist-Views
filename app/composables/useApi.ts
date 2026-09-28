export const useApi = <T>(url: string | (() => string), options: any = {}) => {
  const config = useRuntimeConfig()
  const token = useCookie('auth_token')
  const { deviceId } = useDeviceIdentifier()

  return useFetch<T>(url, {
    ...options,
    baseURL: config.public.apiBase,
    headers: {
      Accept: 'application/json',
      'ngrok-skip-browser-warning': '1',
      'Bypass-Tunnel-Reminder': '1',
      'X-Device-Id': deviceId.value || '',
      ...options.headers,
      Authorization: token.value ? `Bearer ${token.value}` : ''
    }
  })
}

export const $api = <T>(url: string, options: any = {}) => {
  const config = useRuntimeConfig()
  const token = useCookie('auth_token')
  const { deviceId } = useDeviceIdentifier()

  return $fetch<T>(url, {
    ...options,
    baseURL: config.public.apiBase,
    headers: {
      Accept: 'application/json',
      'ngrok-skip-browser-warning': '1',
      'Bypass-Tunnel-Reminder': '1',
      'X-Device-Id': deviceId.value || '',
      ...options.headers,
      Authorization: token.value ? `Bearer ${token.value}` : ''
    }
  })
}
