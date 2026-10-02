import BaseService from '../BaseService'
import { $api } from '~/composables/useApi'

export interface OutOfScopeDatasetCategory {
  category: string
  images: string[]
}

export interface OutOfScopeDatasetStats {
  total: number
  by_category: Record<string, number>
}

/** All CLIP-recognized out-of-scope disease categories */
export const OUT_OF_SCOPE_CATEGORIES = [
  'Psoriasis',
  'Ringworm',
  'Vitiligo',
  'Melanoma',
  'Hives',
  'Warts',
  'Lupus',
  'Rosacea'
] as const

export type OutOfScopeCategory = (typeof OUT_OF_SCOPE_CATEGORIES)[number]

export class OutOfScopeDatasetService extends BaseService {
  async getDataset(): Promise<OutOfScopeDatasetCategory[]> {
    return this.request<OutOfScopeDatasetCategory[]>('/out-of-scope-dataset', 'GET')
  }

  async getStats(): Promise<OutOfScopeDatasetStats> {
    return this.request<OutOfScopeDatasetStats>('/out-of-scope-dataset/stats', 'GET')
  }

  async uploadImage(image: File, category: string): Promise<any> {
    const formData = new FormData()
    formData.append('image', image)
    formData.append('category', category)

    return $api('/out-of-scope-dataset', {
      method: 'POST',
      body: formData
    })
  }

  async uploadImages(images: File[], category: string): Promise<any> {
    const formData = new FormData()
    images.forEach(img => formData.append('images[]', img))
    formData.append('category', category)

    return $api('/out-of-scope-dataset', {
      method: 'POST',
      body: formData
    })
  }

  async saveFromDiagnosis(diagnosisUuid: string): Promise<any> {
    return $api('/out-of-scope-dataset/save-diagnosis', {
      method: 'POST',
      body: { diagnosis_uuid: diagnosisUuid }
    })
  }

  async deleteImage(url: string): Promise<any> {
    return this.request('/out-of-scope-dataset', 'DELETE', { url })
  }

  async deleteImages(urls: string[]): Promise<any> {
    return this.request('/out-of-scope-dataset/bulk', 'DELETE', { urls })
  }

  async downloadDataset(category?: string): Promise<Blob> {
    const query = category ? `?category=${encodeURIComponent(category)}` : ''
    return $api<Blob>(`/out-of-scope-dataset/download${query}`, {
      method: 'GET',
      responseType: 'blob'
    })
  }
}

export const outOfScopeDatasetService = new OutOfScopeDatasetService()
