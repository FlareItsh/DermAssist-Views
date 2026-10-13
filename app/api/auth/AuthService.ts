import { BaseService } from '../BaseService'

export interface LoginResponse {
  token?: string
  two_factor_required?: boolean
  challenge?: string
  user?: {
    uuid: string
    role: string
    [key: string]: any
  }
}

export class AuthService extends BaseService {
  async login(email: string, password: string): Promise<LoginResponse> {
    return await this.request<LoginResponse>('/login', 'POST', {
      email,
      password
    })
  }

  async challenge2FA(payload: {
    challenge: string
    code?: string
    recovery_code?: string
    device_id?: string
  }): Promise<LoginResponse> {
    return await this.request<LoginResponse>('/two-factor/challenge', 'POST', payload)
  }

  async logout(): Promise<void> {
    await this.request<void>('/logout', 'POST')
  }

  async register(payload: any): Promise<any> {
    return await this.request<any>('/register', 'POST', payload)
  }
}

export const authService = new AuthService()
