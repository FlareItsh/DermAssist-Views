import { BaseService } from '../BaseService'

export interface DoctorAvailabilityPayload {
  available_date: string
  start_time: string
  end_time: string
  is_available?: boolean | number
}

export class DoctorAvailabilityService extends BaseService {
  async listForDoctor(doctorUuid: string): Promise<any> {
    return await this.request(`/doctors/${doctorUuid}/availabilities`, 'GET')
  }

  async createForDoctor(doctorUuid: string, payload: DoctorAvailabilityPayload): Promise<any> {
    return await this.request(`/doctors/${doctorUuid}/availabilities`, 'POST', payload)
  }

  async delete(uuid: string): Promise<any> {
    return await this.request(`/availabilities/${uuid}`, 'DELETE')
  }

  async checkDoctor(doctorUuid: string, params: object = {}): Promise<any> {
    return await this.request(`/doctors/${doctorUuid}/availability-check`, 'GET', params)
  }
}

export const doctorAvailabilityService = new DoctorAvailabilityService()
