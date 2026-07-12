import { appealService } from '~/api/appeal/AppealService'

export interface AdminAppealUser {
  first_name?: string
  last_name?: string
  email?: string
  affiliation?: string | null
}

export interface AdminAppeal {
  uuid: string
  diagnosis_label?: string
  suggested_label?: string
  description?: string
  created_at?: string
  updated_at?: string
  user?: AdminAppealUser
}

const getAppealsData = (response: any): AdminAppeal[] => {
  return Array.isArray(response) ? response : response?.data || []
}

const getAppealTimestamp = (appeal: AdminAppeal) => appeal.created_at || appeal.updated_at || ''

export const useAdminAppeals = () => {
  const appeals = useState<AdminAppeal[]>('admin-appeals-list', () => [])
  const isLoadingAppeals = useState<boolean>('admin-appeals-loading', () => false)
  const appealsError = useState<string | null>('admin-appeals-error', () => null)

  const filterStatus = useState<string>('admin-appeals-filter', () => 'pending')

  const resolvedAppealUuids = useCookie<string[]>('admin_resolved_appeals', {
    default: () => [],
    maxAge: 60 * 60 * 24 * 365
  })

  const filteredAppeals = computed(() => {
    if (filterStatus.value === 'resolved') {
      return appeals.value.filter(a => resolvedAppealUuids.value.includes(a.uuid))
    }
    return appeals.value.filter(a => !resolvedAppealUuids.value.includes(a.uuid))
  })

  const sortedAppeals = computed(() => {
    return [...filteredAppeals.value].sort((a, b) => {
      return new Date(getAppealTimestamp(b) || 0).getTime() - new Date(getAppealTimestamp(a) || 0).getTime()
    })
  })

  const latestAppealSignature = computed(() => {
    return sortedAppeals.value.map(appeal => `${appeal.uuid}:${getAppealTimestamp(appeal)}`).join('|')
  })

  const seenAppealSignature = useCookie<string | null>('admin_seen_appeals_signature', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 365
  })

  const hasUnseenAppeals = computed(() => {
    return Boolean(latestAppealSignature.value && seenAppealSignature.value !== latestAppealSignature.value && filterStatus.value === 'pending')
  })

  const fetchAppeals = async () => {
    isLoadingAppeals.value = true
    appealsError.value = null

    try {
      const response = await appealService.list()
      appeals.value = getAppealsData(response)
    } catch (error: any) {
      appealsError.value = error?.message || 'Failed to load doctor scan appeals.'
    } finally {
      isLoadingAppeals.value = false
    }
  }

  const markAppealsSeen = () => {
    if (filterStatus.value === 'pending') {
      seenAppealSignature.value = latestAppealSignature.value || null
    }
  }

  const resolveAppeal = (uuid: string) => {
    if (!resolvedAppealUuids.value.includes(uuid)) {
      resolvedAppealUuids.value.push(uuid)
    }
  }
  
  const restoreAppeal = (uuid: string) => {
    resolvedAppealUuids.value = resolvedAppealUuids.value.filter(id => id !== uuid)
  }

  return {
    appeals,
    sortedAppeals,
    isLoadingAppeals,
    appealsError,
    filterStatus,
    hasUnseenAppeals,
    fetchAppeals,
    markAppealsSeen,
    resolveAppeal,
    restoreAppeal
  }
}
