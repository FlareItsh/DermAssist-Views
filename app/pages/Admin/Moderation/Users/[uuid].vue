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
  gender?: string | null
  age?: number | string | null
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
const errorMessage = ref('')

const getResponseData = (response: any): User | null => response?.data || response || null

const fetchUser = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    user.value = getResponseData(await userService.show(route.params.uuid as string))
  } catch (error) {
    console.error('Failed to fetch user profile:', error)
    user.value = null
    errorMessage.value = 'Unable to load this user profile.'
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchUser)

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
  return user.value?.contact_number || user.value?.phone || 'Not provided'
})

const location = computed(() => {
  if (!user.value) return 'Not provided'
  return (
    [
      user.value.street,
      user.value.barangay,
      user.value.city,
      user.value.province,
      user.value.country
    ]
      .filter(Boolean)
      .join(', ') || 'Not provided'
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
</script>

<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-4">
        <AppButton variant="ghost" size="icon" class="rounded-full bg-white shadow-sm ring-1 ring-gray-200"
          @click="router.back()">
          <Icon name="lucide:arrow-left" class="text-lg" />
        </AppButton>

        <div>
          <h1 class="text-2xl font-black text-gray-950">User Profile</h1>
          <p class="mt-1 text-sm text-gray-500">Review account details and profile information.</p>
        </div>
      </div>

    </div>

    <div v-if="isLoading"
      class="flex h-[55vh] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white">
      <Icon name="svg-spinners:ring-resize" class="text-primary text-4xl" />
      <p class="mt-4 text-sm font-medium text-gray-500">Loading user profile...</p>
    </div>

    <div v-else-if="errorMessage || !user"
      class="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-16 text-center">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
        <Icon name="lucide:circle-alert" class="text-2xl" />
      </div>
      <p class="text-sm font-bold text-gray-800">{{ errorMessage || 'User profile not found.' }}</p>
      <AppButton variant="outline" class="mt-5" @click="router.push('/admin/moderation/users')">
        Back to Users
      </AppButton>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
      <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div class="flex flex-col items-center px-6 py-8 text-center">
          <div
            class="bg-primary/10 text-primary ring-primary/5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl text-3xl font-black ring-4">
            <NuxtImg v-if="profileImage" :src="profileImage" class="h-full w-full object-cover" placeholder />
            <span v-else>{{ initials }}</span>
          </div>

          <h2 class="mt-5 text-2xl font-black text-gray-950">
            {{ userRole === 'doctor' ? 'Dr. ' : '' }}{{ fullName }}
          </h2>
          <p class="text-primary mt-1 text-xs font-bold tracking-wider uppercase">{{ userRole }}</p>

          <AppBadge class="mt-4" size="sm" :color="getStatusColor(userStatus)">
            {{ userStatus }}
          </AppBadge>
        </div>

        <div class="space-y-4 border-t border-gray-100 px-6 py-5">
          <div>
            <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Email</p>
            <p class="mt-1 text-sm font-semibold break-all text-gray-800">
              {{ user.email || 'Not provided' }}
            </p>
          </div>

          <div>
            <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Joined</p>
            <p class="mt-1 text-sm font-semibold text-gray-800">
              {{ formatDate(user.created_at) }}
            </p>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div class="border-b border-gray-100 px-6 py-5">
          <h2 class="text-lg font-black text-gray-950">Profile Details</h2>
          <p class="mt-1 text-sm text-gray-500">Account and role-specific information.</p>
        </div>

        <div class="grid gap-4 p-6 md:grid-cols-2">
          <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">UUID</p>
            <p class="mt-1 font-mono text-sm font-semibold break-all text-gray-800">
              {{ user.uuid }}
            </p>
          </div>

          <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Account Status
            </p>
            <p class="mt-1 text-sm font-semibold text-gray-800 capitalize">
              {{ user.status || 'active' }}
            </p>
          </div>

          <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Age</p>
            <p class="mt-1 text-sm font-semibold text-gray-800">{{ user.age || 'Not provided' }}</p>
          </div>

          <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Gender</p>
            <p class="mt-1 text-sm font-semibold text-gray-800 capitalize">
              {{ user.gender || 'Not provided' }}
            </p>
          </div>

          <div class="rounded-xl border border-gray-100 bg-gray-50 p-4 md:col-span-2">
            <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Location</p>
            <p class="mt-1 text-sm font-semibold text-gray-800">{{ location }}</p>
          </div>

          <div v-if="userRole === 'doctor'" class="rounded-xl border border-gray-100 bg-gray-50 p-4 md:col-span-2">
            <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Affiliation</p>
            <p class="mt-1 text-sm font-semibold text-gray-800">
              {{ user.affiliation || 'Not provided' }}
            </p>
          </div>

          <template v-if="userRole === 'doctor'">
            <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">PRC Number</p>
              <p class="mt-1 font-mono text-sm font-semibold text-gray-800">
                {{ prcNumber || 'Not provided' }}
              </p>
            </div>

            <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                Verification Status
              </p>
              <p class="mt-1 text-sm font-semibold text-gray-800 capitalize">{{ userStatus }}</p>
            </div>

            <div v-if="rejectionReason"
              class="rounded-xl border border-rose-100 bg-rose-50 p-4 text-rose-700 md:col-span-2">
              <p class="text-[10px] font-bold tracking-wider uppercase">Rejection Reason</p>
              <p class="mt-1 text-sm font-semibold">
                {{ rejectionReason }}
              </p>
            </div>
          </template>

          <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Created</p>
            <p class="mt-1 text-sm font-semibold text-gray-800">
              {{ formatDate(user.created_at) }}
            </p>
          </div>

          <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Last Updated</p>
            <p class="mt-1 text-sm font-semibold text-gray-800">
              {{ formatDate(user.updated_at) }}
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
