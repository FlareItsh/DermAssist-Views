import { BaseService } from '../BaseService'

export class AppointmentService extends BaseService {
  private resource = '/appointments'

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

  async accept(uuid: string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/accept`, 'POST')
  }

  async reject(uuid: string, payload: object = {}): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/reject`, 'POST', payload)
  }

  async decline(uuid: string, payload: object = {}): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/decline`, 'POST', payload)
  }

  async cancel(uuid: string, payload: object = {}): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/cancel`, 'POST', payload)
  }

  async checkIn(uuid: string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/check-in`, 'POST')
  }

  async markNoShow(uuid: string, payload: object = {}): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/mark-no-show`, 'POST', payload)
  }

  async getEvents(uuid: string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/events`, 'GET')
  }

  async scheduleForPatient(payload: object): Promise<any> {
    return await this.request(`${this.resource}/schedule-for-patient`, 'POST', payload)
  }

  async proposeReschedule(uuid: string, payload: object): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/propose-reschedule`, 'POST', payload)
  }

  async acceptReschedule(uuid: string, payload: object = {}): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/accept-reschedule`, 'POST', payload)
  }

  async createRescheduleProposal(uuid: string, payload: object): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/reschedule-proposals`, 'POST', payload)
  }

  async acceptRescheduleProposal(uuid: string, proposalUuid: string): Promise<any> {
    return await this.request(
      `${this.resource}/${uuid}/reschedule-proposals/${proposalUuid}/accept`,
      'POST'
    )
  }

  async declineRescheduleProposal(
    uuid: string,
    proposalUuid: string,
    payload: object = {}
  ): Promise<any> {
    return await this.request(
      `${this.resource}/${uuid}/reschedule-proposals/${proposalUuid}/decline`,
      'POST',
      payload
    )
  }

  async withdrawRescheduleProposal(uuid: string, proposalUuid: string): Promise<any> {
    return await this.request(
      `${this.resource}/${uuid}/reschedule-proposals/${proposalUuid}/withdraw`,
      'POST'
    )
  }

  async restore(uuid: string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/restore`, 'POST')
  }

  async attachInClinicScan(uuid: string, diagnosisId: number | string): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/attach-in-clinic-scan`, 'POST', {
      diagnosis_id: diagnosisId
    })
  }

  async recordScanException(
    uuid: string,
    payload: { reason: string; category?: string }
  ): Promise<any> {
    return await this.request(`${this.resource}/${uuid}/scan-exception`, 'POST', payload)
  }
}

export const appointmentService = new AppointmentService()
