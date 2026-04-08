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

  const { data: verifications, refresh } =
    await useApi<PaginatedResponse<Verification>>('verifications')

  const { getStorageUrl } = useStorage()

  const getStatusColor = (status: string): 'warning' | 'success' | 'danger' | 'gray' => {
    switch (status) {
      case 'pending':
        return 'warning'
      case 'approved':
        return 'success'
      case 'rejected':
        return 'danger'
      default:
        return 'gray'
    }
  }
</script>

<template>
  <div class="px-6 py-8">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Doctor Verifications</h1>
        <p class="mt-1 text-gray-500">Review and verify doctor credentials to grant access.</p>
      </div>
      <div class="flex items-center gap-4">
        <AppButton
          variant="outline"
          size="sm"
          @click="refresh"
        >
          Refresh
        </AppButton>
      </div>
    </div>

    <div
      v-if="verifications?.data?.length"
      class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
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
    </div>

    <!-- Empty State -->
    <div
      v-else-if="verifications"
      class="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 py-32 text-center"
    >
      <div
        class="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50 text-gray-400"
      >
        <svg
          class="h-10 w-10"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 class="text-xl font-bold text-gray-900">No verifications found</h3>
      <p class="mt-2 text-gray-500">
        There are no pending doctor verification requests at the moment.
      </p>
    </div>

    <!-- Skeleton / Loading -->
    <div
      v-else
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
