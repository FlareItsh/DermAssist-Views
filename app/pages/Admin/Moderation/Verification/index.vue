<script setup lang="ts">
  import { verificationService } from '~/api/verification/VerificationService'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  interface User {
    id: number
    uuid: string
    first_name: string
    middle_name: string | null
    last_name: string
    email: string
    role: string
    created_at: string
    updated_at: string
  }

  interface Verification {
    id: number
    uuid: string
    prc_number: string | null
    id_photo_path: string | null
    status: 'pending' | 'verified' | 'declined'
    user: User
    created_at: string
    updated_at: string
  }

  const selectedStatus = ref('')
  const searchQuery = ref('')
  const debouncedSearch = ref('')
  let searchTimeout: any = null
  const { getEcho } = useEcho()

  watch(searchQuery, val => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      debouncedSearch.value = val
      searchTimeout = null
    }, 500)
  })

  const verifications = ref<{ data: Verification[] } | null>(null)
  const pending = ref(true)

  const fetchVerifications = async () => {
    try {
      pending.value = true
      const params: any = {}
      if (selectedStatus.value) params.status = selectedStatus.value
      if (debouncedSearch.value) params.search = debouncedSearch.value
      verifications.value = await verificationService.list(params)
    } catch (error) {
      console.error('Failed to fetch verifications:', error)
    } finally {
      pending.value = false
    }
  }

  watch([selectedStatus, debouncedSearch], () => {
    fetchVerifications()
  })

  const clearFilters = () => {
    searchQuery.value = ''
    selectedStatus.value = ''
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      fetchVerifications()
    }
  }

  onMounted(() => {
    fetchVerifications()

    if (import.meta.client) {
      const echo = getEcho()
      if (echo) {
        echo.private('admin.moderation').listen('.DoctorVerificationStatusUpdated', () => {
          fetchVerifications()
        })
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  onUnmounted(() => {
    if (import.meta.client) {
      const echo = getEcho()
      if (echo) {
        echo.leave('admin.moderation')
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  const refresh = fetchVerifications

  const statuses = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Verified', value: 'verified' },
    { label: 'Declined', value: 'declined' }
  ]

  const { getStorageUrl } = useStorage()

  const getStatusColor = (status: string): 'warning' | 'success' | 'danger' | 'gray' => {
    switch (status) {
      case 'pending':
        return 'warning'
      case 'verified':
        return 'success'
      case 'declined':
        return 'danger'
      default:
        return 'gray'
    }
  }
</script>

<template>
  <div class="">
    <div
      class="mb-5 flex flex-col gap-4 md:mb-8 md:gap-6 lg:flex-row lg:items-center lg:justify-between"
    >
      <div>
        <h1 class="text-2xl font-bold text-gray-900 md:text-3xl">Doctor Verifications</h1>
        <p class="mt-1 text-gray-500">Review and verify doctor credentials to grant access.</p>
      </div>

      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <!-- Search Input -->
        <div class="relative w-full sm:w-auto sm:min-w-[300px]">
          <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
            <Icon
              name="material-symbols:search-rounded"
              class="text-xl"
            />
          </span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name or email..."
            class="focus:border-primary/30 focus:ring-primary/10 h-11 w-full rounded-2xl border border-gray-200 bg-white pr-4 pl-11 text-sm font-medium text-gray-900 transition-all outline-none placeholder:text-gray-400 focus:ring-4"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
          >
            <Icon
              name="material-symbols:close-rounded"
              class="text-lg"
            />
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div
            class="scrollbar-none flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1.5"
          >
            <AppButton
              v-for="status in statuses"
              :key="status.value"
              variant="unstyled"
              size="unstyled"
              @click="selectedStatus = status.value"
              class="shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all"
              :class="
                selectedStatus === status.value
                  ? 'text-primary bg-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              "
            >
              {{ status.label }}
            </AppButton>
          </div>

          <div class="mx-1 hidden h-8 w-px bg-gray-200 sm:block"></div>

          <AppButton
            variant="outline"
            size="sm"
            @click="refresh"
            :loading="pending"
          >
            Refresh
          </AppButton>
        </div>
      </div>
    </div>

    <div
      v-if="verifications?.data?.length"
      class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4"
    >
      <TransitionGroup name="grid">
        <NuxtLink
          v-for="verification in verifications.data"
          :key="verification.id"
          :to="`/admin/moderation/verification/${verification.uuid}`"
          class="group relative block overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
          <!-- Status Badge -->
          <div class="absolute top-5 right-5 z-10 flex items-center gap-1.5">
            <AppBadge
              v-if="!verification.prc_number || !verification.id_photo_path"
              color="amber"
              size="xs"
              class="font-medium"
            >
              Incomplete
            </AppBadge>
            <AppBadge
              :color="getStatusColor(verification.status)"
              size="xs"
            >
              {{ verification.status }}
            </AppBadge>
          </div>

          <div class="flex flex-col items-center text-center">
            <div
              class="bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            >
              <span class="text-2xl font-bold uppercase">
                {{ verification.user.first_name[0] }}{{ verification.user.last_name[0] }}
              </span>
            </div>

            <h2 class="group-hover:text-primary text-xl font-bold text-gray-900 transition-colors">
              {{ verification.user.first_name }} {{ verification.user.last_name }}
            </h2>
            <p class="text-sm font-medium text-gray-500">{{ verification.user.email }}</p>

            <div
              class="group-hover:bg-primary/5 my-6 w-full space-y-4 rounded-2xl bg-gray-50 p-4 transition-colors"
            >
              <div class="flex flex-col items-start gap-1">
                <span class="text-[10px] font-bold tracking-widest text-gray-400 uppercase"
                  >PRC License Number</span
                >
                <span
                  v-if="verification.prc_number"
                  class="w-full truncate text-left font-mono text-xs leading-none font-semibold text-gray-900"
                  >{{ verification.prc_number }}</span
                >
                <span
                  v-else
                  class="flex items-center gap-1 text-left text-xs font-medium text-amber-600 italic"
                >
                  <Icon
                    name="heroicons:exclamation-circle"
                    class="size-3.5"
                  />
                  Not provided
                </span>
              </div>

              <div class="flex flex-col items-start gap-1">
                <span class="text-[10px] font-bold tracking-widest text-gray-400 uppercase"
                  >ID Verification Photo</span
                >
                <div
                  v-if="verification.id_photo_path"
                  class="group/img group-hover:border-primary/40 relative mt-2 w-full overflow-hidden rounded-xl border-2 border-dashed border-gray-200 transition-colors"
                >
                  <NuxtImg
                    :src="getStorageUrl(verification.id_photo_path)"
                    class="aspect-video w-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                    placeholder
                  />
                </div>
                <div
                  v-else
                  class="mt-2 flex aspect-video w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-4 text-center text-amber-700"
                >
                  <Icon
                    name="heroicons:document-text"
                    class="mb-1 size-6 text-amber-500"
                  />
                  <span class="text-xs font-semibold">No ID Photo Uploaded</span>
                  <span class="text-[10px] text-amber-600">Pending doctor upload</span>
                </div>
              </div>
            </div>
          </div>
        </NuxtLink>
      </TransitionGroup>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="verifications"
      class="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 py-32 text-center"
    >
      <div
        class="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50 text-gray-400"
      >
        <Icon
          name="material-symbols:search-off-rounded"
          class="text-4xl"
        />
      </div>
      <h3 class="text-xl font-bold text-gray-900">No verifications found</h3>
      <p class="mt-2 text-gray-500">
        <span v-if="searchQuery"
          >No results matching "<strong>{{ searchQuery }}</strong
          >"</span
        >
        <span v-else
          >There are no {{ selectedStatus || '' }} doctor verification requests at the moment.</span
        >
      </p>
      <AppButton
        v-if="searchQuery || selectedStatus"
        variant="ghost"
        class="mt-4"
        @click="clearFilters"
      >
        Clear all filters
      </AppButton>
    </div>

    <!-- Skeleton / Loading -->
    <div
      v-else-if="pending"
      class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4"
    >
      <div
        v-for="i in 4"
        :key="i"
        class="h-[480px] animate-pulse rounded-3xl bg-gray-100"
      />
    </div>
  </div>
</template>

<style scoped>
  .grid-enter-active,
  .grid-leave-active {
    transition: all 0.5s ease;
  }

  .grid-enter-from,
  .grid-leave-to {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }

  .grid-move {
    transition: transform 0.5s ease;
  }
</style>
