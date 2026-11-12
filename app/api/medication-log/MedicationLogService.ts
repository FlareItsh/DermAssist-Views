import BaseService from '../BaseService'

export type MedicationAdherenceStatus = 'taken' | 'dismissed' | 'pending'

export interface MedicationLogRecord {
  id?: number
  uuid?: string
  prescription_key: string
  medication_key: string
  logged_date: string
  status: MedicationAdherenceStatus
  updated_at?: string
}

export class MedicationLogService extends BaseService {
  private resource = '/medication-logs'

  async list(params: { date?: string } = {}): Promise<any> {
    return await this.request(this.resource, 'GET', params)
  }

  async recordStatus(payload: {
    prescription_key: string
    medication_key: string
    logged_date?: string
    status: MedicationAdherenceStatus
  }): Promise<any> {
    return await this.request(this.resource, 'POST', payload)
  }
}

export const medicationLogService = new MedicationLogService()
