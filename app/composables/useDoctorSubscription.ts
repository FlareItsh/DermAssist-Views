import { computed } from 'vue'
import {
  doctorSubscriptionService,
  type DoctorSubscription
} from '~/api/subscription/DoctorSubscriptionService'

export const useDoctorSubscription = () => {
  const currentSubscription = useState<DoctorSubscription | null>(
    'doctor-active-subscription',
    () => null
  )
  const isLoadingSubscription = useState<boolean>('doctor-subscription-loading', () => false)
  const lastFetchedAt = useState<number | null>('doctor-subscription-fetched-at', () => null)

  const isSubscribed = computed(() => {
    if (!currentSubscription.value) return false
    const status = currentSubscription.value.status
    return status === 'active' || status === 'trialing'
  })

  const planFeatures = computed(() => {
    return (
      currentSubscription.value?.plan_snapshot?.features ||
      currentSubscription.value?.effective_features ||
      currentSubscription.value?.plan?.features ||
      {}
    )
  })

  const canExecuteScan = computed(() => {
    if (!isSubscribed.value) return false
    return Boolean(planFeatures.value?.can_execute_scan)
  })

  const maxSecretaries = computed(() => {
    if (!isSubscribed.value) return 0
    if (
      currentSubscription.value?.plan_snapshot &&
      currentSubscription.value.plan_snapshot.max_secretaries !== undefined
    ) {
      return currentSubscription.value.plan_snapshot.max_secretaries
    }
    if (currentSubscription.value?.effective_max_secretaries !== undefined) {
      return currentSubscription.value.effective_max_secretaries
    }
    return currentSubscription.value?.plan?.max_secretaries ?? null
  })

  const maxClinics = computed(() => {
    if (!isSubscribed.value) return 1
    if (
      currentSubscription.value?.plan_snapshot &&
      currentSubscription.value.plan_snapshot.max_clinics !== undefined
    ) {
      return currentSubscription.value.plan_snapshot.max_clinics
    }
    if (currentSubscription.value?.effective_max_clinics !== undefined) {
      return currentSubscription.value.effective_max_clinics
    }
    return currentSubscription.value?.plan?.max_clinics ?? 1
  })

  const canHaveSecretary = computed(() => {
    if (!isSubscribed.value) return false
    return (
      Boolean(planFeatures.value?.can_have_secretary) ||
      maxSecretaries.value === null ||
      (maxSecretaries.value !== undefined && maxSecretaries.value > 0)
    )
  })

  const hasPlanUpdate = computed(() => {
    return Boolean(currentSubscription.value?.has_plan_update)
  })

  const isAutoRenew = computed(() => {
    return Boolean(currentSubscription.value?.auto_renew)
  })

  const isPendingCancellation = computed(() => {
    return Boolean(currentSubscription.value?.is_pending_cancellation)
  })

  const hasFeature = (featureKey: string) => {
    if (!isSubscribed.value) return false
    return Boolean(planFeatures.value?.[featureKey])
  }

  const planName = computed(() => {
    return (
      currentSubscription.value?.plan_snapshot?.name ||
      currentSubscription.value?.plan?.name ||
      'Free / Unsubscribed'
    )
  })

  const fetchSubscription = async (force = false) => {
    // Cache for 30 seconds unless forced
    const now = Date.now()
    if (
      !force &&
      lastFetchedAt.value &&
      now - lastFetchedAt.value < 30000 &&
      currentSubscription.value !== null
    ) {
      return currentSubscription.value
    }

    const role = useCookie('user_role').value
    if (role !== 'doctor') return null

    isLoadingSubscription.value = true
    try {
      const res = await doctorSubscriptionService.getMySubscription()
      currentSubscription.value = res.data?.subscription || null
      lastFetchedAt.value = now
    } catch (e) {
      console.error('Failed to fetch doctor subscription status:', e)
      currentSubscription.value = null
    } finally {
      isLoadingSubscription.value = false
    }

    return currentSubscription.value
  }

  return {
    subscription: currentSubscription,
    currentSubscription,
    isLoadingSubscription,
    isSubscribed,
    planFeatures,
    canExecuteScan,
    canHaveSecretary,
    maxSecretaries,
    maxClinics,
    hasPlanUpdate,
    isAutoRenew,
    isPendingCancellation,
    hasFeature,
    planName,
    fetchSubscription
  }
}
