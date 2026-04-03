export const useApi = <T>(url: string | (() => string), options: any = {}) => {
  const config = useRuntimeConfig()
  const token = useCookie('auth_token')

  return useFetch(url, {
    ...options,
    baseURL: config.public.apiBase,
    headers: {
      ...options.headers,
      Authorization: token.value ? `Bearer ${token.value}` : ''
    }
  })
}

export const $api = <T>(url: string, options: any = {}) => {
  const config = useRuntimeConfig()
  const token = useCookie('auth_token')

  return $fetch<T>(url, {
    ...options,
    baseURL: config.public.apiBase,
    headers: {
      ...options.headers,
      Authorization: token.value ? `Bearer ${token.value}` : ''
    }
  })
}
