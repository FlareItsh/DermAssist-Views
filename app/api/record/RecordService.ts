import BaseService from '../BaseService'
import { $api } from '~/composables/useApi'

export interface RecordItem {
  id: number
  uuid: string
  type: 'scan' | 'doctor_diagnosis'
  title: string
  label: string
  confidence: number
  probabilities: Record<string, number>
  image_path: string
  created_at: string
  patient: any
  doctor: any
  clinical_note: any
}

export class RecordService extends BaseService {
  async getRecords(): Promise<RecordItem[]> {
    return this.request<RecordItem[]>('/records', 'GET')
  }
}

export const recordService = new RecordService()
