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

  const planName = computed(() => {
    return currentSubscription.value?.plan?.name || 'Free / Unsubscribed'
  })

  const fetchSubscription = async (force = false) => {
    // Cache for 30 seconds unless forced
    const now = Date.now()
    if (!force && lastFetchedAt.value && now - lastFetchedAt.value < 30000 && currentSubscription.value !== undefined) {
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
    currentSubscription,
    isLoadingSubscription,
    isSubscribed,
    planName,
    fetchSubscription
  }
}
