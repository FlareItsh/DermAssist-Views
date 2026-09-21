import BaseService from '../BaseService'

export interface ModelStatsResponse {
  gathered_dataset: {
    total: number
    by_category: Record<string, number>
    untrained_count?: number
    last_trained_at?: string | null
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
  status: 'idle' | 'syncing' | 'training' | 'evaluating' | 'completed' | 'failed' | 'cancelled' | 'offline'
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
  error?: string
}

export interface StartTrainingPayload {
  architecture?: 'swin_transformer' | 'resnet50' | 'efficientnet_v2'
  epochs?: number
  sync_dataset?: boolean
  learning_rate?: number
}

export class ModelTrainingService extends BaseService {
  async getStats(): Promise<ModelStatsResponse> {
    return this.request<ModelStatsResponse>('/admin/model/stats', 'GET')
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

  async syncDataset(): Promise<any> {
    return this.request('/admin/model/dataset/sync', 'POST')
  }
}

export const modelTrainingService = new ModelTrainingService()
