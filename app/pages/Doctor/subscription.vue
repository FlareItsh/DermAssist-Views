<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import {
    doctorSubscriptionService,
    type DoctorPlan,
    type DoctorSubscription,
    type PaymentInvoice
  } from '~/api/subscription/DoctorSubscriptionService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const route = useRoute()
  const isLoading = ref(true)
  const plans = ref<DoctorPlan[]>([])
  const currentSubscription = ref<DoctorSubscription | null>(null)
  const invoices = ref<PaymentInvoice[]>([])
  const billingCycle = ref<'monthly' | 'annual'>('monthly')

  // Auto-Renew & Cancellation states
  const isTogglingAutoRenew = ref(false)
  const isCancelModalOpen = ref(false)
  const cancelReason = ref('Cost is too high for my current practice')
  const cancelFeedback = ref('')
  const isCancellingSub = ref(false)
  const isResumingSub = ref(false)

  const cancellationReasons = [
    'Cost is too high for my current practice',
    'Missing features I need for patient care',
    'Taking a temporary break / pausing practice',
    'Clinic group provides alternative software',
    'Other reason'
  ]

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

  const isInherited = ref(false)
  const associateCoverage = ref<any | null>(null)
  const directSubscription = ref<any | null>(null)

  const fetchSubscriptionData = async () => {
    isLoading.value = true
    try {
      const [plansRes, subRes] = await Promise.all([
        doctorSubscriptionService.getPlans(),
        doctorSubscriptionService.getMySubscription()
      ])
      plans.value = plansRes.data || []
      currentSubscription.value = subRes.data?.subscription || null
      directSubscription.value = subRes.data?.direct_subscription || null
      invoices.value = subRes.data?.invoices || []
      isInherited.value = Boolean(subRes.data?.is_inherited)
      associateCoverage.value = subRes.data?.associate_coverage || null
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
      bannerAlert.description =
        'An active subscription plan is required to access Doctor AI Skin Scanning and Clinical Diagnostics.'
    } else if (requiredFeature === 'secretary') {
      bannerAlert.type = 'info'
      bannerAlert.title = 'Secretary Plan Required'
      bannerAlert.description =
        'A subscription plan with secretary account support (such as Individual Doctor Plan with Secretary or Multi-Clinic Plan) is required to register and manage secretary accounts.'
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

  const handleToggleAutoRenew = async (enable: boolean) => {
    if (!currentSubscription.value) return
    isTogglingAutoRenew.value = true
    try {
      const res = await doctorSubscriptionService.toggleAutoRenew(enable)
      toast.success(res.message || (enable ? 'Auto-renewal enabled.' : 'Auto-renewal disabled.'))
      await fetchSubscriptionData()
    } catch (e: any) {
      toast.error(e.message || 'Failed to update auto-renewal setting.')
    } finally {
      isTogglingAutoRenew.value = false
    }
  }

  const openCancelModal = () => {
    cancelReason.value = 'Cost is too high for my current practice'
    cancelFeedback.value = ''
    isCancelModalOpen.value = true
  }

  const handleConfirmCancel = async () => {
    if (!currentSubscription.value) return
    isCancellingSub.value = true
    try {
      const res = await doctorSubscriptionService.cancelSubscription({
        reason: cancelReason.value,
        feedback: cancelFeedback.value
      })
      toast.success(res.message || 'Subscription scheduled for cancellation.')
      isCancelModalOpen.value = false
      await fetchSubscriptionData()
    } catch (e: any) {
      toast.error(e.message || 'Failed to cancel subscription.')
    } finally {
      isCancellingSub.value = false
    }
  }

  const handleResumeSubscription = async () => {
    if (!currentSubscription.value) return
    isResumingSub.value = true
    try {
      const res = await doctorSubscriptionService.resumeSubscription()
      toast.success(res.message || 'Subscription resumed successfully!')
      await fetchSubscriptionData()
    } catch (e: any) {
      toast.error(e.message || 'Failed to resume subscription.')
    } finally {
      isResumingSub.value = false
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

  const extractFeatureItems = (planOrFeatures: any): string[] => {
    if (!planOrFeatures) return []

    const items: string[] = []

    // If passed the whole plan object with normalized plan_features
    if (planOrFeatures.plan_features && Array.isArray(planOrFeatures.plan_features)) {
      planOrFeatures.plan_features.forEach((pf: any) => {
        if (pf.is_included && pf.name) {
          items.push(pf.name)
        }
      })

      const customList = planOrFeatures.features?.custom_list
      if (Array.isArray(customList) && customList.length > 0) {
        items.push(...customList)
      }

      if (items.length > 0) {
        return items
      }
    }

    const features = planOrFeatures.features || planOrFeatures

    if (Array.isArray(features)) {
      return features.filter(f => typeof f === 'string')
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
  <div class="mx-auto max-w-6xl space-y-8 pb-12">
    <!-- Header -->
    <div
      class="border-border flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-center"
    >
      <div>
        <h1 class="text-foreground text-2xl font-bold tracking-tight">Subscription & Billing</h1>
        <p class="text-muted-foreground mt-1 text-sm">
          Manage your practice tier, view billing statements, and upgrade plan limits.
        </p>
      </div>

      <!-- Billing Cycle Toggle -->
      <div
        class="bg-card border-sidebar-border inline-flex items-center self-start rounded-2xl border p-1 shadow-xs md:self-auto"
      >
        <button
          type="button"
          @click="billingCycle = 'monthly'"
          class="cursor-pointer rounded-xl px-4 py-1.5 text-xs font-bold transition-all"
          :class="
            billingCycle === 'monthly'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
          "
        >
          Monthly Billing
        </button>
        <button
          type="button"
          @click="billingCycle = 'annual'"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition-all"
          :class="
            billingCycle === 'annual'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
          "
        >
          Annual Billing
          <span
            class="rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-tight"
            :class="
              billingCycle === 'annual'
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-primary/10 text-primary'
            "
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

    <!-- Dual Coverage / Associate Notice Banner -->
    <div
      v-if="associateCoverage"
      class="flex flex-col justify-between gap-4 rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-6 shadow-xs sm:flex-row sm:items-center"
    >
      <div class="flex items-start gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        >
          <Icon
            name="lucide:building-2"
            class="h-5 w-5"
          />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="text-foreground text-sm font-bold">Clinic Associate Coverage</h4>
            <span
              class="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 capitalize dark:text-indigo-400"
            >
              {{ associateCoverage.role }}
            </span>
            <span
              v-if="isInherited"
              class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600"
            >
              Active Coverage
            </span>
          </div>
          <p class="text-muted-foreground mt-0.5 text-xs">
            Stationed at
            <strong class="text-foreground">{{ associateCoverage.clinic_name }}</strong> • Sponsored
            by <strong class="text-foreground">Dr. {{ associateCoverage.owner_name }}</strong> under
            their {{ associateCoverage.plan_name }}.
          </p>
          <p
            v-if="directSubscription && isInherited"
            class="text-muted-foreground mt-1 text-[11px]"
          >
            Note: You also hold a personal {{ directSubscription.plan?.name || 'subscription' }}.
            Your active status is automatically upgraded to Dr. {{ associateCoverage.owner_name }}'s
            {{ associateCoverage.plan_name }} to grant you full multi-doctor clinical privileges.
          </p>
          <p
            v-else-if="!isInherited"
            class="text-muted-foreground mt-1 text-[11px]"
          >
            You hold your own personal active plan, and you are also covered with shared clinic
            capabilities under this clinic branch.
          </p>
        </div>
      </div>

      <AppButton
        to="/doctor/profile?tab=clinics"
        variant="solid"
        size="sm"
        class="shrink-0 self-start shadow-xs sm:self-auto"
      >
        <Icon
          name="lucide:building"
          class="mr-1.5 h-4 w-4"
        />
        <span>View Clinic & Doctor Team</span>
      </AppButton>
    </div>

    <!-- Active Subscription Banner -->
    <div
      v-if="currentSubscription"
      class="border-primary/20 bg-card space-y-4 rounded-3xl border p-6 shadow-sm"
    >
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-primary text-xs font-semibold tracking-wider uppercase"
              >Current Plan</span
            >
            <AppBadge
              :color="getBadgeColor(currentSubscription.status)"
              variant="subtle"
              size="sm"
            >
              {{ currentSubscription.status }}
            </AppBadge>
            <span
              v-if="isInherited"
              class="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600"
            >
              Sponsored by Clinic
            </span>
            <AppBadge
              v-else-if="currentSubscription.auto_renew"
              color="success"
              variant="subtle"
              size="sm"
            >
              <Icon
                name="lucide:refresh-cw"
                class="mr-1 h-3 w-3"
              />
              Auto-Renew On
            </AppBadge>
            <AppBadge
              v-else
              color="warning"
              variant="subtle"
              size="sm"
            >
              <Icon
                name="lucide:refresh-ccw-off"
                class="mr-1 h-3 w-3"
              />
              Auto-Renew Off
            </AppBadge>
          </div>
          <h2 class="text-foreground text-xl font-bold">
            {{
              currentSubscription.plan_snapshot?.name ||
              currentSubscription.plan?.name ||
              'Standard Tier'
            }}
            <span class="text-muted-foreground text-sm font-normal"
              >({{ currentSubscription.billing_cycle }})</span
            >
          </h2>
          <p
            v-if="!isInherited"
            class="text-muted-foreground text-xs"
          >
            {{
              currentSubscription.is_pending_cancellation ? 'Expires on' : 'Renews / Valid until'
            }}
            {{
              new Date(currentSubscription.ends_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            }}
          </p>
          <p
            v-else
            class="text-muted-foreground text-xs"
          >
            Active via Clinic Seat Membership • Billing managed by Clinic Owner
          </p>
        </div>

        <div
          v-if="!isInherited"
          class="flex flex-wrap items-center gap-2.5"
        >
          <AppButton
            v-if="currentSubscription.is_pending_cancellation || !currentSubscription.auto_renew"
            variant="solid"
            size="sm"
            :loading="isResumingSub"
            @click="handleResumeSubscription"
          >
            <Icon
              name="lucide:rotate-ccw"
              class="mr-1 h-3.5 w-3.5"
            />
            Resume Auto-Renew
          </AppButton>
          <AppButton
            variant="outline"
            size="sm"
            @click="openCheckout(currentSubscription.plan)"
          >
            Renew Plan
          </AppButton>
          <AppButton
            v-if="!currentSubscription.is_pending_cancellation && currentSubscription.auto_renew"
            variant="ghost"
            size="sm"
            class="text-destructive hover:bg-destructive/10 cursor-pointer text-xs"
            @click="openCancelModal"
          >
            <Icon
              name="lucide:x-circle"
              class="mr-1 h-3.5 w-3.5"
            />
            Cancel Plan
          </AppButton>
        </div>
      </div>

      <!-- Auto-Renew Toggle Bar (Doctor direct subscription) -->
      <div
        v-if="!isInherited"
        class="border-sidebar-border flex flex-col justify-between gap-3 border-t pt-3 text-xs sm:flex-row sm:items-center"
      >
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            role="switch"
            :aria-checked="currentSubscription.auto_renew"
            :disabled="isTogglingAutoRenew"
            @click="handleToggleAutoRenew(!currentSubscription.auto_renew)"
            class="focus:ring-primary relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
            :class="currentSubscription.auto_renew ? 'bg-primary' : 'bg-muted-foreground/30'"
          >
            <span
              class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out"
              :class="currentSubscription.auto_renew ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
          <div>
            <span class="text-foreground font-bold">
              Auto-Renewal: {{ currentSubscription.auto_renew ? 'Active' : 'Disabled' }}
            </span>
            <span class="text-muted-foreground ml-1 text-[11px]">
              ({{
                currentSubscription.auto_renew
                  ? 'Plan extends automatically on expiration date'
                  : 'Plan will not renew; access ends on expiration date'
              }})
            </span>
          </div>
        </div>

        <div
          v-if="currentSubscription.is_pending_cancellation"
          class="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400"
        >
          <Icon
            name="lucide:clock"
            class="h-3.5 w-3.5 shrink-0"
          />
          <span>Scheduled to expire at end of current cycle</span>
        </div>
      </div>
    </div>

    <!-- Pending Cancellation Alert Banner -->
    <div
      v-if="currentSubscription?.is_pending_cancellation && !isInherited"
      class="flex flex-col justify-between gap-4 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-xs sm:flex-row sm:items-center"
    >
      <div class="flex items-start gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400"
        >
          <Icon
            name="lucide:alert-triangle"
            class="h-5 w-5"
          />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="text-foreground text-sm font-bold">
              Subscription Scheduled for Cancellation
            </h4>
            <span
              class="rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300"
            >
              No Auto-Renewal
            </span>
          </div>
          <p class="text-muted-foreground mt-0.5 text-xs">
            You cancelled auto-renewal. Your active benefits (AI scans, doctor seats, practice
            quotas) remain accessible until
            <strong class="text-foreground">{{
              new Date(currentSubscription.ends_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            }}</strong
            >. You can resume auto-renew anytime before then.
          </p>
        </div>
      </div>

      <AppButton
        variant="solid"
        size="sm"
        class="shrink-0 self-start shadow-xs sm:self-auto"
        :loading="isResumingSub"
        @click="handleResumeSubscription"
      >
        <Icon
          name="lucide:rotate-ccw"
          class="mr-1.5 h-4 w-4"
        />
        <span>Keep / Resume Plan</span>
      </AppButton>
    </div>

    <!-- Plan Update Available Notice -->
    <div
      v-if="currentSubscription?.has_plan_update && !isInherited"
      class="flex flex-col justify-between gap-4 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-xs sm:flex-row sm:items-center"
    >
      <div class="flex items-start gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400"
        >
          <Icon
            name="lucide:sparkles"
            class="h-5 w-5"
          />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="text-foreground text-sm font-bold">New Plan Updates Available!</h4>
            <span
              class="rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300"
            >
              v{{ currentSubscription.latest_plan_version || 'Latest' }} Available
            </span>
          </div>
          <p class="text-muted-foreground mt-0.5 text-xs">
            Your plan has received new features and quota updates. Your current access remains
            locked to your original terms until renewal on
            {{
              new Date(currentSubscription.ends_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            }}. You can upgrade / renew now to gain immediate access to the new features!
          </p>
        </div>
      </div>

      <AppButton
        variant="solid"
        size="sm"
        class="shrink-0 self-start bg-amber-600 text-white shadow-xs hover:bg-amber-700 sm:self-auto"
        @click="openCheckout(currentSubscription.plan)"
      >
        <Icon
          name="lucide:arrow-up-circle"
          class="mr-1.5 h-4 w-4"
        />
        <span>Upgrade / Renew to Latest</span>
      </AppButton>
    </div>

    <!-- Loading Skeleton -->
    <div
      v-if="isLoading"
      class="grid gap-6 md:grid-cols-3"
    >
      <div
        v-for="n in 3"
        :key="n"
        class="bg-muted/20 h-96 animate-pulse rounded-3xl"
      ></div>
    </div>

    <!-- Pricing Cards Grid -->
    <div
      v-else
      class="grid items-stretch gap-6 md:grid-cols-3"
    >
      <div
        v-for="plan in plans"
        :key="plan.uuid"
        :class="[
          'bg-card relative flex flex-col justify-between rounded-3xl border p-6 shadow-sm transition-all',
          currentSubscription?.plan?.uuid === plan.uuid
            ? 'border-primary ring-primary/20 ring-2'
            : 'border-sidebar-border hover:border-primary/50'
        ]"
      >
        <div class="space-y-4">
          <!-- Recommended Badge -->
          <div
            v-if="plan.tier_type === 'professional'"
            class="absolute -top-3 left-1/2 -translate-x-1/2"
          >
            <AppBadge
              color="primary"
              variant="solid"
              size="sm"
            >
              Most Popular
            </AppBadge>
          </div>

          <div>
            <h3 class="text-foreground text-lg font-bold">{{ plan.name }}</h3>
            <p class="text-muted-foreground mt-0.5 text-xs">
              {{ formatTierLabel(plan.tier_type) }}
            </p>
          </div>

          <!-- Price Display -->
          <div class="flex items-baseline gap-1">
            <span class="text-foreground text-3xl font-extrabold">
              ₱{{ calculateBasePrice(plan).toLocaleString() }}
            </span>
            <span class="text-muted-foreground text-xs font-medium">
              / {{ billingCycle === 'annual' ? 'year' : 'month' }}
            </span>
          </div>

          <!-- Quotas List -->
          <ul class="border-sidebar-border text-foreground/80 space-y-2.5 border-t pt-4 text-xs">
            <li class="flex items-center gap-2">
              <Icon
                name="heroicons:check-circle"
                class="text-primary h-4 w-4 shrink-0"
              />
              <span
                ><strong>{{ plan.max_doctors ? plan.max_doctors : 'Unlimited' }}</strong> Doctor
                Seats</span
              >
            </li>
            <li class="flex items-center gap-2">
              <Icon
                name="heroicons:check-circle"
                class="text-primary h-4 w-4 shrink-0"
              />
              <span
                ><strong>{{ plan.max_clinics ? plan.max_clinics : 'Unlimited' }}</strong> Clinic
                Branches</span
              >
            </li>
            <li
              v-if="
                plan.max_secretaries !== undefined &&
                plan.max_secretaries !== null &&
                plan.max_secretaries > 0
              "
              class="flex items-center gap-2"
            >
              <Icon
                name="heroicons:check-circle"
                class="text-primary h-4 w-4 shrink-0"
              />
              <span
                ><strong>{{ plan.max_secretaries }}</strong> Secretary Account{{
                  plan.max_secretaries > 1 ? 's' : ''
                }}</span
              >
            </li>
            <li
              v-else-if="plan.max_secretaries === null"
              class="flex items-center gap-2"
            >
              <Icon
                name="heroicons:check-circle"
                class="text-primary h-4 w-4 shrink-0"
              />
              <span><strong>Unlimited</strong> Secretary Accounts</span>
            </li>
            <li
              v-for="(feat, idx) in extractFeatureItems(plan)"
              :key="idx"
              class="flex items-center gap-2"
            >
              <Icon
                name="heroicons:check-circle"
                class="text-primary h-4 w-4 shrink-0"
              />
              <span>{{ feat }}</span>
            </li>
          </ul>
        </div>

        <div class="space-y-2 pt-6">
          <AppButton
            :variant="
              currentSubscription?.plan?.uuid === plan.uuid && !currentSubscription?.has_plan_update
                ? 'ghost'
                : 'solid'
            "
            block
            :disabled="
              currentSubscription?.plan?.uuid === plan.uuid && !currentSubscription?.has_plan_update
            "
            @click="openCheckout(plan)"
          >
            {{
              currentSubscription?.plan?.uuid === plan.uuid
                ? currentSubscription?.has_plan_update
                  ? 'Upgrade to Latest Version'
                  : 'Current Active Plan'
                : 'Subscribe Now'
            }}
          </AppButton>

          <AppButton
            v-if="
              currentSubscription?.plan?.uuid === plan.uuid &&
              plan.max_doctors &&
              plan.max_doctors > 1 &&
              !isInherited
            "
            to="/doctor/profile?tab=clinics#seats"
            variant="solid"
            size="sm"
            block
          >
            <Icon
              name="lucide:user-plus"
              class="mr-1 h-4 w-4"
            />
            <span>Manage Doctor Seats</span>
          </AppButton>

          <AppButton
            v-else-if="currentSubscription?.plan?.uuid === plan.uuid && isInherited"
            to="/doctor/profile?tab=clinics#seats"
            variant="outline"
            size="sm"
            block
          >
            <Icon
              name="lucide:users"
              class="mr-1.5 h-4 w-4"
            />
            <span>View Doctor Team</span>
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Invoices / Purchase History -->
    <div class="space-y-4 pt-6">
      <h2 class="text-foreground text-lg font-bold">Payment & Billing History</h2>

      <div
        v-if="invoices.length === 0"
        class="border-sidebar-border bg-card rounded-3xl border p-8 text-center"
      >
        <Icon
          name="heroicons:document-text"
          class="text-muted-foreground mx-auto mb-2 h-10 w-10"
        />
        <p class="text-foreground text-sm font-medium">No payment invoices found</p>
        <p class="text-muted-foreground mt-1 text-xs">
          Select a plan above to initiate your first subscription order.
        </p>
      </div>

      <div
        v-else
        class="border-sidebar-border bg-card overflow-hidden rounded-3xl border shadow-sm"
      >
        <div class="overflow-x-auto">
          <table class="text-foreground/80 w-full text-left text-xs">
            <thead
              class="bg-muted/10 text-foreground border-sidebar-border border-b text-[11px] font-semibold tracking-wider uppercase"
            >
              <tr>
                <th class="px-4 py-3.5">Date</th>
                <th class="px-4 py-3.5">Plan / Cycle</th>
                <th class="px-4 py-3.5">Payment Type</th>
                <th class="px-4 py-3.5">Reference</th>
                <th class="px-4 py-3.5">Amount</th>
                <th class="px-4 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-sidebar-border divide-y">
              <tr
                v-for="inv in paginatedInvoices"
                :key="inv.uuid"
                class="hover:bg-muted/10"
              >
                <td class="text-foreground px-4 py-3.5 font-medium">
                  {{
                    new Date(inv.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  }}
                </td>
                <td class="px-4 py-3.5">
                  {{ inv.subscription?.plan?.name || 'Subscription' }}
                </td>
                <td class="text-foreground px-4 py-3.5 font-semibold uppercase">Online Checkout</td>
                <td class="text-muted-foreground px-4 py-3.5 font-mono">
                  {{ inv.transaction_reference || 'N/A' }}
                </td>
                <td class="text-foreground px-4 py-3.5 font-bold">
                  ₱{{ Number(inv.final_amount).toLocaleString() }}
                </td>
                <td class="px-4 py-3.5 text-right">
                  <AppBadge
                    :color="getBadgeColor(inv.payment_status)"
                    variant="subtle"
                    size="xs"
                  >
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
        <div class="bg-muted/10 border-sidebar-border space-y-2 rounded-2xl border p-4 text-xs">
          <div class="text-muted-foreground flex justify-between">
            <span>Base Price ({{ billingCycle }})</span>
            <span class="text-foreground font-semibold"
              >₱{{ selectedPlan ? calculateBasePrice(selectedPlan).toLocaleString() : 0 }}</span
            >
          </div>
          <div
            v-if="couponDiscount"
            class="text-primary flex justify-between"
          >
            <span>Discount ({{ couponDiscount.code }})</span>
            <span class="font-semibold"
              >-₱{{ couponDiscount.discount_amount.toLocaleString() }}</span
            >
          </div>
          <div
            class="text-foreground border-sidebar-border flex justify-between border-t pt-2 text-sm font-bold"
          >
            <span>Total Amount</span>
            <span
              >₱{{
                selectedPlan
                  ? (couponDiscount
                      ? couponDiscount.final_amount
                      : calculateBasePrice(selectedPlan)
                    ).toLocaleString()
                  : 0
              }}</span
            >
          </div>
        </div>

        <!-- Coupon Input -->
        <div class="space-y-1.5">
          <label class="text-foreground text-xs font-semibold">Have a Promo Coupon?</label>
          <div class="flex gap-2">
            <input
              v-model="couponCode"
              type="text"
              placeholder="ENTER CODE"
              class="border-sidebar-border bg-card text-foreground focus:ring-primary flex-1 rounded-2xl border px-3 py-2 font-mono text-xs uppercase focus:ring-2 focus:outline-hidden"
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
          <p
            v-if="couponError"
            class="text-destructive text-[11px]"
          >
            {{ couponError }}
          </p>
        </div>

        <!-- Instant Payment Method Features -->
        <div class="bg-primary/5 border-primary/20 space-y-2 rounded-2xl border p-4 text-xs">
          <p class="text-primary flex items-center gap-1.5 font-bold">
            <Icon
              name="heroicons:bolt"
              class="text-primary h-4 w-4"
            />
            Instant Automated Subscription Activation
          </p>
          <p class="text-muted-foreground">
            You will be redirected to a secure checkout portal supporting
            <strong>GCash, Maya, QR Ph, and Credit/Debit Cards</strong>. Your subscription activates
            immediately upon payment completion.
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

    <!-- Cancellation Confirmation Modal -->
    <AppModal
      v-model="isCancelModalOpen"
      title="Cancel Subscription Plan"
      description="You will continue to have full access until the end of your paid billing period."
      size="lg"
    >
      <div class="space-y-4 py-2">
        <div class="bg-muted/20 border-sidebar-border space-y-1.5 rounded-2xl border p-4 text-xs">
          <div class="text-foreground flex items-center gap-2 font-semibold">
            <Icon
              name="lucide:info"
              class="text-primary h-4 w-4 shrink-0"
            />
            <span>How cancellation works</span>
          </div>
          <p class="text-muted-foreground">
            Your plan will remain fully active until
            <strong class="text-foreground">{{
              currentSubscription?.ends_at
                ? new Date(currentSubscription.ends_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                : 'the end of your current cycle'
            }}</strong
            >. Auto-renewal will be turned off and you will not be charged again. You can resume
            your plan at any time before expiration.
          </p>
        </div>

        <div class="space-y-2">
          <label class="text-foreground text-xs font-bold"
            >Please select a reason for cancelling:</label
          >
          <div class="space-y-2">
            <label
              v-for="(reason, idx) in cancellationReasons"
              :key="idx"
              class="border-sidebar-border hover:bg-muted/10 text-foreground flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-xs font-medium transition-colors"
              :class="
                cancelReason === reason ? 'border-primary bg-primary/5 ring-primary/30 ring-1' : ''
              "
            >
              <input
                type="radio"
                name="cancelReason"
                :value="reason"
                v-model="cancelReason"
                class="accent-primary"
              />
              <span>{{ reason }}</span>
            </label>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-foreground text-xs font-bold">Additional feedback (optional):</label>
          <textarea
            v-model="cancelFeedback"
            rows="3"
            placeholder="Help us improve DermAssist with any details or suggestions..."
            class="border-sidebar-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary w-full rounded-xl border p-3 text-xs focus:ring-1 focus:outline-hidden"
          ></textarea>
        </div>
      </div>

      <template #footer>
        <div class="flex w-full items-center justify-end gap-3">
          <AppButton
            variant="ghost"
            size="md"
            @click="isCancelModalOpen = false"
            :disabled="isCancellingSub"
          >
            Keep My Plan
          </AppButton>
          <AppButton
            variant="solid"
            size="md"
            class="bg-destructive hover:bg-destructive/90 text-white"
            :loading="isCancellingSub"
            @click="handleConfirmCancel"
          >
            Confirm Cancellation
          </AppButton>
        </div>
      </template>
    </AppModal>
  </div>
</template>
