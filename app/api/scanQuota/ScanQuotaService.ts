import { BaseService } from '../BaseService'

export interface ScanQuota {
  is_unlimited: boolean
  limit: number | null
  used: number
  remaining: number | null
  resets_at: string | null
  countdown_seconds: number | null
  unlimited_until: string | null
  source:
    | 'admin'
    | 'doctor_care'
    | 'subscription'
    | 'free'
    | 'doctor_trial'
    | 'doctor_unsubscribed'
    | 'doctor_unverified'
  can_scan?: boolean
  message?: string | null
}

export interface ScanQuotaPolicies {
  doctor_trial_days: number
  doctor_trial_daily_scans: number
  doctor_unsubscribed_daily_scans: number
  patient_default_daily_scans: number
  patient_care_daily_scans: number
  patient_care_duration_days: number
  guest_daily_scans: number
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

  async getPolicies(): Promise<{ status: string; data: ScanQuotaPolicies }> {
    return await this.request('/admin/settings/scan-quota-policies', 'GET')
  }

  async updatePolicies(payload: Partial<ScanQuotaPolicies>): Promise<{
    status: string
    message: string
    data: ScanQuotaPolicies
  }> {
    return await this.request('/admin/settings/scan-quota-policies', 'POST', payload)
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

  async getGuestQuota(fingerprint?: string): Promise<{ status: string; data: ScanQuota }> {
    return await this.request('/guest/scan-quota', 'GET', undefined, {
      headers: fingerprint ? { 'X-Device-Fingerprint': fingerprint } : {}
    })
  }

  async claimGuestScan(guestToken: string): Promise<{
    status: string
    message: string
    data: { uuid: string }
  }> {
    return await this.request('/guest/claim-scan', 'POST', { guest_token: guestToken })
  }
}

export const scanQuotaService = new ScanQuotaService()
