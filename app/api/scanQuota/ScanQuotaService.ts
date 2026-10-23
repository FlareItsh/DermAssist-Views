import { BaseService } from '../BaseService'

export interface ScanQuota {
  is_unlimited: boolean
  limit: number | null
  used: number
  remaining: number | null
  resets_at: string | null
  countdown_seconds: number | null
  unlimited_until: string | null
  source: 'admin' | 'doctor_care' | 'subscription' | 'free'
}

export interface DefaultScanQuotaResponse {
  default_daily_quota: number
}

export interface CareGracePeriodsResponse {
  appointment_unlimited_days: number
  doctor_created_unlimited_days: number
}

export class ScanQuotaService extends BaseService {
  async getQuota(): Promise<{ status: string; data: ScanQuota }> {
    return await this.request('/scan-quota', 'GET')
  }

  async getDefaultDailyQuota(): Promise<{ status: string; data: DefaultScanQuotaResponse }> {
    return await this.request('/admin/settings/default-scan-quota', 'GET')
  }

  async updateDefaultDailyQuota(
    defaultDailyQuota: number
  ): Promise<{ status: string; message: string; data: DefaultScanQuotaResponse }> {
    return await this.request('/admin/settings/default-scan-quota', 'POST', {
      default_daily_quota: defaultDailyQuota
    })
  }

  async getCareGracePeriods(): Promise<{ status: string; data: CareGracePeriodsResponse }> {
    return await this.request('/admin/settings/care-grace-periods', 'GET')
  }

  async updateCareGracePeriods(payload: Partial<CareGracePeriodsResponse>): Promise<{
    status: string
    message: string
    data: CareGracePeriodsResponse
  }> {
    return await this.request('/admin/settings/care-grace-periods', 'POST', payload)
  }
}

export const scanQuotaService = new ScanQuotaService()
