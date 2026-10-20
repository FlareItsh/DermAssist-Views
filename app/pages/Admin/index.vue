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
  const { sortedAppeals, isLoadingAppeals, fetchAppeals } = useAdminAppeals()
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

  const recentAppeals = computed(() => sortedAppeals.value.slice(0, 4))

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
      ...sortedAppeals.value.map(item => ({
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

  const handleOpenProfitsModal = () => {
    showProfitsModal.value = true
  }

  const handleCloseProfitsModal = () => {
    showProfitsModal.value = false
  }

  const formattedProfits = computed(() => {
    const rev = Number(dashboardStats.value?.subscription_profits?.total_revenue || 0)
    return `₱${new Intl.NumberFormat('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rev)}`
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
    const radius = 46
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

  const revenueTrendSeries = computed(() => {
    const raw = dashboardStats.value?.subscription_profits?.revenue_trend
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((item: any) => ({
        label: item.label,
        amount: Number(item.amount || 0)
      }))
    }
    const now = new Date()
    return Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return {
        label: d.toLocaleDateString('en', { month: 'short' }),
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
    <div
      class="mb-5 grid grid-cols-2 gap-3 sm:gap-3.5 md:mb-6 md:grid-cols-3 md:gap-4 xl:grid-cols-6"
    >
      <AdminSideComponentsMetricCard
        label="Patients"
        :value="patientCount"
        detail="Total registered patient users"
        :trend="patientTrend"
        to="/admin/moderation/users?role=patient"
        :loading="isLoadingUsers"
      />

      <AdminSideComponentsMetricCard
        label="Doctors"
        :value="doctorCount"
        detail="Total registered clinician accounts"
        :trend="doctorTrend"
        to="/admin/moderation/users?role=doctor"
        :loading="isLoadingUsers"
      />

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
        :value="sortedAppeals.length"
        detail="Doctor diagnostic appeal cases"
        :badge="sortedAppeals.length > 0 ? `${sortedAppeals.length} Action Req.` : 'All Clear'"
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
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
              Net Revenue
            </span>
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

          <div class="mt-2.5 flex items-baseline gap-1.5">
            <span class="text-3xl font-black tracking-tight text-gray-950 tabular-nums sm:text-4xl">
              {{ formattedProfits }}
            </span>
            <span class="text-xs font-medium text-gray-400">Total Profits Gained</span>
          </div>
        </div>

        <!-- Dynamic Minimalist Sparkline Chart -->
        <div class="mt-4 w-full">
          <svg
            :viewBox="'0 0 ' + sparkWidth + ' ' + sparkHeight"
            class="w-full overflow-visible"
            role="img"
            aria-label="Monthly net revenue trend line"
          >
            <!-- Dashed Vertical Grid Guides -->
            <line
              v-for="pt in sparkPoints"
              :key="'guide-' + pt.label"
              :x1="pt.x"
              :x2="pt.x"
              :y1="sparkPadding.top"
              :y2="sparkHeight - sparkPadding.bottom"
              stroke="#e2e8f0"
              stroke-width="1"
              stroke-dasharray="2 3"
            />

            <!-- Dynamic Sparkline Line -->
            <path
              :d="sparkLinePath"
              fill="none"
              stroke="#0f172a"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <!-- Point Dots -->
            <circle
              v-for="pt in sparkPoints"
              :key="'dot-' + pt.label"
              :cx="pt.x"
              :cy="pt.y"
              r="2.5"
              fill="#0f172a"
              stroke="#ffffff"
              stroke-width="1.5"
            />

            <!-- X-Axis Month Labels (Smaller, Unbolded) -->
            <text
              v-for="pt in sparkPoints"
              :key="'axis-' + pt.label"
              :x="pt.x"
              :y="sparkHeight - 4"
              text-anchor="middle"
              class="fill-gray-400 text-[7px] font-normal tracking-wider uppercase"
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
          <!-- Left: Numbers and Legend -->
          <div class="min-w-0 flex-1">
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

          <!-- Right: Pie / Donut Chart (Enlarged) -->
          <div class="relative flex shrink-0 items-center justify-center">
            <svg
              width="116"
              height="116"
              viewBox="0 0 116 116"
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
                cx="58"
                cy="58"
                r="46"
                fill="none"
                stroke="#f1f5f9"
                stroke-width="14"
              />

              <!-- Active Segment Progress Arc -->
              <circle
                cx="58"
                cy="58"
                r="46"
                fill="none"
                stroke="url(#outsideRenewalPieGradient)"
                stroke-width="14"
                :stroke-dasharray="`${renewalPieSegments.renewedDash} ${renewalPieSegments.remainingDash}`"
                stroke-dashoffset="0"
                stroke-linecap="round"
                transform="rotate(-90 58 58)"
                class="transition-all duration-700 ease-out"
              />

              <!-- Centered Percentage Label -->
              <text
                x="58"
                y="63"
                text-anchor="middle"
                class="fill-gray-950 text-sm font-black tabular-nums sm:text-base"
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
            <p class="group-hover:text-primary truncate text-sm font-bold text-gray-900">
              Dr. {{ getAppealDoctorName(appeal) }}
            </p>
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
      size="2xl"
      title="Subscription Profits & Retention"
      description="Detailed breakdown of subscription revenue, active subscribers, and renewal rates."
      @update:model-value="showProfitsModal = $event"
      @close="handleCloseProfitsModal"
    >
      <div class="space-y-6">
        <!-- Metric Key Stats Row (Unified, Non-Redundant) -->
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 text-center">
            <span class="block text-[11px] font-semibold tracking-wider text-gray-500 uppercase"
              >Total Profits</span
            >
            <span class="mt-1 block text-xl font-black text-emerald-700 tabular-nums">
              {{ formattedProfits }}
            </span>
            <span class="text-[10px] font-medium text-gray-400">Lifetime Revenue</span>
          </div>

          <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 text-center">
            <span class="block text-[11px] font-semibold tracking-wider text-gray-500 uppercase"
              >Active Subs</span
            >
            <span class="mt-1 block text-xl font-black text-gray-900 tabular-nums">
              {{ dashboardStats?.subscription_profits?.active_subscribers_count ?? 0 }}
            </span>
            <span class="text-[10px] font-medium text-gray-400">
              {{ dashboardStats?.subscription_profits?.total_subscribed_users ?? 0 }} all-time
            </span>
          </div>

          <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 text-center">
            <span class="block text-[11px] font-semibold tracking-wider text-gray-500 uppercase"
              >Renewal Rate</span
            >
            <span class="mt-1 block text-xl font-black text-blue-700 tabular-nums">
              {{ renewalRatePercentage }}%
            </span>
            <span class="text-[10px] font-medium text-gray-400">
              {{ dashboardStats?.subscription_profits?.renewed_users_count ?? 0 }} renewed
            </span>
          </div>

          <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 text-center">
            <span class="block text-[11px] font-semibold tracking-wider text-gray-500 uppercase"
              >Total Doctors</span
            >
            <span class="mt-1 block text-xl font-black text-gray-900 tabular-nums">
              {{ dashboardStats?.user_counts?.total_doctors ?? doctorCount }}
            </span>
            <span class="text-[10px] font-medium text-gray-400">Registered</span>
          </div>

          <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 text-center">
            <span class="block text-[11px] font-semibold tracking-wider text-gray-500 uppercase"
              >Total Patients</span
            >
            <span class="mt-1 block text-xl font-black text-gray-900 tabular-nums">
              {{ dashboardStats?.user_counts?.total_patients ?? patientCount }}
            </span>
            <span class="text-[10px] font-medium text-gray-400">Registered</span>
          </div>
        </div>

        <!-- Recent Invoices List -->
        <div>
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-xs font-bold tracking-wider text-gray-500 uppercase">
              Recent Subscription Payments & Renewals
            </h4>
            <NuxtLink
              to="/admin/subscriptions"
              class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              View in Subscriptions →
            </NuxtLink>
          </div>

          <div
            v-if="dashboardStats?.subscription_profits?.recent_invoices?.length"
            class="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <div
              v-for="invoice in dashboardStats.subscription_profits.recent_invoices"
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
              No subscription invoices recorded yet.
            </p>
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
