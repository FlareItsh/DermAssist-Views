import { $api, useApi } from '~/composables/useApi'
export class BaseService {
  async request<T>(url: string, method: string, params: object = {}, extraConfig: any = {}): Promise<T> {
    const config: any = {
      method,
      ...extraConfig
    }

    if (method.toUpperCase() === 'GET') {
      config.query = params
    } else {
      config.body = params
    }

    try {
      return await $api<T>(url, config)
    } catch (error: any) {
      const status = error?.response?.status
      const message = error?.response?._data?.message || error?.data?.message || error?.message

      switch (status) {
        case 400:
        case 401:
        case 404:
        case 422:
        case 429:
          throw new Error(message || 'Validation or Request Error')
        case 500:
          throw new Error('Server error. Please try again or contact the administrator.')
        default:
          throw new Error(message || 'Something went wrong. Please try again.')
      }
    }
  }

  useRequest<T>(url: string | (() => string), options: any = {}) {
    return useApi<T>(url, options)
  }

  useList<T>(params: any = {}, options: any = {}) {
    return this.useRequest<T>((this as any).resource, { ...options, query: params })
  }

  useShow<T>(uuid: string | (() => string), options: any = {}) {
    const getUrl = () => {
      const id = typeof uuid === 'function' ? uuid() : uuid
      return `${(this as any).resource}/${id}`
    }
    return this.useRequest<T>(getUrl, options)
  }
}

export default BaseService
