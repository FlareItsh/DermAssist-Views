import { BaseService } from '../BaseService'

export class DoctorSecretaryService extends BaseService {
  private resource = '/doctor/secretaries'

  async list(params: object = {}): Promise<any> {
    return await this.request(this.resource, 'GET', params)
  }

  async create(payload: {
    firstName: string
    middleName?: string
    lastName: string
    email: string
    password: string
  }): Promise<any> {
    return await this.request(this.resource, 'POST', payload)
  }

  async delete(uuid: string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}`, 'DELETE')
  }

  useList(params: any = {}, options: any = {}) {
    return this.useRequest<any>(this.resource, { ...options, query: params })
  }
}

export const doctorSecretaryService = new DoctorSecretaryService()
