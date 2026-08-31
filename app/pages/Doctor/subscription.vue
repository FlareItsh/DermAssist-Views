<script setup lang="ts">
import { doctorSubscriptionService, type DoctorPlan, type DoctorSubscription, type PaymentInvoice } from '~/api/subscription/DoctorSubscriptionService'

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const route = useRoute()
const isLoading = ref(true)
const plans = ref<DoctorPlan[]>([])
const currentSubscription = ref<DoctorSubscription | null>(null)
const invoices = ref<PaymentInvoice[]>([])
const billingCycle = ref<'monthly' | 'annual'>('monthly')

// Banner & Alert feedback
const bannerAlert = reactive({
  type: '' as 'success' | 'info' | 'error' | '',
  title: '',
  description: ''
})

// Checkout Modal state
const isCheckoutOpen = ref(false)
const selectedPlan = ref<DoctorPlan | null>(null)
const couponCode = ref('')
const isValidatingCoupon = ref(false)
const couponDiscount = ref<{ discount_amount: number; final_amount: number } | null>(null)
const couponError = ref('')
const isSubmittingCheckout = ref(false)
const checkoutSuccessMsg = ref('')
const checkoutErrorMsg = ref('')

const invoicesPerPage = 5
const invoiceCurrentPage = ref(1)

const paginatedInvoices = computed(() => {
  const start = (invoiceCurrentPage.value - 1) * invoicesPerPage
  return invoices.value.slice(start, start + invoicesPerPage)
})

const fetchSubscriptionData = async () => {
  isLoading.value = true
  try {
    const [plansRes, subRes] = await Promise.all([
      doctorSubscriptionService.getPlans(),
      doctorSubscriptionService.getMySubscription()
    ])
    plans.value = plansRes.data || []
    currentSubscription.value = subRes.data?.subscription || null
    invoices.value = subRes.data?.invoices || []
  } catch (e: any) {
    console.error('Failed to load subscription details:', e)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await fetchSubscriptionData()

  // Handle required feature redirect
  const requiredFeature = route.query.required as string
  if (requiredFeature === 'scan') {
    bannerAlert.type = 'info'
    bannerAlert.title = 'Subscription Required'
    bannerAlert.description = 'An active subscription plan is required to access Doctor AI Skin Scanning and Clinical Diagnostics.'
  }

  // Handle return redirect from gateway payment
  const queryStatus = route.query.status as string
  const invoiceUuid = route.query.invoice as string
  const simulated = route.query.simulated as string

  if (queryStatus === 'success' && invoiceUuid) {
    try {
      const provider = simulated || 'paymongo'
      const res = await doctorSubscriptionService.confirmReturnPayment(invoiceUuid, provider)
      bannerAlert.type = 'success'
      bannerAlert.title = 'Payment Received!'
      bannerAlert.description = res.message || 'Your subscription was activated automatically.'
      await fetchSubscriptionData()
    } catch (e: any) {
      bannerAlert.type = 'error'
      bannerAlert.title = 'Activation Error'
      bannerAlert.description = e.message || 'Unable to confirm instant payment.'
    }
  } else if (queryStatus === 'cancelled') {
    bannerAlert.type = 'info'
    bannerAlert.title = 'Payment Cancelled'
    bannerAlert.description = 'You cancelled the checkout session. No charge was made.'
  }
})

const openCheckout = (plan: DoctorPlan) => {
  selectedPlan.value = plan
  couponCode.value = ''
  couponDiscount.value = null
  couponError.value = ''
  checkoutSuccessMsg.value = ''
  checkoutErrorMsg.value = ''
  isCheckoutOpen.value = true
}

const calculateBasePrice = (plan: DoctorPlan) => {
  return billingCycle.value === 'annual' ? Number(plan.price_annual) : Number(plan.price_monthly)
}

const handleValidateCoupon = async () => {
  if (!couponCode.value || !selectedPlan.value) return
  isValidatingCoupon.value = true
  couponError.value = ''
  couponDiscount.value = null
  try {
    const basePrice = calculateBasePrice(selectedPlan.value)
    const res = await doctorSubscriptionService.validateCoupon(couponCode.value, basePrice)
    couponDiscount.value = res.data
  } catch (e: any) {
    couponError.value = e.message || 'Invalid coupon code.'
  } finally {
    isValidatingCoupon.value = false
  }
}

