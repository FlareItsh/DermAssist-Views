<script setup lang="ts">
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
    prc_number: string
    id_photo_path: string
    status: 'pending' | 'approved' | 'rejected'
    user: User
    created_at: string
    updated_at: string
  }

  interface PaginatedResponse<T> {
    data: T[]
  }

  const selectedStatus = ref('')
  const searchQuery = ref('')
  const debouncedSearch = ref('')
  let searchTimeout: any = null
  let pollingInterval: any = null

  watch(searchQuery, (val) => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      debouncedSearch.value = val
      searchTimeout = null
    }, 500)
  })

  const startPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }

    pollingInterval = setInterval(async () => {
      if (!pending.value && !searchTimeout) {
        await refresh()
      }
    }, 3000)
  }

  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
  }

  onMounted(() => {
    startPolling()
  })

  onUnmounted(() => {
    stopPolling()
  })

  const { data: verifications, refresh, pending } =
    await useApi<PaginatedResponse<Verification>>(() => {
      const params = new URLSearchParams()
      if (selectedStatus.value) {
        params.append('status', selectedStatus.value)
      }
      if (debouncedSearch.value) {
        params.append('search', debouncedSearch.value)
      }
      const qs = params.toString()
      return `verifications${qs ? `?${qs}` : ''}`
    })

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
  <div class="px-6 py-8">
    <div class="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Doctor Verifications</h1>
        <p class="mt-1 text-gray-500">Review and verify doctor credentials to grant access.</p>
      </div>

      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <!-- Search Input -->
        <div class="relative min-w-[300px]">
          <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
            <Icon name="material-symbols:search-rounded" class="text-xl" />
          </span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name or email..."
            class="h-11 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm font-medium text-gray-900 transition-all outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
          >
            <Icon name="material-symbols:close-rounded" class="text-lg" />
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1 rounded-2xl bg-gray-100 p-1.5">
            <AppButton
              v-for="status in statuses"
              :key="status.value"
              variant="unstyled"
              size="unstyled"
              @click="selectedStatus = status.value"
              class="rounded-xl px-4 py-2 text-xs font-bold transition-all"
              :class="
                selectedStatus === status.value
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              "
            >
              {{ status.label }}
            </AppButton>
          </div>

          <div class="h-8 w-px bg-gray-200 mx-1"></div>

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
      class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <TransitionGroup name="grid">
        <NuxtLink
          v-for="verification in verifications.data"
          :key="verification.id"
          :to="`/Admin/Moderation/Verification/${verification.uuid}`"
          class="group relative block overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
          <!-- Status Badge -->
          <div class="absolute top-5 right-5 z-10">
            <AppBadge
              :color="getStatusColor(verification.status)"
              size="xs"
            >
              {{ verification.status }}
            </AppBadge>
          </div>

          <div class="flex flex-col items-center text-center">
            <div
              class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"
            >
              <span class="text-2xl font-bold uppercase">
                {{ verification.user.first_name[0] }}{{ verification.user.last_name[0] }}
              </span>
            </div>

            <h2 class="text-xl font-bold text-gray-900 transition-colors group-hover:text-indigo-600">
              {{ verification.user.first_name }} {{ verification.user.last_name }}
            </h2>
            <p class="text-sm font-medium text-gray-500">{{ verification.user.email }}</p>

            <div class="my-6 w-full space-y-4 rounded-2xl bg-gray-50 p-4 transition-colors group-hover:bg-indigo-50/30">
              <div class="flex flex-col items-start gap-1">
                <span class="text-[10px] font-bold tracking-widest text-gray-400 uppercase"
                  >PRC License Number</span
                >
                <span
                  class="w-full truncate text-left font-mono text-xs leading-none font-semibold text-gray-900"
                  >{{ verification.prc_number }}</span
                >
              </div>

              <div class="flex flex-col items-start gap-1">
                <span class="text-[10px] font-bold tracking-widest text-gray-400 uppercase"
                  >ID Verification Photo</span
                >
                <div
                  class="group/img relative mt-2 w-full overflow-hidden rounded-xl border-2 border-dashed border-gray-200 transition-colors group-hover:border-indigo-400"
                >
                  <NuxtImg
                    :src="getStorageUrl(verification.id_photo_path)"
                    class="aspect-video w-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                    placeholder
                  />
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
        <Icon name="material-symbols:search-off-rounded" class="text-4xl" />
      </div>
      <h3 class="text-xl font-bold text-gray-900">No verifications found</h3>
      <p class="mt-2 text-gray-500">
        <span v-if="searchQuery">No results matching "<strong>{{ searchQuery }}</strong>"</span>
        <span v-else>There are no {{ selectedStatus || '' }} doctor verification requests at the moment.</span>
      </p>
      <AppButton
        v-if="searchQuery || selectedStatus"
        variant="ghost"
        class="mt-4"
        @click="searchQuery = ''; selectedStatus = ''"
      >
        Clear all filters
      </AppButton>
    </div>

    <!-- Skeleton / Loading -->
    <div
      v-else-if="pending"
      class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
