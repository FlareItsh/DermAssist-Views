import { $api, useApi } from '~/composables/useApi'
export class BaseService {
  async request<T>(
    url: string,
    method: string,
    params: object = {},
    extraConfig: any = {}
  ): Promise<T> {
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
      const status = error?.response?.status || error?.statusCode || error?.status
      const message = error?.response?._data?.message || error?.data?.message || error?.message
      const thrownError: any = new Error(
        message ||
          (status === 500
            ? 'Server error. Please try again or contact the administrator.'
            : 'Something went wrong. Please try again.')
      )
      thrownError.status = status
      thrownError.statusCode = status
      thrownError.response = error?.response
      thrownError.data = error?.response?._data || error?.data
      throw thrownError
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
