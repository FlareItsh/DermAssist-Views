import { BaseService } from '../BaseService'

export interface TwoFactorEnableResponse {
  secret: string
  qr_code_svg: string
  otpauth_url: string
}

export interface TwoFactorConfirmResponse {
  message: string
  recovery_codes: string[]
}

export interface TwoFactorDisableResponse {
  message: string
}

export interface TwoFactorRegenerateCodesResponse {
  message: string
  recovery_codes: string[]
}

export class TwoFactorService extends BaseService {
  async enable(): Promise<TwoFactorEnableResponse> {
    return await this.request<TwoFactorEnableResponse>('/two-factor/enable', 'POST')
  }

  async confirm(code: string): Promise<TwoFactorConfirmResponse> {
    return await this.request<TwoFactorConfirmResponse>('/two-factor/confirm', 'POST', {
      code
    })
  }

  async disable(password: string): Promise<TwoFactorDisableResponse> {
    return await this.request<TwoFactorDisableResponse>('/two-factor', 'DELETE', {
      password
    })
  }

  async regenerateRecoveryCodes(password: string): Promise<TwoFactorRegenerateCodesResponse> {
    return await this.request<TwoFactorRegenerateCodesResponse>(
      '/two-factor/recovery-codes',
      'POST',
      {
        password
      }
    )
  }
}

export const twoFactorService = new TwoFactorService()
