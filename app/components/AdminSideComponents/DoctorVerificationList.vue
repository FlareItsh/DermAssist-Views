<script setup lang="ts">
  type VerificationStatus = 'pending' | 'verified' | 'declined' | string

  interface VerificationUser {
    first_name?: string
    last_name?: string
    email?: string
    affiliation?: string | null
  }

  interface Verification {
    uuid: string
    prc_number?: string
    status: VerificationStatus
    created_at?: string
    updated_at?: string
    user?: VerificationUser
  }

  const props = withDefaults(
    defineProps<{
      title: string
      description: string
      items: Verification[]
      emptyText: string
      loading?: boolean
      status: 'pending' | 'verified'
    }>(),
    {
      loading: false
    }
  )

  const listPath = '/admin/moderation/verification'

  const getDoctorName = (item: Verification) => {
    const first = item.user?.first_name?.trim()
    const last = item.user?.last_name?.trim()
    return [first, last].filter(Boolean).join(' ') || 'Unknown doctor'
  }

  const getInitials = (item: Verification) => {
    const first = item.user?.first_name?.[0]
    const last = item.user?.last_name?.[0]
    return `${first || 'D'}${last || 'R'}`.toUpperCase()
  }

  const formatDate = (date?: string) => {
    if (!date) return 'Recently'
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date))
  }

  const getItemPath = (item: Verification) => {
    return item.uuid ? `${listPath}/${item.uuid}` : listPath
  }
</script>

<template>
  <section class="flex h-[420px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div class="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
      <div class="min-w-0">
        <div class="flex items-center gap-3">
          <div
            class="h-2.5 w-2.5 rounded-full"
            :class="status === 'pending' ? 'bg-amber-400' : 'bg-emerald-400'"
          />
          <h2 class="truncate text-lg font-black text-gray-950">{{ title }}</h2>
        </div>
        <p class="mt-1 text-sm text-gray-500">{{ description }}</p>
      </div>

      <NuxtLink
        :to="listPath"
        class="hover:border-primary hover:text-primary inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition"
      >
        <span>{{ status === 'pending' ? 'Review all' : 'See all' }}</span>
        <Icon
          name="lucide:arrow-right"
          class="text-base"
        />
      </NuxtLink>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div
        v-if="loading"
        class="space-y-3 p-5"
      >
        <div
          v-for="i in 4"
          :key="i"
          class="h-20 animate-pulse rounded-xl bg-gray-100"
        />
      </div>

      <div
        v-else-if="items.length"
        class="divide-y divide-gray-100"
      >
        <NuxtLink
          v-for="item in items"
          :key="item.uuid"
          :to="getItemPath(item)"
          class="group flex items-center gap-4 px-5 py-4 transition hover:bg-gray-50"
        >
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-black shadow-sm"
            :class="
              status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            "
          >
            {{ getInitials(item) }}
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="group-hover:text-primary truncate text-sm font-bold text-gray-900">
                Dr. {{ getDoctorName(item) }}
              </h3>
              <AppBadge
                size="xs"
                :color="status === 'pending' ? 'warning' : 'success'"
              >
                {{ status }}
              </AppBadge>
            </div>
            <p class="mt-1 truncate text-sm text-gray-500">
              {{ item.user?.email || item.user?.affiliation || 'No contact details' }}
            </p>
            <p class="mt-1 text-xs font-medium text-gray-400">
              {{ status === 'pending' ? 'Submitted' : 'Verified' }}
              {{ formatDate(status === 'pending' ? item.created_at : item.updated_at) }}
            </p>
          </div>

          <Icon
            name="lucide:chevron-right"
            class="group-hover:text-primary shrink-0 text-xl text-gray-300 transition"
          />
        </NuxtLink>
      </div>

      <div
        v-else
        class="px-5 py-10 text-center"
      >
        <div
          class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400"
        >
          <Icon
            :name="status === 'pending' ? 'lucide:clipboard-check' : 'lucide:user-check'"
            class="text-2xl"
          />
        </div>
        <p class="text-sm font-medium text-gray-500">{{ emptyText }}</p>
      </div>
    </div>
  </section>
</template>
