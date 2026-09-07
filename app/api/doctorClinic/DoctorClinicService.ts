import { BaseService } from '../BaseService'

export interface DoctorClinic {
  id: number
  uuid: string
  owner_doctor_id: number
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  geo_latitude?: number | null
  geo_longitude?: number | null
  is_active: boolean
  is_owner?: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateClinicPayload {
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  geo_latitude?: number | null
  geo_longitude?: number | null
  is_active?: boolean
}

export class DoctorClinicService extends BaseService {
  async list(): Promise<{ data: DoctorClinic[] }> {
    return await this.request('/doctor/clinics', 'GET')
  }

  useList() {
    return this.useAsyncData<{ data: DoctorClinic[] }>('doctor-clinics', '/doctor/clinics')
  }

  async create(payload: CreateClinicPayload): Promise<any> {
    return await this.request('/doctor/clinics', 'POST', payload)
  }

  async update(uuid: string, payload: Partial<CreateClinicPayload>): Promise<any> {
    return await this.request(`/doctor/clinics/${uuid}`, 'PUT', payload)
  }

  async delete(uuid: string): Promise<any> {
    return await this.request(`/doctor/clinics/${uuid}`, 'DELETE')
  }
}

export const doctorClinicService = new DoctorClinicService()
