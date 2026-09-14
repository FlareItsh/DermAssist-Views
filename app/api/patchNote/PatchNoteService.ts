import BaseService from '../BaseService'

export interface PatchNote {
  id?: number
  uuid?: string
  version?: string
  title: string
  description: string
  changes?: string[]
  is_published?: boolean
  published_at?: string
  created_by?: number
  creator_name?: string
  created_at?: string
  updated_at?: string
}

class PatchNoteService extends BaseService {
  // Admin Methods
  async getAll() {
    return this.request<{ status: string; data: PatchNote[] }>('/admin/patch-notes', 'GET')
  }

  async create(data: Partial<PatchNote>) {
    return this.request<{ status: string; message: string; data: PatchNote }>('/admin/patch-notes', 'POST', data)
  }

  async update(id: number, data: Partial<PatchNote>) {
    return this.request<{ status: string; message: string; data: PatchNote }>(`/admin/patch-notes/${id}`, 'PUT', data)
  }

  async togglePublish(id: number) {
    return this.request<{ status: string; message: string; data: PatchNote }>(`/admin/patch-notes/${id}/toggle-publish`, 'PATCH')
  }

  async delete(id: number) {
    return this.request<{ status: string; message: string }>(`/admin/patch-notes/${id}`, 'DELETE')
  }

  // Public / Authenticated User Methods
  async getPublished(limit = 20) {
    return this.request<{ status: string; data: PatchNote[] }>('/patch-notes', 'GET', { limit })
  }

  async getLatest() {
    return this.request<{ status: string; data: PatchNote | null }>('/patch-notes/latest', 'GET')
  }
}

export const patchNoteService = new PatchNoteService()
export default patchNoteService
