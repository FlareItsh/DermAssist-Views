import BaseService from '../BaseService'

export interface DoctorPlan {
  uuid: string
  name: string
  tier_type: string
  price_monthly: number
  price_annual: number
  max_doctors: number | null
  max_clinics: number | null
  support_level?: string
  features: Record<string, any> | string[] | any
  is_active: boolean
}

export interface DoctorSubscription {
  uuid: string
  billing_cycle: 'monthly' | 'annual'
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'expired'
  starts_at: string
  ends_at: string
  plan: DoctorPlan
}

export interface PaymentInvoice {
  uuid: string
  amount: number
  discount_amount: number
  final_amount: number
  payment_method: string
  payment_status: 'pending' | 'approved' | 'rejected'
  proof_of_payment_path: string | null
  transaction_reference: string | null
  created_at: string
  subscription?: {
    plan?: DoctorPlan
  }
}

export class DoctorSubscriptionService extends BaseService {
  async getPlans(): Promise<{ status: string; data: DoctorPlan[] }> {
    return this.request('/subscription/plans', 'GET')
  }

  async getMySubscription(): Promise<{
    status: string
    data: {
      subscription: DoctorSubscription | null
      invoices: PaymentInvoice[]
    }
  }> {
    return this.request('/subscription/my-subscription', 'GET')
  }

  async validateCoupon(code: string, amount: number): Promise<{
    status: string
    data: {
      code: string
      discount_type: 'percentage' | 'fixed'
      value: number
      discount_amount: number
      final_amount: number
    }
  }> {
    return this.request('/subscription/validate-coupon', 'POST', { code, amount })
  }

  async checkout(formData: FormData): Promise<{
    status: string
    message: string
    data: {
      subscription: DoctorSubscription
      invoice: PaymentInvoice
      checkout_url: string | null
    }
  }> {
    return this.request('/subscription/checkout', 'POST', formData, {
      headers: {} // Let browser handle multipart/form-data boundary automatically
    })
  }

  async confirmReturnPayment(invoiceUuid: string, provider: string): Promise<{ status: string; message: string; data: any }> {
    return this.request('/subscription/confirm-return-payment', 'POST', {
      invoice_uuid: invoiceUuid,
      provider
    })
  }
}

export const doctorSubscriptionService = new DoctorSubscriptionService()
