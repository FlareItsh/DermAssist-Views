<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import { userService } from '~/api/user/UserService'
  import { calculateAge } from '~/composables/useFormSanitizer'

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
    gender?: string | null
    age?: number | string | null
    date_of_birth?: string | null
    contact_number?: string | null
    phone?: string | null
    street?: string | null
    barangay?: string | null
    city?: string | null
    province?: string | null
    country?: string | null
    affiliation?: string | null
    avatar_path?: string | null
    prc_number?: string | null
    prcNumber?: string | null
    created_at?: string
    updated_at?: string
    doctor_verification?: {
      status?: string
      prc_number?: string | null
      prcNumber?: string | null
      rejection_reason?: string | null
      rejectionReason?: string | null
    }
  }

  const route = useRoute()
  const router = useRouter()
  const { getStorageUrl } = useStorage()

  const user = ref<User | null>(null)
  const isLoading = ref(true)
  const isRefreshing = ref(false)
  const errorMessage = ref('')
  const isCopied = ref(false)

  const getResponseData = (response: any): User | null => response?.data || response || null

  const fetchUser = async (silent = false) => {
    if (!silent) {
      isLoading.value = true
    } else {
      isRefreshing.value = true
    }
    errorMessage.value = ''

    try {
      user.value = getResponseData(await userService.show(route.params.uuid as string))
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      user.value = null
      errorMessage.value = 'Unable to load this user profile.'
    } finally {
      isLoading.value = false
      isRefreshing.value = false
    }
  }

  const handleRefresh = () => {
    fetchUser(true)
  }

  const handleGoBack = () => {
    router.back()
  }

  const handleNavigateToUsers = () => {
    router.push('/admin/moderation/users')
  }

  const copyEmail = async () => {
    if (!user.value?.email) return
    try {
      await navigator.clipboard.writeText(user.value.email)
      isCopied.value = true
      toast.success('Email copied to clipboard')
      setTimeout(() => {
        isCopied.value = false
      }, 2000)
    } catch (err) {
      console.error('Failed to copy email:', err)
      toast.error('Failed to copy email')
    }
  }

  onMounted(() => {
    fetchUser()
  })

  const getUserRole = (item: User) => String(item.role || item.user_role || 'user').toLowerCase()

  const fullName = computed(() => {
    if (!user.value) return ''
    const first = user.value.first_name?.trim()
    const middle = user.value.middle_name?.trim()
    const last = user.value.last_name?.trim()
    return [first, middle, last].filter(Boolean).join(' ') || 'Unnamed user'
  })

  const initials = computed(() => {
    const first = user.value?.first_name?.[0]
    const last = user.value?.last_name?.[0]
    return `${first || 'U'}${last || 'R'}`.toUpperCase()
  })

  const userRole = computed(() => (user.value ? getUserRole(user.value) : 'user'))

  const userStatus = computed(() => {
    if (!user.value) return 'unknown'
    if (userRole.value === 'doctor') return user.value.doctor_verification?.status || 'unverified'
    return user.value.status || 'active'
  })

  const userAge = computed(() => {
    if (user.value?.date_of_birth) {
      const calculated = calculateAge(user.value.date_of_birth)
      if (calculated !== null && calculated !== undefined) {
        return {
          formatted: `${calculated} yrs old`,
          value: calculated,
          isAutoCalculated: true
        }
      }
    }
    if (
      user.value?.age !== null &&
      user.value?.age !== undefined &&
      user.value?.age !== '' &&
      user.value?.age !== 'Not provided'
    ) {
      return {
        formatted: `${user.value.age} yrs old`,
        value: user.value.age,
        isAutoCalculated: false
      }
    }
    return {
      formatted: 'Not provided',
      value: null,
      isAutoCalculated: false
    }
  })

  const prcNumber = computed(() => {
    return (
      user.value?.prc_number ||
      user.value?.prcNumber ||
      user.value?.doctor_verification?.prc_number ||
      user.value?.doctor_verification?.prcNumber ||
      ''
    )
  })

  const rejectionReason = computed(() => {
    return (
      user.value?.doctor_verification?.rejection_reason ||
      user.value?.doctor_verification?.rejectionReason ||
      ''
    )
  })

  const profileImage = computed(() => {
    if (!user.value?.avatar_path) return ''
    return getStorageUrl(user.value.avatar_path)
  })

  const contactNumber = computed(() => {
    return user.value?.contact_number || user.value?.phone || ''
  })

  const location = computed(() => {
    if (!user.value) return ''
    return (
      [
        user.value.street,
        user.value.barangay,
        user.value.city,
        user.value.province,
        user.value.country
      ]
        .filter(Boolean)
        .join(', ') || ''
    )
  })

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

  const getRoleBadgeClasses = (role: string) => {
    switch (role) {
      case 'doctor':
        return 'bg-sky-50 text-sky-700 border-sky-200/60'
      case 'secretary':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
      case 'admin':
        return 'bg-purple-50 text-purple-700 border-purple-200/60'
      case 'patient':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
    }
  }

  const formatDate = (date?: string) => {
    if (!date) return 'Not available'
    return new Intl.DateTimeFormat('en', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(date))
  }

  const formatBirthDate = (date?: string | null) => {
    if (!date) return 'Not provided'
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date.trim())) {
      const [year, month, day] = date.trim().slice(0, 10).split('-').map(Number)
      return new Intl.DateTimeFormat('en', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }).format(new Date(year, month - 1, day))
    }
    const d = new Date(date)
    if (isNaN(d.getTime())) return 'Not provided'
    return new Intl.DateTimeFormat('en', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(d)
  }
