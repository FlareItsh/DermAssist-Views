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

  // Doctor-Created Patients
  async createDoctorPatient(payload: object): Promise<any> {
    return await this.request('/doctor/patients', 'POST', payload)
  }

  async listDoctorPatients(params: { page?: number; per_page?: number } = {}): Promise<any> {
    return await this.request('/doctor/patients', 'GET', params)
  }

  async enablePatient(uuid: string): Promise<any> {
    return await this.request(`/doctor/patients/${uuid}/enable`, 'POST')
  }

  async disablePatient(uuid: string): Promise<any> {
    return await this.request(`/doctor/patients/${uuid}/disable`, 'POST')
  }

  async deleteDoctorPatient(uuid: string): Promise<any> {
    return await this.request(`/doctor/patients/${uuid}`, 'DELETE')
  }

  async scheduleAccountAction(uuid: string, payload: object): Promise<any> {
    return await this.request(`/doctor/patients/${uuid}/schedule-action`, 'POST', payload)
  }

  async cancelScheduledAction(uuid: string): Promise<any> {
    return await this.request(`/doctor/patients/${uuid}/cancel-schedule`, 'DELETE')
  }

  async sendScanResult(patientUuid: string, diagnosisUuid: string): Promise<any> {
    return await this.request(`/doctor/patients/${patientUuid}/send-scan`, 'POST', { diagnosis_uuid: diagnosisUuid })
  }

  async scheduleAppointmentForPatient(patientUuid: string, payload: { scheduled_at: string; scheduled_end_at?: string; location: string; purpose: string }): Promise<any> {
    return await this.request(`/doctor/patients/${patientUuid}/schedule-appointment`, 'POST', payload)
  }

  useShow(uuid: string | (() => string), options: any = {}) {
    const url = typeof uuid === 'function' ? () => `${this.resource}/${uuid()}` : `${this.resource}/${uuid}`
    return this.useRequest(url, options)
  }
}

export const userService = new UserService()
