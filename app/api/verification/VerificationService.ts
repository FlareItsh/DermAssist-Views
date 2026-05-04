import BaseService from '../BaseService'

export class VerificationService extends BaseService {
  private resource = '/verifications'

  async list(params: object = {}): Promise<any> {
    return await this.request(this.resource, 'GET', params)
  }

  async show(uuid: string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}`, 'GET')
  }

  async update(uuid: string, data: any): Promise<any> {
    return await this.request(`${this.resource}/${uuid}`, 'PUT', data)
  }
}

export const verificationService = new VerificationService()
