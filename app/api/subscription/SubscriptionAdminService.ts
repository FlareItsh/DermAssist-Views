import BaseService from '../BaseService'

export interface Plan {
  id?: number
  name: string
  slug?: string
  tier_type: 'individual' | 'doctor_multi_clinic' | 'clinic_multi_doctor'
  price_monthly: number
  price_annual: number
  max_doctors?: number | null
  max_clinics?: number | null
  max_secretaries?: number | null
  features?: Record<string, boolean>
  trial_period_days?: number
  grace_period_days?: number
  sort_order?: number
  is_active?: boolean
}

export interface PaymentInvoice {
  id: number
  uuid: string
  user?: any
  subscription?: any
  amount: number
  discount_amount: number
  final_amount: number
  payment_method: string
  payment_status: 'pending' | 'paid' | 'rejected'
  proof_of_payment_path?: string
  transaction_reference?: string
  created_at: string
}

export interface Feature {
  id?: number
  uuid?: string
  name: string
  code?: string
  description?: string
  is_active?: boolean
  sort_order?: number
  is_included?: boolean
}

export interface Coupon {
  id?: number
  code: string
  discount_type: 'percentage' | 'fixed_amount'
  value: number
  duration: 'once' | 'repeating' | 'forever'
  duration_in_months?: number
  valid_from?: string
  valid_until?: string
  max_redemptions?: number
  times_redeemed?: number
  is_active?: boolean
}

class SubscriptionAdminService extends BaseService {
  async getDashboard() {
    return this.request<any>('/admin/subscriptions/dashboard', 'GET')
  }

  async getPlans() {
    return this.request<any>('/admin/plans', 'GET')
  }

  async createPlan(data: Plan) {
    return this.request<any>('/admin/plans', 'POST', data)
  }

  async updatePlan(id: number, data: Partial<Plan>) {
    return this.request<any>(`/admin/plans/${id}`, 'PUT', data)
  }

  async togglePlanActive(id: number) {
    return this.request<any>(`/admin/plans/${id}/toggle-active`, 'PATCH')
  }

  async deletePlan(id: number) {
    return this.request<any>(`/admin/plans/${id}`, 'DELETE')
  }

  // Feature Management
  async getFeatures(activeOnly = false) {
    return this.request<any>('/admin/features', 'GET', activeOnly ? { active_only: 1 } : undefined)
  }

  async createFeature(data: Partial<Feature>) {
    return this.request<any>('/admin/features', 'POST', data)
  }

  async updateFeature(id: number, data: Partial<Feature>) {
    return this.request<any>(`/admin/features/${id}`, 'PUT', data)
  }

  async toggleFeatureActive(id: number) {
    return this.request<any>(`/admin/features/${id}/toggle-active`, 'PATCH')
  }

  async deleteFeature(id: number) {
    return this.request<any>(`/admin/features/${id}`, 'DELETE')
  }

  async getPayments(status?: string) {
    return this.request<any>('/admin/payments', 'GET', { status })
  }

  async approvePayment(id: number, reference?: string) {
    return this.request<any>(`/admin/payments/${id}/approve`, 'POST', { transaction_reference: reference })
  }

  async rejectPayment(id: number, reason: string) {
    return this.request<any>(`/admin/payments/${id}/reject`, 'POST', { reason })
  }

  async getCoupons() {
    return this.request<any>('/admin/coupons', 'GET')
  }

  async createCoupon(data: Coupon) {
    return this.request<any>('/admin/coupons', 'POST', data)
  }

  async toggleCouponActive(id: number) {
    return this.request<any>(`/admin/coupons/${id}/toggle-active`, 'PATCH')
  }

  async deleteCoupon(id: number) {
    return this.request<any>(`/admin/coupons/${id}`, 'DELETE')
  }
}

export const subscriptionAdminService = new SubscriptionAdminService()