const processCheckout = async () => {
  if (!selectedPlan.value) return
  isSubmittingCheckout.value = true
  checkoutErrorMsg.value = ''
  checkoutSuccessMsg.value = ''

  try {
    const formData = new FormData()
    formData.append('plan_uuid', selectedPlan.value.uuid)
    formData.append('billing_cycle', billingCycle.value)
    formData.append('payment_method', 'paymongo')

    if (couponCode.value) {
      formData.append('coupon_code', couponCode.value)
    }

    const res = await doctorSubscriptionService.checkout(formData)

    if (res.data?.checkout_url) {
      checkoutSuccessMsg.value = 'Redirecting to secure payment checkout...'
      setTimeout(() => {
        window.location.href = res.data.checkout_url
      }, 800)
    } else {
      checkoutSuccessMsg.value = res.message || 'Order placed successfully!'
      setTimeout(() => {
        isCheckoutOpen.value = false
        fetchSubscriptionData()
      }, 1800)
    }
  } catch (e: any) {
    checkoutErrorMsg.value = e.message || 'Failed to complete checkout.'
  } finally {
    isSubmittingCheckout.value = false
  }
}

const formatTierLabel = (tierType?: string) => {
  switch (tierType) {
    case 'individual':
      return 'Individual Tier Access'
    case 'doctor_multi_clinic':
      return 'Multi-Clinic Doctor Access'
    case 'clinic_multi_doctor':
      return 'Multi-Doctor Group Access'
    default:
      return (tierType || 'Standard').replace(/_/g, ' ') + ' Tier Access'
  }
}

const extractFeatureItems = (features: any): string[] => {
  if (!features) return []

  const items: string[] = []

  if (Array.isArray(features)) {
    return features.filter((f) => typeof f === 'string')
  }

  if (typeof features === 'object') {
    if (Array.isArray(features.custom_list) && features.custom_list.length > 0) {
      items.push(...features.custom_list)
    }

    if (features.show_in_recommendation === true) {
      items.push('Patient Scan Recommendations Access')
    }
    if (features.can_execute_scan === true) {
      items.push('Full Doctor AI Scan Execution')
    }
    if (features.export_pdf_reports === true) {
      items.push('Export PDF Clinical Reports')
    }
    if (features.unlimited_appointments === true) {
      items.push('Teleconsultation Appointments')
    }
  }

  return items
}

