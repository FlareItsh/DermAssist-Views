<script setup lang="ts">
  import { userService } from '~/api/user/UserService'
  import { scanQuotaService } from '~/api/scanQuota/ScanQuotaService'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  interface User {
    id?: number
    uuid: string
    first_name?: string
    middle_name?: string | null
    last_name?: string
    email?: string
    role?: string
    user_role?: string
    status?: string
    city?: string | null
    province?: string | null
    affiliation?: string | null
    created_at?: string
    updated_at?: string
    doctor_verification?: {
      status?: string
      prc_number?: string
    }
  }

  const users = ref<User[]>([])
  const isLoading = ref(true)
  const isLoadingCounts = ref(true)
  const searchQuery = ref('')
  const selectedRole = ref('')
  const selectedStatus = ref('')
  const currentPage = ref(1)
  const perPage = ref(10)
  const totalUsers = ref(0)
  const patientCount = ref(0)
  const doctorCount = ref(0)
  const route = useRoute()
  const router = useRouter()

  // Dynamic Scan Quota Setting State
  const defaultScanQuota = ref(5)
  const inputScanQuota = ref(5)
  const isLoadingQuota = ref(false)
  const isUpdatingQuota = ref(false)

  // Dynamic Care Grace Periods State
  const appointmentUnlimitedDays = ref(7)
  const doctorCreatedUnlimitedDays = ref(7)
  const inputApptGraceValue = ref(1)
  const inputApptGraceUnit = ref<'days' | 'weeks'>('weeks')
  const inputDocCreatedGraceValue = ref(1)
  const inputDocCreatedGraceUnit = ref<'days' | 'weeks'>('weeks')
  const isUpdatingApptGrace = ref(false)
  const isUpdatingDocGrace = ref(false)

  const roleOptions = [
    { label: 'All', value: '' },
    { label: 'Patients', value: 'patient' },
    { label: 'Doctors', value: 'doctor' },
    { label: 'Admins', value: 'admin' }
  ]

  const statusOptions = [
    { label: 'All', value: '' },
    { label: 'Verified', value: 'verified' },
    { label: 'Pending', value: 'pending' },
    { label: 'Declined', value: 'declined' }
  ]

  const getResponseData = (response: any): User[] => {
    return Array.isArray(response) ? response : response?.data || []
  }

  const getResponseTotal = (response: any) => {
    if (typeof response?.total === 'number') return response.total
    if (typeof response?.meta?.total === 'number') return response.meta.total
    if (typeof response?.pagination?.total === 'number') return response.pagination.total
    return getResponseData(response).length
  }

  const getResponseCurrentPage = (response: any) => {
    return response?.meta?.current_page || response?.pagination?.current_page || currentPage.value
  }

  const getResponsePerPage = (response: any) => {
    return response?.meta?.per_page || response?.pagination?.per_page || perPage.value
  }

  const syncRoleFromRoute = () => {
    const role = Array.isArray(route.query.role) ? route.query.role[0] : route.query.role
    selectedRole.value = roleOptions.some(option => option.value === role) ? String(role) : ''
  }

  const updateRouteRole = () => {
    const query = { ...route.query }

    if (selectedRole.value) query.role = selectedRole.value
    else delete query.role

    router.replace({ query })
  }

  const fetchUsers = async () => {
    isLoading.value = true

    try {
      const params: Record<string, string | number> = {
        page: currentPage.value,
        per_page: perPage.value
      }
      if (selectedRole.value) params.role = selectedRole.value
      if (selectedStatus.value) params.status = selectedStatus.value
      if (searchQuery.value.trim()) params.search = searchQuery.value.trim()

      const response = await userService.list(params)
      users.value = getResponseData(response)
      totalUsers.value = getResponseTotal(response)
      currentPage.value = getResponseCurrentPage(response)
      perPage.value = getResponsePerPage(response)
    } catch (error) {
      console.error('Failed to fetch users:', error)
      users.value = []
      totalUsers.value = 0
    } finally {
      isLoading.value = false
    }
  }

  const patientUsersData = ref<User[]>([])
  const doctorUsersData = ref<User[]>([])

  const patientTrend = computed(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recent = patientUsersData.value.filter(
      u =>
        (u.created_at || (u as any).createdAt) &&
        new Date(u.created_at || (u as any).createdAt) >= thirtyDaysAgo
    ).length
    return {
      value: recent > 0 ? `+${recent}` : '0 new',
      direction: recent > 0 ? ('up' as const) : ('neutral' as const),
      label: 'last 30d'
    }
  })

  const doctorTrend = computed(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recent = doctorUsersData.value.filter(
      u =>
        (u.created_at || (u as any).createdAt) &&
        new Date(u.created_at || (u as any).createdAt) >= thirtyDaysAgo
    ).length
    return {
      value: recent > 0 ? `+${recent}` : '0 new',
      direction: recent > 0 ? ('up' as const) : ('neutral' as const),
      label: 'last 30d'
    }
  })

  const fetchUserCounts = async () => {
    isLoadingCounts.value = true

    try {
      const [patientsResponse, doctorsResponse] = await Promise.all([
        userService.list({ role: 'patient' }),
        userService.list({ role: 'doctor' })
      ])

      patientCount.value = getResponseTotal(patientsResponse)
      doctorCount.value = getResponseTotal(doctorsResponse)
      patientUsersData.value = getResponseData(patientsResponse)
      doctorUsersData.value = getResponseData(doctorsResponse)
    } catch (error) {
      console.error('Failed to fetch user counts:', error)
      patientCount.value = 0
      doctorCount.value = 0
    } finally {
      isLoadingCounts.value = false
    }
  }

  const fetchDefaultQuota = async () => {
    isLoadingQuota.value = true
    try {
      const res = await scanQuotaService.getDefaultDailyQuota()
      if (res?.data?.default_daily_quota) {
        defaultScanQuota.value = res.data.default_daily_quota
        inputScanQuota.value = res.data.default_daily_quota
      }
    } catch (e: any) {
      console.error('Failed to load default scan quota:', e)
    } finally {
      isLoadingQuota.value = false
    }
  }

  const saveDefaultQuota = async () => {
    if (!inputScanQuota.value || inputScanQuota.value < 1) {
      toast.error('Scan quota must be at least 1.')
      return
    }
    isUpdatingQuota.value = true
    try {
      const res = await scanQuotaService.updateDefaultDailyQuota(inputScanQuota.value)
      if (res?.data?.default_daily_quota) {
        defaultScanQuota.value = res.data.default_daily_quota
        inputScanQuota.value = res.data.default_daily_quota
        toast.success(`Default daily scan quota updated to ${defaultScanQuota.value} scans.`)
      }
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to update default scan quota.')
    } finally {
      isUpdatingQuota.value = false
    }
  }

  const fetchCareGracePeriods = async () => {
    try {
      const res = await scanQuotaService.getCareGracePeriods()
      if (res?.data) {
        appointmentUnlimitedDays.value = res.data.appointment_unlimited_days
        doctorCreatedUnlimitedDays.value = res.data.doctor_created_unlimited_days

        if (appointmentUnlimitedDays.value > 0 && appointmentUnlimitedDays.value % 7 === 0) {
          inputApptGraceValue.value = appointmentUnlimitedDays.value / 7
          inputApptGraceUnit.value = 'weeks'
        } else {
          inputApptGraceValue.value = appointmentUnlimitedDays.value
          inputApptGraceUnit.value = 'days'
        }

        if (doctorCreatedUnlimitedDays.value > 0 && doctorCreatedUnlimitedDays.value % 7 === 0) {
          inputDocCreatedGraceValue.value = doctorCreatedUnlimitedDays.value / 7
          inputDocCreatedGraceUnit.value = 'weeks'
        } else {
          inputDocCreatedGraceValue.value = doctorCreatedUnlimitedDays.value
          inputDocCreatedGraceUnit.value = 'days'
        }
      }
    } catch (e: any) {
      console.error('Failed to load care grace periods:', e)
    }
  }

  const saveAppointmentGrace = async () => {
    const rawVal = Number(inputApptGraceValue.value)
    if (isNaN(rawVal) || rawVal < 0) {
      toast.error('Duration must be 0 or greater.')
      return
    }
    const days = inputApptGraceUnit.value === 'weeks' ? rawVal * 7 : rawVal
    if (days > 365) {
      toast.error('Duration cannot exceed 365 days (52 weeks).')
      return
    }

    isUpdatingApptGrace.value = true
    try {
      const res = await scanQuotaService.updateCareGracePeriods({
        appointment_unlimited_days: days
      })
      if (res?.data) {
        appointmentUnlimitedDays.value = res.data.appointment_unlimited_days
        toast.success(`Completed appointment grace period set to ${days} day(s).`)
      }
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to update grace period.')
    } finally {
      isUpdatingApptGrace.value = false
    }
  }

  const saveDoctorCreatedGrace = async () => {
    const rawVal = Number(inputDocCreatedGraceValue.value)
    if (isNaN(rawVal) || rawVal < 0) {
      toast.error('Duration must be 0 or greater.')
      return
    }
    const days = inputDocCreatedGraceUnit.value === 'weeks' ? rawVal * 7 : rawVal
    if (days > 365) {
      toast.error('Duration cannot exceed 365 days (52 weeks).')
      return
    }

    isUpdatingDocGrace.value = true
    try {
      const res = await scanQuotaService.updateCareGracePeriods({
        doctor_created_unlimited_days: days
      })
      if (res?.data) {
        doctorCreatedUnlimitedDays.value = res.data.doctor_created_unlimited_days
        toast.success(`Doctor-created account grace period set to ${days} day(s).`)
      }
    } catch (err: any) {
      toast.error(err.data?.message || err.message || 'Failed to update grace period.')
    } finally {
      isUpdatingDocGrace.value = false
    }
  }

  const setApptPreset = (val: number, unit: 'days' | 'weeks') => {
    inputApptGraceValue.value = val
    inputApptGraceUnit.value = unit
  }

  const setDocCreatedPreset = (val: number, unit: 'days' | 'weeks') => {
    inputDocCreatedGraceValue.value = val
    inputDocCreatedGraceUnit.value = unit
  }

  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  const totalPages = computed(() => Math.max(1, Math.ceil(totalUsers.value / perPage.value)))
  const firstVisibleUser = computed(() =>
    totalUsers.value ? (currentPage.value - 1) * perPage.value + 1 : 0
  )
  const lastVisibleUser = computed(() =>
    Math.min(currentPage.value * perPage.value, totalUsers.value)
  )

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages.value)
    if (nextPage === currentPage.value) return

    currentPage.value = nextPage
    fetchUsers()
  }

  watch(selectedRole, () => {
    currentPage.value = 1
    updateRouteRole()
    fetchUsers()
  })

  watch(selectedStatus, () => {
    currentPage.value = 1
    fetchUsers()
  })

  watch(searchQuery, () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      currentPage.value = 1
      fetchUsers()
    }, 350)
  })

  watch(
    () => route.query.role,
    () => {
      const previousRole = selectedRole.value
      syncRoleFromRoute()
      if (previousRole !== selectedRole.value) {
        currentPage.value = 1
      }
    }
  )

  onMounted(() => {
    syncRoleFromRoute()
    fetchUsers()
    fetchUserCounts()
    fetchDefaultQuota()
    fetchCareGracePeriods()
  })

  onUnmounted(() => {
    if (searchTimeout) clearTimeout(searchTimeout)
  })

  const getUserRole = (user: User) => String(user.role || user.user_role || 'user').toLowerCase()

  const getFullName = (user: User) => {
    const first = user.first_name?.trim()
    const middle = user.middle_name?.trim()
    const last = user.last_name?.trim()
    return [first, middle, last].filter(Boolean).join(' ') || 'Unnamed user'
  }

  const getInitials = (user: User) => {
    const first = user.first_name?.[0]
    const last = user.last_name?.[0]
    return `${first || 'U'}${last || 'R'}`.toUpperCase()
  }

  const getLocation = (user: User) => {
    return (
      [user.city, user.province].filter(Boolean).join(', ') ||
      user.affiliation ||
      'No location listed'
    )
  }

  const getUserStatus = (user: User) => {
    if (getUserRole(user) === 'doctor') return user.doctor_verification?.status || 'unverified'
    return user.status || 'active'
  }

  const getStatusColor = (
    status: string
  ): 'primary' | 'success' | 'warning' | 'danger' | 'gray' => {
    switch (status) {
      case 'active':
      case 'verified':
        return 'success'
      case 'pending':
      case 'unverified':
        return 'warning'
      case 'declined':
      case 'inactive':
      case 'suspended':
        return 'danger'
      default:
        return 'gray'
    }
  }

  const formatDate = (date?: string) => {
    if (!date) return 'Recently'
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date))
  }

  const visiblePatientCount = computed(
    () => users.value.filter(user => getUserRole(user) === 'patient').length
  )
  const visibleDoctorCount = computed(
    () => users.value.filter(user => getUserRole(user) === 'doctor').length
  )
