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
        items.push('Patient Scan Recommendations')
      }
      if (features.can_execute_scan === true) {
        items.push('Doctor AI Scan Execution')
      }
      if (features.export_pdf_reports === true) {
        items.push('PDF Clinical Report Exports')
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
  <div class="mx-auto flex max-w-7xl flex-col gap-6 p-4 pb-12 sm:p-6">
    <!-- Header -->
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
          Subscription & Plans
        </h1>
        <p class="text-xs text-gray-500 sm:text-sm">
          Manage your clinical practice tier, multi-doctor clinic seat allocation, and billing
          history.
        </p>
      </div>
    </div>

    <!-- Alert Feedback Banner -->
    <AppAlert
      v-if="bannerAlert.type"
      :type="bannerAlert.type"
      :title="bannerAlert.title"
      :description="bannerAlert.description"
    />

    <!-- ───────────────────────────────────────────────────────────────────────── -->
    <!-- UNIFIED HERO CARD: ACTIVE PLAN & CLINICAL COVERAGE                        -->
    <!-- ───────────────────────────────────────────────────────────────────────── -->
    <div
      v-if="currentSubscription || associateCoverage"
      class="relative overflow-hidden rounded-3xl border border-gray-200/90 bg-white p-5 shadow-xs transition-all hover:border-gray-300 sm:p-6"
    >
      <!-- Top Section: Plan Headline & Status -->
      <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <!-- Status Badges Row -->
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-indigo-600 uppercase"
            >
              Current Plan
            </span>

            <AppBadge
              :color="getBadgeColor(currentSubscription?.status || 'active')"
              variant="subtle"
              size="sm"
            >
              {{ currentSubscription?.status || 'Active' }}
            </AppBadge>

            <span
              v-if="isInherited"
              class="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700"
            >
              <Icon
                name="lucide:shield-check"
                class="text-xs"
              />
              Sponsored by Clinic
            </span>

            <span
              v-else-if="currentSubscription?.auto_renew"
              class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700"
            >
              <Icon
                name="lucide:refresh-cw"
                class="text-xs"
              />
              Auto-Renew Active
            </span>

            <span
              v-else
              class="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800"
            >
              <Icon
                name="lucide:refresh-ccw-off"
                class="text-xs"
              />
              Auto-Renew Off
            </span>
          </div>

          <!-- Plan Title -->
          <h2 class="mt-2 text-xl font-black text-gray-900 sm:text-2xl">
            {{
              currentSubscription?.plan_snapshot?.name ||
              currentSubscription?.plan?.name ||
              associateCoverage?.plan_name ||
              'Clinical Tier'
            }}
            <span class="text-sm font-semibold text-gray-400">
              ({{ currentSubscription?.billing_cycle || 'monthly' }})
            </span>
          </h2>

          <!-- Plan Subtitle / Renewal Date -->
          <p class="mt-1 text-xs text-gray-500">
            <template v-if="!isInherited && currentSubscription?.ends_at">
              {{
                currentSubscription.is_pending_cancellation
                  ? 'Access expires on:'
                  : 'Next renewal / valid until:'
              }}
              <strong class="text-gray-800">
                {{
                  new Date(currentSubscription.ends_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                }}
              </strong>
            </template>
            <template v-else-if="isInherited">
              Active via Clinic Seat Membership • Billing managed by Clinic Owner
            </template>
          </p>
        </div>

        <!-- Direct Actions on Active Plan (If not inherited) -->
        <div
          v-if="!isInherited && currentSubscription"
          class="flex flex-wrap items-center gap-2"
        >
          <AppButton
            v-if="currentSubscription.is_pending_cancellation || !currentSubscription.auto_renew"
            variant="solid"
            size="sm"
            class="bg-indigo-600 text-white hover:bg-indigo-700"
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
            v-if="currentSubscription.status === 'expired' || !currentSubscription.is_active"
            variant="solid"
            size="sm"
            class="bg-indigo-600 text-white hover:bg-indigo-700"
            @click="openCheckout(currentSubscription.plan)"
          >
            <Icon
              name="lucide:refresh-cw"
              class="mr-1 h-3.5 w-3.5"
            />
            Renew Plan
          </AppButton>

          <AppButton
            v-if="
              currentSubscription.is_active &&
              currentSubscription.status === 'active' &&
              !currentSubscription.is_pending_cancellation &&
              currentSubscription.auto_renew
            "
            variant="ghost"
            size="sm"
            class="text-xs font-bold text-rose-600 hover:bg-rose-50"
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

      <!-- Associate Clinic Coverage Integration Box (When covered under a clinic) -->
      <div
        v-if="associateCoverage"
        class="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 sm:flex-row sm:items-center"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"
          >
            <Icon
              name="lucide:building-2"
              class="h-4 w-4"
            />
          </div>
          <div class="text-xs">
            <div class="flex items-center gap-2">
              <span class="font-bold text-gray-900">Clinic Associate Station</span>
              <span
                class="py-0.2 rounded-md bg-indigo-100/80 px-1.5 text-[10px] font-bold text-indigo-700 uppercase"
              >
                {{ associateCoverage.role || 'Associate' }}
              </span>
            </div>
            <p class="mt-0.5 text-gray-600">
              Stationed at
              <strong class="text-gray-900">{{ associateCoverage.clinic_name }}</strong> • Sponsored
              by <strong class="text-gray-900">Dr. {{ associateCoverage.owner_name }}</strong> under
              their {{ associateCoverage.plan_name }}.
            </p>
            <p
              v-if="directSubscription && associateCoverage && !isInherited"
              class="mt-1 text-[11px] text-gray-500"
            >
              Note: You hold an active personal
              <strong>{{ directSubscription.plan?.name || 'subscription' }}</strong> for your
              private practice while benefiting from team privileges at
              {{ associateCoverage.clinic_name }}.
            </p>
            <p
              v-else-if="directSubscription && isInherited"
              class="mt-1 text-[11px] text-gray-500"
            >
              Note: You also hold a personal {{ directSubscription.plan?.name || 'subscription' }}.
              Your active status is automatically upgraded to Dr.
              {{ associateCoverage.owner_name }}'s {{ associateCoverage.plan_name }} for full team
              privileges.
            </p>
          </div>
        </div>

        <AppButton
          to="/doctor/profile?tab=clinics"
          variant="outline"
          size="sm"
          class="shrink-0 border-indigo-200 bg-white font-bold text-indigo-700 hover:bg-indigo-50"
        >
          <Icon
            name="lucide:users"
            class="mr-1.5 h-3.5 w-3.5"
          />
          View Clinic Team
        </AppButton>
      </div>

      <!-- Auto-Renewal Switch Row (Direct subscriptions only) -->
      <div
        v-if="!isInherited && currentSubscription"
        class="mt-4 flex flex-col justify-between gap-3 border-t border-gray-100 pt-3 text-xs sm:flex-row sm:items-center"
      >
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            role="switch"
            :aria-checked="currentSubscription.auto_renew"
            :disabled="isTogglingAutoRenew"
            @click="handleToggleAutoRenew(!currentSubscription.auto_renew)"
            class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            :class="currentSubscription.auto_renew ? 'bg-indigo-600' : 'bg-gray-200'"
          >
            <span
              class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out"
              :class="currentSubscription.auto_renew ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
          <div>
            <span class="font-bold text-gray-900">
              Auto-Renewal: {{ currentSubscription.auto_renew ? 'Active' : 'Disabled' }}
            </span>
            <span class="ml-1 text-[11px] text-gray-500">
              ({{
                currentSubscription.auto_renew
                  ? 'Plan automatically renews on expiration date'
                  : 'Plan will not renew; access ends on expiration date'
              }})
            </span>
          </div>
        </div>

        <div
          v-if="currentSubscription.is_pending_cancellation"
          class="flex items-center gap-1 text-[11px] font-medium text-amber-700"
        >
          <Icon
            name="lucide:clock"
            class="h-3.5 w-3.5 shrink-0"
          />
          <span>Scheduled to expire at end of current cycle</span>
        </div>
      </div>
    </div>

    <!-- ───────────────────────────────────────────────────────────────────────── -->
    <!-- PLAN SELECTION SECTION                                                    -->
    <!-- ───────────────────────────────────────────────────────────────────────── -->
    <div class="space-y-4">
      <!-- Section Header with Contextual Billing Cycle Switcher -->
      <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 class="text-lg font-black text-gray-900 sm:text-xl">Available Practice Plans</h2>
          <p class="text-xs text-gray-500">
            Scale your clinical capacity, add doctor seats, or register secretary accounts.
          </p>
        </div>

        <!-- Billing Cycle Toggle -->
        <div
          class="inline-flex items-center self-start rounded-2xl border border-gray-200 bg-gray-100 p-1 shadow-2xs sm:self-auto"
        >
          <button
            type="button"
            @click="billingCycle = 'monthly'"
            class="cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              billingCycle === 'monthly'
                ? 'border border-gray-200/60 bg-white text-indigo-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            "
          >
            Monthly Billing
          </button>
          <button
            type="button"
            @click="billingCycle = 'annual'"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              billingCycle === 'annual'
                ? 'border border-gray-200/60 bg-white text-indigo-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            "
          >
            Annual Billing
            <span
              class="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              :class="
                billingCycle === 'annual'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'bg-emerald-100 text-emerald-800'
              "
            >
              Save ~17%
            </span>
          </button>
        </div>
      </div>

      <!-- Loading Skeleton -->
      <div
        v-if="isLoading"
        class="grid grid-cols-1 gap-5 md:grid-cols-3"
      >
        <div
          v-for="n in 3"
          :key="n"
          class="h-80 animate-pulse rounded-3xl border border-gray-200/70 bg-gray-50/80 p-5 shadow-xs"
        />
      </div>

      <!-- Pricing Cards Grid -->
      <div
        v-else
        class="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div
          v-for="plan in plans"
          :key="plan.uuid"
          :class="[
            'relative flex flex-col justify-between rounded-3xl border bg-white p-5 shadow-xs transition-all hover:shadow-md sm:p-6',
            currentSubscription?.plan?.uuid === plan.uuid
              ? 'border-indigo-600 ring-2 ring-indigo-600/20'
              : 'border-gray-200/80 hover:border-indigo-300'
          ]"
        >
          <div>
            <!-- Most Popular Badge -->
            <div
              v-if="
                plan.slug === 'individual-doctor-secretary-plan' ||
                plan.tier_type === 'professional'
              "
              class="absolute -top-3 left-1/2 -translate-x-1/2"
            >
              <span
                class="rounded-full bg-indigo-600 px-3 py-0.5 text-[10px] font-extrabold tracking-wide text-white shadow-xs"
              >
                MOST POPULAR
              </span>
            </div>

            <!-- Card Header -->
            <div class="flex items-baseline justify-between gap-2">
              <div>
                <h3 class="text-base font-black text-gray-900">{{ plan.name }}</h3>
                <p class="text-[11px] font-semibold text-gray-500">
                  {{ formatTierLabel(plan.tier_type) }}
                </p>
              </div>

              <span
                v-if="currentSubscription?.plan?.uuid === plan.uuid"
                class="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700"
              >
                {{ isInherited ? 'Clinic Seat' : 'Current' }}
              </span>
            </div>

            <!-- Price -->
            <div class="mt-4 flex items-baseline gap-1">
              <span class="text-3xl font-black text-gray-900">
                ₱{{ calculateBasePrice(plan).toLocaleString() }}
              </span>
              <span class="text-xs font-semibold text-gray-400">
                / {{ billingCycle === 'annual' ? 'year' : 'month' }}
              </span>
            </div>

            <!-- Quotas Row -->
            <div
              class="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-gray-50/70 p-2.5 text-center text-xs"
            >
              <div>
                <span class="block text-[10px] font-bold text-gray-400 uppercase">Doctors</span>
                <span class="font-extrabold text-gray-900">
                  {{ plan.max_doctors ? plan.max_doctors : 'Unlimited' }}
                </span>
              </div>
              <div class="border-x border-gray-200/60">
                <span class="block text-[10px] font-bold text-gray-400 uppercase">Clinics</span>
                <span class="font-extrabold text-gray-900">
                  {{ plan.max_clinics ? plan.max_clinics : 'Unlimited' }}
                </span>
              </div>
              <div>
                <span class="block text-[10px] font-bold text-gray-400 uppercase">Secretaries</span>
                <span class="font-extrabold text-gray-900">
                  {{ plan.max_secretaries ?? 'Unlimited' }}
                </span>
              </div>
            </div>

            <!-- Feature Checkmarks List -->
            <ul class="mt-4 space-y-2 border-t border-gray-100 pt-4 text-xs text-gray-600">
              <li
                v-for="(feat, idx) in extractFeatureItems(plan)"
                :key="idx"
                class="flex items-center gap-2"
              >
                <Icon
                  name="lucide:check-circle-2"
                  class="h-4 w-4 shrink-0 text-indigo-600"
                />
                <span class="font-medium text-gray-700">{{ feat }}</span>
              </li>
            </ul>
          </div>

          <!-- Bottom Card Actions -->
          <div class="mt-6 space-y-2 border-t border-gray-100 pt-2">
            <AppButton
              :variant="
                currentSubscription?.plan?.uuid === plan.uuid &&
                currentSubscription?.is_active &&
                currentSubscription?.status === 'active' &&
                !currentSubscription?.has_plan_update
                  ? 'ghost'
                  : 'solid'
              "
              block
              class="w-full justify-center text-xs font-bold"
              :class="
                currentSubscription?.plan?.uuid === plan.uuid &&
                currentSubscription?.is_active &&
                currentSubscription?.status === 'active' &&
                !currentSubscription?.has_plan_update
                  ? 'cursor-default border border-gray-200 bg-gray-50 text-gray-500'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              "
              :disabled="
                currentSubscription?.plan?.uuid === plan.uuid &&
                currentSubscription?.is_active &&
                currentSubscription?.status === 'active' &&
                !currentSubscription?.has_plan_update
              "
              @click="openCheckout(plan)"
            >
              {{
                currentSubscription?.plan?.uuid === plan.uuid
                  ? isInherited
                    ? 'Covered via Clinic Seat'
                    : currentSubscription?.is_active && currentSubscription?.status === 'active'
                      ? currentSubscription?.has_plan_update
                        ? 'Upgrade to Latest Version'
                        : 'Current Active Plan'
                      : 'Renew Plan'
                  : currentSubscription?.is_active &&
                      currentSubscription?.status === 'active' &&
                      !isInherited
                    ? 'Switch to Plan'
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
              variant="outline"
              size="sm"
              block
              class="w-full justify-center border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
            >
              <Icon
                name="lucide:user-plus"
                class="mr-1 h-3.5 w-3.5"
              />
              Manage Doctor Seats
            </AppButton>

            <AppButton
              v-else-if="currentSubscription?.plan?.uuid === plan.uuid && isInherited"
              to="/doctor/profile?tab=clinics#seats"
              variant="outline"
              size="sm"
              block
              class="w-full justify-center border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              <Icon
                name="lucide:users"
                class="mr-1.5 h-3.5 w-3.5"
              />
              View Doctor Team
            </AppButton>
          </div>
        </div>
      </div>
    </div>

    <!-- ───────────────────────────────────────────────────────────────────────── -->
    <!-- BILLING & INVOICE HISTORY                                                 -->
    <!-- ───────────────────────────────────────────────────────────────────────── -->
    <div class="space-y-3 pt-2">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-black text-gray-900 sm:text-xl">Payment & Billing History</h2>
        <span class="text-xs font-semibold text-gray-500">
          {{ invoices.length }} {{ invoices.length === 1 ? 'transaction' : 'transactions' }}
        </span>
      </div>

      <div
        v-if="invoices.length === 0"
        class="rounded-3xl border border-gray-200/80 bg-white p-8 text-center shadow-xs"
      >
        <Icon
          name="lucide:receipt"
          class="mx-auto mb-2 h-10 w-10 text-gray-400"
        />
        <p class="text-sm font-bold text-gray-800">No payment invoices found</p>
        <p class="mt-1 text-xs text-gray-500">
          Invoices and receipts will appear here once an online checkout is completed.
        </p>
      </div>

      <div
        v-else
        class="overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-xs"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-gray-700">
            <thead
              class="border-b border-gray-200/80 bg-gray-50/80 text-[11px] font-bold tracking-wider text-gray-500 uppercase"
            >
              <tr>
                <th class="px-4 py-3">Date</th>
                <th class="px-4 py-3">Plan / Cycle</th>
                <th class="px-4 py-3">Payment Method</th>
                <th class="px-4 py-3">Reference</th>
                <th class="px-4 py-3">Amount</th>
                <th class="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="inv in paginatedInvoices"
                :key="inv.uuid"
                class="transition-colors hover:bg-gray-50/60"
              >
                <td class="px-4 py-3 font-semibold text-gray-900">
                  {{
                    new Date(inv.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  }}
                </td>
                <td class="px-4 py-3 font-medium text-gray-800">
                  {{ inv.subscription?.plan?.name || 'Subscription' }}
                </td>
                <td class="px-4 py-3 font-semibold text-gray-600 uppercase">Online Checkout</td>
                <td class="px-4 py-3 font-mono text-[11px] text-gray-500">
                  {{ inv.transaction_reference || 'N/A' }}
                </td>
                <td class="px-4 py-3 font-extrabold text-gray-900">
                  ₱{{ Number(inv.final_amount).toLocaleString() }}
                </td>
                <td class="px-4 py-3 text-right">
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

    <!-- ───────────────────────────────────────────────────────────────────────── -->
    <!-- CHECKOUT MODAL                                                            -->
    <!-- ───────────────────────────────────────────────────────────────────────── -->
    <AppModal
      v-model="isCheckoutOpen"
      :title="selectedPlan ? `Checkout: ${selectedPlan.name}` : 'Checkout'"
      :description="billingCycle === 'annual' ? 'Annual Billing Cycle' : 'Monthly Billing Cycle'"
      size="lg"
    >
      <div class="space-y-5">
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
        <div class="space-y-2 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 text-xs">
          <div class="flex justify-between text-gray-500">
            <span>Base Price ({{ billingCycle }})</span>
            <span class="font-bold text-gray-900">
              ₱{{ selectedPlan ? calculateBasePrice(selectedPlan).toLocaleString() : 0 }}
            </span>
          </div>
          <div
            v-if="couponDiscount"
            class="flex justify-between text-indigo-700"
          >
            <span>Discount ({{ couponDiscount.code }})</span>
            <span class="font-bold">-₱{{ couponDiscount.discount_amount.toLocaleString() }}</span>
          </div>
          <div
            class="flex justify-between border-t border-gray-200/80 pt-2 text-sm font-black text-gray-900"
          >
            <span>Total Amount</span>
            <span>
              ₱{{
                selectedPlan
                  ? (couponDiscount
                      ? couponDiscount.final_amount
                      : calculateBasePrice(selectedPlan)
                    ).toLocaleString()
                  : 0
              }}
            </span>
          </div>
        </div>

        <!-- Coupon Input -->
        <div class="space-y-1.5">
          <label class="block text-xs font-bold text-gray-700">Promo Coupon Code</label>
          <div class="flex gap-2">
            <input
              v-model="couponCode"
              type="text"
              placeholder="ENTER CODE"
              class="h-9 flex-1 rounded-xl border border-gray-200 bg-white px-3 font-mono text-xs text-gray-900 uppercase outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <AppButton
              variant="outline"
              size="sm"
              class="rounded-xl"
              :disabled="isValidatingCoupon || !couponCode"
              :loading="isValidatingCoupon"
              @click="handleValidateCoupon"
            >
              Apply
            </AppButton>
          </div>
          <p
            v-if="couponError"
            class="text-[11px] font-bold text-rose-600"
          >
            {{ couponError }}
          </p>
        </div>

        <!-- Payment Notice -->
        <div class="space-y-1 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs">
          <p class="flex items-center gap-1.5 font-bold text-indigo-900">
            <Icon
              name="lucide:zap"
              class="h-4 w-4 text-indigo-600"
            />
            Instant Automated Subscription Activation
          </p>
          <p class="text-gray-600">
            Secure checkout gateway supporting
            <strong>GCash, Maya, QR Ph, and Credit/Debit Cards</strong>. Your subscription activates
            immediately upon payment completion.
          </p>
        </div>
      </div>

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
          class="bg-indigo-600 text-white hover:bg-indigo-700"
          :loading="isSubmittingCheckout"
          @click="processCheckout"
        >
          Proceed to Secure Payment
        </AppButton>
      </template>
    </AppModal>

    <!-- ───────────────────────────────────────────────────────────────────────── -->
    <!-- CANCELLATION CONFIRMATION MODAL                                           -->
    <!-- ───────────────────────────────────────────────────────────────────────── -->
    <AppModal
      v-model="isCancelModalOpen"
      title="Cancel Subscription Plan"
      description="You will continue to have full access until the end of your paid billing period."
      size="lg"
    >
      <div class="space-y-4 py-2">
        <div class="space-y-1.5 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 text-xs">
          <div class="flex items-center gap-2 font-bold text-gray-900">
            <Icon
              name="lucide:info"
              class="h-4 w-4 shrink-0 text-indigo-600"
            />
            <span>How cancellation works</span>
          </div>
          <p class="text-gray-600">
            Your plan will remain fully active until
            <strong class="text-gray-900">
              {{
                currentSubscription?.ends_at
                  ? new Date(currentSubscription.ends_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : 'the end of your current cycle'
              }} </strong
            >. Auto-renewal will be turned off and you will not be charged again. You can resume
            your plan at any time before expiration.
          </p>
        </div>

        <div class="space-y-2">
          <label class="block text-xs font-bold text-gray-700"
            >Please select a reason for cancelling:</label
          >
          <div class="space-y-2">
            <label
              v-for="(reason, idx) in cancellationReasons"
              :key="idx"
              class="flex cursor-pointer items-center gap-2.5 rounded-xl border border-gray-200 p-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              :class="
                cancelReason === reason
                  ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600/30'
                  : ''
              "
            >
              <input
                type="radio"
                name="cancelReason"
                :value="reason"
                v-model="cancelReason"
                class="accent-indigo-600"
              />
              <span>{{ reason }}</span>
            </label>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="block text-xs font-bold text-gray-700"
            >Additional feedback (optional):</label
          >
          <textarea
            v-model="cancelFeedback"
            rows="3"
            placeholder="Help us improve DermAssist with any details or suggestions..."
            class="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
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
            class="bg-rose-600 text-white hover:bg-rose-700"
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
