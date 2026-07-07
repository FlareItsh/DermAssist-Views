<script setup lang="ts">
  import { userService } from '~/api/user/UserService'

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

  const fetchUserCounts = async () => {
    isLoadingCounts.value = true

    try {
      const [patientsResponse, doctorsResponse] = await Promise.all([
        userService.list({ role: 'patient' }),
        userService.list({ role: 'doctor' })
      ])

      patientCount.value = getResponseTotal(patientsResponse)
      doctorCount.value = getResponseTotal(doctorsResponse)
    } catch (error) {
      console.error('Failed to fetch user counts:', error)
      patientCount.value = 0
      doctorCount.value = 0
    } finally {
      isLoadingCounts.value = false
    }
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
    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      <AdminSideComponentsMetricCard
        label="Patients"
        :value="patientCount"
        detail="Registered patient accounts"
        icon="lucide:user-round"
        tone="blue"
        to="/admin/moderation/users?role=patient"
        :loading="isLoadingCounts"
      />
      <AdminSideComponentsMetricCard
        label="Doctors"
        :value="doctorCount"
        detail="Registered doctor accounts"
        icon="lucide:stethoscope"
        tone="emerald"
        to="/admin/moderation/users?role=doctor"
        :loading="isLoadingCounts"
      />
    </div>

    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div
        class="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 xl:flex-row xl:items-center xl:justify-between"
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

          <div class="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              v-for="role in roleOptions"
              :key="role.value"
              type="button"
              class="rounded-lg px-2.5 py-1 text-xs font-bold transition"
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
            class="focus:border-primary/30 focus:ring-primary/10 h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-600 transition outline-none focus:bg-white focus:ring-4"
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
        class="space-y-3 p-5"
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
          class="grid gap-4 px-5 py-4 transition hover:bg-gray-50 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
        >
          <div class="flex min-w-0 items-center gap-4">
            <div
              class="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-black"
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
        class="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
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
