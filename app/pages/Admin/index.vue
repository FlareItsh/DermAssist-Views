<script setup lang="ts">
import { datasetService, type DatasetCategory } from '~/api/dataset/DatasetService'
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
    const activities = usageActivities.value.filter(activity => activity.date >= bucket.start && activity.date < bucket.end)
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

const usageTotal = computed(() => usageSeries.value.reduce((total, point) => total + point.value, 0))
const usageMax = computed(() => Math.max(...usageSeries.value.map(point => point.value), 1))
const usageYAxisLabels = computed(() => {
  return Array.from({ length: 5 }, (_, index) => Math.round((usageMax.value / 4) * (4 - index)))
})

const usageChartPoints = computed(() => {
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom
  const step = usageSeries.value.length > 1 ? plotWidth / (usageSeries.value.length - 1) : plotWidth

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
    usersForUsage.value = [...getResponseData(patientsResponse), ...getResponseData(doctorsResponse)]
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

onMounted(() => {
  fetchUserCounts()
  fetchVerifications()
  fetchDatasets()
  fetchAppeals()
})
</script>

<template>
  <div class="">

    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
      <AdminSideComponentsMetricCard label="Patients" :value="patientCount"
        detail="Number of users registered as patients" icon="lucide:users" tone="blue" to="/admin/moderation/users?role=patient" :loading="isLoadingUsers" />

      <AdminSideComponentsMetricCard label="Doctors" :value="doctorCount" detail="Number of users registered as doctors"
        icon="lucide:stethoscope" tone="emerald" to="/admin/moderation/users?role=doctor" :loading="isLoadingUsers" />

      <AdminSideComponentsMetricCard label="Active Dataset" :value="datasetImageCount"
        detail="New dataset images added to the gallery" icon="lucide:images" tone="amber"
        to="/admin/dataset" :loading="isLoadingDatasets" />

      <AdminSideComponentsMetricCard label="Scan Appeals" :value="sortedAppeals.length"
        detail="Doctor reports disputing scanner results" icon="lucide:alert-circle" tone="rose"
        to="/admin/appeals" :loading="isLoadingAppeals" />
    </div>

    <section class="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 class="text-base font-black text-gray-950">Website Usage</h2>
          <p class="mt-1 text-xs text-gray-500">Tracked platform activity across the selected period.</p>
        </div>

        <div class="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button v-for="option in usageRangeOptions" :key="option.value" type="button"
            class="rounded-lg px-2.5 py-1 text-xs font-bold transition"
            :class="usageRange === option.value ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
            @click="usageRange = option.value">
            {{ option.label }}
          </button>
        </div>
      </div>

      <div v-if="isLoadingUsers || isLoadingVerifications || isLoadingAppeals" class="p-5">
        <div class="h-80 animate-pulse rounded-xl bg-gray-100" />
      </div>

      <div v-else class="p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total activity</p>
            <p class="mt-1 text-2xl font-black text-gray-950">{{ usageTotal }}</p>
          </div>

          <div class="text-primary flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2">
            <Icon name="lucide:activity" class="text-base" />
            <span class="text-xs font-bold">{{usageRangeOptions.find(option => option.value === usageRange)?.label}}
              view</span>
          </div>
        </div>

        <div class="w-full overflow-x-auto">
          <svg class="min-w-[680px]" :viewBox="`0 0 ${chartWidth} ${chartHeight}`" role="img"
            aria-label="Website usage area chart">
            <defs>
              <linearGradient id="usageAreaGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.48" />
                <stop offset="100%" stop-color="var(--color-primary-light)" stop-opacity="0.16" />
              </linearGradient>
            </defs>

            <g>
              <line v-for="(label, index) in usageYAxisLabels" :key="`grid-${index}`" :x1="chartPadding.left"
                :x2="chartWidth - chartPadding.right"
                :y1="chartPadding.top + ((chartHeight - chartPadding.top - chartPadding.bottom) / 4) * index"
                :y2="chartPadding.top + ((chartHeight - chartPadding.top - chartPadding.bottom) / 4) * index"
                stroke="#eef2f7" stroke-width="1" />
              <text v-for="(label, index) in usageYAxisLabels" :key="`axis-${label}-${index}`"
                :x="chartPadding.left - 14"
                :y="chartPadding.top + ((chartHeight - chartPadding.top - chartPadding.bottom) / 4) * index + 4"
                text-anchor="end" class="fill-gray-400 text-[8px] font-semibold">
                {{ label }}
              </text>
            </g>

            <path :d="usageAreaPath" fill="url(#usageAreaGradient)" />
            <path :d="usageLinePath" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" />

            <g v-for="point in usageChartPoints" :key="point.label" @mouseenter="hoveredUsagePoint = point"
              @mouseleave="hoveredUsagePoint = null" @focus="hoveredUsagePoint = point" @blur="hoveredUsagePoint = null"
              tabindex="0">
              <rect :x="point.x - 18" :y="chartPadding.top" width="36"
                :height="chartHeight - chartPadding.top - chartPadding.bottom" fill="transparent" />
              <line v-if="hoveredUsagePoint?.label === point.label" :x1="point.x" :x2="point.x" :y1="chartPadding.top"
                :y2="chartHeight - chartPadding.bottom" stroke="var(--color-primary-light)" stroke-width="1.5" stroke-dasharray="4 4" />
              <circle :cx="point.x" :cy="point.y" r="4" fill="var(--color-primary)" stroke="white" stroke-width="2" />
              <text :x="point.x" :y="chartHeight - 12" text-anchor="middle"
                class="fill-gray-500 text-[8px] font-semibold">
                {{ point.label }}
              </text>
            </g>

            <g v-if="hoveredUsagePoint" pointer-events="none">
              <rect :x="getTooltipX(hoveredUsagePoint)" :y="getTooltipY(hoveredUsagePoint)" :width="tooltipWidth"
                :height="hoveredUsagePoint.activityCounts.length ? 53 + hoveredUsagePoint.activityCounts.length * 16 : 76"
                rx="12" fill="white" stroke="var(--color-primary-light)" stroke-width="1"
                filter="drop-shadow(0 12px 24px rgba(15, 23, 42, 0.14))" />
              <text :x="getTooltipX(hoveredUsagePoint) + 14" :y="getTooltipY(hoveredUsagePoint) + 22"
                class="fill-gray-500 text-[10px] font-bold uppercase">
                {{ hoveredUsagePoint.label }}
              </text>
              <text :x="getTooltipX(hoveredUsagePoint) + 14" :y="getTooltipY(hoveredUsagePoint) + 35"
                class="fill-gray-950 text-[10px] font-black">
                {{ hoveredUsagePoint.value }} total activities
              </text>
              <template v-if="hoveredUsagePoint.activityCounts.length">
                <g v-for="(activity, index) in hoveredUsagePoint.activityCounts" :key="activity.label">
                  <circle :cx="getTooltipX(hoveredUsagePoint) + 18"
                    :cy="getTooltipY(hoveredUsagePoint) + 55 + index * 12" r="2" fill="var(--color-primary)" />
                  <text :x="getTooltipX(hoveredUsagePoint) + 28" :y="getTooltipY(hoveredUsagePoint) + 58 + index * 11"
                    class="fill-gray-600 text-[8px] font-semibold">
                    {{ activity.label }}: {{ activity.count }}
                  </text>
                </g>
              </template>
              <text v-else :x="getTooltipX(hoveredUsagePoint) + 14" :y="getTooltipY(hoveredUsagePoint) + 60"
                class="fill-gray-400 text-[8px] font-semibold">
                No activity recorded
              </text>
            </g>
          </svg>
        </div>
      </div>
    </section>

    <div class="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div class="min-w-0">
          <div class="flex items-center gap-3">
            <div class="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <h2 class="truncate text-lg font-black text-gray-950">Doctor Scan Appeals</h2>
          </div>
          <p class="mt-1 text-sm text-gray-500">Doctors flagging scans they believe were diagnosed incorrectly.</p>
        </div>

        <NuxtLink to="/admin/appeals"
          class="hover:border-primary hover:text-primary inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition">
          <span>Review all</span>
          <Icon name="lucide:arrow-right" class="text-base" />
        </NuxtLink>
      </div>

      <div v-if="isLoadingAppeals" class="grid gap-3 p-5 md:grid-cols-2">
        <div v-for="i in 4" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-100" />
      </div>

      <div v-else-if="recentAppeals.length" class="divide-y divide-gray-100">
        <NuxtLink v-for="appeal in recentAppeals" :key="appeal.uuid" to="/admin/appeals"
          class="group grid gap-4 px-5 py-4 transition hover:bg-gray-50 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-gray-900 group-hover:text-primary">Dr. {{
              getAppealDoctorName(appeal) }}</p>
            <p class="mt-1 truncate text-xs font-medium text-gray-400">{{ formatAppealDate(appeal.created_at ||
              appeal.updated_at) }}</p>
          </div>

          <div class="min-w-0">
            <p class="truncate text-sm text-gray-600">
              Suggested <span class="font-bold text-rose-600">{{ appeal.suggested_label || 'new diagnosis' }}</span>
              instead of <span class="font-semibold text-gray-900">{{ appeal.diagnosis_label || 'scanner result'
              }}</span>
            </p>
            <p class="mt-1 line-clamp-1 text-sm text-gray-500">{{ appeal.description || 'No reason provided.' }}</p>
          </div>

          <Icon name="lucide:chevron-right"
            class="self-center text-xl text-gray-300 transition group-hover:text-primary" />
        </NuxtLink>
      </div>

      <div v-else class="px-5 py-10 text-center">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
          <Icon name="material-symbols:report-outline" class="text-2xl" />
        </div>
        <p class="text-sm font-medium text-gray-500">No doctor scan appeals have been filed yet.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <AdminSideComponentsDoctorVerificationList title="Recently Verified Doctors"
        description="Doctors who were most recently cleared for platform access." :items="recentlyVerifiedDoctors"
        empty-text="No recently verified doctors yet." status="verified" :loading="isLoadingVerifications" />

      <AdminSideComponentsDoctorVerificationList title="Upcoming Doctor Verification"
        description="Pending verification requests that still need review." :items="pendingVerifications"
        empty-text="No pending doctor verifications right now." status="pending" :loading="isLoadingVerifications" />
    </div>

    <div class="mt-6">
      <AdminSideComponentsRecentDatasetImages :datasets="datasets" :loading="isLoadingDatasets" />
    </div>
  </div>
</template>
