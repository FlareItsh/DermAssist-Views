import BaseService from '../BaseService'
import { $api } from '~/composables/useApi'

export interface DatasetCategory {
  category: string
  images: string[]
}

export class DatasetService extends BaseService {
  async getDataset(): Promise<DatasetCategory[]> {
    return this.request<DatasetCategory[]>('/dataset', 'GET')
  }

  async uploadImage(image: File, category: string): Promise<any> {
    const formData = new FormData()
    formData.append('image', image)
    formData.append('category', category)
    
    return $api('/dataset', {
      method: 'POST',
      body: formData
    })
  }

  async saveFromDiagnosis(diagnosisUuid: string): Promise<any> {
    return $api('/dataset/save-diagnosis', {
      method: 'POST',
      body: { diagnosis_uuid: diagnosisUuid }
    })
  }

  async deleteImage(url: string): Promise<any> {
    return this.request('/dataset', 'DELETE', { url })
  }

  async downloadDataset(category?: string): Promise<Blob> {
    const query = category ? `?category=${encodeURIComponent(category)}` : ''
    return $api<Blob>(`/dataset/download${query}`, {
      method: 'GET',
      responseType: 'blob'
    })
  }
}

export const datasetService = new DatasetService()
