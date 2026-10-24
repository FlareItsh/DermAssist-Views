import { BaseService } from '../BaseService'

export interface MedicineVariantPayload {
  uuid?: string
  dosage: string
  unit: string
  default_frequency: string
}

export interface MedicinePayload {
  name: string
  description?: string | null
  variants: MedicineVariantPayload[]
}

export interface MedicineVariant {
  id?: number
  uuid: string
  medicine_id: number
  dosage: string
  unit: string
  default_frequency: string
  created_at?: string
  updated_at?: string
}

export interface Medicine {
  id?: number
  uuid: string
  doctor_id: number
  name: string
  description?: string | null
  variants: MedicineVariant[]
  created_at?: string
  updated_at?: string
}

export class MedicineService extends BaseService {
  protected resource = '/doctor/medicines'

  async list(params: object = {}): Promise<{ data: Medicine[] }> {
    return await this.request(this.resource, 'GET', params)
  }

  async get(uuid: string): Promise<{ data: Medicine }> {
    return await this.request(`${this.resource}/${uuid}`, 'GET')
  }

  async create(payload: MedicinePayload): Promise<{ message: string; data: Medicine }> {
    return await this.request(this.resource, 'POST', payload)
  }

  async update(
    uuid: string,
    payload: MedicinePayload
  ): Promise<{ message: string; data: Medicine }> {
    return await this.request(`${this.resource}/${uuid}`, 'PUT', payload)
  }

  async delete(uuid: string): Promise<{ message: string }> {
    return await this.request(`${this.resource}/${uuid}`, 'DELETE')
  }

  useList(params: any = {}, options: any = {}) {
    return this.useRequest<{ data: Medicine[] }>(this.resource, { ...options, query: params })
  }

  useShow(uuid: string | (() => string), options: any = {}) {
    const getUrl = () => {
      const id = typeof uuid === 'function' ? uuid() : uuid
      return `${this.resource}/${id}`
    }
    return this.useRequest<{ data: Medicine }>(getUrl, options)
  }
}

export const medicineService = new MedicineService()
