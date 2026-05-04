import { BaseService } from '../BaseService'

export interface LoginResponse {
  token: string
  user: {
    uuid: string
    role: string
  }
}

export class AuthService extends BaseService {
  async login(email: string, password: string): Promise<LoginResponse> {
    return await this.request<LoginResponse>('/login', 'POST', {
      email,
      password
    })
  }

  async logout(): Promise<void> {
    await this.request<void>('/logout', 'POST')
  }

  async register(payload: any): Promise<any> {
    return await this.request<any>('/register', 'POST', payload)
  }
}

export const authService = new AuthService()
