<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import {
    doctorSubscriptionService,
    type DoctorPlan
  } from '~/api/subscription/DoctorSubscriptionService'

  const { isSubscribed, currentSubscription, planName, fetchSubscription } = useDoctorSubscription()

  const allPlans = ref<DoctorPlan[]>([])
  const isLoading = ref(true)
  const isDismissed = ref(false)

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
    const currentTier = currentSubscription.value.plan?.tier_type
    if (currentTier === 'clinic_multi_doctor') return true

    const currentPrice = Number(currentSubscription.value.plan?.price_monthly || 0)
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

    const currentPrice = Number(currentSubscription.value?.plan?.price_monthly || 0)
    // Find active plans priced strictly higher than current plan, sorted ascending
    const higherPlans = allPlans.value
      .filter(p => p.is_active && Number(p.price_monthly || 0) > currentPrice)
      .sort((a, b) => Number(a.price_monthly || 0) - Number(b.price_monthly || 0))

    return higherPlans[0] || highestPlan.value || null
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
      sessionStorage.setItem('dermassist_doctor_sub_ad_dismissed', 'true')
    } catch {}
  }

  const loadData = async () => {
    try {
      isLoading.value = true
      try {
        if (sessionStorage.getItem('dermassist_doctor_sub_ad_dismissed') === 'true') {
          isDismissed.value = true
        }
      } catch {}

      const [, plansRes] = await Promise.all([
        fetchSubscription(),
        doctorSubscriptionService.getPlans()
      ])

      allPlans.value = plansRes.data || []
    } catch (e) {
      console.error('Failed to fetch plans for subscription ad:', e)
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    loadData()
  })

  // Format currency
  const formatCurrency = (val: number | string) => {
    const num = Number(val || 0)
    return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
  }
</script>

<template>
  <div
    v-if="shouldShowAd"
    class="border-primary/25 from-primary/10 via-card to-background hover:border-primary/40 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-4.5 shadow-sm transition-all hover:shadow-md"
  >
    <!-- Background subtle glow -->
    <div
      class="bg-primary/10 pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl"
    />

    <!-- Header / Dismiss -->
    <div class="relative flex items-start justify-between gap-2">
      <div class="flex items-center gap-2">
        <span
          class="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
        >
          <Icon
            name="lucide:sparkles"
            class="h-3.5 w-3.5"
          />
          {{ isSubscribed ? 'Upgrade Opportunity' : 'Practice Growth' }}
        </span>
        <span
          v-if="isSubscribed"
          class="text-muted-foreground max-w-[120px] truncate text-[11px] font-semibold"
        >
          {{ planName }}
        </span>
      </div>

      <button
        @click="dismissAd"
        title="Dismiss for session"
        class="text-muted-foreground/60 hover:text-foreground rounded-full p-1 transition-colors"
      >
        <Icon
          name="lucide:x"
          class="h-4 w-4"
        />
      </button>
    </div>

    <!-- Main pitch -->
    <div class="relative mt-2.5 flex flex-col gap-1">
      <h3 class="text-foreground text-sm font-bold tracking-tight">
        <template v-if="recommendedPlan"> Level up to {{ recommendedPlan.name }} </template>
        <template v-else> Scale your practice with DermAssist Pro </template>
      </h3>

      <p class="text-muted-foreground text-xs leading-relaxed">
        <template v-if="!isSubscribed">
          Unlock AI skin lesion scanning, teleconsultations, and automated patient triage.
        </template>
        <template v-else-if="recommendedPlan?.tier_type === 'clinic_multi_doctor'">
          Add associate doctors, delegate to multiple clinic branches, and share pooled quotas.
        </template>
        <template v-else-if="recommendedPlan?.max_secretaries">
          Delegate clinic operations to dedicated secretary accounts and manage multi-clinic
          schedules.
        </template>
        <template v-else>
          Unlock elevated quotas, multi-clinic locations, and premium clinical analytics.
        </template>
      </p>
    </div>

    <!-- Highlights & CTA -->
    <div
      class="border-border/60 relative mt-3.5 flex items-center justify-between gap-3 border-t pt-2"
    >
      <div class="flex flex-col">
        <span class="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          {{ recommendedPlan ? 'Starting at' : 'Subscription' }}
        </span>
        <div class="flex items-baseline gap-1">
          <span class="text-foreground text-sm font-black">
            {{ recommendedPlan ? formatCurrency(recommendedPlan.price_monthly) : 'Plans' }}
          </span>
          <span class="text-muted-foreground text-[10px] font-medium">/mo</span>
        </div>
      </div>

      <AppButton
        to="/doctor/subscription"
        variant="solid"
        size="sm"
        class="shrink-0 font-bold shadow-xs hover:shadow-sm"
      >
        <span>{{ isSubscribed ? 'Upgrade Plan' : 'Explore Plans' }}</span>
        <Icon
          name="lucide:arrow-right"
          class="ml-1 h-3.5 w-3.5"
        />
      </AppButton>
    </div>
  </div>
</template>
