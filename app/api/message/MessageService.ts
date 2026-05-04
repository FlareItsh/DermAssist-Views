import { BaseService } from '../BaseService'

export class MessageService extends BaseService {
  private resource = '/messages'

  async list(params: object = {}): Promise<any> {
    return await this.request(this.resource, 'GET', params)
  }

  async create(payload: object): Promise<any> {
    return await this.request(this.resource, 'POST', payload)
  }

  async show(uuid: string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}`, 'GET')
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
}

export const messageService = new MessageService()