</script>

<template>
  <div>
    <div class="mb-5 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-2 md:gap-4">
      <AdminSideComponentsMetricCard
        label="Patients"
        :value="patientCount"
        detail="Registered patient accounts"
        :trend="patientTrend"
        to="/admin/moderation/users?role=patient"
        :loading="isLoadingCounts"
      />
      <AdminSideComponentsMetricCard
        label="Doctors"
        :value="doctorCount"
        detail="Registered doctor accounts"
        :trend="doctorTrend"
        to="/admin/moderation/users?role=doctor"
        :loading="isLoadingCounts"
      />
    </div>

    <!-- AI Scan Quota & Grace Policy Settings Grid -->
    <div class="mb-5 grid grid-cols-1 gap-4 md:mb-6 lg:grid-cols-3">
      <!-- Setting 1: Default Daily Quota -->
      <div
        class="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-5"
      >
        <div>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <div
                class="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              >
                <Icon
                  name="lucide:gauge"
                  class="h-4.5 w-4.5"
                />
              </div>
              <h3 class="text-sm font-bold text-gray-950">Daily AI Scan Quota</h3>
            </div>
            <span
              class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
            >
              Active: {{ defaultScanQuota }}/24h
            </span>
          </div>

          <p class="mt-2 text-xs leading-relaxed text-gray-500">
            Standard limit for patients and unsubscribed doctors. Resets 24h after first scan.
          </p>
        </div>

        <div class="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
          <div class="relative flex-1">
            <input
              v-model.number="inputScanQuota"
              type="number"
              min="1"
              max="1000"
              placeholder="e.g. 5"
              class="focus:border-primary/30 focus:ring-primary/10 h-9.5 w-full rounded-xl border border-gray-200 bg-gray-50 pr-12 pl-3 text-sm font-bold text-gray-900 transition outline-none focus:bg-white focus:ring-4"
              :disabled="isUpdatingQuota"
            />
            <span
              class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-gray-400"
            >
              scans
            </span>
          </div>

          <AppButton
            variant="solid"
            size="sm"
            @click="saveDefaultQuota"
            :disabled="
              isUpdatingQuota ||
              inputScanQuota === defaultScanQuota ||
              !inputScanQuota ||
              inputScanQuota < 1
            "
            class="h-9.5 px-3.5"
          >
            <Icon
              v-if="isUpdatingQuota"
              name="svg-spinners:ring-resize"
              class="mr-1 h-3.5 w-3.5 animate-spin"
            />
            <Icon
              v-else
              name="lucide:check"
              class="mr-1 h-3.5 w-3.5"
            />
            <span>Update</span>
          </AppButton>
        </div>
      </div>

      <!-- Setting 2: Completed Appointment Grace Period -->
      <div
        class="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-5"
      >
        <div>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"
              >
                <Icon
                  name="lucide:calendar-check-2"
                  class="h-4.5 w-4.5"
                />
              </div>
              <h3 class="text-sm font-bold text-gray-950">Completed Appt Grace</h3>
            </div>
            <span
              class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"
            >
              Active:
              {{ appointmentUnlimitedDays === 0 ? 'Disabled' : `${appointmentUnlimitedDays}d` }}
            </span>
          </div>

          <p class="mt-2 text-xs leading-relaxed text-gray-500">
            Unlimited AI scans awarded to patients after their doctor marks an appointment complete.
          </p>

          <!-- Presets -->
          <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              @click="setApptPreset(1, 'weeks')"
              class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              1 Week
            </button>
            <button
              type="button"
              @click="setApptPreset(2, 'weeks')"
              class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              2 Weeks
            </button>
            <button
              type="button"
              @click="setApptPreset(30, 'days')"
              class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              30 Days
            </button>
            <button
              type="button"
              @click="setApptPreset(0, 'days')"
              class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              None
            </button>
          </div>
        </div>

        <div class="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
          <div class="flex flex-1 items-center gap-1.5">
            <input
              v-model.number="inputApptGraceValue"
              type="number"
              min="0"
              max="365"
              class="focus:border-primary/30 focus:ring-primary/10 h-9.5 w-18 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-center text-sm font-bold text-gray-900 transition outline-none focus:bg-white focus:ring-4"
              :disabled="isUpdatingApptGrace"
            />
            <select
              v-model="inputApptGraceUnit"
              class="focus:border-primary/30 focus:ring-primary/10 h-9.5 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-2 text-xs font-bold text-gray-800 transition outline-none focus:bg-white focus:ring-4"
              :disabled="isUpdatingApptGrace"
            >
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
            </select>
          </div>

          <AppButton
            variant="solid"
            size="sm"
            @click="saveAppointmentGrace"
            :disabled="isUpdatingApptGrace"
            class="h-9.5 px-3.5"
          >
            <Icon
              v-if="isUpdatingApptGrace"
              name="svg-spinners:ring-resize"
              class="mr-1 h-3.5 w-3.5 animate-spin"
            />
            <Icon
              v-else
              name="lucide:check"
              class="mr-1 h-3.5 w-3.5"
            />
            <span>Update</span>
          </AppButton>
        </div>
      </div>

      <!-- Setting 3: Doctor-Created Account Grace Period -->
      <div
        class="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-5"
      >
        <div>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600"
              >
                <Icon
                  name="lucide:user-plus"
                  class="h-4.5 w-4.5"
                />
              </div>
              <h3 class="text-sm font-bold text-gray-950">Doctor-Created Grace</h3>
            </div>
            <span
              class="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800"
            >
              Active:
              {{ doctorCreatedUnlimitedDays === 0 ? 'Disabled' : `${doctorCreatedUnlimitedDays}d` }}
            </span>
          </div>

          <p class="mt-2 text-xs leading-relaxed text-gray-500">
            Unlimited AI scans awarded to patients whose accounts are registered directly by a
            doctor.
          </p>

          <!-- Presets -->
          <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              @click="setDocCreatedPreset(1, 'weeks')"
              class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              1 Week
            </button>
            <button
              type="button"
              @click="setDocCreatedPreset(2, 'weeks')"
              class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              2 Weeks
            </button>
            <button
              type="button"
              @click="setDocCreatedPreset(30, 'days')"
              class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              30 Days
            </button>
            <button
              type="button"
              @click="setDocCreatedPreset(0, 'days')"
              class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              None
            </button>
          </div>
        </div>

        <div class="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
          <div class="flex flex-1 items-center gap-1.5">
            <input
              v-model.number="inputDocCreatedGraceValue"
              type="number"
              min="0"
              max="365"
              class="focus:border-primary/30 focus:ring-primary/10 h-9.5 w-18 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-center text-sm font-bold text-gray-900 transition outline-none focus:bg-white focus:ring-4"
              :disabled="isUpdatingDocGrace"
            />
            <select
              v-model="inputDocCreatedGraceUnit"
              class="focus:border-primary/30 focus:ring-primary/10 h-9.5 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-2 text-xs font-bold text-gray-800 transition outline-none focus:bg-white focus:ring-4"
              :disabled="isUpdatingDocGrace"
            >
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
            </select>
          </div>

          <AppButton
            variant="solid"
            size="sm"
            @click="saveDoctorCreatedGrace"
            :disabled="isUpdatingDocGrace"
            class="h-9.5 px-3.5"
          >
            <Icon
              v-if="isUpdatingDocGrace"
              name="svg-spinners:ring-resize"
              class="mr-1 h-3.5 w-3.5 animate-spin"
            />
            <Icon
              v-else
              name="lucide:check"
              class="mr-1 h-3.5 w-3.5"
            />
            <span>Update</span>
          </AppButton>
        </div>
      </div>
    </div>

    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div
        class="flex flex-col gap-4 border-b border-gray-100 px-4 py-3 md:px-5 md:py-4 xl:flex-row xl:items-center xl:justify-between"
      >
        <div>
          <h2 class="text-base font-black text-gray-950">User Directory</h2>
          <p class="mt-1 text-xs text-gray-500">
            {{ visibleDoctorCount }} doctors and {{ visiblePatientCount }} patients shown.
          </p>
        </div>

        <div class="flex flex-col gap-3 md:flex-row md:items-center">
          <div class="relative md:w-72">
            <Icon
              name="lucide:search"
              class="absolute top-1/2 left-3 -translate-y-1/2 text-base text-gray-400"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search users..."
              class="focus:border-primary/30 focus:ring-primary/10 h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pr-3 pl-9 text-sm font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
            />
          </div>

          <div class="flex w-full rounded-xl border border-gray-200 bg-gray-50 p-1 md:w-auto">
            <button
              v-for="role in roleOptions"
              :key="role.value"
              type="button"
              class="flex-1 rounded-lg px-2.5 py-1 text-xs font-bold transition md:flex-none"
              :class="
                selectedRole === role.value
                  ? 'text-primary bg-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              "
              @click="selectedRole = role.value"
            >
              {{ role.label }}
            </button>
          </div>

          <select
            v-model="selectedStatus"
            class="focus:border-primary/30 focus:ring-primary/10 h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-600 transition outline-none focus:bg-white focus:ring-4 md:w-auto"
          >
            <option
              v-for="status in statusOptions"
              :key="status.value"
              :value="status.value"
            >
              {{ status.label }} status
            </option>
          </select>
        </div>
      </div>

      <div
        v-if="isLoading"
        class="space-y-3 p-4 md:p-5"
      >
        <div
          v-for="i in 6"
          :key="i"
          class="h-20 animate-pulse rounded-xl bg-gray-100"
        />
      </div>

      <div
        v-else-if="users.length"
        class="divide-y divide-gray-100"
      >
        <NuxtLink
          v-for="user in users"
          :key="user.uuid || user.id"
          :to="`/admin/moderation/users/${user.uuid}`"
          class="grid gap-2 px-4 py-3 transition hover:bg-gray-50 md:px-5 md:py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:gap-4"
        >
          <div class="flex min-w-0 items-center gap-4">
            <div
              class="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-black md:h-12 md:w-12"
            >
              {{ getInitials(user) }}
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-gray-950">
                {{ getUserRole(user) === 'doctor' ? 'Dr. ' : '' }}{{ getFullName(user) }}
              </p>
              <p class="mt-1 truncate text-xs font-medium text-gray-500">
                {{ user.email || 'No email address' }}
              </p>
            </div>
          </div>

          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-gray-700 capitalize">
              {{ getUserRole(user) }}
            </p>
            <p class="mt-1 truncate text-xs font-medium text-gray-400">{{ getLocation(user) }}</p>
          </div>

          <div class="flex items-center gap-3 lg:justify-end">
            <AppBadge
              size="xs"
              :color="getStatusColor(getUserStatus(user))"
            >
              {{ getUserStatus(user) }}
            </AppBadge>
            <span class="text-xs font-medium text-gray-400">{{ formatDate(user.created_at) }}</span>
            <Icon
              name="lucide:chevron-right"
              class="text-lg text-gray-300"
            />
          </div>
        </NuxtLink>
      </div>

      <div
        v-else
        class="px-5 py-14 text-center"
      >
        <div
          class="bg-primary/10 text-primary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
        >
          <Icon
            name="lucide:users-round"
            class="text-2xl"
          />
        </div>
        <p class="text-sm font-bold text-gray-700">No users found</p>
        <p class="mt-1 text-sm text-gray-500">Try changing the search or filter options.</p>
      </div>

      <div
        v-if="!isLoading && totalUsers > 0"
        class="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5 md:py-4"
      >
        <p class="text-xs font-medium text-gray-500">
          Showing {{ firstVisibleUser }}-{{ lastVisibleUser }} of {{ totalUsers }} users
        </p>

        <div class="flex items-center gap-2">
          <AppButton
            variant="outline"
            size="sm"
            :disabled="currentPage <= 1"
            @click="goToPage(currentPage - 1)"
          >
            Previous
          </AppButton>
          <span class="min-w-24 text-center text-xs font-bold text-gray-600">
            Page {{ currentPage }} of {{ totalPages }}
          </span>
          <AppButton
            variant="outline"
            size="sm"
            :disabled="currentPage >= totalPages"
            @click="goToPage(currentPage + 1)"
          >
            Next
          </AppButton>
        </div>
      </div>
    </section>
  </div>
</template>
