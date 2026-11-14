<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
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
    rejectedCount,
    totalCount,
    resolveAppeal: apiResolve,
    rejectAppeal: apiReject,
    restoreAppeal: apiRestore
  } = useAdminAppeals()

  const { getStorageUrl } = useStorage()

  // Search & Inspection Modal State
  const searchQuery = ref('')
  const selectedAppeal = ref<AdminAppeal | null>(null)
  const isDetailModalOpen = ref(false)

  // Rejection Confirmation State
  const showRejectConfirm = ref(false)
  const appealToReject = ref<AdminAppeal | null>(null)
  const rejectionNotes = ref('')
  const isRejecting = ref(false)

  const openRejectModal = (appeal: AdminAppeal, e?: Event) => {
    if (e) e.stopPropagation()
    appealToReject.value = appeal
    rejectionNotes.value = ''
    showRejectConfirm.value = true
  }

  const handleConfirmReject = async () => {
    if (!appealToReject.value) return
    isRejecting.value = true
    try {
      await apiReject(appealToReject.value.uuid, {
        resolution_notes: rejectionNotes.value.trim() || undefined
      })
      toast.success('Appeal rejected and excluded from retraining dataset.')
      showRejectConfirm.value = false
      appealToReject.value = null
      await fetchAppeals()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to reject appeal.')
    } finally {
      isRejecting.value = false
    }
  }

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
      await fetchAppeals()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to resolve appeal.')
    }
  }

  const restoreAppeal = async (uuid: string, e?: Event) => {
    if (e) e.stopPropagation()
    try {
      await apiRestore(uuid)
      toast.info('Appeal restored to pending moderation.')
      await fetchAppeals()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to restore appeal.')
    }
  }

  const getDoctorName = (appeal: AdminAppeal) => {
    const first = appeal.user?.first_name?.trim()
    const last = appeal.user?.last_name?.trim()
    return [first, last].filter(Boolean).join(' ') || 'Unknown doctor'
  }

  const getDoctorInitials = (appeal: AdminAppeal) => {
    const first = appeal.user?.first_name?.[0]
    const last = appeal.user?.last_name?.[0]
    return `${first || 'D'}${last || 'R'}`.toUpperCase()
  }

  const getPatientName = (appeal: AdminAppeal) => {
    const p = appeal.diagnosis?.patient
    if (!p) return 'Unassigned Patient'
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Patient'
  }

  const hasPatientConsent = (appeal: AdminAppeal) => {
    const diag = appeal.diagnosis
    return Boolean(
      diag?.patient_consented_dataset || diag?.patient_consent || diag?.patient?.consent_dataset
    )
  }

  const getContactDetails = (appeal: AdminAppeal) => {
    return appeal.user?.email || appeal.user?.affiliation || 'Dermatologist'
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

  const clearSearch = () => {
    searchQuery.value = ''
  }

  // Filtered appeals by search query across doctor, patient, disease, description, uuid
  const displayedAppeals = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return sortedAppeals.value

    return sortedAppeals.value.filter(a => {
      const doc = getDoctorName(a).toLowerCase()
      const email = (a.user?.email || '').toLowerCase()
      const patient = getPatientName(a).toLowerCase()
      const diag = (a.diagnosis_label || '').toLowerCase()
      const sugg = (a.suggested_label || '').toLowerCase()
      const desc = (a.description || '').toLowerCase()
      const refUuid = (a.diagnosis?.uuid || '').toLowerCase()

      return (
        doc.includes(q) ||
        email.includes(q) ||
        patient.includes(q) ||
        diag.includes(q) ||
        sugg.includes(q) ||
        desc.includes(q) ||
        refUuid.includes(q)
      )
    })
  })

  const { getEcho } = useEcho()

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      fetchAppeals()
    }
  }

  onMounted(async () => {
    await fetchAppeals()
    markAppealsSeen()

    if (import.meta.client) {
      const echo = getEcho()
      if (echo) {
        echo.private('admin.moderation').listen('.ScanAppealUpdated', (payload?: any) => {
          fetchAppeals(true)
          if (payload?.action === 'submitted') {
            toast.info('New doctor scan appeal received.')
          }
        })
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  onUnmounted(() => {
    if (import.meta.client) {
      const echo = getEcho()
      if (echo) {
        echo.private('admin.moderation').stopListening('.ScanAppealUpdated')
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Page Header -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1 rounded-md border border-rose-100 bg-rose-50 px-2 py-0.5 text-[11px] font-bold tracking-wider text-rose-600 uppercase"
          >
            <Icon
              name="lucide:shield-alert"
              size="12"
            />
            Moderation & Quality Assurance
          </span>
        </div>
        <h1 class="mt-2 text-2xl font-black tracking-tight text-gray-950 md:text-3xl">
          Doctor Scan Appeals
        </h1>
        <p class="mt-1 max-w-2xl text-xs text-gray-500 sm:text-sm">
          Review physician diagnostic corrections, audit clinical rationale, and ingest verified
          cases into the AI retraining pipeline.
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2.5">
        <AppButton
          variant="outline"
          size="sm"
          to="/admin/dataset"
          class="gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-950"
        >
          <Icon
            name="lucide:database"
            size="14"
          />
          Retraining Dataset
        </AppButton>
      </div>
    </div>

    <!-- 4-Card Clinical Metric Grid -->
    <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      <AdminSideComponentsMetricCard
        label="Pending Moderation"
        :value="pendingCount"
        tone="amber"
        badge="Action Required"
        detail="Cases awaiting clinical review"
      />

      <AdminSideComponentsMetricCard
        label="Approved for Retraining"
        :value="resolvedCount"
        tone="emerald"
        badge="Ingested"
        detail="Relocated into active AI dataset pool"
      />

      <AdminSideComponentsMetricCard
        label="Excluded / Rejected"
        :value="rejectedCount"
        tone="rose"
        badge="Excluded"
        detail="Scans withheld from AI retraining"
      />

      <AdminSideComponentsMetricCard
        label="Total Appeals"
        :value="totalCount"
        tone="blue"
        badge="Audit History"
        detail="Total recorded doctor feedback"
      />
    </div>

    <!-- Main Appeals Table Card -->
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs">
      <!-- Toolbar: Search Input + Segmented Filter Tabs -->
      <div
        class="flex flex-col gap-3.5 border-b border-gray-100 bg-gray-50/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5"
      >
        <!-- Search Input with Clear Button -->
        <div class="relative w-full max-w-sm">
          <Icon
            name="lucide:search"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-gray-400"
          />
          <input
            v-model="searchQuery"
            type="text"
            class="focus:border-primary focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-white py-2 pr-8 pl-9 text-xs text-gray-800 placeholder-gray-400 transition-all outline-none focus:ring-2"
            placeholder="Search doctor, patient, disease, UUID..."
          />
          <button
            v-if="searchQuery"
            type="button"
            @click="clearSearch"
            class="absolute top-1/2 right-2.5 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
            title="Clear search"
          >
            <Icon
              name="lucide:x"
              size="13"
            />
          </button>
        </div>

        <!-- Sleek Segmented Filter Tabs -->
        <div
          class="flex items-center gap-1 self-start rounded-xl border border-gray-200 bg-gray-100/70 p-1 sm:self-auto"
        >
          <button
            type="button"
            @click="filterStatus = 'pending'"
            class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
            :class="
              filterStatus === 'pending'
                ? 'bg-white font-bold text-gray-950 shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            "
          >
            <span>Pending Review</span>
            <span
              class="py-0.2 rounded-full px-1.5 text-[10px] font-bold transition-colors"
              :class="
                filterStatus === 'pending'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-200/80 text-gray-600'
              "
            >
              {{ pendingCount }}
            </span>
          </button>

          <button
            type="button"
            @click="filterStatus = 'resolved'"
            class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
            :class="
              filterStatus === 'resolved'
                ? 'bg-white font-bold text-gray-950 shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            "
          >
            <span>Resolved</span>
            <span
              class="py-0.2 rounded-full px-1.5 text-[10px] font-bold transition-colors"
              :class="
                filterStatus === 'resolved'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-200/80 text-gray-600'
              "
            >
              {{ resolvedCount }}
            </span>
          </button>

          <button
            type="button"
            @click="filterStatus = 'rejected'"
            class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
            :class="
              filterStatus === 'rejected'
                ? 'bg-white font-bold text-gray-950 shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            "
          >
            <span>Rejected</span>
            <span
              class="py-0.2 rounded-full px-1.5 text-[10px] font-bold transition-colors"
              :class="
                filterStatus === 'rejected'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-gray-200/80 text-gray-600'
              "
            >
              {{ rejectedCount }}
            </span>
          </button>
        </div>
      </div>

      <!-- Loading Skeleton -->
      <div
        v-if="isLoadingAppeals"
        class="space-y-3 p-5 sm:p-6"
      >
        <div
          v-for="i in 4"
          :key="i"
          class="h-24 animate-pulse rounded-xl bg-gray-100"
        />
      </div>

      <!-- Error Notice -->
      <div
        v-else-if="appealsError"
        class="px-5 py-12 text-center"
      >
        <Icon
          name="lucide:circle-alert"
          class="mx-auto mb-3 text-4xl text-rose-500"
        />
        <p class="font-semibold text-gray-900">{{ appealsError }}</p>
        <AppButton
          variant="outline"
          size="sm"
          @click="fetchAppeals"
          class="mt-3 rounded-xl"
        >
          Try Again
        </AppButton>
      </div>

      <!-- Appeals List Rows -->
      <div
        v-else-if="displayedAppeals.length"
        class="divide-y divide-gray-100"
      >
        <article
          v-for="appeal in displayedAppeals"
          :key="appeal.uuid"
          @click="handleOpenDetail(appeal)"
          class="group relative flex cursor-pointer flex-col gap-4 p-4 transition-colors hover:bg-gray-50/70 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
        >
          <!-- Left: Scan Thumbnail + Case Metadata (Doctor & Patient) -->
          <div class="flex min-w-0 items-start gap-4">
            <!-- Scan Image Thumbnail with hover affordance -->
            <div
              class="group/thumb relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-950 shadow-2xs transition-all group-hover:border-gray-300 sm:h-18 sm:w-18"
            >
              <img
                v-if="getScanThumbnail(appeal)"
                :src="getScanThumbnail(appeal)!"
                alt="Lesion scan"
                class="h-full w-full object-cover transition-transform duration-200 group-hover/thumb:scale-110"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center text-gray-500"
              >
                <Icon
                  name="lucide:image-off"
                  size="20"
                />
              </div>

              <div
                v-if="getScanThumbnail(appeal)"
                class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover/thumb:opacity-100"
              >
                <Icon
                  name="lucide:maximize-2"
                  size="14"
                  class="text-white"
                />
              </div>
            </div>

            <!-- Doctor, Patient & Scan Context -->
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="truncate text-sm font-bold text-gray-950 sm:text-base">
                  Dr. {{ getDoctorName(appeal) }}
                </h3>
                <span
                  v-if="appeal.status === 'resolved'"
                  class="inline-flex items-center gap-1 rounded-md border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                >
                  <Icon
                    name="lucide:check-circle-2"
                    size="11"
                  />
                  Resolved
                </span>
                <span
                  v-else-if="appeal.status === 'rejected'"
                  class="inline-flex items-center gap-1 rounded-md border border-rose-200/60 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700"
                >
                  <Icon
                    name="lucide:x-circle"
                    size="11"
                  />
                  Rejected
                </span>
                <span
                  v-if="(appeal as any).resubmission_count"
                  class="inline-flex items-center gap-1 rounded-md border border-purple-200/60 bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700"
                >
                  Round {{ (appeal as any).resubmission_count + 1 }}
                </span>
              </div>

              <!-- Patient & Doctor Affiliation -->
              <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                <span class="inline-flex items-center gap-1 truncate font-medium text-gray-700">
                  <Icon
                    name="lucide:user"
                    size="12"
                    class="shrink-0 text-gray-400"
                  />
                  Patient: <strong class="text-gray-900">{{ getPatientName(appeal) }}</strong>
                </span>
                <span class="text-gray-300">•</span>
                <span class="truncate text-gray-500">{{ getContactDetails(appeal) }}</span>
              </div>

              <!-- Scan Reference UUID & Timestamp -->
              <div class="flex items-center gap-2 text-[11px] text-gray-400">
                <span class="font-mono text-gray-500">
                  #{{ appeal.diagnosis?.uuid?.slice(0, 10) || 'N/A' }}
                </span>
                <span>•</span>
                <span>{{ formatDate(appeal.created_at || appeal.updated_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Middle: Diagnostic Discrepancy & Clinical Note -->
          <div class="flex min-w-0 flex-1 flex-col justify-center gap-2 lg:max-w-md xl:max-w-lg">
            <!-- Discrepancy comparison badge row -->
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">AI:</span>
              <AppBadge
                color="danger"
                size="xs"
              >
                {{ appeal.diagnosis_label || 'Unlabeled' }}
                <span
                  v-if="appeal.diagnosis?.confidence"
                  class="ml-1 font-mono text-[10px] opacity-80"
                >
                  ({{ Math.round(Number(appeal.diagnosis.confidence) * 100) }}%)
                </span>
              </AppBadge>

              <Icon
                name="lucide:arrow-right"
                class="shrink-0 text-xs text-gray-400"
              />

              <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase"
                >Doctor:</span
              >
              <AppBadge
                color="success"
                size="xs"
                class="font-bold"
              >
                <Icon
                  name="lucide:check-circle-2"
                  size="12"
                  class="mr-1"
                />
                {{ appeal.suggested_label }}
              </AppBadge>

              <!-- Gate 1 Patient Consent Indicator -->
              <span
                class="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors sm:ml-0"
                :class="
                  hasPatientConsent(appeal)
                    ? 'border border-emerald-200/60 bg-emerald-50 text-emerald-700'
                    : 'border border-amber-200/60 bg-amber-50 text-amber-700'
                "
              >
                <Icon
                  :name="hasPatientConsent(appeal) ? 'lucide:check' : 'lucide:alert-circle'"
                  size="10"
                />
                {{ hasPatientConsent(appeal) ? 'Consented' : 'No Consent' }}
              </span>
            </div>

            <!-- Doctor's Justification Quote -->
            <p
              class="border-primary/50 line-clamp-2 rounded-r-lg border-l-2 bg-gray-50/70 px-2.5 py-1 text-xs break-words text-gray-600 italic"
            >
              "{{ appeal.description || 'No specific clinical description provided.' }}"
            </p>
          </div>

          <!-- Right: Clean Actions Cluster -->
          <div
            class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 pt-3 lg:border-t-0 lg:pt-0"
          >
            <button
              type="button"
              @click.stop="handleOpenDetail(appeal)"
              class="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white px-3.5 text-xs font-semibold text-gray-800 shadow-2xs transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950"
            >
              <Icon
                name="lucide:eye"
                size="14"
                class="mr-1.5 text-gray-500"
              />
              Inspect Appeal
            </button>

            <!-- Quick Action Buttons for Pending State -->
            <template v-if="filterStatus === 'pending'">
              <button
                type="button"
                @click.stop="resolveAppeal(appeal.uuid, $event)"
                class="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 text-xs font-bold text-emerald-700 shadow-2xs transition-colors hover:border-emerald-300 hover:bg-emerald-100/80"
                title="Quickly approve and ingest scan for AI retraining"
              >
                <Icon
                  name="lucide:check-circle-2"
                  size="14"
                  class="mr-1.5 text-emerald-600"
                />
                Resolve
              </button>

              <button
                type="button"
                @click.stop="openRejectModal(appeal, $event)"
                class="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-rose-200 bg-rose-50/60 px-3 text-xs font-bold text-rose-700 shadow-2xs transition-colors hover:border-rose-300 hover:bg-rose-100/80"
                title="Reject this appeal"
              >
                <Icon
                  name="lucide:x-circle"
                  size="14"
                  class="mr-1.5 text-rose-500"
                />
                Reject
              </button>
            </template>

            <!-- Quick Action for Resolved / Rejected State -->
            <button
              v-else
              type="button"
              @click.stop="restoreAppeal(appeal.uuid, $event)"
              class="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-amber-200 bg-amber-50/60 px-3 text-xs font-bold text-amber-700 shadow-2xs transition-colors hover:border-amber-300 hover:bg-amber-100/80"
              title="Restore appeal back to pending moderation"
            >
              <Icon
                name="lucide:rotate-ccw"
                size="14"
                class="mr-1.5 text-amber-600"
              />
              Restore
            </button>
          </div>
        </article>
      </div>

      <!-- Contextual Empty State -->
      <div
        v-else
        class="px-5 py-14 text-center"
      >
        <div
          class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 text-gray-400"
        >
          <Icon
            :name="
              searchQuery
                ? 'lucide:search-x'
                : filterStatus === 'pending'
                  ? 'lucide:check-check'
                  : filterStatus === 'resolved'
                    ? 'lucide:archive'
                    : 'lucide:shield-check'
            "
            class="text-2xl"
          />
        </div>
        <p class="text-sm font-bold text-gray-800">
          {{
            searchQuery
              ? `No appeals matching "${searchQuery}"`
              : filterStatus === 'pending'
                ? 'All caught up! No pending appeals awaiting moderation.'
                : filterStatus === 'resolved'
                  ? 'No resolved appeals found in history.'
                  : 'No rejected doctor appeals recorded.'
          }}
        </p>
        <p class="mt-1 text-xs text-gray-500">
          {{
            searchQuery
              ? 'Try checking for typos or searching by doctor email, disease, or UUID.'
              : filterStatus === 'pending'
                ? 'New scan appeals submitted by physicians will appear here in real time.'
                : 'Processed appeals and audit trails are archived here.'
          }}
        </p>
        <button
          v-if="searchQuery"
          type="button"
          @click="clearSearch"
          class="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50"
        >
          <Icon
            name="lucide:x"
            size="13"
          />
          Clear search query
        </button>
      </div>
    </section>

    <!-- Detailed Inspection Modal -->
    <AppModalAppealDetail
      v-model="isDetailModalOpen"
      :appeal="selectedAppeal"
      :appeals-list="displayedAppeals"
      @select-appeal="handleSelectAppeal"
      @resolved="fetchAppeals"
      @rejected="fetchAppeals"
      @restored="fetchAppeals"
    />

    <!-- Confirmation Modal for Appeal Rejection -->
    <AppModalConfirmation
      v-model="showRejectConfirm"
      title="Reject Doctor Scan Appeal?"
      description="This appeal will be marked as rejected and excluded from AI retraining datasets. The doctor will receive a rejection notification and can submit a new appeal."
      icon="lucide:x-circle"
      icon-color="danger"
      confirm-text="Reject Appeal"
      cancel-text="Keep Pending"
      confirm-variant="destructive"
      :loading="isRejecting"
      @confirm="handleConfirmReject"
    >
      <div class="mt-4 text-left">
        <label class="block text-xs font-bold text-gray-700">
          Rejection Reason / Notes (Optional)
        </label>
        <p class="mt-0.5 text-[11px] text-gray-500">
          Provide feedback visible to the doctor explaining why this appeal was rejected.
        </p>
        <textarea
          v-model="rejectionNotes"
          rows="3"
          class="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs text-gray-800 transition-all outline-none focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
          placeholder="e.g. Scan resolution too blurry, atypical presentation requiring in-person biopsy..."
        />
      </div>
    </AppModalConfirmation>
  </div>
</template>
