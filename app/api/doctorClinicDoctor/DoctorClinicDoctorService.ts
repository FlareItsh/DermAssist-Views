import { BaseService } from '../BaseService'

export interface SeatUsage {
  max_doctors: number | null
  used_seats: number
  available_seats: number | null
  can_add: boolean
}

export interface ClinicDoctorItem {
  pivot_id: number
  role: string
  status: string
  joined_at: string
  clinic: {
    id: number
    uuid: string
    name: string
  }
  doctor: {
    id: number
    uuid: string
    first_name: string
    middle_name?: string
    last_name: string
    full_name: string
    email: string
    prc_number?: string
    affiliation?: string
    avatar_path?: string
    account_status: string
  }
}

export interface OwnerInfo {
  id: number
  uuid: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  prc_number?: string
  affiliation?: string
  avatar_path?: string
  plan_name?: string
}

export interface SponsoringClinicInfo {
  id: number
  uuid: string
  name: string
  address?: string
  role: string
}

export interface CandidateDoctor {
  id: number
  uuid: string
  full_name: string
  email: string
  prc_number?: string
  affiliation?: string
  avatar_path?: string
}

export class DoctorClinicDoctorService extends BaseService {
  private resource = '/doctor/clinic-doctors'

  async getClinicDoctors(): Promise<{
    status: string
    is_owner: boolean
    owner: OwnerInfo | null
    sponsoring_clinic: SponsoringClinicInfo | null
    seat_usage: SeatUsage
    data: ClinicDoctorItem[]
  }> {
    return await this.request(this.resource, 'GET')
  }

  async searchDoctors(query: string): Promise<{ status: string; data: CandidateDoctor[] }> {
    return await this.request(`${this.resource}/search`, 'GET', { query })
  }

  async assignDoctor(payload: {
    clinic_id?: number
    clinic_uuid?: string
    doctor_id?: number
    doctor_uuid?: string
    email?: string
    role?: string
  }): Promise<any> {
    return await this.request(this.resource, 'POST', payload)
  }

  async removeDoctor(pivotId: number): Promise<any> {
    return await this.request(`${this.resource}/${pivotId}`, 'DELETE')
  }
}

export const doctorClinicDoctorService = new DoctorClinicDoctorService()
