<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import { userService } from '~/api/user/UserService'
  import { calculateAge } from '~/composables/useFormSanitizer'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  interface ScanQuota {
    is_unlimited: boolean
    limit: number | null
    used: number
    remaining: number | null
    resets_at?: string | null
    countdown_seconds?: number | null
    unlimited_until?: string | null
    source?: string
    can_scan?: boolean
    message?: string | null
  }

  interface DoctorAffiliation {
    type: 'associate' | 'owner' | 'independent'
    summary: string
    hospital_affiliation?: string | null
    associate_membership?: {
      clinic_uuid: string
      clinic_name: string
      address?: string | null
      role?: string
      owner_doctor?: {
        uuid?: string
        name?: string
        email?: string
      } | null
    } | null
    owned_clinics?: Array<{
      uuid: string
      name: string
      address?: string | null
      doctors_count?: number
      is_active?: boolean
    }>
  }

  interface SubscriptionDetails {
    uuid?: string | null
    plan_name: string
    plan_slug?: string
    tier_type?: string
    status: string
    billing_cycle?: string | null
    auto_renew?: boolean
    is_inherited?: boolean
    starts_at?: string | null
    ends_at?: string | null
    trial_ends_at?: string | null
    cancelled_at?: string | null
    is_active?: boolean
    max_clinics?: number | null
    max_secretaries?: number | null
    max_doctors?: number | null
    daily_scan_limit?: number | null
  }

  interface PaymentInvoice {
    id?: number
    uuid: string
    amount: number
    discount_amount: number
    final_amount: number
    payment_method: string
    payment_status: string
    proof_of_payment_path?: string | null
    transaction_reference?: string | null
    plan_name?: string
    paid_at?: string | null
    created_at?: string
    approved_by?: {
      id?: number
      uuid?: string
      name?: string
      email?: string
    } | null
  }

  interface RegisteredByDoctor {
    id?: number
    uuid?: string
    first_name?: string
    last_name?: string
    email?: string
    affiliation?: string | null
    prc_number?: string | null
    city?: string | null
    province?: string | null
  }

  interface AssignedDoctor {
    id?: number
    uuid?: string
    name?: string
    email?: string
    affiliation?: string | null
  }

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
    is_doctor_registered?: boolean
    account_origin?: 'doctor_created' | 'self_registered'
    registered_by_doctor?: RegisteredByDoctor | null
    assigned_doctor?: AssignedDoctor | null
    doctor_verification?: {
      status?: string
      prc_number?: string | null
      prcNumber?: string | null
      rejection_reason?: string | null
      rejectionReason?: string | null
    }
    scan_quota?: ScanQuota | null
    doctor_affiliation?: DoctorAffiliation | null
    subscription_details?: SubscriptionDetails | null
    payment_history?: PaymentInvoice[]
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

  const formatCurrency = (val?: number | null) => {
    if (val === null || val === undefined) return '₱0.00'
    return `₱${Number(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const formatQuotaSource = (source?: string) => {
    switch (source) {
      case 'doctor_care':
        return 'Doctor-Care Window (15 daily scans)'
      case 'doctor_trial':
        return 'Doctor 14-Day Trial (10 daily scans)'
      case 'subscription':
        return 'Subscribed Plan Entitlement'
      case 'admin':
        return 'System Administrator (Unlimited scans)'
      case 'doctor_unverified':
        return 'Doctor Verification Required'
      case 'doctor_unsubscribed':
        return 'Unsubscribed Doctor Allowance (3 daily scans)'
      default:
        return 'Standard Patient Quota (5 daily scans)'
    }
  }

  // Tab Management for compact layout
  const activeTab = ref<string>('practice')

  watch(
    userRole,
    newRole => {
      if (newRole === 'doctor') {
        activeTab.value = 'practice'
      } else if (newRole === 'patient') {
        activeTab.value = 'overview'
      } else {
        activeTab.value = 'overview'
      }
    },
    { immediate: true }
  )

  const currentRoleTabs = computed(() => {
    if (userRole.value === 'doctor') {
      return [
        {
          id: 'practice',
          label: 'Practice & Profile',
          icon: 'lucide:stethoscope'
        },
        {
          id: 'billing',
          label: 'Subscription & Invoices',
          icon: 'lucide:crown',
          badge: user.value?.payment_history?.length || 0
        },
        {
          id: 'quota',
          label: 'AI Scan Quota',
          icon: 'lucide:zap'
        }
      ]
    }

    if (userRole.value === 'patient') {
      return [
        {
          id: 'overview',
          label: 'Profile & Origin',
          icon: 'lucide:user'
        },
        {
          id: 'quota',
          label: 'AI Scan Quota',
          icon: 'lucide:zap'
        }
      ]
    }

    return []
  })

  // Change Role Modal State
  const isChangeRoleModalOpen = ref(false)
  const isSubmittingRole = ref(false)
  const selectedNewRole = ref('')
  const adminPassword = ref('')
  const showAdminPassword = ref(false)
  const roleErrorMessage = ref('')

  const availableRoles = [
    {
      label: 'Patient',
      value: 'patient',
      icon: 'lucide:user',
      desc: 'Standard diagnostic scan recipient'
    },
    {
      label: 'Doctor',
      value: 'doctor',
      icon: 'lucide:stethoscope',
      desc: 'Physician with clinical & scanning privileges'
    },
    {
      label: 'Secretary',
      value: 'secretary',
      icon: 'lucide:calendar-clock',
      desc: 'Clinic administrative support staff'
    },
    {
      label: 'Administrator',
      value: 'admin',
      icon: 'lucide:shield',
      desc: 'Full administrative access and moderation'
    }
  ]

  const openChangeRoleModal = () => {
    selectedNewRole.value = userRole.value
    adminPassword.value = ''
    showAdminPassword.value = false
    roleErrorMessage.value = ''
    isChangeRoleModalOpen.value = true
  }

  const closeChangeRoleModal = () => {
    isChangeRoleModalOpen.value = false
    adminPassword.value = ''
    roleErrorMessage.value = ''
  }

  const submitChangeRole = async () => {
    if (!user.value?.uuid) return
    if (!selectedNewRole.value) {
      roleErrorMessage.value = 'Please select a new role.'
      return
    }
    if (!adminPassword.value) {
      roleErrorMessage.value = 'Please enter your admin password to confirm.'
      return
    }

    isSubmittingRole.value = true
    roleErrorMessage.value = ''

    try {
      const response = await userService.changeRole(user.value.uuid, {
        role: selectedNewRole.value,
        admin_password: adminPassword.value
      })
      toast.success(response?.message || 'User role updated successfully.')
      closeChangeRoleModal()
      await fetchUser(true)
    } catch (err: any) {
      console.error('Failed to change user role:', err)
      const data = err?.response?._data || err?.response?.data || err?.data
      if (data?.errors?.admin_password?.[0]) {
        roleErrorMessage.value = data.errors.admin_password[0]
      } else if (data?.errors?.role?.[0]) {
        roleErrorMessage.value = data.errors.role[0]
      } else if (data?.message) {
        roleErrorMessage.value = data.message
      } else {
        roleErrorMessage.value = 'Failed to update role. Please check your password.'
      }
      toast.error(roleErrorMessage.value)
    } finally {
      isSubmittingRole.value = false
    }
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
      class="grid items-start gap-6 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.35fr)]"
    >
      <!-- Left Column: Identity & Quick Contacts -->
      <section
        class="flex flex-col self-start overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm"
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

          <!-- Prominent Change Role Action in Identity Card -->
          <div class="mt-4 flex w-full max-w-[220px] items-center justify-center">
            <button
              type="button"
              class="group border-primary/30 bg-primary/5 text-primary hover:border-primary hover:bg-primary inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold shadow-2xs transition-all hover:text-white active:scale-95"
              @click="openChangeRoleModal"
            >
              <Icon
                name="lucide:user-cog"
                class="text-sm transition-transform group-hover:rotate-12"
              />
              <span>Change Role</span>
            </button>
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

      <!-- Right Column: Profile Details and Modules -->
      <div class="min-w-0 space-y-6">
        <!-- Tab Navigation Switcher (Doctor & Patient) -->
        <div
          v-if="currentRoleTabs.length > 0"
          class="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-gray-200/80 bg-gray-50/80 p-1.5 shadow-2xs"
        >
          <button
            v-for="tab in currentRoleTabs"
            :key="tab.id"
            type="button"
            class="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition"
            :class="
              activeTab === tab.id
                ? 'bg-white text-gray-950 shadow-xs ring-1 ring-gray-950/5'
                : 'text-gray-500 hover:bg-white/60 hover:text-gray-900'
            "
            @click="activeTab = tab.id"
          >
            <Icon
              :name="tab.icon"
              class="text-sm"
              :class="activeTab === tab.id ? 'text-primary' : 'text-gray-400'"
            />
            <span>{{ tab.label }}</span>
            <span
              v-if="tab.badge !== undefined && tab.badge > 0"
              class="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              :class="
                activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-gray-200/70 text-gray-600'
              "
            >
              {{ tab.badge }}
            </span>
          </button>
        </div>

        <!-- Section 1: Profile Details -->
        <section
          v-if="
            userRole === 'admin' ||
            userRole === 'secretary' ||
            (userRole === 'doctor' && activeTab === 'practice') ||
            (userRole === 'patient' && activeTab === 'overview')
          "
          class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm"
        >
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
                :class="
                  userAge.value !== null ? 'text-gray-900' : 'font-normal text-gray-400 italic'
                "
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

        <!-- Secretary Supervising Physician (Secretary only) -->
        <section
          v-if="userRole === 'secretary' && user.assigned_doctor"
          class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm"
        >
          <div
            class="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5"
          >
            <div>
              <h2 class="flex items-center gap-2 text-lg font-black tracking-tight text-gray-950">
                <Icon
                  name="lucide:stethoscope"
                  class="text-lg text-indigo-600"
                />
                Assigned Supervising Physician
              </h2>
              <p class="mt-0.5 text-xs text-gray-500 sm:text-sm">
                Physician whose clinic and consultations this secretary supports.
              </p>
            </div>
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/60 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700"
            >
              Supervising Doctor
            </span>
          </div>

          <div class="p-5 sm:p-6">
            <div class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
              <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div class="flex items-center gap-3.5">
                  <div
                    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-sm font-bold text-indigo-700"
                  >
                    Dr
                  </div>
                  <div>
                    <p class="text-xs font-bold tracking-wider text-indigo-600 uppercase">
                      Supervising Doctor
                    </p>
                    <p class="mt-0.5 text-sm font-black text-gray-950">
                      Dr. {{ user.assigned_doctor.name }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ user.assigned_doctor.email }} •
                      {{ user.assigned_doctor.affiliation || 'Private Clinic' }}
                    </p>
                  </div>
                </div>

                <NuxtLink
                  v-if="user.assigned_doctor.uuid"
                  :to="`/admin/moderation/users/${user.assigned_doctor.uuid}`"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs transition hover:bg-indigo-50"
                >
                  <span>View Doctor Profile</span>
                  <Icon
                    name="lucide:arrow-up-right"
                    class="text-xs"
                  />
                </NuxtLink>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 2: AI Scan Quota & Entitlements (Doctor & Patient quota tab only) -->
        <section
          v-if="(userRole === 'doctor' || userRole === 'patient') && activeTab === 'quota'"
          class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm"
        >
          <div
            class="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5"
          >
            <div>
              <h2 class="flex items-center gap-2 text-lg font-black tracking-tight text-gray-950">
                <Icon
                  name="lucide:zap"
                  class="text-lg text-amber-500"
                />
                AI Scan Quota & Entitlements
              </h2>
              <p class="mt-0.5 text-xs text-gray-500 sm:text-sm">
                Diagnostic scan allowance, remaining balance, and entitlement tier.
              </p>
            </div>
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
              :class="
                user.scan_quota?.is_unlimited
                  ? 'border border-purple-200/60 bg-purple-50 text-purple-700'
                  : 'border border-emerald-200/60 bg-emerald-50 text-emerald-700'
              "
            >
              <Icon
                :name="user.scan_quota?.is_unlimited ? 'lucide:infinity' : 'lucide:activity'"
                class="text-xs"
              />
              {{ user.scan_quota?.is_unlimited ? 'Unlimited Tier' : 'Daily Quota' }}
            </span>
          </div>

          <div class="grid gap-3.5 p-5 sm:grid-cols-3 sm:gap-4 sm:p-6">
            <!-- Daily Limit -->
            <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >
                <Icon
                  name="lucide:gauge"
                  class="text-xs text-gray-400"
                />
                Daily Scan Limit
              </span>
              <p class="mt-1 text-base font-black text-gray-950">
                {{
                  user.scan_quota?.is_unlimited
                    ? 'Unlimited'
                    : user.scan_quota?.limit !== null && user.scan_quota?.limit !== undefined
                      ? `${user.scan_quota.limit} scans/day`
                      : 'None'
                }}
              </p>
            </div>

            <!-- Remaining Scans -->
            <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >
                <Icon
                  name="lucide:check-circle-2"
                  class="text-xs text-emerald-500"
                />
                Remaining Today
              </span>
              <p
                class="mt-1 text-base font-black"
                :class="
                  user.scan_quota?.is_unlimited || (user.scan_quota?.remaining ?? 0) > 0
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                "
              >
                {{
                  user.scan_quota?.is_unlimited
                    ? 'Unlimited'
                    : user.scan_quota?.remaining !== null &&
                        user.scan_quota?.remaining !== undefined
                      ? `${user.scan_quota.remaining} scans`
                      : '0 scans'
                }}
              </p>
            </div>

            <!-- Used Today -->
            <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >
                <Icon
                  name="lucide:clock"
                  class="text-xs text-gray-400"
                />
                Used Today
              </span>
              <p class="mt-1 text-base font-black text-gray-950">
                {{ user.scan_quota?.used ?? 0 }} scans
              </p>
            </div>

            <!-- Quota Source & Details -->
            <div
              class="flex flex-col justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4 sm:col-span-3 sm:flex-row sm:items-center"
            >
              <div>
                <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                  >Entitlement Source</span
                >
                <p class="mt-0.5 text-sm font-bold text-gray-900 capitalize">
                  {{ formatQuotaSource(user.scan_quota?.source) }}
                </p>
              </div>

              <div
                v-if="user.scan_quota?.unlimited_until"
                class="text-xs text-gray-500"
              >
                <span class="font-semibold text-gray-700">Valid until:</span>
                {{ formatDate(user.scan_quota.unlimited_until) }}
              </div>
              <div
                v-else-if="user.scan_quota?.resets_at"
                class="text-xs text-gray-500"
              >
                <span class="font-semibold text-gray-700">Resets:</span>
                {{ formatDate(user.scan_quota.resets_at) }}
              </div>
            </div>
          </div>
        </section>

        <!-- Section 3: Patient Account Origin (Patient overview tab only) -->
        <section
          v-if="userRole === 'patient' && activeTab === 'overview'"
          class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm"
        >
          <div
            class="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5"
          >
            <div>
              <h2 class="flex items-center gap-2 text-lg font-black tracking-tight text-gray-950">
                <Icon
                  :name="
                    user.account_origin === 'doctor_created' || user.is_doctor_registered
                      ? 'lucide:stethoscope'
                      : 'lucide:user'
                  "
                  class="text-lg text-sky-600"
                />
                Account Origin & Registration
              </h2>
              <p class="mt-0.5 text-xs text-gray-500 sm:text-sm">
                Provenance of this patient account and physician registration.
              </p>
            </div>
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
              :class="
                user.account_origin === 'doctor_created' || user.is_doctor_registered
                  ? 'border border-sky-200/60 bg-sky-50 text-sky-700'
                  : 'border border-emerald-200/60 bg-emerald-50 text-emerald-700'
              "
            >
              <Icon
                :name="
                  user.account_origin === 'doctor_created' || user.is_doctor_registered
                    ? 'lucide:stethoscope'
                    : 'lucide:user'
                "
                class="text-xs"
              />
              {{
                user.account_origin === 'doctor_created' || user.is_doctor_registered
                  ? 'Doctor-Created Account'
                  : 'Self-Registered Account'
              }}
            </span>
          </div>

          <div class="p-5 sm:p-6">
            <div
              v-if="user.registered_by_doctor"
              class="rounded-xl border border-sky-100 bg-sky-50/50 p-4"
            >
              <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div class="flex items-center gap-3.5">
                  <div
                    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-bold text-sky-700"
                  >
                    Dr
                  </div>
                  <div>
                    <p class="text-xs font-bold tracking-wider text-sky-600 uppercase">
                      Sponsoring Physician
                    </p>
                    <p class="mt-0.5 text-sm font-black text-gray-950">
                      Dr. {{ user.registered_by_doctor.first_name }}
                      {{ user.registered_by_doctor.last_name }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ user.registered_by_doctor.affiliation || 'Private Clinic' }} • PRC #{{
                        user.registered_by_doctor.prc_number || 'N/A'
                      }}
                    </p>
                  </div>
                </div>

                <NuxtLink
                  :to="`/admin/moderation/users/${user.registered_by_doctor.uuid}`"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-700 shadow-2xs transition hover:bg-sky-50"
                >
                  <span>View Doctor Profile</span>
                  <Icon
                    name="lucide:arrow-up-right"
                    class="text-xs"
                  />
                </NuxtLink>
              </div>
            </div>

            <div
              v-else
              class="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-xs text-gray-600"
            >
              <Icon
                name="lucide:info"
                class="shrink-0 text-sm text-gray-400"
              />
              <span
                >This patient registered directly via the public patient registration portal.</span
              >
            </div>
          </div>
        </section>

        <!-- Section 4: Doctor Subscription Details (Doctor billing tab only) -->
        <section
          v-if="userRole === 'doctor' && activeTab === 'billing'"
          class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm"
        >
          <div
            class="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5"
          >
            <div>
              <h2 class="flex items-center gap-2 text-lg font-black tracking-tight text-gray-950">
                <Icon
                  name="lucide:crown"
                  class="text-lg text-purple-600"
                />
                Subscription & Plan Details
              </h2>
              <p class="mt-0.5 text-xs text-gray-500 sm:text-sm">
                Active doctor subscription, validity dates, and platform allowances.
              </p>
            </div>
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize"
              :class="
                user.subscription_details?.is_active
                  ? 'border border-purple-200/60 bg-purple-50 text-purple-700'
                  : 'bg-gray-100 text-gray-600'
              "
            >
              <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
              {{ user.subscription_details?.status || 'No Plan' }}
            </span>
          </div>

          <div class="space-y-4 p-5 sm:p-6">
            <!-- Inherited Seat Notice -->
            <div
              v-if="user.subscription_details?.is_inherited"
              class="flex items-start gap-2.5 rounded-xl border border-purple-100 bg-purple-50/70 p-3.5 text-xs text-purple-900"
            >
              <Icon
                name="lucide:users"
                class="mt-0.5 shrink-0 text-sm text-purple-600"
              />
              <div>
                <p class="font-bold">Inherited Clinic Group Seat</p>
                <p class="mt-0.5 text-purple-700">
                  This doctor's subscription access is sponsored by their clinic lead doctor under
                  an active group plan.
                </p>
              </div>
            </div>

            <div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <!-- Plan Name -->
              <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                <span
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  <Icon
                    name="lucide:sparkles"
                    class="text-xs text-gray-400"
                  />
                  Plan Name
                </span>
                <p class="mt-1 text-sm font-bold text-gray-950">
                  {{ user.subscription_details?.plan_name || 'Unsubscribed' }}
                </p>
              </div>

              <!-- Billing Cycle -->
              <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                <span
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  <Icon
                    name="lucide:repeat"
                    class="text-xs text-gray-400"
                  />
                  Billing Cycle
                </span>
                <p class="mt-1 text-sm font-bold text-gray-950 capitalize">
                  {{
                    user.subscription_details?.billing_cycle ||
                    (user.subscription_details?.status === 'trialing'
                      ? '14-Day Free Trial'
                      : 'None')
                  }}
                </p>
              </div>

              <!-- Starts At -->
              <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                <span
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  <Icon
                    name="lucide:calendar-plus"
                    class="text-xs text-gray-400"
                  />
                  Starts At
                </span>
                <p class="mt-1 text-sm font-bold text-gray-950">
                  {{ formatDate(user.subscription_details?.starts_at) }}
                </p>
              </div>

              <!-- Ends At -->
              <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                <span
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  <Icon
                    name="lucide:calendar-check"
                    class="text-xs text-gray-400"
                  />
                  Ends At
                </span>
                <p class="mt-1 text-sm font-bold text-gray-950">
                  {{ formatDate(user.subscription_details?.ends_at) }}
                </p>
              </div>
            </div>

            <!-- Allowances & Auto-Renew -->
            <div class="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
              <div class="rounded-xl border border-gray-100 bg-white p-3 shadow-2xs">
                <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                  >Clinics Allowed</span
                >
                <p class="mt-0.5 text-sm font-black text-gray-900">
                  {{ user.subscription_details?.max_clinics ?? 1 }}
                  {{ (user.subscription_details?.max_clinics ?? 1) === 1 ? 'Clinic' : 'Clinics' }}
                </p>
              </div>
              <div class="rounded-xl border border-gray-100 bg-white p-3 shadow-2xs">
                <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                  >Secretaries Allowed</span
                >
                <p class="mt-0.5 text-sm font-black text-gray-900">
                  {{ user.subscription_details?.max_secretaries ?? 0 }}
                  {{
                    (user.subscription_details?.max_secretaries ?? 0) === 1
                      ? 'Secretary'
                      : 'Secretaries'
                  }}
                </p>
              </div>
              <div
                class="col-span-2 rounded-xl border border-gray-100 bg-white p-3 shadow-2xs sm:col-span-1"
              >
                <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                  >Auto-Renewal</span
                >
                <p class="mt-0.5 text-sm font-black text-gray-900">
                  {{ user.subscription_details?.auto_renew ? 'Active (Auto-renews)' : 'Disabled' }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 5: Doctor Affiliations & Clinics (Doctor practice tab only) -->
        <section
          v-if="userRole === 'doctor' && activeTab === 'practice'"
          class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm"
        >
          <div
            class="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5"
          >
            <div>
              <h2 class="flex items-center gap-2 text-lg font-black tracking-tight text-gray-950">
                <Icon
                  name="lucide:building-2"
                  class="text-lg text-indigo-600"
                />
                Clinical Affiliations & Practice Network
              </h2>
              <p class="mt-0.5 text-xs text-gray-500 sm:text-sm">
                Hospital affiliations, team memberships, and practice clinic branches.
              </p>
            </div>
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/60 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 capitalize"
            >
              {{ user.doctor_affiliation?.type || 'Independent' }}
            </span>
          </div>

          <div class="space-y-4 p-5 sm:p-6">
            <!-- Overview Summary -->
            <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                >Primary Affiliation</span
              >
              <p class="mt-1 text-sm font-bold text-gray-900">
                {{ user.doctor_affiliation?.summary || user.affiliation || 'Independent Practice' }}
              </p>
            </div>

            <!-- Associate Membership (if associate under another doctor's clinic) -->
            <div
              v-if="user.doctor_affiliation?.associate_membership"
              class="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4"
            >
              <div class="mb-2 flex items-center gap-2">
                <Icon
                  name="lucide:hospital"
                  class="text-sm text-indigo-600"
                />
                <p class="text-xs font-bold tracking-wider text-indigo-950 uppercase">
                  Affiliated Clinic Branch
                </p>
              </div>
              <div class="space-y-1 text-xs">
                <p class="text-sm font-bold text-gray-900">
                  {{ user.doctor_affiliation.associate_membership.clinic_name }}
                </p>
                <p class="text-gray-500">
                  {{
                    user.doctor_affiliation.associate_membership.address || 'No address provided'
                  }}
                </p>
                <p
                  v-if="user.doctor_affiliation.associate_membership.owner_doctor"
                  class="pt-1 font-semibold text-gray-700"
                >
                  Lead Physician: Dr.
                  {{ user.doctor_affiliation.associate_membership.owner_doctor.name }}
                  <span class="font-normal text-gray-400"
                    >({{ user.doctor_affiliation.associate_membership.owner_doctor.email }})</span
                  >
                </p>
              </div>
            </div>

            <!-- Owned Clinics (if owner) -->
            <div
              v-if="
                user.doctor_affiliation?.owned_clinics &&
                user.doctor_affiliation.owned_clinics.length > 0
              "
              class="space-y-2 pt-1"
            >
              <p class="text-xs font-bold tracking-wider text-gray-500 uppercase">
                Owned Clinic Branches ({{ user.doctor_affiliation.owned_clinics.length }})
              </p>
              <div class="grid gap-2.5 sm:grid-cols-2">
                <div
                  v-for="clinic in user.doctor_affiliation.owned_clinics"
                  :key="clinic.uuid"
                  class="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs"
                >
                  <div class="flex items-center justify-between gap-2">
                    <p class="truncate text-sm font-bold text-gray-900">{{ clinic.name }}</p>
                    <span
                      class="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                      :class="
                        clinic.is_active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      "
                    >
                      {{ clinic.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </div>
                  <p class="mt-1 line-clamp-1 text-xs text-gray-500">
                    {{ clinic.address || 'Address not listed' }}
                  </p>
                  <p class="mt-2 text-[11px] font-semibold text-gray-400">
                    {{ clinic.doctors_count }} associate
                    {{ clinic.doctors_count === 1 ? 'doctor' : 'doctors' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 6: Doctor Payment History Table (Doctor billing tab only) -->
        <section
          v-if="userRole === 'doctor' && activeTab === 'billing'"
          class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm"
        >
          <div
            class="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5"
          >
            <div>
              <h2 class="flex items-center gap-2 text-lg font-black tracking-tight text-gray-950">
                <Icon
                  name="lucide:receipt"
                  class="text-lg text-emerald-600"
                />
                Payment History & Invoices
              </h2>
              <p class="mt-0.5 text-xs text-gray-500 sm:text-sm">
                Subscription payments, transaction references, and billing status.
              </p>
            </div>
            <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
              {{ (user.payment_history || []).length }}
              {{ (user.payment_history || []).length === 1 ? 'Invoice' : 'Invoices' }}
            </span>
          </div>

          <!-- Invoices Table -->
          <div
            v-if="user.payment_history && user.payment_history.length > 0"
            class="overflow-x-auto"
          >
            <table class="w-full text-left text-xs">
              <thead
                class="border-b border-gray-100 bg-gray-50/60 text-[10px] font-bold tracking-wider text-gray-400 uppercase"
              >
                <tr>
                  <th class="px-5 py-3">Reference / Plan</th>
                  <th class="px-4 py-3">Amount</th>
                  <th class="px-4 py-3">Method</th>
                  <th class="px-4 py-3">Status</th>
                  <th class="px-5 py-3 text-right">Paid Date</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="inv in user.payment_history"
                  :key="inv.uuid"
                  class="transition hover:bg-gray-50/50"
                >
                  <td class="px-5 py-3.5">
                    <p class="font-mono font-bold text-gray-950">
                      {{ inv.transaction_reference || inv.uuid.slice(0, 8) }}
                    </p>
                    <p class="mt-0.5 text-[11px] text-gray-500">
                      {{ inv.plan_name || 'Doctor Plan' }}
                    </p>
                  </td>
                  <td class="px-4 py-3.5 font-bold text-gray-900">
                    {{ formatCurrency(inv.final_amount ?? inv.amount) }}
                  </td>
                  <td class="px-4 py-3.5">
                    <span
                      class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 font-bold text-gray-700 capitalize"
                    >
                      {{ inv.payment_method }}
                    </span>
                  </td>
                  <td class="px-4 py-3.5">
                    <AppBadge
                      size="xs"
                      :color="
                        inv.payment_status === 'paid'
                          ? 'success'
                          : inv.payment_status === 'pending'
                            ? 'warning'
                            : 'danger'
                      "
                      class="capitalize"
                    >
                      {{ inv.payment_status }}
                    </AppBadge>
                  </td>
                  <td class="px-5 py-3.5 text-right font-medium whitespace-nowrap text-gray-600">
                    {{ formatDate(inv.paid_at || inv.created_at) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Empty Invoices State -->
          <div
            v-else
            class="p-8 text-center"
          >
            <div
              class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400"
            >
              <Icon
                name="lucide:receipt-text"
                class="text-xl"
              />
            </div>
            <p class="text-sm font-bold text-gray-700">No payment history recorded</p>
            <p class="mt-0.5 text-xs text-gray-400">
              This doctor has no transaction invoices in the system yet.
            </p>
          </div>
        </section>
      </div>
    </div>

    <!-- Change Role Modal -->
    <AppModal
      v-model="isChangeRoleModalOpen"
      title="Change User Role"
      :description="`Update system role and access permissions for ${fullName}.`"
      size="md"
    >
      <form
        class="space-y-4 p-5 sm:p-6"
        @submit.prevent="submitChangeRole"
      >
        <!-- Notice / Warning banner -->
        <div
          class="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-xs text-amber-900"
        >
          <Icon
            name="lucide:shield-alert"
            class="mt-0.5 shrink-0 text-sm text-amber-600"
          />
          <div>
            <p class="font-bold">Privilege & Feature Access Change</p>
            <p class="mt-0.5 text-amber-800">
              Changing this user's role will adjust their portal access, permissions, and diagnostic
              features immediately.
            </p>
          </div>
        </div>

        <!-- Role Selection -->
        <div>
          <label class="mb-1.5 block text-xs font-bold tracking-wider text-gray-700 uppercase">
            Select New Role
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="opt in availableRoles"
              :key="opt.value"
              type="button"
              class="flex flex-col gap-1 rounded-xl border p-3 text-left transition"
              :class="
                selectedNewRole === opt.value
                  ? 'border-primary bg-primary/5 ring-primary/20 text-primary font-bold shadow-2xs ring-2'
                  : 'border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-50'
              "
              @click="selectedNewRole = opt.value"
            >
              <div class="flex items-center gap-1.5">
                <Icon
                  :name="opt.icon"
                  class="text-sm"
                />
                <span class="text-xs">{{ opt.label }}</span>
              </div>
              <p class="line-clamp-1 text-[10px] font-normal text-gray-400">
                {{ opt.desc }}
              </p>
            </button>
          </div>
        </div>

        <!-- Admin Password Input -->
        <div>
          <label class="mb-1.5 block text-xs font-bold tracking-wider text-gray-700 uppercase">
            Admin Password Confirmation
          </label>
          <div class="relative">
            <input
              v-model="adminPassword"
              :type="showAdminPassword ? 'text' : 'password'"
              placeholder="Enter your administrator password"
              autocomplete="current-password"
              required
              class="focus:border-primary/40 focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 pr-10 text-xs font-medium text-gray-900 transition outline-none focus:bg-white focus:ring-4"
            />
            <button
              type="button"
              class="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              @click="showAdminPassword = !showAdminPassword"
            >
              <Icon
                :name="showAdminPassword ? 'lucide:eye-off' : 'lucide:eye'"
                class="text-xs"
              />
            </button>
          </div>
          <p class="mt-1 text-[11px] text-gray-500">
            You must confirm with your current administrator password to authorize this role
            modification.
          </p>
          <p
            v-if="roleErrorMessage"
            class="mt-1.5 text-xs font-bold text-rose-600"
          >
            {{ roleErrorMessage }}
          </p>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2.5 border-t border-gray-100 pt-3">
          <AppButton
            type="button"
            variant="outline"
            size="sm"
            class="rounded-xl text-xs font-semibold"
            :disabled="isSubmittingRole"
            @click="closeChangeRoleModal"
          >
            Cancel
          </AppButton>
          <AppButton
            type="submit"
            size="sm"
            class="gap-1.5 rounded-xl text-xs font-bold"
            :disabled="isSubmittingRole || !selectedNewRole || !adminPassword"
          >
            <Icon
              v-if="isSubmittingRole"
              name="svg-spinners:ring-resize"
              class="text-xs"
            />
            <Icon
              v-else
              name="lucide:check"
              class="text-xs"
            />
            <span>{{ isSubmittingRole ? 'Confirming...' : 'Update Role' }}</span>
          </AppButton>
        </div>
      </form>
    </AppModal>
  </div>
</template>
