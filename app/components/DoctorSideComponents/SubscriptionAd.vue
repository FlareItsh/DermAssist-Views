<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue'
  import {
    doctorSubscriptionService,
    type DoctorPlan
  } from '~/api/subscription/DoctorSubscriptionService'

  const userUuid = useCookie('user_uuid')
  const { isSubscribed, currentSubscription, planName, fetchSubscription } = useDoctorSubscription()

  const allPlans = ref<DoctorPlan[]>([])
  const isLoading = ref(true)
  const isDismissed = ref(false)

  // Per-user dismissal storage key so dismissing on one account doesn't affect another
  const dismissKey = computed(
    () => `dermassist_doctor_sub_ad_dismissed_${userUuid.value || 'guest'}`
  )

  // Highest tier plan in the system
  const highestPlan = computed<DoctorPlan | null>(() => {
    if (!allPlans.value.length) return null
    return [...allPlans.value].sort(
      (a, b) => Number(b.price_monthly || 0) - Number(a.price_monthly || 0)
    )[0]
  })

  // Whether user is currently on the highest plan
  const isOnBestPlan = computed(() => {
    if (!isSubscribed.value || !currentSubscription.value) return false
    const currentTier =
      currentSubscription.value.plan?.tier_type ||
      currentSubscription.value.plan_snapshot?.tier_type
    if (currentTier === 'clinic_multi_doctor') return true

    const currentPrice = Number(
      currentSubscription.value.plan?.price_monthly ??
        currentSubscription.value.plan_snapshot?.price_monthly ??
        0
    )
    const maxPrice = Number(highestPlan.value?.price_monthly || 0)
    return currentPrice >= maxPrice && maxPrice > 0
  })

  // Next recommended upgrade plan
  const recommendedPlan = computed<DoctorPlan | null>(() => {
    if (!allPlans.value.length) return null
    if (!isSubscribed.value) {
      // Recommend entry or popular plan
      return allPlans.value.find(p => p.tier_type === 'individual') || allPlans.value[0] || null
    }

    const currentPrice = Number(
      currentSubscription.value?.plan?.price_monthly ??
        currentSubscription.value?.plan_snapshot?.price_monthly ??
        0
    )
    // Find active plans priced strictly higher than current plan, sorted ascending
    const higherPlans = allPlans.value
      .filter(p => p.is_active && Number(p.price_monthly || 0) > currentPrice)
      .sort((a, b) => Number(a.price_monthly || 0) - Number(b.price_monthly || 0))

    return higherPlans[0] || highestPlan.value || null
  })

  const pitchText = computed(() => {
    if (!isSubscribed.value) {
      return 'Unlock AI skin lesion scanning, teleconsultations, and automated patient triage.'
    }
    if (recommendedPlan.value?.tier_type === 'clinic_multi_doctor') {
      return 'Add associate doctors, delegate to multiple clinic branches, and share pooled quotas.'
    }
    if (recommendedPlan.value?.tier_type === 'doctor_multi_clinic') {
      return 'Manage multiple clinic locations, assign duty presets, and register dedicated secretaries.'
    }
    if (recommendedPlan.value?.max_secretaries) {
      return 'Delegate clinic operations to dedicated secretary accounts and export clinical reports.'
    }
    return 'Unlock elevated quotas, multi-clinic locations, and premium clinical diagnostics.'
  })

  const shouldShowAd = computed(() => {
    if (isLoading.value) return false
    if (isDismissed.value) return false
    // Rule: if what they subscribed is the best plan, don't show any ad
    if (isOnBestPlan.value) return false
    return Boolean(recommendedPlan.value || !isSubscribed.value)
  })

  const dismissAd = () => {
    isDismissed.value = true
    try {
      sessionStorage.setItem(dismissKey.value, 'true')
    } catch {}
  }

  const navigateToSubscription = () => {
    navigateTo('/doctor/subscription')
  }

  const loadData = async () => {
    try {
      isLoading.value = true
      try {
        if (sessionStorage.getItem(dismissKey.value) === 'true') {
          isDismissed.value = true
        } else {
          isDismissed.value = false
        }
      } catch {}

      const [, plansRes] = await Promise.all([
        fetchSubscription(true),
        doctorSubscriptionService.getPlans()
      ])

      const plans = Array.isArray((plansRes as any)?.data)
        ? (plansRes as any).data
        : Array.isArray(plansRes)
          ? plansRes
          : []
      allPlans.value = plans
    } catch (e) {
      console.error('Failed to fetch plans for subscription ad:', e)
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    loadData()
  })

  watch(
    () => userUuid.value,
    () => {
      loadData()
    }
  )

  // Format currency
  const formatCurrency = (val: number | string) => {
    const num = Number(val || 0)
    return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
  }
