export const useApi = <T>(url: string | (() => string), options: any = {}) => {
  const config = useRuntimeConfig()

  return useFetch(url, {
    ...options,
    baseURL: config.public.apiBase
  })
}

export const $api = <T>(url: string, options: any = {}) => {
  const config = useRuntimeConfig()

  return $fetch<T>(url, {
    ...options,
    baseURL: config.public.apiBase
  })
}
