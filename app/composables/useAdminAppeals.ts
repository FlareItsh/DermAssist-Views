import { appealService } from '~/api/appeal/AppealService'

export interface AdminAppealUser {
  id?: number
  uuid?: string
  first_name?: string
  last_name?: string
  email?: string
  affiliation?: string | null
  avatar_path?: string | null
}

export interface AdminAppealDiagnosis {
  id?: number
  uuid?: string
  label?: string
  confidence?: number
  probabilities?: Record<string, number>
  image_url?: string | null
  image_path?: string | null
  is_out_of_scope?: boolean
  out_of_scope_category?: string | null
  contributed_to_dataset?: boolean
  created_at?: string
  patient?: {
    id?: number
    uuid?: string
    first_name?: string
    last_name?: string
    email?: string
  } | null
}

export interface AdminAppeal {
  id?: number
  uuid: string
  diagnosis_label?: string
  suggested_label?: string
  description?: string
  status?: string
  resolved_at?: string | null
  resolution_notes?: string | null
  created_at?: string
  updated_at?: string
  user?: AdminAppealUser
  diagnosis?: AdminAppealDiagnosis | null
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

  const filteredAppeals = computed(() => {
    if (filterStatus.value === 'resolved') {
      return appeals.value.filter(a => a.status === 'resolved')
    }
    if (filterStatus.value === 'rejected') {
      return appeals.value.filter(a => a.status === 'rejected')
    }
    return appeals.value.filter(a => a.status !== 'resolved' && a.status !== 'rejected')
  })

  const sortedAppeals = computed(() => {
    return [...filteredAppeals.value].sort((a, b) => {
      return (
        new Date(getAppealTimestamp(b) || 0).getTime() -
        new Date(getAppealTimestamp(a) || 0).getTime()
      )
    })
  })

  const allSortedAppeals = computed(() => {
    return [...appeals.value].sort((a, b) => {
      return (
        new Date(getAppealTimestamp(b) || 0).getTime() -
        new Date(getAppealTimestamp(a) || 0).getTime()
      )
    })
  })

  const pendingCount = computed(
    () => appeals.value.filter(a => a.status !== 'resolved' && a.status !== 'rejected').length
  )
  const resolvedCount = computed(() => appeals.value.filter(a => a.status === 'resolved').length)
  const rejectedCount = computed(() => appeals.value.filter(a => a.status === 'rejected').length)
  const totalCount = computed(() => appeals.value.length)

  const latestAppealSignature = computed(() => {
    return sortedAppeals.value
      .map(appeal => `${appeal.uuid}:${getAppealTimestamp(appeal)}`)
      .join('|')
  })

  const seenAppealSignature = useCookie<string | null>('admin_seen_appeals_signature', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 365
  })

  const hasUnseenAppeals = computed(() => {
    return Boolean(
      latestAppealSignature.value &&
      seenAppealSignature.value !== latestAppealSignature.value &&
      filterStatus.value === 'pending'
    )
  })

  const fetchAppeals = async () => {
    isLoadingAppeals.value = true
    appealsError.value = null

    try {
      const response = await appealService.list({ status: 'all' })
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

  const resolveAppeal = async (
    uuid: string,
    options: { resolution_notes?: string; update_dataset?: boolean } = {}
  ) => {
    try {
      const res = await appealService.resolve(uuid, options)
      const updated = res?.data || res
      const idx = appeals.value.findIndex(a => a.uuid === uuid)
      if (idx !== -1) {
        appeals.value[idx] = {
          ...appeals.value[idx],
          ...updated,
          status: 'resolved',
          resolved_at: new Date().toISOString()
        }
      }
      return updated
    } catch (err: any) {
      throw err
    }
  }

  const rejectAppeal = async (uuid: string, options: { resolution_notes?: string } = {}) => {
    try {
      const res = await appealService.reject(uuid, options)
      const updated = res?.data || res
      const idx = appeals.value.findIndex(a => a.uuid === uuid)
      if (idx !== -1) {
        appeals.value[idx] = {
          ...appeals.value[idx],
          ...updated,
          status: 'rejected',
          resolved_at: new Date().toISOString()
        }
      }
      return updated
    } catch (err: any) {
      throw err
    }
  }

  const restoreAppeal = async (uuid: string) => {
    try {
      const res = await appealService.restore(uuid)
      const updated = res?.data || res
      const idx = appeals.value.findIndex(a => a.uuid === uuid)
      if (idx !== -1) {
        appeals.value[idx] = {
          ...appeals.value[idx],
          ...updated,
          status: 'pending',
          resolved_at: null
        }
      }
      return updated
    } catch (err: any) {
      throw err
    }
  }

  return {
    appeals,
    sortedAppeals,
    allSortedAppeals,
    isLoadingAppeals,
    appealsError,
    filterStatus,
    pendingCount,
    resolvedCount,
    rejectedCount,
    totalCount,
    hasUnseenAppeals,
    fetchAppeals,
    markAppealsSeen,
    resolveAppeal,
    rejectAppeal,
    restoreAppeal
  }
}
