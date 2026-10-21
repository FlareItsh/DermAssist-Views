<script setup lang="ts">
  import { datasetService, type DatasetCategory } from '~/api/dataset/DatasetService'
  import { subscriptionAdminService } from '~/api/subscription/SubscriptionAdminService'
  import { userService } from '~/api/user/UserService'
  import { verificationService } from '~/api/verification/VerificationService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  interface VerificationUser {
    first_name?: string
    last_name?: string
    email?: string
    affiliation?: string | null
  }

  interface Verification {
    uuid: string
    prc_number?: string
    status: string
    created_at?: string
    updated_at?: string
    user?: VerificationUser
  }

  const isLoadingVerifications = ref(true)
  const isLoadingDatasets = ref(true)
  const isLoadingUsers = ref(true)
  const recentlyVerifiedDoctors = ref<Verification[]>([])
  const pendingVerifications = ref<Verification[]>([])
  const datasets = ref<DatasetCategory[]>([])
  const patientCount = ref(0)
  const doctorCount = ref(0)
  const usersForUsage = ref<any[]>([])
  const {
    appeals,
    sortedAppeals,
    allSortedAppeals,
    pendingCount,
    totalCount,
    isLoadingAppeals,
    fetchAppeals
  } = useAdminAppeals()
  const usageRange = ref<'week' | 'month' | 'year'>('year')
  const hoveredUsagePoint = ref<any | null>(null)

  const getVerificationData = (response: any): Verification[] => {
    return Array.isArray(response) ? response : response?.data || []
  }

  const getResponseCount = (response: any) => {
    if (typeof response?.total === 'number') return response.total
    if (typeof response?.meta?.total === 'number') return response.meta.total
    if (typeof response?.pagination?.total === 'number') return response.pagination.total
    if (Array.isArray(response?.data)) return response.data.length
    if (Array.isArray(response)) return response.length
    return 0
  }

  const getResponseData = (response: any): any[] => {
    return Array.isArray(response) ? response : response?.data || []
  }

  const datasetImageCount = computed(() =>
    datasets.value.reduce((total, dataset) => total + dataset.images.length, 0)
  )

  const sortByDateDesc = (items: Verification[], field: 'created_at' | 'updated_at') => {
    return [...items].sort((a, b) => {
      return new Date(b[field] || 0).getTime() - new Date(a[field] || 0).getTime()
    })
  }

  const recentAppeals = computed(() => allSortedAppeals.value.slice(0, 4))

  const patientTrend = computed(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const patients = usersForUsage.value.filter(u => getUserRole(u) === 'patient')
    const recent = patients.filter(
      u => (u.created_at || u.createdAt) && new Date(u.created_at || u.createdAt) >= thirtyDaysAgo
    ).length
    return {
      value: recent > 0 ? `+${recent}` : '0 new',
      direction: recent > 0 ? ('up' as const) : ('neutral' as const),
      label: 'last 30d'
    }
  })

  const doctorTrend = computed(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const doctors = usersForUsage.value.filter(u => getUserRole(u) === 'doctor')
    const recent = doctors.filter(
      u => (u.created_at || u.createdAt) && new Date(u.created_at || u.createdAt) >= thirtyDaysAgo
    ).length
    return {
      value: recent > 0 ? `+${recent}` : '0 new',
      direction: recent > 0 ? ('up' as const) : ('neutral' as const),
      label: 'last 30d'
    }
  })

  const usageRangeOptions = [
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' }
  ] as const

  const chartWidth = 760
  const chartHeight = 260
  const chartPadding = {
    top: 24,
    right: 24,
    bottom: 28,
    left: 52
  }

  const getUserRole = (user: any) => {
    return String(user.role || user.user_role || '').toLowerCase()
  }

  const usageActivities = computed(() => {
    const userActivities = usersForUsage.value.map(user => ({
      type: getUserRole(user) === 'doctor' ? 'New doctors' : 'New patients',
      date: user.created_at || user.updated_at
    }))

    return [
      ...userActivities,
      ...recentlyVerifiedDoctors.value.map(item => ({
        type: 'Verified doctors',
        date: item.updated_at || item.created_at
      })),
      ...pendingVerifications.value.map(item => ({
        type: 'Pending verifications',
        date: item.created_at || item.updated_at
      })),
      ...appeals.value.map(item => ({
        type: 'Scan appeals',
        date: item.created_at || item.updated_at
      }))
    ]
      .filter(activity => activity.date)
      .map(activity => ({
        ...activity,
        date: new Date(activity.date)
      }))
  })

  const startOfDay = (date: Date) => {
    const next = new Date(date)
    next.setHours(0, 0, 0, 0)
    return next
  }

  const addDays = (date: Date, days: number) => {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
  }

  const addMonths = (date: Date, months: number) => {
    const next = new Date(date)
    next.setMonth(next.getMonth() + months)
    return next
  }

  const usageBuckets = computed(() => {
    const now = new Date()

    if (usageRange.value === 'year') {
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      return Array.from({ length: 12 }, (_, index) => {
        const bucketStart = addMonths(start, index)
        const bucketEnd = addMonths(bucketStart, 1)
        return {
          label: bucketStart.toLocaleDateString('en', { month: 'short' }),
          start: bucketStart,
          end: bucketEnd
        }
      })
    }

    if (usageRange.value === 'month') {
      const start = startOfDay(addDays(now, -29))
      return Array.from({ length: 6 }, (_, index) => {
        const bucketStart = addDays(start, index * 5)
        const bucketEnd = index === 5 ? addDays(startOfDay(now), 1) : addDays(bucketStart, 5)
        return {
          label: `${bucketStart.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`,
          start: bucketStart,
          end: bucketEnd
        }
      })
    }

    const start = startOfDay(addDays(now, -6))
    return Array.from({ length: 7 }, (_, index) => {
      const bucketStart = addDays(start, index)
      return {
        label: bucketStart.toLocaleDateString('en', { weekday: 'short' }),
        start: bucketStart,
        end: addDays(bucketStart, 1)
      }
    })
  })

  const usageSeries = computed(() => {
    return usageBuckets.value.map(bucket => {
      const activities = usageActivities.value.filter(
        activity => activity.date >= bucket.start && activity.date < bucket.end
      )
      const activityCounts = activities.reduce<Record<string, number>>((counts, activity) => {
        counts[activity.type] = (counts[activity.type] || 0) + 1
        return counts
      }, {})

      return {
        label: bucket.label,
        value: activities.length,
        activityCounts: Object.entries(activityCounts).map(([label, count]) => ({
          label,
          count
        }))
      }
    })
  })

  const usageTotal = computed(() =>
    usageSeries.value.reduce((total, point) => total + point.value, 0)
  )
  const usageMax = computed(() => Math.max(...usageSeries.value.map(point => point.value), 1))
  const usageYAxisLabels = computed(() => {
    return Array.from({ length: 5 }, (_, index) => Math.round((usageMax.value / 4) * (4 - index)))
  })

  const usageChartPoints = computed(() => {
    const plotWidth = chartWidth - chartPadding.left - chartPadding.right
    const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom
    const step =
      usageSeries.value.length > 1 ? plotWidth / (usageSeries.value.length - 1) : plotWidth

    return usageSeries.value.map((point, index) => {
      const x = chartPadding.left + step * index
      const y = chartPadding.top + plotHeight - (point.value / usageMax.value) * plotHeight
      return {
        ...point,
        x,
        y
      }
    })
  })

  const usageLinePath = computed(() => {
    if (!usageChartPoints.value.length) return ''
    return usageChartPoints.value.reduce((path, point, index, points) => {
      if (index === 0) return `M ${point.x} ${point.y}`

      const previous = points[index - 1]
      const controlDistance = (point.x - previous.x) / 2
      return `${path} C ${previous.x + controlDistance} ${previous.y}, ${point.x - controlDistance} ${point.y}, ${point.x} ${point.y}`
    }, '')
  })

  const usageAreaPath = computed(() => {
    if (!usageChartPoints.value.length) return ''
    const bottom = chartHeight - chartPadding.bottom
    const first = usageChartPoints.value[0]
    const last = usageChartPoints.value[usageChartPoints.value.length - 1]
    return `${usageLinePath.value} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`
  })

  const tooltipWidth = 150
  const getTooltipX = (point: any) => {
    return Math.min(Math.max(point.x - tooltipWidth / 2, 8), chartWidth - tooltipWidth - 8)
  }

  const getTooltipY = (point: any) => {
    return Math.max(point.y - 92, 8)
  }

  const getAppealDoctorName = (appeal: any) => {
    const first = appeal.user?.first_name?.trim()
    const last = appeal.user?.last_name?.trim()
    return [first, last].filter(Boolean).join(' ') || 'Unknown doctor'
  }

  const formatAppealDate = (date?: string) => {
    if (!date) return 'Recently'
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date))
  }

  const fetchUserCounts = async () => {
    isLoadingUsers.value = true

    try {
      const [patientsResponse, doctorsResponse] = await Promise.all([
        userService.list({ role: 'patient' }),
        userService.list({ role: 'doctor' })
      ])

      patientCount.value = getResponseCount(patientsResponse)
      doctorCount.value = getResponseCount(doctorsResponse)
      usersForUsage.value = [
        ...getResponseData(patientsResponse),
        ...getResponseData(doctorsResponse)
      ]
    } catch (error) {
      console.error('Failed to fetch dashboard user counts:', error)
    } finally {
      isLoadingUsers.value = false
    }
  }

  const fetchVerifications = async () => {
    isLoadingVerifications.value = true

    try {
      const [verifiedResponse, pendingResponse] = await Promise.all([
        verificationService.list({ status: 'verified' }),
        verificationService.list({ status: 'pending' })
      ])

      recentlyVerifiedDoctors.value = sortByDateDesc(
        getVerificationData(verifiedResponse).filter(item => item.status === 'verified'),
        'updated_at'
      ).slice(0, 5)

      pendingVerifications.value = sortByDateDesc(
        getVerificationData(pendingResponse).filter(item => item.status === 'pending'),
        'created_at'
      ).slice(0, 5)
    } catch (error) {
      console.error('Failed to fetch dashboard verifications:', error)
    } finally {
      isLoadingVerifications.value = false
    }
  }

  const fetchDatasets = async () => {
    isLoadingDatasets.value = true

    try {
      datasets.value = await datasetService.getDataset()
    } catch (error) {
      console.error('Failed to fetch dashboard datasets:', error)
    } finally {
      isLoadingDatasets.value = false
    }
  }

  const dashboardStats = ref<any>(null)
  const isLoadingDashboardStats = ref(true)
  const showProfitsModal = ref(false)

  type ModalProfitsFilter = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom'

  const modalProfitsFilter = ref<ModalProfitsFilter>('month')
  const modalProfitsCustomDate = ref<string>(new Date().toISOString().split('T')[0])
  const isLoadingModalFilter = ref(false)
  const modalFilteredData = ref<any | null>(null)
  const isModalMaximized = ref(true)

  const toggleMaximizeModal = () => {
    isModalMaximized.value = !isModalMaximized.value
  }

  const modalFilterOptions: { id: ModalProfitsFilter; label: string }[] = [
    { id: 'month', label: 'This Month' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'all', label: 'All Time' }
  ]

  const fetchModalFilteredProfits = async (date?: string, startDate?: string, endDate?: string) => {
    isLoadingModalFilter.value = true
    try {
      const params: any = {}
      if (date) params.date = date
      if (startDate && endDate) {
        params.start_date = startDate
        params.end_date = endDate
      }
      const res = await subscriptionAdminService.getDashboardStats(params)
      const data = res?.data || res
      modalFilteredData.value = data?.subscription_profits?.filtered_metrics || null
    } catch (err) {
      console.error('Failed to fetch filtered profits:', err)
    } finally {
      isLoadingModalFilter.value = false
    }
  }

  const setModalProfitsFilter = async (filter: ModalProfitsFilter) => {
    modalProfitsFilter.value = filter
    if (filter === 'all') {
      modalFilteredData.value = null
      return
    }

    const today = new Date()
    const formatDate = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    if (filter === 'today') {
      await fetchModalFilteredProfits(formatDate(today))
    } else if (filter === 'yesterday') {
      const yest = new Date(today)
      yest.setDate(yest.getDate() - 1)
      await fetchModalFilteredProfits(formatDate(yest))
    } else if (filter === '7d') {
      const past = new Date(today)
      past.setDate(past.getDate() - 6)
      await fetchModalFilteredProfits(undefined, formatDate(past), formatDate(today))
    } else if (filter === '30d') {
      const past = new Date(today)
      past.setDate(past.getDate() - 29)
      await fetchModalFilteredProfits(undefined, formatDate(past), formatDate(today))
    } else if (filter === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      await fetchModalFilteredProfits(undefined, formatDate(start), formatDate(today))
    } else if (filter === 'custom') {
      if (modalProfitsCustomDate.value) {
        await fetchModalFilteredProfits(modalProfitsCustomDate.value)
      }
    }
  }

  const handleModalCustomDateInput = async (event: Event) => {
    const val = (event.target as HTMLInputElement)?.value
    if (val) {
      modalProfitsCustomDate.value = val
      modalProfitsFilter.value = 'custom'
      await fetchModalFilteredProfits(val)
    }
  }

  const resetModalProfitsFilter = async () => {
    modalProfitsFilter.value = 'month'
    await setModalProfitsFilter('month')
  }

  const handleOpenProfitsModal = async () => {
    showProfitsModal.value = true
    isModalMaximized.value = true
    await setModalProfitsFilter('month')
  }

  const handleCloseProfitsModal = () => {
    showProfitsModal.value = false
    isModalMaximized.value = true
    modalProfitsFilter.value = 'month'
    modalFilteredData.value = null
  }

  const handleUpdateProfitsModal = (val: boolean) => {
    showProfitsModal.value = val
    if (!val) {
      isModalMaximized.value = true
      modalProfitsFilter.value = 'month'
      modalFilteredData.value = null
    }
  }

  const detailedChartWidth = 920
  const detailedChartHeight = 260
  const detailedPadding = { top: 25, bottom: 45, left: 65, right: 25 }

  const detailedChartSeries = computed(() => {
    const now = new Date()
    let startDate: Date
    let endDate: Date = new Date()

    if (modalProfitsFilter.value === 'today') {
      startDate = new Date(now)
    } else if (modalProfitsFilter.value === 'yesterday') {
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 1)
      endDate = new Date(startDate)
    } else if (modalProfitsFilter.value === '7d') {
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 6)
    } else if (modalProfitsFilter.value === '30d') {
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 29)
    } else if (modalProfitsFilter.value === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now)
    } else if (modalProfitsFilter.value === 'custom') {
      const parts = modalProfitsCustomDate.value.split('-')
      if (parts.length === 3) {
        startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        endDate = new Date(startDate)
      } else {
        startDate = new Date(now)
      }
    } else {
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 29)
    }

    const invoiceMap: Record<string, { amount: number; count: number }> = {}
    const rawInvoices = displayedInvoices.value || []
    rawInvoices.forEach((inv: any) => {
      const d = (inv.paid_at || '').split('T')[0] || (inv.paid_at || '').split(' ')[0]
      if (d) {
        if (!invoiceMap[d]) invoiceMap[d] = { amount: 0, count: 0 }
        invoiceMap[d].amount += Number(inv.amount || 0)
        invoiceMap[d].count += 1
      }
    })

    const fallbackTotals = dashboardStats.value?.subscription_profits?.daily_totals || {}
    const series: any[] = []
    const cur = new Date(startDate)
    const end = new Date(endDate)

    if (cur.toISOString().split('T')[0] === end.toISOString().split('T')[0]) {
      const dStr = cur.toISOString().split('T')[0]
      const invData = invoiceMap[dStr]
      return [
        {
          date: dStr,
          label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          full_date: cur.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          amount: invData ? invData.amount : fallbackTotals[dStr] || 0,
          count: invData ? invData.count : fallbackTotals[dStr] ? 1 : 0
        }
      ]
    }

    while (cur <= end) {
      const dStr = cur.toISOString().split('T')[0]
      const invData = invoiceMap[dStr]
      const amt = invData ? invData.amount : fallbackTotals[dStr] || 0
      const count = invData ? invData.count : 0

      series.push({
        date: dStr,
        label:
          cur.getDate() === 1 || series.length === 0
            ? cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : String(cur.getDate()),
        full_date: cur.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        amount: amt,
        count
      })
      cur.setDate(cur.getDate() + 1)
    }

    return series
  })

  const detailedChartMetrics = computed(() => {
    const s = detailedChartSeries.value
    const total = s.reduce((acc, d) => acc + d.amount, 0)
    const totalTx = s.reduce((acc, d) => acc + d.count, 0)
    const avg = s.length > 0 ? total / s.length : 0

    let peak = s[0] || { amount: 0, full_date: 'N/A' }
    s.forEach(d => {
      if (d.amount > peak.amount) peak = d
    })

    return {
      totalFormatted: formatCurrency(total),
      avgFormatted: formatCurrency(avg),
      peakAmount: formatCurrency(peak.amount),
      peakDate: peak.full_date || peak.label || 'N/A',
      totalTx
    }
  })

  const detailedMaxVal = computed(() => {
    const rawMax = Math.max(...detailedChartSeries.value.map(d => d.amount), 500)
    if (rawMax <= 1000) return 1000
    if (rawMax <= 5000) return Math.ceil(rawMax / 1000) * 1000
    if (rawMax <= 20000) return Math.ceil(rawMax / 5000) * 5000
    return Math.ceil(rawMax / 10000) * 10000
  })

  const detailedYScaleTicks = computed(() => {
    const max = detailedMaxVal.value
    return [
      { val: max, label: formatCurrency(max), yRatio: 1 },
      { val: max * 0.66, label: formatCurrency(max * 0.66), yRatio: 0.66 },
      { val: max * 0.33, label: formatCurrency(max * 0.33), yRatio: 0.33 },
      { val: 0, label: '₱0', yRatio: 0 }
    ]
  })

  const detailedPoints = computed(() => {
    const data = detailedChartSeries.value
    const maxVal = detailedMaxVal.value
    const plotWidth = detailedChartWidth - detailedPadding.left - detailedPadding.right
    const plotHeight = detailedChartHeight - detailedPadding.top - detailedPadding.bottom
    const step = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth

    return data.map((d, i) => {
      const x = detailedPadding.left + (data.length === 1 ? plotWidth / 2 : i * step)
      const y = detailedPadding.top + plotHeight - (d.amount / maxVal) * plotHeight
      return {
        ...d,
        x,
        y,
        index: i
      }
    })
  })

  const detailedLinePath = computed(() => {
    const pts = detailedPoints.value
    if (!pts.length) return ''
    if (pts.length === 1) return `M ${pts[0].x - 20} ${pts[0].y} L ${pts[0].x + 20} ${pts[0].y}`
    return pts.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`
      const prev = arr[i - 1]
      const cx = (pt.x - prev.x) / 2
      return `${acc} C ${prev.x + cx} ${prev.y}, ${pt.x - cx} ${pt.y}, ${pt.x} ${pt.y}`
    }, '')
  })

  const detailedAreaPath = computed(() => {
    const pts = detailedPoints.value
    if (!pts.length) return ''
    const line = detailedLinePath.value
    const first = pts[0]
    const last = pts[pts.length - 1]
    const bottomY = detailedChartHeight - detailedPadding.bottom
    return `${line} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`
  })

  const hoveredDetailedPoint = ref<any | null>(null)

  const handleDetailedChartMouseMove = (event: MouseEvent) => {
    const pts = detailedPoints.value
    if (!pts || pts.length === 0) return
    const target = event.currentTarget as HTMLElement
    if (!target) return
    const rect = target.getBoundingClientRect()
    if (rect.width <= 0) return
    const relX = event.clientX - rect.left
    const svgX = (relX / rect.width) * detailedChartWidth

    let closest = pts[0]
    let minDist = Math.abs(pts[0].x - svgX)
    for (let i = 1; i < pts.length; i++) {
      const dist = Math.abs(pts[i].x - svgX)
      if (dist < minDist) {
        minDist = dist
        closest = pts[i]
      }
    }
    hoveredDetailedPoint.value = closest
  }

  const handleDetailedChartMouseLeave = () => {
    hoveredDetailedPoint.value = null
  }

  const formattedProfits = computed(() => {
    const rev = Number(dashboardStats.value?.subscription_profits?.total_revenue || 0)
    return `₱${new Intl.NumberFormat('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rev)}`
  })

  const displayedProfitsAmount = computed(() => {
    if (modalProfitsFilter.value !== 'all' && modalFilteredData.value) {
      return formatCurrency(modalFilteredData.value.amount || 0)
    }
    return formattedProfits.value
  })

  const displayedProfitsSubtitle = computed(() => {
    if (modalProfitsFilter.value === 'all' || !modalFilteredData.value) {
      return 'Lifetime Revenue'
    }
    if (modalProfitsFilter.value === 'today') return 'Gained Today'
    if (modalProfitsFilter.value === 'yesterday') return 'Gained Yesterday'
    if (modalProfitsFilter.value === '7d') return 'Gained in Last 7 Days'
    if (modalProfitsFilter.value === '30d') return 'Gained in Last 30 Days'
    if (modalProfitsFilter.value === 'month') return 'Gained This Month'
    if (modalProfitsFilter.value === 'custom') {
      const parts = modalProfitsCustomDate.value.split('-')
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        return `Gained on ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`
      }
      return `Gained on ${modalProfitsCustomDate.value}`
    }
    return 'Filtered Revenue'
  })

  const displayedInvoices = computed(() => {
    if (modalProfitsFilter.value !== 'all' && modalFilteredData.value) {
      return modalFilteredData.value.invoices || []
    }
    return dashboardStats.value?.subscription_profits?.recent_invoices || []
  })

  const scanUsageTotal = computed(() => {
    return dashboardStats.value?.scan_usage?.total_scans || 0
  })

  const scanUsageDetail = computed(() => {
    const doc = dashboardStats.value?.scan_usage?.doctor_scans_count || 0
    const pat = dashboardStats.value?.scan_usage?.patient_scans_count || 0
    return `${doc} Doctor • ${pat} Patient`
  })

  const scanUsageTrend = computed(() => {
    const recent = dashboardStats.value?.scan_usage?.scans_30d || 0
    return {
      value: recent > 0 ? `+${recent}` : '0 new',
      direction: recent > 0 ? ('up' as const) : ('neutral' as const),
      label: 'last 30d'
    }
  })

  const formatCurrency = (amount: number) => {
    return `₱${new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0)}`
  }

  const renewalRatePercentage = computed(() => {
    return Number(dashboardStats.value?.subscription_profits?.renewal_rate_percentage || 0)
  })

  const renewalPieSegments = computed(() => {
    const rate = Math.min(100, Math.max(0, renewalRatePercentage.value))
    const radius = 58
    const circumference = 2 * Math.PI * radius
    const renewedDash = (rate / 100) * circumference
    const remainingDash = circumference - renewedDash
    return {
      radius,
      circumference,
      renewedDash,
      remainingDash,
      rate
    }
  })

  const revenueTimeframe = ref<'7D' | '14D' | '30D' | '6M'>('7D')
  const hoveredRevenuePoint = ref<any | null>(null)

  const setRevenueTimeframe = (tf: '7D' | '14D' | '30D' | '6M') => {
    revenueTimeframe.value = tf
    hoveredRevenuePoint.value = null
  }

  const revenueTrendSeries = computed(() => {
    let raw: any[] | undefined
    const profits = dashboardStats.value?.subscription_profits

    if (revenueTimeframe.value === '7D') {
      raw = profits?.revenue_trend_7d
    } else if (revenueTimeframe.value === '14D') {
      raw = profits?.revenue_trend_14d
    } else if (revenueTimeframe.value === '30D') {
      raw = profits?.revenue_trend_30d
    } else if (revenueTimeframe.value === '6M') {
      raw = profits?.revenue_trend_6m || profits?.revenue_trend
    }

    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((item: any) => ({
        label: item.label,
        full_date: item.full_date || item.label,
        amount: Number(item.amount || 0)
      }))
    }

    // Fallbacks if data has not yet loaded
    if (revenueTimeframe.value === '7D') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const now = new Date()
      return Array.from({ length: 7 }, (_, index) => {
        const d = new Date(now)
        d.setDate(now.getDate() - (6 - index))
        return {
          label: days[d.getDay()],
          full_date: d.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          amount: 0
        }
      })
    }

    if (revenueTimeframe.value === '14D') {
      const now = new Date()
      return Array.from({ length: 14 }, (_, index) => {
        const d = new Date(now)
        d.setDate(now.getDate() - (13 - index))
        return {
          label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          full_date: d.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          amount: 0
        }
      })
    }

    if (revenueTimeframe.value === '30D') {
      const now = new Date()
      return Array.from({ length: 30 }, (_, index) => {
        const d = new Date(now)
        d.setDate(now.getDate() - (29 - index))
        return {
          label: String(d.getDate()),
          full_date: d.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          amount: 0
        }
      })
    }

    const now = new Date()
    return Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return {
        label: d.toLocaleDateString('en', { month: 'short' }),
        full_date: d.toLocaleDateString('en', { month: 'long', year: 'numeric' }),
        amount: 0
      }
    })
  })

  const revenueGrowthRate = computed(() => {
    const rate = Number(dashboardStats.value?.subscription_profits?.growth_rate || 0)
    return {
      value: rate >= 0 ? `+${rate}%` : `${rate}%`,
      direction: rate >= 0 ? ('up' as const) : ('down' as const)
    }
  })

  const sparkWidth = 280
  const sparkHeight = 64
  const sparkPadding = { top: 8, bottom: 20, left: 16, right: 16 }

  const sparkPoints = computed(() => {
    const data = revenueTrendSeries.value
    const maxVal = Math.max(...data.map(d => d.amount), 1)
    const plotWidth = sparkWidth - sparkPadding.left - sparkPadding.right
    const plotHeight = sparkHeight - sparkPadding.top - sparkPadding.bottom
    const step = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth

    return data.map((d, i) => {
      const x = sparkPadding.left + i * step
      const y = sparkPadding.top + plotHeight - (d.amount / maxVal) * plotHeight
      return {
        ...d,
        x,
        y
      }
    })
  })

  const sparkLinePath = computed(() => {
    const pts = sparkPoints.value
    if (!pts.length) return ''
    return pts.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`
      const prev = arr[i - 1]
      const cx = (pt.x - prev.x) / 2
      return `${acc} C ${prev.x + cx} ${prev.y}, ${pt.x - cx} ${pt.y}, ${pt.x} ${pt.y}`
    }, '')
  })

  const shouldShowAxisLabel = (index: number, total: number) => {
    if (total <= 7) return true
    if (total <= 14) return index % 2 === 0 || index === total - 1
    return index % 5 === 0 || index === total - 1
  }

  const handleSparkMouseMove = (event: MouseEvent) => {
    const pts = sparkPoints.value
    if (!pts || pts.length === 0) return
    const target = event.currentTarget as HTMLElement
    if (!target) return
    const rect = target.getBoundingClientRect()
    if (rect.width <= 0) return
    const relX = event.clientX - rect.left
    const svgX = (relX / rect.width) * sparkWidth

    let closest = pts[0]
    let minDist = Math.abs(pts[0].x - svgX)
    for (let i = 1; i < pts.length; i++) {
      const dist = Math.abs(pts[i].x - svgX)
      if (dist < minDist) {
        minDist = dist
        closest = pts[i]
      }
    }
    hoveredRevenuePoint.value = closest
  }

  const handleSparkMouseLeave = () => {
    hoveredRevenuePoint.value = null
  }

  const fetchDashboardStats = async () => {
    isLoadingDashboardStats.value = true
    try {
      const response = await subscriptionAdminService.getDashboardStats()
      dashboardStats.value = response?.data || response || null
      if (dashboardStats.value?.user_counts) {
        if (!patientCount.value) {
          patientCount.value = dashboardStats.value.user_counts.total_patients || 0
        }
        if (!doctorCount.value) {
          doctorCount.value = dashboardStats.value.user_counts.total_doctors || 0
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      isLoadingDashboardStats.value = false
    }
  }

  onMounted(() => {
    fetchDashboardStats()
    fetchUserCounts()
    fetchVerifications()
    fetchDatasets()
    fetchAppeals()
  })
</script>

<template>
  <div class="">
    <!-- Row 1: User Demographics (Primary Gradient Banners, Single-Line Text & Number) -->
    <div class="mb-4 grid grid-cols-1 gap-3.5 sm:gap-4 md:mb-5 md:grid-cols-2">
      <!-- Patients Banner -->
      <NuxtLink
        to="/admin/moderation/users?role=patient"
        class="group via-primary flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-700 p-4 text-white shadow-xs transition hover:shadow-md hover:brightness-105 sm:px-5"
      >
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="group-hover:text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-xs transition group-hover:bg-white"
          >
            <Icon
              name="lucide:user"
              class="h-5 w-5"
            />
          </div>
          <div class="flex min-w-0 items-baseline gap-2.5">
            <span class="text-xs font-bold tracking-wider text-white/90 uppercase"> Patients </span>
            <span class="text-2xl font-black text-white tabular-nums">
              {{ patientCount }}
            </span>
            <span class="hidden truncate text-xs font-light tracking-wide text-white/60 sm:inline">
              registered
            </span>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span
            v-if="patientTrend"
            class="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/30 backdrop-blur-xs"
          >
            <Icon
              name="lucide:trending-up"
              class="h-3 w-3"
            />
            {{ patientTrend.value }} {{ patientTrend.label || '' }}
          </span>
          <Icon
            name="lucide:chevron-right"
            class="h-4 w-4 text-white/80 transition group-hover:translate-x-0.5 group-hover:text-white"
          />
        </div>
      </NuxtLink>

      <!-- Doctors Banner -->
      <NuxtLink
        to="/admin/moderation/users?role=doctor"
        class="group via-primary flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-700 p-4 text-white shadow-xs transition hover:shadow-md hover:brightness-105 sm:px-5"
      >
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="group-hover:text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-xs transition group-hover:bg-white"
          >
            <Icon
              name="lucide:stethoscope"
              class="h-5 w-5"
            />
          </div>
          <div class="flex min-w-0 items-baseline gap-2.5">
            <span class="text-xs font-bold tracking-wider text-white/90 uppercase"> Doctors </span>
            <span class="text-2xl font-black text-white tabular-nums">
              {{ doctorCount }}
            </span>
            <span class="hidden truncate text-xs font-light tracking-wide text-white/60 sm:inline">
              registered
            </span>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span
            v-if="doctorTrend"
            class="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/30 backdrop-blur-xs"
          >
            <Icon
              name="lucide:trending-up"
              class="h-3 w-3"
            />
            {{ doctorTrend.value }} {{ doctorTrend.label || '' }}
          </span>
          <Icon
            name="lucide:chevron-right"
            class="h-4 w-4 text-white/80 transition group-hover:translate-x-0.5 group-hover:text-white"
          />
        </div>
      </NuxtLink>
    </div>

    <!-- Row 2: Key Operations & Clinical Metrics (4 Cards) -->
    <div class="mb-5 grid grid-cols-2 gap-3 sm:gap-3.5 md:mb-6 md:grid-cols-4 md:gap-4">
      <AdminSideComponentsMetricCard
        label="AI Scans Used"
        :value="scanUsageTotal"
        unit="scans"
        :detail="scanUsageDetail"
        :trend="scanUsageTrend"
        :loading="isLoadingDashboardStats"
      />

      <AdminSideComponentsMetricCard
        label="Subscription Profits"
        :value="formattedProfits"
        detail="Tap to view subscribers & renewals"
        badge="Details →"
        :loading="isLoadingDashboardStats"
        class="cursor-pointer transition-all hover:border-emerald-400 hover:shadow-md hover:ring-2 hover:ring-emerald-500/10"
        @click="handleOpenProfitsModal"
      />

      <AdminSideComponentsMetricCard
        label="Active Dataset"
        :value="datasetImageCount"
        unit="photos"
        detail="Lesion photos in AI repository"
        :badge="`${datasets.length} Categories`"
        to="/admin/dataset"
        :loading="isLoadingDatasets"
      />

      <AdminSideComponentsMetricCard
        label="Scan Appeals"
        :value="totalCount"
        detail="Doctor diagnostic appeal cases"
        :badge="pendingCount > 0 ? `${pendingCount} Action Req.` : 'All Clear'"
        to="/admin/appeals"
        :loading="isLoadingAppeals"
      />
    </div>

    <!-- Financial & Subscription Visual Graph Cards (Above Website Usage) -->
    <div class="mb-5 grid grid-cols-1 gap-3.5 sm:gap-4 md:mb-6 md:grid-cols-2">
      <!-- Card 1: Net Revenue with Dynamic Minimalist Sparkline Chart -->
      <div
        class="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-5 shadow-2xs transition hover:border-gray-300"
      >
        <div>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Net Revenue
              </span>

              <!-- Minimalist Segmented Timeframe Switcher -->
              <div
                class="inline-flex items-center rounded-lg bg-gray-100 p-0.5 text-[11px] font-medium text-gray-600"
              >
                <button
                  v-for="tf in ['7D', '14D', '30D', '6M'] as const"
                  :key="tf"
                  type="button"
                  class="rounded-md px-2 py-0.5 text-[10.5px] font-medium transition-all"
                  :class="
                    revenueTimeframe === tf
                      ? 'bg-white font-semibold text-gray-950 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-900'
                  "
                  @click="setRevenueTimeframe(tf)"
                >
                  {{ tf }}
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                :class="
                  revenueGrowthRate?.direction === 'up'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 ring-inset'
                    : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 ring-inset'
                "
              >
                <Icon
                  :name="
                    revenueGrowthRate?.direction === 'up'
                      ? 'lucide:trending-up'
                      : 'lucide:trending-down'
                  "
                  class="h-3 w-3"
                />
                {{ revenueGrowthRate?.value || '0%' }}
              </span>

              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                @click="handleOpenProfitsModal"
              >
                <span>Details</span>
                <Icon
                  name="lucide:arrow-right"
                  class="h-3 w-3"
                />
              </button>
            </div>
          </div>

          <div class="mt-2.5 flex items-baseline gap-2">
            <span
              class="text-3xl font-black tracking-tight text-gray-950 tabular-nums transition-colors sm:text-4xl"
            >
              {{
                hoveredRevenuePoint ? formatCurrency(hoveredRevenuePoint.amount) : formattedProfits
              }}
            </span>
            <div class="flex items-center gap-1.5">
              <span
                v-if="hoveredRevenuePoint"
                class="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20 ring-inset"
              >
                {{ hoveredRevenuePoint.full_date || hoveredRevenuePoint.label }}
              </span>
              <span
                v-else
                class="text-xs font-medium text-gray-400"
              >
                Total Profits Gained
              </span>
            </div>
          </div>
        </div>

        <!-- Dynamic Minimalist Sparkline Chart with Interactive Hover & Tooltip -->
        <div
          class="relative mt-4 w-full"
          @mousemove="handleSparkMouseMove"
          @mouseleave="handleSparkMouseLeave"
        >
          <!-- Floating Tooltip Pill (Linear / Stripe style) -->
          <div
            v-if="hoveredRevenuePoint"
            class="pointer-events-none absolute -top-11 z-20 -translate-x-1/2 rounded-lg bg-gray-900/95 px-2.5 py-1 whitespace-nowrap text-white shadow-xl ring-1 ring-white/10 backdrop-blur-sm transition-all duration-75"
            :style="{
              left: `clamp(80px, ${(hoveredRevenuePoint.x / sparkWidth) * 100}%, calc(100% - 80px))`
            }"
          >
            <div class="relative z-10 flex flex-col items-center text-center leading-tight">
              <span class="text-[9.5px] font-medium tracking-wide text-gray-300">
                {{ hoveredRevenuePoint.full_date || hoveredRevenuePoint.label }}
              </span>
              <span class="text-[11px] font-bold text-emerald-400 tabular-nums">
                {{ formatCurrency(hoveredRevenuePoint.amount) }}
              </span>
            </div>
            <div
              class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-900/95"
            ></div>
          </div>

          <svg
            :viewBox="'0 0 ' + sparkWidth + ' ' + sparkHeight"
            class="w-full cursor-crosshair overflow-visible"
            role="img"
            aria-label="Net revenue trend line"
          >
            <!-- Dashed Vertical Grid Guides -->
            <line
              v-for="pt in sparkPoints"
              :key="'guide-' + pt.label + '-' + pt.x"
              :x1="pt.x"
              :x2="pt.x"
              :y1="sparkPadding.top"
              :y2="sparkHeight - sparkPadding.bottom"
              stroke="#f1f5f9"
              stroke-width="1"
              stroke-dasharray="2 3"
            />

            <!-- Active Vertical Hover Hairline Rule -->
            <line
              v-if="hoveredRevenuePoint"
              :x1="hoveredRevenuePoint.x"
              :x2="hoveredRevenuePoint.x"
              :y1="sparkPadding.top"
              :y2="sparkHeight - sparkPadding.bottom"
              stroke="#0f172a"
              stroke-width="1.25"
              stroke-dasharray="2 2"
              class="opacity-70"
            />

            <!-- Dynamic Sparkline Line (Thinner, Hairline Precision) -->
            <path
              :d="sparkLinePath"
              fill="none"
              stroke="#0f172a"
              stroke-width="1.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <!-- Point Dots -->
            <circle
              v-for="pt in sparkPoints"
              :key="'dot-' + pt.label + '-' + pt.x"
              :cx="pt.x"
              :cy="pt.y"
              :r="revenueTimeframe === '30D' ? 1 : 1.75"
              fill="#0f172a"
              stroke="#ffffff"
              stroke-width="1"
            />

            <!-- Active Hover Point Dots (Glow + Solid) -->
            <g v-if="hoveredRevenuePoint">
              <circle
                :cx="hoveredRevenuePoint.x"
                :cy="hoveredRevenuePoint.y"
                r="6"
                fill="#0f172a"
                fill-opacity="0.15"
              />
              <circle
                :cx="hoveredRevenuePoint.x"
                :cy="hoveredRevenuePoint.y"
                r="3"
                fill="#0f172a"
                stroke="#ffffff"
                stroke-width="1.5"
              />
            </g>

            <!-- X-Axis Labels (Filtered for clarity) -->
            <text
              v-for="(pt, idx) in sparkPoints"
              v-show="shouldShowAxisLabel(idx, sparkPoints.length)"
              :key="'axis-' + pt.label + '-' + idx"
              :x="pt.x"
              :y="sparkHeight - 4"
              text-anchor="middle"
              class="fill-gray-400 text-[5px] font-normal tracking-wider uppercase select-none"
            >
              {{ pt.label }}
            </text>
          </svg>
        </div>
      </div>

      <!-- Card 2: Renewal Rate with Pie Chart on Right Side -->
      <div
        class="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-5 shadow-2xs transition hover:border-gray-300"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Subscription Renewal Rate
          </span>
          <span
            class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-600/20 ring-inset"
          >
            <Icon
              name="lucide:repeat"
              class="h-3 w-3"
            />
            {{ renewalRatePercentage }}%
          </span>
        </div>

        <div class="mt-3 flex items-center justify-between gap-3">
          <!-- Left: Numbers and Legend (Aligned to bottom for consistent spacing) -->
          <div class="min-w-0 flex-1 self-end pb-0.5">
            <div class="flex items-baseline gap-1.5">
              <span
                class="text-3xl font-black tracking-tight text-gray-950 tabular-nums sm:text-4xl"
              >
                {{ dashboardStats?.subscription_profits?.renewed_users_count ?? 0 }}
              </span>
              <span class="text-xs font-semibold text-gray-500">
                / {{ dashboardStats?.subscription_profits?.total_subscribed_users ?? 0 }} renewed
              </span>
            </div>

            <!-- Mini Legend -->
            <div class="mt-3 flex flex-wrap items-center gap-2.5 text-xs">
              <span class="inline-flex items-center gap-1.5 font-medium text-gray-700">
                <span class="h-2 w-2 rounded-full bg-blue-600"></span>
                Renewed ({{ renewalRatePercentage }}%)
              </span>
              <span class="inline-flex items-center gap-1.5 font-medium text-gray-400">
                <span class="h-2 w-2 rounded-full bg-slate-300"></span>
                Non-renewed
              </span>
            </div>

            <p class="mt-2 text-[11px] font-medium text-gray-400">
              Percentage of subscribed doctors who renewed plan.
            </p>
          </div>

          <!-- Right: Pie / Donut Chart (Expanded to Consume Div) -->
          <div class="relative flex shrink-0 items-center justify-center">
            <svg
              width="146"
              height="146"
              viewBox="0 0 150 150"
              class="overflow-visible"
              role="img"
              aria-label="Subscription renewal rate pie chart"
            >
              <defs>
                <linearGradient
                  id="outsideRenewalPieGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    stop-color="#3b82f6"
                  />
                  <stop
                    offset="100%"
                    stop-color="#1d4ed8"
                  />
                </linearGradient>
              </defs>

              <!-- Recessed Channel Track -->
              <circle
                cx="75"
                cy="75"
                r="58"
                fill="none"
                stroke="#f1f5f9"
                stroke-width="18"
              />

              <!-- Active Segment Progress Arc -->
              <circle
                cx="75"
                cy="75"
                r="58"
                fill="none"
                stroke="url(#outsideRenewalPieGradient)"
                stroke-width="18"
                :stroke-dasharray="`${renewalPieSegments.renewedDash} ${renewalPieSegments.remainingDash}`"
                stroke-dashoffset="0"
                stroke-linecap="round"
                transform="rotate(-90 75 75)"
                class="transition-all duration-700 ease-out"
              />

              <!-- Centered Percentage Label -->
              <text
                x="75"
                y="81"
                text-anchor="middle"
                class="fill-gray-950 text-lg font-black tabular-nums sm:text-xl"
              >
                {{ Math.round(renewalRatePercentage) }}%
              </text>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <section
      class="mb-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:mb-6"
    >
      <div
        class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 md:gap-4 md:px-5 md:py-4"
      >
        <div>
          <h2 class="text-base font-black text-gray-950">Website Usage</h2>
          <p class="mt-1 text-xs text-gray-500">
            Tracked platform activity across the selected period.
          </p>
        </div>

        <div class="flex w-full rounded-xl border border-gray-200 bg-gray-50 p-1 sm:w-auto">
          <button
            v-for="option in usageRangeOptions"
            :key="option.value"
            type="button"
            class="flex-1 rounded-lg px-2.5 py-1 text-xs font-bold transition sm:flex-none"
            :class="
              usageRange === option.value
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            "
            @click="usageRange = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div
        v-if="isLoadingUsers || isLoadingVerifications || isLoadingAppeals"
        class="p-5"
      >
        <div class="h-80 animate-pulse rounded-xl bg-gray-100" />
      </div>

      <div
        v-else
        class="p-4 md:p-5"
      >
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Total activity
            </p>
            <p class="mt-1 text-2xl font-black text-gray-950">{{ usageTotal }}</p>
          </div>

          <div class="text-primary bg-primary/10 flex items-center gap-2 rounded-xl px-3 py-2">
            <Icon
              name="lucide:activity"
              class="text-base"
            />
            <span class="text-xs font-bold"
              >{{ usageRangeOptions.find(option => option.value === usageRange)?.label }} view</span
            >
          </div>
        </div>

        <div class="w-full overflow-x-auto">
          <svg
            class="min-w-[600px] md:min-w-[680px]"
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            role="img"
            aria-label="Website usage area chart"
          >
            <defs>
              <linearGradient
                id="usageAreaGradient"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stop-color="var(--color-primary)"
                  stop-opacity="0.48"
                />
                <stop
                  offset="100%"
                  stop-color="var(--color-primary-light)"
                  stop-opacity="0.16"
                />
              </linearGradient>
            </defs>

            <g>
              <line
                v-for="(label, index) in usageYAxisLabels"
                :key="`grid-${index}`"
                :x1="chartPadding.left"
                :x2="chartWidth - chartPadding.right"
                :y1="
                  chartPadding.top +
                  ((chartHeight - chartPadding.top - chartPadding.bottom) / 4) * index
                "
                :y2="
                  chartPadding.top +
                  ((chartHeight - chartPadding.top - chartPadding.bottom) / 4) * index
                "
                stroke="#eef2f7"
                stroke-width="1"
              />
              <text
                v-for="(label, index) in usageYAxisLabels"
                :key="`axis-${label}-${index}`"
                :x="chartPadding.left - 14"
                :y="
                  chartPadding.top +
                  ((chartHeight - chartPadding.top - chartPadding.bottom) / 4) * index +
                  4
                "
                text-anchor="end"
                class="fill-gray-400 text-[10px] font-semibold md:text-[8px]"
              >
                {{ label }}
              </text>
            </g>

            <path
              :d="usageAreaPath"
              fill="url(#usageAreaGradient)"
            />
            <path
              :d="usageLinePath"
              fill="none"
              stroke="var(--color-primary)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <g
              v-for="point in usageChartPoints"
              :key="point.label"
              @mouseenter="hoveredUsagePoint = point"
              @mouseleave="hoveredUsagePoint = null"
              @focus="hoveredUsagePoint = point"
              @blur="hoveredUsagePoint = null"
              @click="hoveredUsagePoint = point"
              tabindex="0"
            >
              <rect
                :x="point.x - 18"
                :y="chartPadding.top"
                width="36"
                :height="chartHeight - chartPadding.top - chartPadding.bottom"
                fill="transparent"
              />
              <line
                v-if="hoveredUsagePoint?.label === point.label"
                :x1="point.x"
                :x2="point.x"
                :y1="chartPadding.top"
                :y2="chartHeight - chartPadding.bottom"
                stroke="var(--color-primary-light)"
                stroke-width="1.5"
                stroke-dasharray="4 4"
              />
              <circle
                :cx="point.x"
                :cy="point.y"
                r="4"
                fill="var(--color-primary)"
                stroke="white"
                stroke-width="2"
              />
              <text
                :x="point.x"
                :y="chartHeight - 12"
                text-anchor="middle"
                class="fill-gray-500 text-[10px] font-semibold md:text-[8px]"
              >
                {{ point.label }}
              </text>
            </g>

            <g
              v-if="hoveredUsagePoint"
              pointer-events="none"
            >
              <rect
                :x="getTooltipX(hoveredUsagePoint)"
                :y="getTooltipY(hoveredUsagePoint)"
                :width="tooltipWidth"
                :height="
                  hoveredUsagePoint.activityCounts.length
                    ? 53 + hoveredUsagePoint.activityCounts.length * 16
                    : 76
                "
                rx="12"
                fill="white"
                stroke="var(--color-primary-light)"
                stroke-width="1"
                filter="drop-shadow(0 12px 24px rgba(15, 23, 42, 0.14))"
              />
              <text
                :x="getTooltipX(hoveredUsagePoint) + 14"
                :y="getTooltipY(hoveredUsagePoint) + 22"
                class="fill-gray-500 text-[10px] font-bold uppercase"
              >
                {{ hoveredUsagePoint.label }}
              </text>
              <text
                :x="getTooltipX(hoveredUsagePoint) + 14"
                :y="getTooltipY(hoveredUsagePoint) + 35"
                class="fill-gray-950 text-[10px] font-black"
              >
                {{ hoveredUsagePoint.value }} total activities
              </text>
              <template v-if="hoveredUsagePoint.activityCounts.length">
                <g
                  v-for="(activity, index) in hoveredUsagePoint.activityCounts"
                  :key="activity.label"
                >
                  <circle
                    :cx="getTooltipX(hoveredUsagePoint) + 18"
                    :cy="getTooltipY(hoveredUsagePoint) + 55 + index * 12"
                    r="2"
                    fill="var(--color-primary)"
                  />
                  <text
                    :x="getTooltipX(hoveredUsagePoint) + 28"
                    :y="getTooltipY(hoveredUsagePoint) + 58 + index * 11"
                    class="fill-gray-600 text-[8px] font-semibold"
                  >
                    {{ activity.label }}: {{ activity.count }}
                  </text>
                </g>
              </template>
              <text
                v-else
                :x="getTooltipX(hoveredUsagePoint) + 14"
                :y="getTooltipY(hoveredUsagePoint) + 60"
                class="fill-gray-400 text-[8px] font-semibold"
              >
                No activity recorded
              </text>
            </g>
          </svg>
        </div>
        <p class="mt-2 text-center text-[10px] font-medium text-gray-400 md:hidden">
          Swipe sideways to see the full chart, tap a point for details
        </p>
      </div>
    </section>

    <div class="mb-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:mb-6">
      <div
        class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 md:gap-4 md:px-5 md:py-4"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-3">
            <div class="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <h2 class="truncate text-lg font-black text-gray-950">Doctor Scan Appeals</h2>
          </div>
          <p class="mt-1 text-sm text-gray-500">
            Doctors flagging scans they believe were diagnosed incorrectly.
          </p>
        </div>

        <NuxtLink
          to="/admin/appeals"
          class="hover:border-primary hover:text-primary inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition"
        >
          <span>Review all</span>
          <Icon
            name="lucide:arrow-right"
            class="text-base"
          />
        </NuxtLink>
      </div>

      <div
        v-if="isLoadingAppeals"
        class="grid gap-3 p-5 md:grid-cols-2"
      >
        <div
          v-for="i in 4"
          :key="i"
          class="h-24 animate-pulse rounded-xl bg-gray-100"
        />
      </div>

      <div
        v-else-if="recentAppeals.length"
        class="divide-y divide-gray-100"
      >
        <NuxtLink
          v-for="appeal in recentAppeals"
          :key="appeal.uuid"
          to="/admin/appeals"
          class="group grid gap-2 px-4 py-3 transition hover:bg-gray-50 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] md:gap-4 md:px-5 md:py-4"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="group-hover:text-primary truncate text-sm font-bold text-gray-900">
                Dr. {{ getAppealDoctorName(appeal) }}
              </p>
              <span
                v-if="appeal.status === 'resolved'"
                class="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 ring-1 ring-green-600/20 ring-inset"
              >
                Resolved
              </span>
              <span
                v-else-if="appeal.status === 'rejected'"
                class="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-600/20 ring-inset"
              >
                Rejected
              </span>
              <span
                v-else
                class="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-600/20 ring-inset"
              >
                Pending
              </span>
            </div>
            <p class="mt-1 truncate text-xs font-medium text-gray-400">
              {{ formatAppealDate(appeal.created_at || appeal.updated_at) }}
            </p>
          </div>

          <div class="min-w-0">
            <p class="truncate text-sm text-gray-600">
              Suggested
              <span class="font-bold text-rose-600">{{
                appeal.suggested_label || 'new diagnosis'
              }}</span>
              instead of
              <span class="font-semibold text-gray-900">{{
                appeal.diagnosis_label || 'scanner result'
              }}</span>
            </p>
            <p class="mt-1 line-clamp-1 text-sm text-gray-500">
              {{ appeal.description || 'No reason provided.' }}
            </p>
          </div>

          <Icon
            name="lucide:chevron-right"
            class="group-hover:text-primary self-center text-xl text-gray-300 transition"
          />
        </NuxtLink>
      </div>

      <div
        v-else
        class="px-5 py-10 text-center"
      >
        <div
          class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500"
        >
          <Icon
            name="material-symbols:report-outline"
            class="text-2xl"
          />
        </div>
        <p class="text-sm font-medium text-gray-500">No doctor scan appeals have been filed yet.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 md:gap-6 xl:grid-cols-2">
      <AdminSideComponentsDoctorVerificationList
        title="Recently Verified Doctors"
        description="Doctors who were most recently cleared for platform access."
        :items="recentlyVerifiedDoctors"
        empty-text="No recently verified doctors yet."
        status="verified"
        :loading="isLoadingVerifications"
      />

      <AdminSideComponentsDoctorVerificationList
        title="Upcoming Doctor Verification"
        description="Pending verification requests that still need review."
        :items="pendingVerifications"
        empty-text="No pending doctor verifications right now."
        status="pending"
        :loading="isLoadingVerifications"
      />
    </div>

    <div class="mt-6">
      <AdminSideComponentsRecentDatasetImages
        :datasets="datasets"
        :loading="isLoadingDatasets"
      />
    </div>

    <!-- Subscription Profits Details Modal -->
    <AppModal
      :model-value="showProfitsModal"
      :size="isModalMaximized ? '6xl' : '2xl'"
      title="Subscription Profits & Retention"
      description="Detailed breakdown of subscription revenue, active subscribers, and renewal rates."
      @update:model-value="handleUpdateProfitsModal"
      @close="handleCloseProfitsModal"
    >
      <div class="space-y-6">
        <!-- Interactive Date Filter Bar with Maximize Toggle -->
        <div class="rounded-xl border border-gray-200/90 bg-gray-50/80 p-3.5 shadow-2xs">
          <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-2">
              <Icon
                name="lucide:calendar-search"
                class="h-4 w-4 text-emerald-700"
              />
              <span class="text-xs font-semibold text-gray-800">Filter Revenue by Date:</span>
            </div>

            <!-- Custom Single Date Picker & Maximize Toggle -->
            <div class="flex flex-wrap items-center gap-2">
              <div class="flex items-center gap-1.5">
                <label
                  for="modal-custom-date"
                  class="text-[11px] font-medium text-gray-500"
                >
                  Pick Date:
                </label>
                <input
                  id="modal-custom-date"
                  type="date"
                  :value="modalProfitsCustomDate"
                  class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 shadow-2xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  @change="handleModalCustomDateInput"
                />
              </div>

              <!-- Maximize / Restore Button -->
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-2xs transition hover:bg-gray-100"
                @click="toggleMaximizeModal"
              >
                <Icon
                  :name="isModalMaximized ? 'lucide:minimize-2' : 'lucide:maximize-2'"
                  class="h-3.5 w-3.5 text-emerald-700"
                />
                <span>{{ isModalMaximized ? 'Minimize' : 'Detailed Graph' }}</span>
              </button>
            </div>
          </div>

          <!-- Quick Preset Pills -->
          <div
            class="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-gray-200/60 pt-2.5"
          >
            <button
              v-for="opt in modalFilterOptions"
              :key="opt.id"
              type="button"
              class="inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-medium transition"
              :class="
                modalProfitsFilter === opt.id
                  ? 'bg-emerald-700 font-semibold text-white shadow-2xs'
                  : 'border border-gray-200/90 bg-white text-gray-600 hover:bg-gray-100'
              "
              @click="setModalProfitsFilter(opt.id)"
            >
              {{ opt.label }}
            </button>

            <button
              v-if="modalProfitsFilter !== 'month'"
              type="button"
              class="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
              @click="resetModalProfitsFilter"
            >
              <Icon
                name="lucide:rotate-ccw"
                class="h-3 w-3"
              />
              <span>Reset to This Month</span>
            </button>
          </div>
        </div>

        <!-- Very Detailed Analytics Graph Section (Expanded on Maximize) -->
        <div
          v-if="isModalMaximized"
          class="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-xs transition-all"
        >
          <!-- Detailed Header & KPIs -->
          <div
            class="mb-4 flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50"
                ></span>
                <h4 class="text-sm font-bold tracking-tight text-gray-900">
                  High-Resolution Net Revenue Progression
                </h4>
                <span
                  class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/20 ring-inset"
                >
                  Detailed Analytics
                </span>
              </div>
              <p class="mt-0.5 text-xs text-gray-500">
                Day-by-day revenue velocity and payment occurrences across the active period.
              </p>
            </div>

            <!-- Detailed Summary Metric Pills -->
            <div class="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
              <div class="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-1.5 text-right">
                <span class="block text-[10px] font-semibold text-gray-400 uppercase"
                  >Total Period</span
                >
                <span class="text-xs font-black text-emerald-700 tabular-nums">{{
                  detailedChartMetrics.totalFormatted
                }}</span>
              </div>
              <div class="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-1.5 text-right">
                <span class="block text-[10px] font-semibold text-gray-400 uppercase"
                  >Daily Average</span
                >
                <span class="text-xs font-bold text-gray-800 tabular-nums">{{
                  detailedChartMetrics.avgFormatted
                }}</span>
              </div>
              <div class="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-1.5 text-right">
                <span class="block text-[10px] font-semibold text-gray-400 uppercase"
                  >Peak Gain</span
                >
                <span class="text-xs font-bold text-emerald-700 tabular-nums">{{
                  detailedChartMetrics.peakAmount
                }}</span>
              </div>
              <div class="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-1.5 text-right">
                <span class="block text-[10px] font-semibold text-gray-400 uppercase"
                  >Transactions</span
                >
                <span class="text-xs font-bold text-gray-800 tabular-nums"
                  >{{ detailedChartMetrics.totalTx }} paid</span
                >
              </div>
            </div>
          </div>

          <!-- Interactive Detailed Chart Container -->
          <div
            class="relative mt-8 w-full overflow-visible"
            @mousemove="handleDetailedChartMouseMove"
            @mouseleave="handleDetailedChartMouseLeave"
          >
            <!-- Floating Hover Tooltip -->
            <div
              v-if="hoveredDetailedPoint"
              class="pointer-events-none absolute -top-12 z-30 -translate-x-1/2 rounded-xl bg-gray-950/95 px-3 py-1.5 whitespace-nowrap text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md transition-all duration-75"
              :style="{
                left: `clamp(90px, ${(hoveredDetailedPoint.x / detailedChartWidth) * 100}%, calc(100% - 90px))`
              }"
            >
              <div class="relative z-10 flex flex-col items-center text-center leading-tight">
                <span class="text-[10px] font-medium tracking-wide text-gray-300">
                  {{ hoveredDetailedPoint.full_date || hoveredDetailedPoint.label }}
                </span>
                <span class="mt-0.5 text-xs font-black text-emerald-400 tabular-nums">
                  +{{ formatCurrency(hoveredDetailedPoint.amount) }}
                </span>
                <span class="text-[9px] font-medium text-gray-400">
                  {{ hoveredDetailedPoint.count }} subscription
                  {{ hoveredDetailedPoint.count === 1 ? 'payment' : 'payments' }}
                </span>
              </div>
              <div
                class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-950/95"
              ></div>
            </div>

            <!-- SVG Spline Area Chart -->
            <svg
              :viewBox="'0 0 ' + detailedChartWidth + ' ' + detailedChartHeight"
              class="w-full cursor-crosshair overflow-visible"
              role="img"
              aria-label="High-resolution revenue spline chart"
            >
              <defs>
                <linearGradient
                  id="detailedAreaGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stop-color="#10b981"
                    stop-opacity="0.35"
                  />
                  <stop
                    offset="60%"
                    stop-color="#10b981"
                    stop-opacity="0.08"
                  />
                  <stop
                    offset="100%"
                    stop-color="#10b981"
                    stop-opacity="0.0"
                  />
                </linearGradient>
              </defs>

              <!-- Y-Axis Grid Lines & Scales -->
              <g
                v-for="tick in detailedYScaleTicks"
                :key="'ytick-' + tick.val"
              >
                <line
                  :x1="detailedPadding.left"
                  :x2="detailedChartWidth - detailedPadding.right"
                  :y1="
                    detailedPadding.top +
                    (detailedChartHeight - detailedPadding.top - detailedPadding.bottom) *
                      (1 - tick.yRatio)
                  "
                  :y2="
                    detailedPadding.top +
                    (detailedChartHeight - detailedPadding.top - detailedPadding.bottom) *
                      (1 - tick.yRatio)
                  "
                  stroke="#f1f5f9"
                  stroke-width="1"
                  stroke-dasharray="3 3"
                />
                <text
                  :x="detailedPadding.left - 8"
                  :y="
                    detailedPadding.top +
                    (detailedChartHeight - detailedPadding.top - detailedPadding.bottom) *
                      (1 - tick.yRatio) +
                    3
                  "
                  text-anchor="end"
                  class="fill-gray-400 text-[7px] font-medium tabular-nums select-none"
                >
                  {{ tick.label }}
                </text>
              </g>

              <!-- Area Fill Under Spline -->
              <path
                :d="detailedAreaPath"
                fill="url(#detailedAreaGradient)"
              />

              <!-- Active Vertical Hairline Cursor -->
              <line
                v-if="hoveredDetailedPoint"
                :x1="hoveredDetailedPoint.x"
                :x2="hoveredDetailedPoint.x"
                :y1="detailedPadding.top"
                :y2="detailedChartHeight - detailedPadding.bottom"
                stroke="#059669"
                stroke-width="1.5"
                stroke-dasharray="2 2"
                class="opacity-80"
              />

              <!-- Spline Stroke -->
              <path
                :d="detailedLinePath"
                fill="none"
                stroke="#059669"
                stroke-width="2.25"
                stroke-linecap="round"
                stroke-linejoin="round"
              />

              <!-- Points Dots -->
              <circle
                v-for="pt in detailedPoints"
                :key="'dpt-' + pt.label + '-' + pt.x"
                :cx="pt.x"
                :cy="pt.y"
                :r="pt.amount > 0 ? 2.5 : 1.5"
                :fill="pt.amount > 0 ? '#047857' : '#94a3b8'"
                stroke="#ffffff"
                stroke-width="1.25"
              />

              <!-- Active Hover Circle with Halo -->
              <g v-if="hoveredDetailedPoint">
                <circle
                  :cx="hoveredDetailedPoint.x"
                  :cy="hoveredDetailedPoint.y"
                  r="9"
                  fill="#10b981"
                  fill-opacity="0.2"
                />
                <circle
                  :cx="hoveredDetailedPoint.x"
                  :cy="hoveredDetailedPoint.y"
                  r="4.5"
                  fill="#047857"
                  stroke="#ffffff"
                  stroke-width="2"
                />
              </g>

              <!-- X-Axis Labels -->
              <text
                v-for="(pt, idx) in detailedPoints"
                v-show="
                  detailedPoints.length <= 14 ||
                  idx % Math.ceil(detailedPoints.length / 10) === 0 ||
                  idx === detailedPoints.length - 1
                "
                :key="'daxis-' + pt.label + '-' + idx"
                :x="pt.x"
                :y="detailedChartHeight - 14"
                text-anchor="middle"
                class="fill-gray-400 text-[6.5px] font-medium tracking-wide uppercase select-none"
              >
                {{ pt.label }}
              </text>
            </svg>
          </div>
        </div>

        <!-- Subscription Financial & Retention Metrics (Top 3 Cards) -->
        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <!-- Card 1: Profits (Dynamic: Shows Filtered Gain when date is selected) -->
          <div
            class="flex flex-col items-center justify-center rounded-xl border p-4 text-center transition"
            :class="
              modalProfitsFilter !== 'all'
                ? 'border-emerald-200 bg-emerald-50/50 shadow-2xs'
                : 'border-gray-100 bg-gray-50/70'
            "
          >
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                {{ modalProfitsFilter !== 'all' ? 'Filtered Gain' : 'Total Profits' }}
              </span>
              <span
                v-if="modalProfitsFilter !== 'all'"
                class="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 uppercase"
              >
                Filtered
              </span>
            </div>
            <span class="my-1.5 block text-2xl font-black text-emerald-700 tabular-nums">
              <span
                v-if="isLoadingModalFilter"
                class="inline-block animate-pulse text-gray-400"
              >
                ...
              </span>
              <span v-else>{{ displayedProfitsAmount }}</span>
            </span>
            <span class="block text-xs font-medium text-gray-500">
              {{ displayedProfitsSubtitle }}
            </span>
            <span
              v-if="modalProfitsFilter !== 'all'"
              class="mt-1 block text-[10.5px] font-medium text-gray-400"
            >
              Lifetime: {{ formattedProfits }}
            </span>
          </div>

          <!-- Card 2: Active Subscribers -->
          <div
            class="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50/70 p-4 text-center"
          >
            <span class="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Active Subs
            </span>
            <span class="my-1.5 block text-2xl font-black text-gray-900 tabular-nums">
              {{ dashboardStats?.subscription_profits?.active_subscribers_count ?? 0 }}
            </span>
            <span class="block text-xs font-medium text-gray-400">
              {{ dashboardStats?.subscription_profits?.total_subscribed_users ?? 0 }} all-time
            </span>
          </div>

          <!-- Card 3: Renewal Rate -->
          <div
            class="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50/70 p-4 text-center"
          >
            <span class="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Renewal Rate
            </span>
            <span class="my-1.5 block text-2xl font-black text-blue-700 tabular-nums">
              {{ renewalRatePercentage }}%
            </span>
            <span class="block text-xs font-medium text-gray-400">
              {{ dashboardStats?.subscription_profits?.renewed_users_count ?? 0 }} renewed
            </span>
          </div>
        </div>

        <!-- User Demographics (Bottom 2 Wide Divs) -->
        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div
            class="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50/70 p-4 text-center"
          >
            <span class="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Total Doctors
            </span>
            <span class="my-1.5 block text-2xl font-black text-gray-900 tabular-nums">
              {{ dashboardStats?.user_counts?.total_doctors ?? doctorCount }}
            </span>
            <span class="block text-xs font-medium text-gray-400"> Registered Doctors </span>
          </div>

          <div
            class="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50/70 p-4 text-center"
          >
            <span class="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Total Patients
            </span>
            <span class="my-1.5 block text-2xl font-black text-gray-900 tabular-nums">
              {{ dashboardStats?.user_counts?.total_patients ?? patientCount }}
            </span>
            <span class="block text-xs font-medium text-gray-400"> Registered Patients </span>
          </div>
        </div>

        <!-- Invoices List (Filtered by Date or Recent All-Time) -->
        <div>
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-bold tracking-wider text-gray-500 uppercase">
                {{
                  modalProfitsFilter !== 'all'
                    ? 'Payments on Filtered Date'
                    : 'Recent Subscription Payments & Renewals'
                }}
              </h4>
              <span
                v-if="modalProfitsFilter !== 'all'"
                class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/20 ring-inset"
              >
                {{ displayedInvoices.length }} paid
              </span>
            </div>
            <NuxtLink
              to="/admin/subscriptions"
              class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              View in Subscriptions →
            </NuxtLink>
          </div>

          <div
            v-if="displayedInvoices.length"
            class="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <div
              v-for="invoice in displayedInvoices"
              :key="invoice.id"
              class="flex items-center justify-between p-3.5 transition hover:bg-gray-50/80"
            >
              <div class="min-w-0 pr-3">
                <div class="flex items-center gap-2">
                  <p class="truncate text-xs font-bold text-gray-900">
                    {{ invoice.user?.name || 'Doctor Account' }}
                  </p>
                  <span
                    v-if="invoice.is_renewal"
                    class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20 ring-inset"
                  >
                    Renewal
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-600/20 ring-inset"
                  >
                    New
                  </span>
                </div>
                <p class="mt-0.5 truncate text-[11px] font-medium text-gray-400">
                  {{ invoice.user?.email || 'N/A' }} • {{ formatAppealDate(invoice.paid_at) }}
                </p>
              </div>

              <div class="shrink-0 text-right">
                <span class="text-xs font-black text-gray-950 tabular-nums">
                  {{ formatCurrency(invoice.amount) }}
                </span>
                <span class="block text-[10px] font-medium text-emerald-600"> Approved </span>
              </div>
            </div>
          </div>

          <div
            v-else
            class="rounded-xl border border-dashed border-gray-200 p-8 text-center"
          >
            <Icon
              name="lucide:receipt"
              class="mx-auto h-8 w-8 text-gray-300"
            />
            <p class="mt-2 text-xs font-medium text-gray-500">
              No subscription payments recorded for this date.
            </p>
            <button
              v-if="modalProfitsFilter !== 'all'"
              type="button"
              class="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
              @click="resetModalProfitsFilter"
            >
              <Icon
                name="lucide:rotate-ccw"
                class="h-3 w-3"
              />
              <span>View All Time</span>
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2 pt-2">
          <AppButton
            variant="outline"
            size="sm"
            @click="handleCloseProfitsModal"
          >
            Close
          </AppButton>
          <NuxtLink to="/admin/subscriptions">
            <AppButton
              variant="primary"
              size="sm"
            >
              Manage Subscriptions
            </AppButton>
          </NuxtLink>
        </div>
      </template>
    </AppModal>
  </div>
</template>
