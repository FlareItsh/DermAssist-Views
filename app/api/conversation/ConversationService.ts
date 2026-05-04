import { BaseService } from '../BaseService'

export class ConversationService extends BaseService {
  private resource = '/conversations'

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

  async getMessages(uuid: string, params: object = {}): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/messages`, 'GET', params)
  }

  async sendMessage(uuid: string, message: string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/messages`, 'POST', { message })
  }
}

export const conversationService = new ConversationService()
