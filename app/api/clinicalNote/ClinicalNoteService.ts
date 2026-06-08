import BaseService from '../BaseService'
import { $api } from '~/composables/useApi'

export interface ClinicalNote {
  id?: number
  uuid?: string
  appointment_id?: number
  doctor_id?: number
  patient_id?: number
  diagnosis_id?: number | null
  
  history_of_present_illness?: string | null
  systemic_symptoms?: string | null
  
  physical_exam?: string | null
  
  differential_diagnosis?: string | null
  final_diagnosis?: string | null
  
  prescription?: string | null
  patient_education?: string | null
  follow_up_date?: string | null
  follow_up_instructions?: string | null
  
  created_at?: string
  updated_at?: string
}

export class ClinicalNoteService extends BaseService {
  async getByAppointment(appointmentUuid: string): Promise<ClinicalNote | null> {
    return this.request<ClinicalNote | null>(`/appointments/${appointmentUuid}/clinical-note`, 'GET')
  }

  async save(appointmentUuid: string, data: Partial<ClinicalNote>): Promise<ClinicalNote> {
    return $api(`/appointments/${appointmentUuid}/clinical-note`, {
      method: 'POST',
      body: data
    })
  }

  async saveForDiagnosis(diagnosisUuid: string, data: Partial<ClinicalNote>): Promise<ClinicalNote> {
    return $api(`/diagnoses/${diagnosisUuid}/clinical-note`, {
      method: 'POST',
      body: data
    })
  }
}

export const clinicalNoteService = new ClinicalNoteService()
