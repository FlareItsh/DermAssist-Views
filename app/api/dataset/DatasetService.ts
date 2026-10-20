import BaseService from '../BaseService'
import { $api } from '~/composables/useApi'

export interface DatasetImageItem {
  url: string
  filename?: string
  is_synced: boolean
  sync_status: 'synced' | 'needs_sync'
  source?: 'diagnosis' | 'dataset_gallery'
  storage_location?: string
  diagnosis_uuid?: string
  created_at?: string | null
}

export interface DatasetCategory {
  category: string
  images: string[]
  items?: DatasetImageItem[]
  total?: number
  current_page?: number
  per_page?: number
  last_page?: number
  synced_count?: number
  needs_sync_count?: number
}

export class DatasetService extends BaseService {
  async getDataset(params?: {
    category?: string
    page?: number
    per_page?: number
    all?: boolean
    scope?: string
  }): Promise<DatasetCategory[]> {
    const queryParts: string[] = []
    if (params?.category) queryParts.push(`category=${encodeURIComponent(params.category)}`)
    if (params?.page) queryParts.push(`page=${params.page}`)
    if (params?.per_page) queryParts.push(`per_page=${params.per_page}`)
    if (params?.all) queryParts.push(`all=true`)
    if (params?.scope) queryParts.push(`scope=${encodeURIComponent(params.scope)}`)
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
    return this.request<DatasetCategory[]>(`/dataset${queryString}`, 'GET')
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

  async uploadImages(images: File[], category: string): Promise<any> {
    const formData = new FormData()
    images.forEach(img => formData.append('images[]', img))
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

  async deleteImages(urls: string[]): Promise<any> {
    return this.request('/dataset/bulk', 'DELETE', { urls })
  }

  async downloadDataset(category?: string, params?: { scope?: string }): Promise<Blob> {
    const queryParts: string[] = []
    if (category) queryParts.push(`category=${encodeURIComponent(category)}`)
    if (params?.scope) queryParts.push(`scope=${encodeURIComponent(params.scope)}`)
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
    return $api<Blob>(`/dataset/download${query}`, {
      method: 'GET',
      responseType: 'blob'
    })
  }
}

export const datasetService = new DatasetService()
