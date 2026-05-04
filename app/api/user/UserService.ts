import { BaseService } from '../BaseService'

export class UserService extends BaseService {
  private resource = '/users'

  async list(params: object = {}): Promise<any> {
    return await this.request(this.resource, 'GET', params)
  }

  async create(payload: object): Promise<any> {
    return await this.request(this.resource, 'POST', payload)
  }

  async show(uuid: string, params: object = {}): Promise<any> {
    return await this.request(`${this.resource}/${uuid}`, 'GET', params)
  }

  async update(uuid: string, payload: object): Promise<any> {
    return await this.request(`${this.resource}/${uuid}`, 'PUT', payload)
  }

  async delete(uuid: string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}`, 'DELETE')
  }

  async restore(uuid: string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/restore`, 'POST')
  }

  useShow(uuid: string | (() => string), options: any = {}) {
    const url = typeof uuid === 'function' ? () => `${this.resource}/${uuid()}` : `${this.resource}/${uuid}`
    return this.useRequest(url, options)
  }
}

export const userService = new UserService()
