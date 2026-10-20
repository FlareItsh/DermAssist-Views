<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { toast } from 'vue-sonner'
  import type { AdminAppeal } from '~/composables/useAdminAppeals'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const {
    sortedAppeals,
    isLoadingAppeals,
    appealsError,
    fetchAppeals,
    markAppealsSeen,
    filterStatus,
    pendingCount,
    resolvedCount,
    totalCount,
    resolveAppeal: apiResolve,
    restoreAppeal: apiRestore
  } = useAdminAppeals()

  const { getStorageUrl } = useStorage()

  // Search & Inspection Modal State
  const searchQuery = ref('')
  const selectedAppeal = ref<AdminAppeal | null>(null)
  const isDetailModalOpen = ref(false)

  const handleOpenDetail = (appeal: AdminAppeal) => {
    selectedAppeal.value = appeal
    isDetailModalOpen.value = true
  }

  const handleSelectAppeal = (appeal: AdminAppeal) => {
    selectedAppeal.value = appeal
  }

  const resolveAppeal = async (uuid: string, e?: Event) => {
    if (e) e.stopPropagation()
    try {
      await apiResolve(uuid, { update_dataset: true })
      toast.success('Appeal approved and scan ingested for AI retraining.')
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to resolve appeal.')
    }
  }

  const restoreAppeal = async (uuid: string, e?: Event) => {
    if (e) e.stopPropagation()
    try {
      await apiRestore(uuid)
      toast.info('Appeal restored to pending moderation.')
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to restore appeal.')
    }
  }

  const getDoctorName = (appeal: AdminAppeal) => {
    const first = appeal.user?.first_name?.trim()
    const last = appeal.user?.last_name?.trim()
    return [first, last].filter(Boolean).join(' ') || 'Unknown doctor'
  }

  const getInitials = (appeal: AdminAppeal) => {
    const first = appeal.user?.first_name?.[0]
    const last = appeal.user?.last_name?.[0]
    return `${first || 'D'}${last || 'R'}`.toUpperCase()
  }

  const getContactDetails = (appeal: AdminAppeal) => {
    return appeal.user?.email || appeal.user?.affiliation || 'No contact details'
  }

  const formatDate = (date?: string | null) => {
    if (!date) return 'Recently'
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(date))
  }

  const getScanThumbnail = (appeal: AdminAppeal): string | null => {
    if (!appeal.diagnosis) return null
    const raw = appeal.diagnosis.image_url || appeal.diagnosis.image_path
    return raw ? getStorageUrl(raw) : null
  }

  // Filtered appeals by search query
  const displayedAppeals = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return sortedAppeals.value

    return sortedAppeals.value.filter(a => {
      const doc = getDoctorName(a).toLowerCase()
      const email = (a.user?.email || '').toLowerCase()
      const diag = (a.diagnosis_label || '').toLowerCase()
      const sugg = (a.suggested_label || '').toLowerCase()
      const desc = (a.description || '').toLowerCase()

      return (
        doc.includes(q) ||
        email.includes(q) ||
        diag.includes(q) ||
        sugg.includes(q) ||
        desc.includes(q)
      )
    })
  })

  onMounted(async () => {
    await fetchAppeals()
    markAppealsSeen()
  })
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-bold tracking-wider text-rose-500 uppercase">Moderation</p>
        <h1 class="mt-2 text-2xl font-black text-gray-950 md:text-3xl">Doctor Scan Appeals</h1>
        <p class="mt-2 max-w-2xl text-sm text-gray-500">
          Review physician feedback on AI diagnoses, inspect scan images, and approve verified scans
          for the AI retraining dataset.
        </p>
      </div>

      <!-- Quick Metrics Counter Badges -->
      <div class="flex items-center gap-2.5">
        <div class="rounded-2xl border border-gray-100 bg-white px-3.5 py-2 shadow-sm">
          <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Pending</span>
          <p class="text-lg font-black text-rose-600">{{ pendingCount }}</p>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-3.5 py-2 shadow-sm">
          <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Resolved</span>
          <p class="text-lg font-black text-green-600">{{ resolvedCount }}</p>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-3.5 py-2 shadow-sm">
          <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Total</span>
          <p class="text-lg font-black text-gray-900">{{ totalCount }}</p>
        </div>
      </div>
    </div>

    <!-- Main Appeals Table Card -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <!-- Toolbar & Status Filter -->
      <div
        class="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <!-- Search Input -->
        <div class="relative w-full max-w-sm">
          <Icon
            name="lucide:search"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-gray-400"
          />
          <input
            v-model="searchQuery"
            type="text"
            class="focus:ring-primary w-full rounded-xl border-0 bg-gray-50/80 py-2 pr-3 pl-9 text-xs text-gray-800 ring-1 ring-gray-200/60 transition-all outline-none focus:bg-white focus:ring-2"
            placeholder="Search doctor, email, disease..."
          />
        </div>

        <!-- Filter Tabs -->
        <div
          class="flex gap-2 self-start rounded-xl border border-gray-100 bg-gray-50 p-1 sm:self-auto"
        >
          <button
            @click="filterStatus = 'pending'"
            :class="
              filterStatus === 'pending'
                ? 'bg-white font-bold text-gray-950 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            "
            class="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all"
          >
            <span>Pending Review</span>
            <span
              class="py-0.2 rounded-full px-1.5 text-[10px] font-bold"
              :class="
                filterStatus === 'pending'
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-gray-200 text-gray-600'
              "
            >
              {{ pendingCount }}
            </span>
          </button>
          <button
            @click="filterStatus = 'resolved'"
            :class="
              filterStatus === 'resolved'
                ? 'bg-white font-bold text-gray-950 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            "
            class="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all"
          >
            <span>Resolved</span>
            <span
              class="py-0.2 rounded-full px-1.5 text-[10px] font-bold"
              :class="
                filterStatus === 'resolved'
                  ? 'bg-green-50 text-green-600'
                  : 'bg-gray-200 text-gray-600'
              "
            >
              {{ resolvedCount }}
            </span>
          </button>
        </div>
      </div>

      <!-- Loading Skeleton -->
      <div
        v-if="isLoadingAppeals"
        class="space-y-3 p-5"
      >
        <div
          v-for="i in 5"
          :key="i"
          class="h-24 animate-pulse rounded-xl bg-gray-100"
        />
      </div>

      <!-- Error Notice -->
      <div
        v-else-if="appealsError"
        class="px-5 py-10 text-center"
      >
        <Icon
          name="lucide:circle-alert"
          class="mx-auto mb-3 text-4xl text-rose-500"
        />
        <p class="font-semibold text-gray-900">{{ appealsError }}</p>
      </div>

      <!-- Appeals List -->
      <div
        v-else-if="displayedAppeals.length"
        class="divide-y divide-gray-100"
      >
        <article
          v-for="appeal in displayedAppeals"
          :key="appeal.uuid"
          @click="handleOpenDetail(appeal)"
          class="group flex cursor-pointer flex-col gap-4 p-5 transition-all hover:bg-gray-50/80 md:flex-row md:items-center md:justify-between"
        >
          <!-- Left: Scan Thumbnail + Doctor Information -->
          <div class="flex min-w-0 items-start gap-4">
            <!-- Scan Image Thumbnail -->
            <div
              class="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-950 shadow-inner transition-transform group-hover:scale-105"
            >
              <img
                v-if="getScanThumbnail(appeal)"
                :src="getScanThumbnail(appeal)!"
                alt="Scan"
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center text-gray-500"
              >
                <Icon
                  name="lucide:image-off"
                  size="18"
                />
              </div>
            </div>

            <!-- Doctor & Timestamp -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="truncate text-base font-black text-gray-950">
                  Dr. {{ getDoctorName(appeal) }}
                </h3>
                <span
                  v-if="appeal.status === 'resolved'"
                  class="rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700"
                >
                  Resolved
                </span>
              </div>
              <p class="mt-0.5 truncate text-xs text-gray-500">{{ getContactDetails(appeal) }}</p>
              <p class="mt-1 text-[11px] font-medium text-gray-400">
                {{ formatDate(appeal.created_at || appeal.updated_at) }}
              </p>
            </div>
          </div>

          <!-- Middle / Right: Diagnostic Shift & Clinical Reason -->
          <div class="flex flex-1 flex-col justify-between gap-3 md:max-w-md lg:max-w-lg">
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                >AI Guess:</span
              >
              <AppBadge
                color="danger"
                size="xs"
              >
                {{ appeal.diagnosis_label || 'Unlabeled' }}
              </AppBadge>

              <Icon
                name="lucide:arrow-right"
                class="text-xs text-gray-400"
              />

              <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                >Doctor Verified:</span
              >
              <AppBadge
                color="success"
                size="xs"
                class="font-bold"
              >
                {{ appeal.suggested_label }}
              </AppBadge>
            </div>

            <p class="line-clamp-2 text-xs text-gray-600 italic">
              "{{ appeal.description || 'No specific clinical description provided.' }}"
            </p>
          </div>

          <!-- Actions: Inspect & Quick Resolve -->
          <div
            class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 pt-2 md:border-t-0 md:pt-0"
          >
            <AppButton
              variant="outline"
              size="sm"
              @click.stop="handleOpenDetail(appeal)"
              class="hover:bg-primary/5 hover:text-primary rounded-xl px-3 py-1.5 text-xs font-bold"
            >
              <Icon
                name="lucide:eye"
                size="14"
                class="mr-1.5"
              />
              Inspect Appeal
            </AppButton>

            <AppButton
              v-if="filterStatus === 'pending'"
              variant="outline"
              size="sm"
              @click.stop="resolveAppeal(appeal.uuid, $event)"
              class="rounded-xl px-3 py-1.5 text-xs font-bold text-green-700 hover:border-green-300 hover:bg-green-50"
              title="Quickly approve and ingest for retraining"
            >
              <Icon
                name="lucide:check-circle-2"
                size="14"
                class="mr-1.5"
              />
              Resolve
            </AppButton>

            <AppButton
              v-else
              variant="outline"
              size="sm"
              @click.stop="restoreAppeal(appeal.uuid, $event)"
              class="rounded-xl px-3 py-1.5 text-xs font-bold text-amber-700 hover:border-amber-300 hover:bg-amber-50"
            >
              <Icon
                name="lucide:rotate-ccw"
                size="14"
                class="mr-1.5"
              />
              Restore
            </AppButton>
          </div>
        </article>
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="px-5 py-14 text-center"
      >
        <div
          class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"
        >
          <Icon
            :name="filterStatus === 'pending' ? 'lucide:alert-circle' : 'lucide:check-circle-2'"
            class="text-3xl"
          />
        </div>
        <p class="text-sm font-semibold text-gray-700">
          {{
            searchQuery
              ? `No appeals found matching "${searchQuery}".`
              : filterStatus === 'pending'
                ? 'No pending doctor scan appeals found.'
                : 'No resolved appeals found.'
          }}
        </p>
        <p
          v-if="searchQuery"
          class="mt-1 text-xs text-gray-400"
        >
          Try clearing your search query.
        </p>
      </div>
    </section>

    <!-- Detailed Inspection Modal -->
    <AppModalAppealDetail
      v-model="isDetailModalOpen"
      :appeal="selectedAppeal"
      :appeals-list="displayedAppeals"
      @select-appeal="handleSelectAppeal"
      @resolved="fetchAppeals"
      @restored="fetchAppeals"
    />
  </div>
</template>
