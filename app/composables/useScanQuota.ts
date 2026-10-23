import { computed, onMounted, onUnmounted, ref } from 'vue'
import { scanQuotaService, type ScanQuota } from '~/api/scanQuota/ScanQuotaService'

export const useScanQuota = () => {
  const quota = useState<ScanQuota | null>('user-scan-quota', () => null)
  const isLoading = useState<boolean>('user-scan-quota-loading', () => false)
  const lastFetchedAt = useState<number | null>('user-scan-quota-fetched-at', () => null)

  // Local reactive clock for smooth countdown calculation
  const now = ref(Date.now())
  let timerInterval: ReturnType<typeof setInterval> | null = null

  const isUnlimited = computed(() => {
    return quota.value?.is_unlimited ?? false
  })

  const limit = computed(() => {
    return quota.value?.limit ?? null
  })

  const used = computed(() => {
    return quota.value?.used ?? 0
  })

  const remaining = computed(() => {
    if (isUnlimited.value) return null
    return quota.value?.remaining ?? null
  })

  const isLimitReached = computed(() => {
    if (isUnlimited.value) return false
    if (remaining.value === null) return false
    return remaining.value <= 0
  })

  const resetsAt = computed(() => {
    return quota.value?.resets_at ?? null
  })

  const secondsRemaining = computed(() => {
    if (!resetsAt.value) return null
    const diff = Math.floor((new Date(resetsAt.value).getTime() - now.value) / 1000)
    return Math.max(0, diff)
  })

  const formattedCountdown = computed(() => {
    const sec = secondsRemaining.value
    if (sec === null || sec <= 0) return null

    const hours = Math.floor(sec / 3600)
    const minutes = Math.floor((sec % 3600) / 60)
    const seconds = sec % 60

    const pad = (n: number) => n.toString().padStart(2, '0')

    if (hours > 0) {
      return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
    }
    return `${minutes}m ${pad(seconds)}s`
  })

  const quotaSource = computed(() => {
    return quota.value?.source ?? 'free'
  })

  const canScan = computed(() => {
    return quota.value?.can_scan ?? true
  })

  const isDoctorUnverified = computed(() => {
    return quota.value?.source === 'doctor_unverified' || quota.value?.can_scan === false
  })

  const isDoctorTrial = computed(() => {
    return quota.value?.source === 'doctor_trial'
  })

  const isDoctorUnsubscribed = computed(() => {
    return quota.value?.source === 'doctor_unsubscribed'
  })

  const unlimitedUntil = computed(() => {
    return quota.value?.unlimited_until ?? null
  })

  const formattedUnlimitedUntil = computed(() => {
    if (!unlimitedUntil.value) return null
    try {
      const d = new Date(unlimitedUntil.value)
      if (isNaN(d.getTime())) return null
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(d)
    } catch {
      return null
    }
  })

  const formattedUnlimitedRemaining = computed(() => {
    if (!unlimitedUntil.value) return null
    const diff = Math.floor((new Date(unlimitedUntil.value).getTime() - now.value) / 1000)
    if (diff <= 0) return 'Expired'

    const days = Math.floor(diff / 86400)
    const hours = Math.floor((diff % 86400) / 3600)
    if (days > 0) {
      return `${days} ${days === 1 ? 'day' : 'days'}${hours > 0 ? ` ${hours}h` : ''} left`
    }
    const minutes = Math.floor((diff % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m left`
    }
    return `${minutes}m left`
  })

  const fetchQuota = async (force: boolean = false): Promise<ScanQuota | null> => {
    const nowTime = Date.now()
    if (!force && lastFetchedAt.value && nowTime - lastFetchedAt.value < 10000 && quota.value) {
      return quota.value
    }

    try {
      isLoading.value = true
      const response = await scanQuotaService.getQuota()
      if (response && response.data) {
        quota.value = response.data
        lastFetchedAt.value = nowTime
        return response.data
      }
      return null
    } catch (error) {
      console.error('Failed to fetch scan quota:', error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const applyQuota = (newQuota: ScanQuota) => {
    quota.value = newQuota
    lastFetchedAt.value = Date.now()
  }

  const startCountdownTimer = () => {
    if (import.meta.client && !timerInterval) {
      timerInterval = setInterval(() => {
        now.value = Date.now()
        // If countdown expires, refresh quota automatically
        if (
          resetsAt.value &&
          new Date(resetsAt.value).getTime() <= now.value &&
          !isUnlimited.value &&
          (quota.value?.used ?? 0) > 0
        ) {
          fetchQuota(true)
        }

        // If unlimited grace period expires, refresh quota automatically
        if (
          unlimitedUntil.value &&
          new Date(unlimitedUntil.value).getTime() <= now.value &&
          isUnlimited.value
        ) {
          fetchQuota(true)
        }
      }, 1000)
    }
  }

  const stopCountdownTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  return {
    quota,
    isLoading,
    isUnlimited,
    limit,
    used,
    remaining,
    isLimitReached,
    resetsAt,
    secondsRemaining,
    formattedCountdown,
    quotaSource,
    unlimitedUntil,
    formattedUnlimitedUntil,
    formattedUnlimitedRemaining,
    canScan,
    isDoctorUnverified,
    isDoctorTrial,
    isDoctorUnsubscribed,
    fetchQuota,
    applyQuota,
    startCountdownTimer,
    stopCountdownTimer
  }
}
