import { BaseService } from '../BaseService'

export interface CandidateDiseaseItem {
  id: number
  uuid: string
  name: string
  slug: string
  category: string
  description?: string | null
  badge?: string | null
  icon?: string | null
  is_default: boolean
  is_core?: boolean
  created_at?: string
  updated_at?: string
}

export class CandidateDiseaseService extends BaseService {
  private resource = '/candidate-diseases'

  async list(params: object = {}): Promise<any> {
    return await this.request(this.resource, 'GET', params)
  }

  async create(payload: {
    name: string
    category?: string
    description?: string
    badge?: string
    icon?: string
  }): Promise<any> {
    return await this.request(this.resource, 'POST', payload)
  }

  async delete(uuid: string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}`, 'DELETE')
  }

  useList(params: object = {}, options: any = {}) {
    return this.useRequest(this.resource, { ...options, query: params })
  }
}

export const candidateDiseaseService = new CandidateDiseaseService()
