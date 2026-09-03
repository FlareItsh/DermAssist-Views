import { computed } from 'vue'
import { doctorSubscriptionService, type DoctorSubscription } from '~/api/subscription/DoctorSubscriptionService'

export const useDoctorSubscription = () => {
  const currentSubscription = useState<DoctorSubscription | null>('doctor-active-subscription', () => null)
  const isLoadingSubscription = useState<boolean>('doctor-subscription-loading', () => false)
  const lastFetchedAt = useState<number | null>('doctor-subscription-fetched-at', () => null)

  const isSubscribed = computed(() => {
    if (!currentSubscription.value) return false
    const status = currentSubscription.value.status
    return status === 'active' || status === 'trialing'
  })

  const planFeatures = computed(() => {
    return currentSubscription.value?.plan?.features || {}
  })

  const canExecuteScan = computed(() => {
    if (!isSubscribed.value) return false
    return Boolean(planFeatures.value?.can_execute_scan)
  })

  const canHaveSecretary = computed(() => {
    if (!isSubscribed.value) return false
    const plan = currentSubscription.value?.plan
    if (!plan) return false
    const features = (plan.features || {}) as Record<string, any>
    return Boolean(features?.can_have_secretary) || plan.max_secretaries === null || (plan.max_secretaries !== undefined && plan.max_secretaries > 0)
  })

  const maxSecretaries = computed(() => {
    if (!isSubscribed.value) return 0
    return currentSubscription.value?.plan?.max_secretaries ?? null
  })

  const hasFeature = (featureKey: string) => {
    if (!isSubscribed.value) return false
    return Boolean(planFeatures.value?.[featureKey])
  }

  const planName = computed(() => {
    return currentSubscription.value?.plan?.name || 'Free / Unsubscribed'
  })

  const fetchSubscription = async (force = false) => {
    // Cache for 30 seconds unless forced
    const now = Date.now()
    if (!force && lastFetchedAt.value && now - lastFetchedAt.value < 30000 && currentSubscription.value !== null) {
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
    hasFeature,
    planName,
    fetchSubscription
  }
}