</script>

<template>
  <div class="space-y-6">
    <!-- Header with Back Button and Quick Actions -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3.5">
        <AppButton
          variant="ghost"
          size="icon"
          class="h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
          @click="handleGoBack"
        >
          <Icon
            name="lucide:arrow-left"
            class="text-lg"
          />
        </AppButton>

        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-black tracking-tight text-gray-950 md:text-2xl">
              User Profile
            </h1>
            <span
              v-if="user"
              class="hidden rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase sm:inline-block"
              :class="getRoleBadgeClasses(userRole)"
            >
              {{ userRole }}
            </span>
          </div>
          <p class="mt-0.5 text-xs text-gray-500 sm:text-sm">
            Review account details and profile information.
          </p>
        </div>
      </div>

      <div
        v-if="user"
        class="flex items-center gap-2"
      >
        <AppButton
          variant="outline"
          size="sm"
          class="gap-1.5 rounded-xl border-gray-200 bg-white text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          :disabled="isRefreshing"
          @click="handleRefresh"
        >
          <Icon
            name="lucide:refresh-cw"
            class="text-xs transition-transform"
            :class="{ 'animate-spin': isRefreshing }"
          />
          <span>Refresh</span>
        </AppButton>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div
      v-if="isLoading"
      class="flex h-[55vh] flex-col items-center justify-center rounded-2xl border border-gray-200/80 bg-white shadow-sm"
    >
      <Icon
        name="svg-spinners:ring-resize"
        class="text-primary text-4xl"
      />
      <p class="mt-4 text-sm font-medium text-gray-500">Loading user profile...</p>
    </div>

    <!-- Error / Not Found State -->
    <div
      v-else-if="errorMessage || !user"
      class="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-16 text-center shadow-sm"
    >
      <div
        class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500"
      >
        <Icon
          name="lucide:circle-alert"
          class="text-2xl"
        />
      </div>
      <p class="text-sm font-bold text-gray-800">{{ errorMessage || 'User profile not found.' }}</p>
      <AppButton
        variant="outline"
        class="mt-5 rounded-xl"
        @click="handleNavigateToUsers"
      >
        Back to Users
      </AppButton>
    </div>

    <!-- Main Content Layout -->
    <div
      v-else
      class="grid gap-6 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.35fr)]"
    >
      <!-- Left Column: Identity & Quick Contacts -->
      <section
        class="flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm"
      >
        <div class="flex flex-col items-center px-6 py-8 text-center">
          <div
            class="bg-primary/10 text-primary ring-primary/10 relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl text-3xl font-black shadow-sm ring-4"
          >
            <NuxtImg
              v-if="profileImage"
              :src="profileImage"
              class="h-full w-full object-cover"
              placeholder
            />
            <span v-else>{{ initials }}</span>
          </div>

          <h2 class="mt-5 text-xl font-black tracking-tight text-gray-950 sm:text-2xl">
            {{ userRole === 'doctor' ? 'Dr. ' : '' }}{{ fullName }}
          </h2>

          <div class="mt-2 flex flex-wrap items-center justify-center gap-2">
            <span
              class="rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase"
              :class="getRoleBadgeClasses(userRole)"
            >
              {{ userRole }}
            </span>

            <AppBadge
              size="sm"
              :color="getStatusColor(userStatus)"
              class="capitalize"
            >
              <span
                class="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80"
              ></span>
              {{ userStatus }}
            </AppBadge>
          </div>
        </div>

        <div class="space-y-3.5 border-t border-gray-100 bg-gray-50/40 px-5 py-6 sm:px-6">
          <!-- Email with Copy Action -->
          <div class="rounded-xl border border-gray-100 bg-white p-3.5 shadow-2xs">
            <div class="flex items-center justify-between gap-2">
              <span
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >
                <Icon
                  name="lucide:mail"
                  class="text-xs text-gray-400"
                />
                Email Address
              </span>
              <button
                v-if="user.email"
                type="button"
                class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 active:scale-95"
                :title="isCopied ? 'Copied' : 'Copy email'"
                @click="copyEmail"
              >
                <Icon
                  :name="isCopied ? 'lucide:check' : 'lucide:copy'"
                  class="text-xs"
                  :class="{ 'text-emerald-600': isCopied }"
                />
                <span>{{ isCopied ? 'Copied' : 'Copy' }}</span>
              </button>
            </div>
            <p class="mt-1 text-sm font-semibold break-all text-gray-900">
              {{ user.email || 'Not provided' }}
            </p>
          </div>

          <!-- Contact Number -->
          <div
            v-if="userRole !== 'admin'"
            class="rounded-xl border border-gray-100 bg-white p-3.5 shadow-2xs"
          >
            <span
              class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
            >
              <Icon
                name="lucide:phone"
                class="text-xs text-gray-400"
              />
              Contact Number
            </span>
            <p
              class="mt-1 text-sm font-semibold"
              :class="
                contactNumber ? 'font-mono text-gray-900' : 'font-normal text-gray-400 italic'
              "
            >
              {{ contactNumber || 'Not provided' }}
            </p>
          </div>

          <!-- Joined Date -->
          <div class="rounded-xl border border-gray-100 bg-white p-3.5 shadow-2xs">
            <span
              class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
            >
              <Icon
                name="lucide:calendar"
                class="text-xs text-gray-400"
              />
              Member Since
            </span>
            <p class="mt-1 text-sm font-semibold text-gray-900">
              {{ formatDate(user.created_at) }}
            </p>
          </div>
        </div>
      </section>

      <!-- Right Column: Profile Details (No UUID displayed) -->
      <section class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
        <div class="border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-black tracking-tight text-gray-950">Profile Details</h2>
              <p class="mt-0.5 text-xs text-gray-500 sm:text-sm">
                Account and role-specific information.
              </p>
            </div>
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700"
            >
              <Icon
                name="lucide:shield-check"
                class="text-xs text-gray-500"
              />
              Verified Record
            </span>
          </div>
        </div>

        <div class="grid gap-3.5 p-5 sm:grid-cols-2 sm:gap-4 sm:p-6">
          <!-- Account Status -->
          <div
            class="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:bg-gray-50"
          >
            <span
              class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
            >
              <Icon
                name="lucide:activity"
                class="text-xs text-gray-400"
              />
              Account Status
            </span>
            <div class="mt-1.5 flex items-center gap-2">
              <AppBadge
                size="xs"
                :color="getStatusColor(user.status || 'active')"
                class="capitalize"
              >
                {{ user.status || 'active' }}
              </AppBadge>
            </div>
          </div>

          <!-- Gender -->
          <div
            class="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:bg-gray-50"
          >
            <span
              class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
            >
              <Icon
                name="lucide:user"
                class="text-xs text-gray-400"
              />
              Gender
            </span>
            <p
              class="mt-1 text-sm font-semibold capitalize"
              :class="user.gender ? 'text-gray-900' : 'font-normal text-gray-400 italic'"
            >
              {{ user.gender || 'Not provided' }}
            </p>
          </div>

          <!-- Date of Birth -->
          <div
            class="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:bg-gray-50"
          >
            <span
              class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
            >
              <Icon
                name="lucide:calendar-days"
                class="text-xs text-gray-400"
              />
              Date of Birth
            </span>
            <p
              class="mt-1 text-sm font-semibold"
              :class="user.date_of_birth ? 'text-gray-900' : 'font-normal text-gray-400 italic'"
            >
              {{ formatBirthDate(user.date_of_birth) }}
            </p>
          </div>

          <!-- Age (Auto-generated from Date of Birth) -->
          <div
            class="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:bg-gray-50"
          >
            <div class="flex items-center justify-between">
              <span
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >
                <Icon
                  name="lucide:cake"
                  class="text-xs text-gray-400"
                />
                Age
              </span>
              <span
                v-if="userAge.isAutoCalculated"
                class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                title="Automatically calculated from Date of Birth"
              >
                <Icon
                  name="lucide:sparkles"
                  class="text-[10px]"
                />
                Auto-calculated
              </span>
            </div>
            <p
              class="mt-1 text-sm font-semibold"
              :class="userAge.value !== null ? 'text-gray-900' : 'font-normal text-gray-400 italic'"
            >
              {{ userAge.formatted }}
            </p>
          </div>

          <!-- Location (Span 2 cols) -->
          <div
            class="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:bg-gray-50 sm:col-span-2"
          >
            <span
              class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
            >
              <Icon
                name="lucide:map-pin"
                class="text-xs text-gray-400"
              />
              Location
            </span>
            <p
              class="mt-1 text-sm font-semibold"
              :class="location ? 'text-gray-900' : 'font-normal text-gray-400 italic'"
            >
              {{ location || 'Not provided' }}
            </p>
          </div>

          <!-- Doctor Specific Fields -->
          <template v-if="userRole === 'doctor'">
            <div
              class="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:bg-gray-50 sm:col-span-2"
            >
              <span
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >
                <Icon
                  name="lucide:building-2"
                  class="text-xs text-gray-400"
                />
                Clinic / Hospital Affiliation
              </span>
              <p
                class="mt-1 text-sm font-semibold"
                :class="user.affiliation ? 'text-gray-900' : 'font-normal text-gray-400 italic'"
              >
                {{ user.affiliation || 'Not provided' }}
              </p>
            </div>

            <div
              class="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:bg-gray-50"
            >
              <span
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >
                <Icon
                  name="lucide:file-badge-2"
                  class="text-xs text-gray-400"
                />
                PRC License Number
              </span>
              <p
                class="mt-1 font-mono text-sm font-semibold"
                :class="prcNumber ? 'text-gray-900' : 'font-normal text-gray-400 italic'"
              >
                {{ prcNumber || 'Not provided' }}
              </p>
            </div>

            <div
              class="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:bg-gray-50"
            >
              <span
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >
                <Icon
                  name="lucide:badge-check"
                  class="text-xs text-gray-400"
                />
                Doctor Verification
              </span>
              <div class="mt-1.5">
                <AppBadge
                  size="xs"
                  :color="getStatusColor(userStatus)"
                  class="capitalize"
                >
                  {{ userStatus }}
                </AppBadge>
              </div>
            </div>

            <div
              v-if="rejectionReason"
              class="rounded-xl border border-rose-100 bg-rose-50/80 p-4 text-rose-800 sm:col-span-2"
            >
              <span
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-rose-500 uppercase"
              >
                <Icon
                  name="lucide:alert-circle"
                  class="text-xs"
                />
                Verification Rejection Reason
              </span>
              <p class="mt-1 text-sm font-semibold">
                {{ rejectionReason }}
              </p>
            </div>
          </template>

          <!-- Audit Timestamps -->
          <div
            class="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:bg-gray-50"
          >
            <span
              class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
            >
              <Icon
                name="lucide:clock"
                class="text-xs text-gray-400"
              />
              Account Created
            </span>
            <p class="mt-1 text-sm font-semibold text-gray-900">
              {{ formatDate(user.created_at) }}
            </p>
          </div>

          <div
            class="rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:bg-gray-50"
          >
            <span
              class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
            >
              <Icon
                name="lucide:history"
                class="text-xs text-gray-400"
              />
              Last Profile Update
            </span>
            <p class="mt-1 text-sm font-semibold text-gray-900">
              {{ formatDate(user.updated_at) }}
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