</script>

<template>
  <div
    v-if="shouldShowAd"
    role="link"
    tabindex="0"
    @click="navigateToSubscription"
    @keydown.enter="navigateToSubscription"
    class="group border-primary-light/30 from-primary via-primary to-primary-dark text-primary-foreground shadow-primary/20 hover:shadow-primary/30 relative cursor-pointer overflow-hidden rounded-3xl border bg-gradient-to-br p-5 shadow-lg transition-all duration-300 select-none hover:-translate-y-1 hover:shadow-xl focus:ring-2 focus:ring-white/40 focus:outline-none"
  >
    <!-- Background dynamic ambient glows -->
    <div
      class="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/15 blur-2xl transition-transform duration-500 group-hover:scale-125"
    />
    <div
      class="bg-secondary/30 pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full blur-xl"
    />

    <!-- Header / Dismiss -->
    <div class="relative flex items-center justify-between gap-2">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span
          class="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/20 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white uppercase shadow-2xs backdrop-blur-xs"
        >
          <Icon
            name="lucide:sparkles"
            class="h-3.5 w-3.5 animate-pulse text-white"
          />
          {{ isSubscribed ? 'Upgrade Opportunity' : 'Practice Growth' }}
        </span>

        <span
          v-if="isSubscribed && planName"
          class="inline-flex max-w-[170px] items-center truncate rounded-lg border border-white/20 bg-black/15 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-xs"
          :title="`Current plan: ${planName}`"
        >
          {{ planName }}
        </span>
      </div>

      <button
        type="button"
        @click.stop="dismissAd"
        title="Dismiss for session"
        aria-label="Dismiss banner"
        class="relative z-10 rounded-full p-1 text-white/75 transition-colors hover:bg-white/20 hover:text-white"
      >
        <Icon
          name="lucide:x"
          class="h-4 w-4"
        />
      </button>
    </div>

    <!-- Main pitch -->
    <div class="relative mt-3 flex flex-col gap-1">
      <h3 class="drop-shadow-2xs text-base font-black tracking-tight text-white transition-colors">
        <template v-if="recommendedPlan"> Level up to {{ recommendedPlan.name }} </template>
        <template v-else> Scale your practice with DermAssist Pro </template>
      </h3>

      <p class="text-xs leading-relaxed text-white/90">
        {{ pitchText }}
      </p>
    </div>

    <!-- Highlights & CTA -->
    <div
      class="relative mt-3.5 flex items-center justify-between gap-3 border-t border-white/20 pt-3"
    >
      <div class="flex flex-col">
        <span class="text-[10px] font-bold tracking-wider text-white/75 uppercase">
          {{ recommendedPlan ? 'Starting at' : 'Subscription' }}
        </span>
        <div class="flex items-baseline gap-1">
          <span class="text-lg font-black tracking-tight text-white">
            {{ recommendedPlan ? formatCurrency(recommendedPlan.price_monthly) : 'Plans' }}
          </span>
          <span class="text-[10px] font-semibold text-white/75">/mo</span>
        </div>
      </div>

      <div
        class="text-primary inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black shadow-md transition-all duration-200 group-hover:scale-102 group-hover:bg-white/95 group-hover:shadow-lg"
      >
        <span>{{ isSubscribed ? 'Upgrade Plan' : 'Explore Plans' }}</span>
        <Icon
          name="lucide:arrow-right"
          class="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1"
        />
      </div>
    </div>
  </div>
</template>