const getBadgeColor = (status: string): 'success' | 'warning' | 'info' | 'danger' | 'gray' => {
  switch (status) {
    case 'active':
    case 'approved':
    case 'paid':
      return 'success'
    case 'trialing':
      return 'warning'
    case 'pending':
      return 'info'
    case 'rejected':
    case 'expired':
    case 'canceled':
      return 'danger'
    default:
      return 'gray'
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-8 pb-12">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground">Subscription & Billing</h1>
        <p class="text-sm text-muted-foreground mt-1">Manage your practice tier, view billing statements, and upgrade plan limits.</p>
      </div>

      <!-- Billing Cycle Toggle -->
      <div class="inline-flex items-center p-1 bg-card rounded-2xl border border-sidebar-border shadow-xs self-start md:self-auto">
        <button
          type="button"
          @click="billingCycle = 'monthly'"
          class="px-4 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer"
          :class="billingCycle === 'monthly' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'"
        >
          Monthly Billing
        </button>
        <button
          type="button"
          @click="billingCycle = 'annual'"
          class="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer"
          :class="billingCycle === 'annual' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'"
        >
          Annual Billing
          <span
            class="px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-tight"
            :class="billingCycle === 'annual' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'"
          >
            Save ~17%
          </span>
        </button>
      </div>
    </div>

    <!-- Return Alert Banner -->
    <AppAlert
      v-if="bannerAlert.type"
      :type="bannerAlert.type"
      :title="bannerAlert.title"
      :description="bannerAlert.description"
    />

    <!-- Active Subscription Banner -->
    <div v-if="currentSubscription" class="rounded-3xl border border-primary/20 bg-card p-6 shadow-sm">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-primary">Current Plan</span>
            <AppBadge :color="getBadgeColor(currentSubscription.status)" variant="subtle" size="sm">
              {{ currentSubscription.status }}
            </AppBadge>
          </div>
          <h2 class="text-xl font-bold text-foreground">
            {{ currentSubscription.plan?.name || 'Standard Tier' }}
            <span class="text-sm font-normal text-muted-foreground">({{ currentSubscription.billing_cycle }})</span>
          </h2>
          <p class="text-xs text-muted-foreground">
            Valid until {{ new Date(currentSubscription.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <AppButton
            variant="solid"
            size="md"
            @click="openCheckout(currentSubscription.plan)"
          >
            Renew Plan
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="isLoading" class="grid md:grid-cols-3 gap-6">
      <div v-for="n in 3" :key="n" class="h-96 rounded-3xl bg-muted/20 animate-pulse"></div>
    </div>

    <!-- Pricing Cards Grid -->
    <div v-else class="grid md:grid-cols-3 gap-6 items-stretch">
      <div
        v-for="plan in plans"
        :key="plan.uuid"
        :class="[
          'relative rounded-3xl p-6 transition-all flex flex-col justify-between border shadow-sm bg-card',
          currentSubscription?.plan?.uuid === plan.uuid
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-sidebar-border hover:border-primary/50'
        ]"
      >
        <div class="space-y-4">
          <!-- Recommended Badge -->
          <div v-if="plan.tier_type === 'professional'" class="absolute -top-3 left-1/2 -translate-x-1/2">
            <AppBadge color="primary" variant="solid" size="sm">
              Most Popular
            </AppBadge>
          </div>

          <div>
            <h3 class="text-lg font-bold text-foreground">{{ plan.name }}</h3>
            <p class="text-xs text-muted-foreground mt-0.5">{{ formatTierLabel(plan.tier_type) }}</p>
          </div>

          <!-- Price Display -->
          <div class="flex items-baseline gap-1">
            <span class="text-3xl font-extrabold text-foreground">
              ₱{{ calculateBasePrice(plan).toLocaleString() }}
            </span>
            <span class="text-xs font-medium text-muted-foreground">
              / {{ billingCycle === 'annual' ? 'year' : 'month' }}
            </span>
          </div>

          <!-- Quotas List -->
          <ul class="space-y-2.5 pt-4 border-t border-sidebar-border text-xs text-foreground/80">
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-4 h-4 text-primary shrink-0" />
              <span><strong>{{ plan.max_doctors ? plan.max_doctors : 'Unlimited' }}</strong> Doctor Seats</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-4 h-4 text-primary shrink-0" />
              <span><strong>{{ plan.max_clinics ? plan.max_clinics : 'Unlimited' }}</strong> Clinic Branches</span>
            </li>
            <li v-for="(feat, idx) in extractFeatureItems(plan.features)" :key="idx" class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-4 h-4 text-primary shrink-0" />
              <span>{{ feat }}</span>
            </li>
          </ul>
        </div>

        <div class="pt-6">
          <AppButton
            :variant="currentSubscription?.plan?.uuid === plan.uuid ? 'ghost' : 'solid'"
            block
            :disabled="currentSubscription?.plan?.uuid === plan.uuid"
            @click="openCheckout(plan)"
          >
            {{ currentSubscription?.plan?.uuid === plan.uuid ? 'Current Active Plan' : 'Subscribe Now' }}
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Invoices / Purchase History -->
    <div class="space-y-4 pt-6">
      <h2 class="text-lg font-bold text-foreground">Payment & Billing History</h2>
      
      <div v-if="invoices.length === 0" class="rounded-3xl border border-sidebar-border bg-card p-8 text-center">
        <Icon name="heroicons:document-text" class="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p class="text-sm font-medium text-foreground">No payment invoices found</p>
        <p class="text-xs text-muted-foreground mt-1">Select a plan above to initiate your first subscription order.</p>
      </div>

      <div v-else class="rounded-3xl border border-sidebar-border bg-card overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-foreground/80">
            <thead class="bg-muted/10 text-foreground border-b border-sidebar-border uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th class="py-3.5 px-4">Date</th>
                <th class="py-3.5 px-4">Plan / Cycle</th>
                <th class="py-3.5 px-4">Payment Type</th>
                <th class="py-3.5 px-4">Reference</th>
                <th class="py-3.5 px-4">Amount</th>
                <th class="py-3.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-sidebar-border">
              <tr v-for="inv in paginatedInvoices" :key="inv.uuid" class="hover:bg-muted/10">
                <td class="py-3.5 px-4 font-medium text-foreground">
                  {{ new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
                </td>
                <td class="py-3.5 px-4">
                  {{ inv.subscription?.plan?.name || 'Subscription' }}
                </td>
                <td class="py-3.5 px-4 uppercase font-semibold text-foreground">
                  Online Checkout
                </td>
                <td class="py-3.5 px-4 font-mono text-muted-foreground">
                  {{ inv.transaction_reference || 'N/A' }}
                </td>
                <td class="py-3.5 px-4 font-bold text-foreground">
                  ₱{{ Number(inv.final_amount).toLocaleString() }}
                </td>
                <td class="py-3.5 px-4 text-right">
                  <AppBadge :color="getBadgeColor(inv.payment_status)" variant="subtle" size="xs">
                    {{ inv.payment_status }}
                  </AppBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <AppPagination
          v-model:currentPage="invoiceCurrentPage"
          :total-items="invoices.length"
          :per-page="invoicesPerPage"
          item-label="invoices"
        />
      </div>
    </div>

    <!-- Checkout Modal Component -->
    <AppModal
      v-model="isCheckoutOpen"
      :title="selectedPlan ? `Checkout: ${selectedPlan.name}` : 'Checkout'"
      :description="billingCycle === 'annual' ? 'Annual Billing Cycle' : 'Monthly Billing Cycle'"
      size="lg"
    >
      <div class="space-y-6">
        <!-- Alerts using AppAlert component -->
        <AppAlert
          v-if="checkoutSuccessMsg"
          type="success"
          title="Order Submitted"
          :description="checkoutSuccessMsg"
        />
        <AppAlert
          v-if="checkoutErrorMsg"
          type="error"
          title="Checkout Error"
          :description="checkoutErrorMsg"
        />

        <!-- Order Summary -->
        <div class="space-y-2 p-4 rounded-2xl bg-muted/10 border border-sidebar-border text-xs">
          <div class="flex justify-between text-muted-foreground">
            <span>Base Price ({{ billingCycle }})</span>
            <span class="font-semibold text-foreground">₱{{ selectedPlan ? calculateBasePrice(selectedPlan).toLocaleString() : 0 }}</span>
          </div>
          <div v-if="couponDiscount" class="flex justify-between text-primary">
            <span>Discount ({{ couponDiscount.code }})</span>
            <span class="font-semibold">-₱{{ couponDiscount.discount_amount.toLocaleString() }}</span>
          </div>
          <div class="flex justify-between text-sm font-bold text-foreground border-t border-sidebar-border pt-2">
            <span>Total Amount</span>
            <span>₱{{ selectedPlan ? (couponDiscount ? couponDiscount.final_amount : calculateBasePrice(selectedPlan)).toLocaleString() : 0 }}</span>
          </div>
        </div>

        <!-- Coupon Input -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-foreground">Have a Promo Coupon?</label>
          <div class="flex gap-2">
            <input
              v-model="couponCode"
              type="text"
              placeholder="ENTER CODE"
              class="flex-1 px-3 py-2 text-xs rounded-2xl border border-sidebar-border bg-card text-foreground font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
            <AppButton
              variant="outline"
              size="sm"
              :disabled="isValidatingCoupon || !couponCode"
              :loading="isValidatingCoupon"
              @click="handleValidateCoupon"
            >
              Apply
            </AppButton>
          </div>
          <p v-if="couponError" class="text-[11px] text-destructive">{{ couponError }}</p>
        </div>

        <!-- Instant Payment Method Features -->
        <div class="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2 text-xs">
          <p class="font-bold text-primary flex items-center gap-1.5">
            <Icon name="heroicons:bolt" class="w-4 h-4 text-primary" />
            Instant Automated Subscription Activation
          </p>
          <p class="text-muted-foreground">
            You will be redirected to a secure checkout portal supporting <strong>GCash, Maya, QR Ph, and Credit/Debit Cards</strong>. Your subscription activates immediately upon payment completion.
          </p>
        </div>
      </div>

      <!-- Modal Footer -->
      <template #footer>
        <AppButton
          variant="ghost"
          size="md"
          @click="isCheckoutOpen = false"
        >
          Cancel
        </AppButton>
        <AppButton
          variant="solid"
          size="md"
          :loading="isSubmittingCheckout"
          @click="processCheckout"
        >
          Proceed to Secure Payment
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
