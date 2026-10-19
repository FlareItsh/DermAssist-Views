import BaseService from '../BaseService'

export interface ModelStatsResponse {
  gathered_dataset: {
    total: number
    by_category: Record<string, number>
    untrained_count?: number
    last_trained_at?: string | null
  }
  out_of_scope_candidates?: {
    total: number
    by_category: Record<string, number>
  }
  ai_service: {
    total_baseline_images: number
    classes: Record<string, number>
    active_architecture: string
    models_available: string[]
  }
}

export interface TrainingHistory {
  train_loss: number[]
  train_acc: number[]
  val_loss: number[]
  val_acc: number[]
}

export interface TrainingStatusResponse {
  status:
    | 'idle'
    | 'syncing'
    | 'training'
    | 'evaluating'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'offline'
  progress: number
  architecture: string
  current_epoch: number
  total_epochs: number
  current_batch: number
  total_batches: number
  train_loss: number
  train_acc: number
  val_loss: number
  val_acc: number
  baseline_val_acc: number
  best_val_acc: number
  model_promoted: boolean
  message: string
  eta_seconds: number
  elapsed_seconds: number
  logs: string[]
  history: TrainingHistory
  started_at?: string
  completed_at?: string
  expansion_disease?: string
  training_mode?: 'quick' | 'full' | string
  fresh_start?: boolean
  error?: string
}

export interface TrainingImageItem {
  uuid: string
  file_name?: string
  filename?: string
  original_name?: string
  image_url: string
  category: string
  label?: string
  is_tangible: boolean
  is_in_raw: boolean
  is_in_local_storage: boolean
  storage_status: 'ready' | 'in_raw' | 'in_local_storage' | 'raw' | 'local_storage' | 'both'
  is_synced?: boolean
  sync_status?: 'synced' | 'needs_sync'
  is_trained?: boolean
  stage?: 'pending' | 'synced' | 'trained'
  is_contributed?: boolean
  contributed_to_dataset?: boolean
  created_at: string | null
  patient_consented?: boolean
  has_consent?: boolean
  source?: 'diagnosis' | 'dataset_gallery'
}

export interface TrainingImagesResponse {
  images: TrainingImageItem[]
  data?: TrainingImageItem[]
  total: number
  tangible_count?: number
  intangible_count?: number
  synced_count?: number
  needs_sync_count?: number
  by_category: Record<string, number>
  summary?: {
    total: number
    tangible_count: number
    intangible_count: number
    in_local_storage_count: number
    in_raw_count: number
    synced_count?: number
    needs_sync_count?: number
  }
}

export interface StartTrainingPayload {
  architecture?: 'ensemble' | 'swin_transformer' | 'resnet50' | 'efficientnet_v2'
  epochs?: number
  sync_dataset?: boolean
  learning_rate?: number
  expansion_disease?: string
  selected_image_uuids?: string[]
  training_mode?: 'quick' | 'full'
  fresh_start?: boolean
}

export class ModelTrainingService extends BaseService {
  async getStats(): Promise<ModelStatsResponse> {
    return this.request<ModelStatsResponse>('/admin/model/stats', 'GET')
  }

  async getTrainingImages(params?: { category?: string }): Promise<TrainingImagesResponse> {
    const query =
      params?.category && params.category !== 'all' ? `?category=${params.category}` : ''
    return this.request<TrainingImagesResponse>(`/admin/model/training-images${query}`, 'GET')
  }

  async deleteTrainingImages(uuids: string[]): Promise<any> {
    return this.request('/admin/model/training-images', 'DELETE', { uuids })
  }

  async recategorizeTrainingImages(
    uuids: string[],
    targetCategory: string
  ): Promise<{ message: string; transferred_count: number; target_category: string }> {
    return this.request('/admin/model/training-images/recategorize', 'POST', {
      uuids,
      target_category: targetCategory
    })
  }

  async startTraining(payload: StartTrainingPayload): Promise<any> {
    return this.request('/admin/model/retrain', 'POST', payload)
  }

  async getStatus(): Promise<TrainingStatusResponse> {
    return this.request<TrainingStatusResponse>('/admin/model/retrain/status', 'GET')
  }

  async cancelTraining(): Promise<any> {
    return this.request('/admin/model/retrain/cancel', 'POST')
  }

  async markCompleted(): Promise<any> {
    return this.request('/admin/model/retrain/complete', 'POST')
  }

  async syncDataset(uuids?: string[]): Promise<any> {
    return this.request(
      '/admin/model/dataset/sync',
      'POST',
      uuids && uuids.length > 0 ? { uuids } : {}
    )
  }
}

export const modelTrainingService = new ModelTrainingService()
