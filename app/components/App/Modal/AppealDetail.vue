<script setup lang="ts">
  import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
  import { toast } from 'vue-sonner'
  import type { AdminAppeal } from '~/composables/useAdminAppeals'

  interface Props {
    modelValue?: boolean
    appeal: AdminAppeal | null
    appealsList?: AdminAppeal[]
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    appeal: null,
    appealsList: () => []
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'close'): void
    (e: 'resolved', uuid: string): void
    (e: 'rejected', uuid: string): void
    (e: 'restored', uuid: string): void
    (e: 'select-appeal', appeal: AdminAppeal): void
  }>()

  const { getStorageUrl } = useStorage()
  const {
    resolveAppeal: apiResolve,
    rejectAppeal: apiReject,
    restoreAppeal: apiRestore
  } = useAdminAppeals()

  const isResolving = ref(false)
  const isRejecting = ref(false)
  const isRestoring = ref(false)
  const resolutionNotes = ref('')
  const isImageZoomed = ref(false)
  const isCopied = ref(false)

  // Current index in list for next / prev cycling
  const currentIndex = computed(() => {
    if (!props.appeal || !props.appealsList.length) return -1
    return props.appealsList.findIndex(a => a.uuid === props.appeal?.uuid)
  })

  const hasPrev = computed(() => currentIndex.value > 0)
  const hasNext = computed(
    () => currentIndex.value >= 0 && currentIndex.value < props.appealsList.length - 1
  )

  const goToPrev = () => {
    if (hasPrev.value) {
      const prev = props.appealsList[currentIndex.value - 1]
      emit('select-appeal', prev)
      resetState()
    }
  }

  const goToNext = () => {
    if (hasNext.value) {
      const next = props.appealsList[currentIndex.value + 1]
      emit('select-appeal', next)
      resetState()
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (!props.modelValue) return
    if (e.key === 'ArrowLeft') {
      goToPrev()
    } else if (e.key === 'ArrowRight') {
      goToNext()
    } else if (e.key === 'Escape') {
      handleClose()
    }
  }

  onMounted(() => {
    if (import.meta.client) {
      window.addEventListener('keydown', handleKeydown)
    }
  })

  onBeforeUnmount(() => {
    if (import.meta.client) {
      window.removeEventListener('keydown', handleKeydown)
    }
  })

  const resetState = () => {
    resolutionNotes.value = props.appeal?.resolution_notes || ''
    isImageZoomed.value = false
    isCopied.value = false
  }

  watch(
    () => props.appeal,
    () => {
      resetState()
    },
    { immediate: true }
  )

  const handleClose = () => {
    if (isResolving.value || isRestoring.value) return
    emit('update:modelValue', false)
    emit('close')
  }

  const handleResolve = async () => {
    if (!props.appeal?.uuid) return
    isResolving.value = true
    try {
      await apiResolve(props.appeal.uuid, {
        resolution_notes: resolutionNotes.value,
        update_dataset: true
      })
      emit('resolved', props.appeal.uuid)
      toast.success(
        `Appeal resolved. Scan image added to "${props.appeal.suggested_label}" AI retraining dataset.`
      )
      handleClose()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to resolve appeal.')
    } finally {
      isResolving.value = false
    }
  }

  const handleReject = async () => {
    if (!props.appeal?.uuid) return
    isRejecting.value = true
    try {
      await apiReject(props.appeal.uuid, {
        resolution_notes: resolutionNotes.value.trim() || undefined
      })
      emit('rejected', props.appeal.uuid)
      toast.success('Appeal rejected and excluded from retraining dataset.')
      handleClose()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to reject appeal.')
    } finally {
      isRejecting.value = false
    }
  }

  const handleRestore = async () => {
    if (!props.appeal?.uuid) return
    isRestoring.value = true
    try {
      await apiRestore(props.appeal.uuid)
      emit('restored', props.appeal.uuid)
      toast.info('Appeal restored to pending moderation.')
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to restore appeal.')
    } finally {
      isRestoring.value = false
    }
  }

  const scanImageUrl = computed(() => {
    if (!props.appeal?.diagnosis) return null
    const diag = props.appeal.diagnosis
    const raw = diag.image_url || diag.image_path
    return raw ? getStorageUrl(raw) : null
  })

  const doctorName = computed(() => {
    if (!props.appeal?.user) return 'Doctor'
    const first = props.appeal.user.first_name?.trim() || ''
    const last = props.appeal.user.last_name?.trim() || ''
    return [first, last].filter(Boolean).join(' ') || 'Doctor'
  })

  const doctorInitials = computed(() => {
    const first = props.appeal?.user?.first_name?.[0] || 'D'
    const last = props.appeal?.user?.last_name?.[0] || 'R'
    return `${first}${last}`.toUpperCase()
  })

  const patientName = computed(() => {
    const p = props.appeal?.diagnosis?.patient
    if (!p) return 'Unassigned Patient'
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Patient'
  })

  // Gate 1: Check patient consent across diagnosis snapshot, resource field, and patient model
  const hasPatientConsent = computed(() => {
    const diag = props.appeal?.diagnosis
    if (!diag) return false
    return Boolean(
      diag.patient_consented_dataset ||
      diag.patient_consent ||
      diag.patient?.consent_dataset
    )
  })

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

  const copyScanReference = () => {
    const refUuid = props.appeal?.diagnosis?.uuid
    if (!refUuid) return
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(refUuid)
      isCopied.value = true
      toast.success('Scan reference copied to clipboard.')
      setTimeout(() => {
        isCopied.value = false
      }, 2000)
    }
  }

  const probabilities = computed(() => {
    const raw = props.appeal?.diagnosis?.probabilities
    if (!raw || typeof raw !== 'object') return []
    return Object.entries(raw)
      .map(([label, val]) => ({
        label,
        value: typeof val === 'number' ? Math.round(val * 100) : 0
      }))
      .sort((a, b) => b.value - a.value)
  })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.modelValue && props.appeal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        @click="handleClose"
      />

      <!-- Modal Dialog Container -->
      <div
        class="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition-all"
      >
        <!-- Modal Header (Fixed at top) -->
        <header
          class="flex shrink-0 items-center justify-between border-b border-gray-100 bg-gray-50/80 px-5 py-3.5 sm:px-6"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 border border-rose-100 text-rose-600"
            >
              <Icon
                name="lucide:stethoscope"
                class="text-lg"
              />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-base font-bold text-gray-900 tracking-tight sm:text-lg truncate">
                  Doctor Scan Appeal Inspection
                </h2>
                <AppBadge
                  :color="
                    props.appeal.status === 'resolved'
                      ? 'success'
                      : props.appeal.status === 'rejected'
                        ? 'danger'
                        : 'amber'
                  "
                  size="xs"
                >
                  {{
                    props.appeal.status === 'resolved'
                      ? 'Resolved'
                      : props.appeal.status === 'rejected'
                        ? 'Rejected'
                        : 'Pending Review'
                  }}
                </AppBadge>
                <AppBadge
                  v-if="(props.appeal as any).resubmission_count"
                  color="purple"
                  size="xs"
                >
                  Round {{ (props.appeal as any).resubmission_count + 1 }}
                </AppBadge>
              </div>
              <p class="text-xs text-gray-500 mt-0.5">
                Appeal filed {{ formatDate(props.appeal.created_at) }}
              </p>
            </div>
          </div>

          <!-- Controls: Cycling and Close -->
          <div class="flex items-center gap-2 shrink-0">
            <div
              v-if="props.appealsList.length > 1"
              class="hidden items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 sm:flex"
            >
              <span class="text-[11px] font-semibold text-gray-500">
                {{ currentIndex + 1 }} of {{ props.appealsList.length }}
              </span>
              <button
                type="button"
                @click="goToPrev"
                :disabled="!hasPrev"
                class="rounded-md p-0.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous appeal (Arrow Left)"
              >
                <Icon
                  name="lucide:chevron-left"
                  size="14"
                />
              </button>
              <button
                type="button"
                @click="goToNext"
                :disabled="!hasNext"
                class="rounded-md p-0.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next appeal (Arrow Right)"
              >
                <Icon
                  name="lucide:chevron-right"
                  size="14"
                />
              </button>
            </div>

            <button
              type="button"
              @click="handleClose"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title="Close modal (Esc)"
            >
              <Icon
                name="lucide:x"
                class="text-lg"
              />
            </button>
          </div>
        </header>

        <!-- Modal Body (Scrollable, NO horizontal overflow) -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6 text-gray-900">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- Left Column: Scan Image & Scan Reference -->
            <div class="space-y-4 lg:col-span-5 lg:sticky lg:top-0">
              <div
                class="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-950 shadow-inner"
              >
                <img
                  v-if="scanImageUrl"
                  :src="scanImageUrl"
                  alt="Scanned lesion"
                  class="h-full w-full object-cover transition-transform duration-300 select-none"
                  :class="isImageZoomed ? 'scale-130 cursor-zoom-out' : 'cursor-zoom-in'"
                  @click="isImageZoomed = !isImageZoomed"
                />
                <div
                  v-else
                  class="flex flex-col items-center justify-center p-6 text-center text-gray-400"
                >
                  <Icon
                    name="lucide:image-off"
                    class="mb-2 text-3xl"
                  />
                  <span class="text-xs font-semibold">Scan image unavailable</span>
                  <p class="mt-1 text-[11px] text-gray-500">Image was not archived with record.</p>
                </div>

                <div
                  v-if="scanImageUrl"
                  class="pointer-events-none absolute right-2 bottom-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs"
                >
                  Click to {{ isImageZoomed ? 'reset' : 'zoom' }}
                </div>
              </div>

              <!-- Scan Metadata Card -->
              <div class="rounded-xl border border-gray-200/80 bg-gray-50/70 p-4 text-xs space-y-2.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium text-gray-500">Scan Reference</span>
                  <button
                    type="button"
                    @click="copyScanReference"
                    class="group inline-flex items-center gap-1 font-mono font-bold text-gray-800 hover:text-primary transition-colors"
                    title="Click to copy full UUID"
                  >
                    <span>#{{ props.appeal.diagnosis?.uuid?.slice(0, 10) || 'N/A' }}</span>
                    <Icon
                      :name="isCopied ? 'lucide:check' : 'lucide:copy'"
                      size="12"
                      :class="isCopied ? 'text-emerald-600' : 'text-gray-400 group-hover:text-primary'"
                    />
                  </button>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium text-gray-500">Assigned Patient</span>
                  <span class="font-semibold text-gray-800 truncate">{{ patientName }}</span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium text-gray-500">Scan Timestamp</span>
                  <span class="font-medium text-gray-700">
                    {{ formatDate(props.appeal.diagnosis?.created_at) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Right Column: Comparative Assessment & Clinical Audit -->
            <div class="space-y-4 lg:col-span-7 min-w-0">
              <!-- Comparison Header Card -->
              <div class="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 sm:p-5">
                <span
                  class="text-[10px] font-bold tracking-widest text-gray-400 uppercase sm:text-xs block"
                >
                  Diagnostic Discrepancy
                </span>
                <div class="mt-3 flex flex-wrap items-center gap-3">
                  <div class="flex flex-col">
                    <span class="text-[10px] font-semibold text-rose-500">AI Initial Guess</span>
                    <AppBadge
                      color="danger"
                      size="md"
                      class="mt-1"
                    >
                      {{ props.appeal.diagnosis_label || 'Unlabeled' }}
                      <span
                        v-if="props.appeal.diagnosis?.confidence"
                        class="ml-1 opacity-80 font-mono"
                      >
                        ({{ Math.round(Number(props.appeal.diagnosis.confidence) * 100) }}%)
                      </span>
                    </AppBadge>
                  </div>

                  <Icon
                    name="lucide:arrow-right"
                    class="mt-3 text-lg text-gray-400 shrink-0"
                  />

                  <div class="flex flex-col">
                    <span class="text-[10px] font-semibold text-emerald-600">
                      Doctor's Verified Diagnosis
                    </span>
                    <AppBadge
                      color="success"
                      size="md"
                      class="mt-1 font-bold"
                    >
                      <Icon
                        name="lucide:check-circle-2"
                        size="14"
                        class="mr-1"
                      />
                      {{ props.appeal.suggested_label }}
                    </AppBadge>
                  </div>
                </div>

                <!-- Probability breakdown if available -->
                <div
                  v-if="probabilities.length"
                  class="mt-4 border-t border-gray-200/60 pt-3"
                >
                  <span class="text-[11px] font-bold text-gray-500">
                    Model Confidence Breakdown:
                  </span>
                  <div class="mt-2 space-y-1.5">
                    <div
                      v-for="p in probabilities"
                      :key="p.label"
                      class="flex items-center gap-2 text-[11px]"
                    >
                      <span class="w-20 truncate font-medium text-gray-600 shrink-0">{{ p.label }}</span>
                      <div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                        <div
                          class="h-full rounded-full transition-all duration-500"
                          :class="
                            p.label === props.appeal.suggested_label
                              ? 'bg-emerald-500'
                              : p.label === props.appeal.diagnosis_label
                                ? 'bg-rose-500'
                                : 'bg-primary'
                          "
                          :style="{ width: `${p.value}%` }"
                        />
                      </div>
                      <span class="w-10 text-right font-mono font-bold text-gray-700 shrink-0"
                        >{{ p.value }}%</span
                      >
                    </div>
                  </div>
                </div>
              </div>

              <!-- Doctor Clinical Rationale Box -->
              <div class="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs sm:p-5">
                <div class="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div
                    class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold shrink-0"
                  >
                    {{ doctorInitials }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <h4 class="truncate text-sm font-bold text-gray-900">
                      Dr. {{ doctorName }}
                    </h4>
                    <p class="truncate text-xs text-gray-500">
                      {{
                        props.appeal.user?.email || props.appeal.user?.affiliation || 'Specialist'
                      }}
                    </p>
                  </div>
                </div>

                <div class="mt-3">
                  <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                    Clinical Reason & Justification
                  </span>
                  <p class="mt-1.5 text-xs leading-relaxed text-gray-700 italic sm:text-sm break-words">
                    "{{
                      props.appeal.description ||
                      'No specific clinical description was provided.'
                    }}"
                  </p>
                </div>
              </div>

              <!-- Three-Gate Compliance & Dual-Consent Card (Zero horizontal scroll, responsive) -->
              <div class="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs sm:p-5 min-w-0">
                <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase block">
                  AI Retraining Ingestion Gates (Dual-Consent & Admin Verification)
                </span>
                <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0">
                  <!-- Gate 1: Patient Consent -->
                  <div
                    class="flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors min-w-0"
                    :class="
                      hasPatientConsent
                        ? 'border-emerald-200/80 bg-emerald-50/50'
                        : 'border-amber-200/80 bg-amber-50/50'
                    "
                  >
                    <Icon
                      :name="hasPatientConsent ? 'lucide:check-circle-2' : 'lucide:alert-circle'"
                      :class="hasPatientConsent ? 'text-emerald-600' : 'text-amber-600'"
                      size="18"
                      class="shrink-0"
                    />
                    <div class="flex flex-col min-w-0">
                      <span class="text-[10px] font-semibold text-gray-500">Gate 1: Patient</span>
                      <span
                        class="text-xs font-bold truncate"
                        :class="hasPatientConsent ? 'text-emerald-800' : 'text-amber-800'"
                      >
                        {{ hasPatientConsent ? 'Research Consented' : 'No Consent' }}
                      </span>
                    </div>
                  </div>

                  <!-- Gate 2: Doctor Authorization -->
                  <div
                    class="flex items-center gap-2.5 rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-2.5 min-w-0"
                  >
                    <Icon
                      name="lucide:check-circle-2"
                      class="text-emerald-600 shrink-0"
                      size="18"
                    />
                    <div class="flex flex-col min-w-0">
                      <span class="text-[10px] font-semibold text-gray-500">Gate 2: Doctor</span>
                      <span class="text-xs font-bold text-emerald-800 truncate">
                        Authorized (Appeal)
                      </span>
                    </div>
                  </div>

                  <!-- Gate 3: Admin Approval -->
                  <div
                    class="flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors min-w-0"
                    :class="
                      props.appeal.status === 'resolved'
                        ? 'border-emerald-200/80 bg-emerald-50/50'
                        : props.appeal.status === 'rejected'
                          ? 'border-rose-200/80 bg-rose-50/50'
                          : 'border-amber-200/80 bg-amber-50/50'
                    "
                  >
                    <Icon
                      :name="
                        props.appeal.status === 'resolved'
                          ? 'lucide:check-circle-2'
                          : props.appeal.status === 'rejected'
                            ? 'lucide:x-circle'
                            : 'lucide:clock'
                      "
                      :class="
                        props.appeal.status === 'resolved'
                          ? 'text-emerald-600'
                          : props.appeal.status === 'rejected'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                      "
                      size="18"
                      class="shrink-0"
                    />
                    <div class="flex flex-col min-w-0">
                      <span class="text-[10px] font-semibold text-gray-500">Gate 3: Admin</span>
                      <span
                        class="text-xs font-bold truncate"
                        :class="
                          props.appeal.status === 'resolved'
                            ? 'text-emerald-800'
                            : props.appeal.status === 'rejected'
                              ? 'text-rose-800'
                              : 'text-amber-800'
                        "
                      >
                        {{
                          props.appeal.status === 'resolved'
                            ? 'Approved'
                            : props.appeal.status === 'rejected'
                              ? 'Rejected'
                              : 'Pending'
                        }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Resubmission Predecessor Note -->
              <div
                v-if="(props.appeal as any).parent_appeal_uuid"
                class="rounded-xl border border-purple-200/70 bg-purple-50/50 p-3 text-xs text-purple-900"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="lucide:rotate-ccw"
                    class="text-purple-600 shrink-0"
                    size="14"
                  />
                  <span class="font-bold">Resubmission History:</span>
                  <span class="text-purple-700 truncate">
                    Revision of rejected predecessor appeal #{{
                      (props.appeal as any).parent_appeal_uuid.slice(0, 8)
                    }}.
                  </span>
                </div>
              </div>

              <!-- Moderation Notes Card for Pending Appeals -->
              <div
                v-if="props.appeal.status === 'pending'"
                class="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs sm:p-5"
              >
                <label class="block text-xs font-bold text-gray-700">
                  Moderation Notes / Feedback (Optional)
                </label>
                <p class="mt-0.5 text-[11px] text-gray-500">
                  Will be saved in audit history and displayed to the doctor if rejected.
                </p>
                <textarea
                  v-model="resolutionNotes"
                  rows="2"
                  class="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-gray-50/60 p-2.5 text-xs text-gray-800 transition-all outline-none focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  placeholder="e.g. Scan resolution too blurry, atypical presentation requiring biopsy..."
                />
              </div>

              <!-- Rejected Notice if Appeal was Rejected -->
              <div
                v-else-if="props.appeal.status === 'rejected'"
                class="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-xs"
              >
                <div class="flex items-start gap-2.5">
                  <Icon
                    name="lucide:x-circle"
                    class="mt-0.5 shrink-0 text-base text-rose-500"
                  />
                  <div>
                    <span class="font-bold text-rose-700">Appeal Rejected by Moderation</span>
                    <p class="mt-0.5 text-[11px] leading-relaxed text-gray-600">
                      This appeal was rejected and excluded from AI retraining datasets.
                    </p>
                    <p
                      v-if="props.appeal.resolution_notes"
                      class="mt-1.5 text-xs text-gray-700 italic"
                    >
                      Reason: "{{ props.appeal.resolution_notes }}"
                    </p>
                  </div>
                </div>
              </div>

              <!-- Retraining Ingestion Notice if Resolved -->
              <div
                v-else
                class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs"
              >
                <div class="flex items-start gap-2.5">
                  <Icon
                    name="lucide:check-circle-2"
                    class="mt-0.5 shrink-0 text-base text-emerald-600"
                  />
                  <div>
                    <span class="font-bold text-gray-900">Approved for AI Retraining</span>
                    <p class="mt-0.5 text-[11px] leading-relaxed text-gray-600">
                      Scan image is assigned to the
                      <strong class="font-semibold text-emerald-800">{{ props.appeal.suggested_label }}</strong> model dataset.
                    </p>
                    <p
                      v-if="props.appeal.resolution_notes"
                      class="mt-1.5 text-xs text-gray-700 italic"
                    >
                      Notes: "{{ props.appeal.resolution_notes }}"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer (Fixed at bottom, ALWAYS visible without scrolling) -->
        <footer
          class="shrink-0 border-t border-gray-100 bg-gray-50/90 px-5 py-3.5 sm:px-6 flex items-center justify-between gap-3"
        >
          <!-- Left: Mobile Cycling / Keyboard Shortcut Hint -->
          <div class="flex items-center gap-2">
            <div
              v-if="props.appealsList.length > 1"
              class="flex items-center gap-1 sm:hidden"
            >
              <button
                type="button"
                @click="goToPrev"
                :disabled="!hasPrev"
                class="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous appeal"
              >
                <Icon
                  name="lucide:chevron-left"
                  size="14"
                />
              </button>
              <span class="px-1 text-xs font-semibold text-gray-500">
                {{ currentIndex + 1 }}/{{ props.appealsList.length }}
              </span>
              <button
                type="button"
                @click="goToNext"
                :disabled="!hasNext"
                class="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next appeal"
              >
                <Icon
                  name="lucide:chevron-right"
                  size="14"
                />
              </button>
            </div>
            <span class="hidden sm:inline-block text-[11px] text-gray-400 select-none">
              Press <kbd class="px-1 py-0.5 rounded border border-gray-200 bg-white font-mono text-[10px]">Esc</kbd> to close
            </span>
          </div>

          <!-- Right: Modal Action Buttons -->
          <div class="ml-auto flex items-center gap-2.5">
            <button
              type="button"
              @click="handleClose"
              class="inline-flex h-9 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 sm:text-sm cursor-pointer"
            >
              Close
            </button>

            <template v-if="props.appeal.status === 'pending'">
              <button
                type="button"
                @click="handleReject"
                :disabled="isRejecting"
                class="inline-flex h-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50/40 px-4 text-xs font-bold text-rose-600 shadow-2xs transition-colors hover:border-rose-300 hover:bg-rose-100/60 active:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm cursor-pointer"
              >
                <Icon
                  v-if="!isRejecting"
                  name="lucide:x-circle"
                  size="15"
                  class="mr-1.5 shrink-0 text-rose-500"
                />
                <Icon
                  v-else
                  name="lucide:loader-2"
                  size="15"
                  class="mr-1.5 shrink-0 animate-spin text-rose-500"
                />
                Reject Appeal
              </button>

              <button
                type="button"
                @click="handleResolve"
                :disabled="isResolving"
                class="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-5 text-xs font-bold text-white shadow-xs transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm cursor-pointer"
              >
                <Icon
                  v-if="!isResolving"
                  name="lucide:check-circle-2"
                  size="16"
                  class="mr-1.5 shrink-0 text-white"
                />
                <Icon
                  v-else
                  name="lucide:loader-2"
                  size="16"
                  class="mr-1.5 shrink-0 animate-spin text-white"
                />
                Approve for AI Retraining
              </button>
            </template>

            <button
              v-else
              type="button"
              @click="handleRestore"
              :disabled="isRestoring"
              class="inline-flex h-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50/40 px-4 text-xs font-bold text-amber-700 shadow-2xs transition-colors hover:border-amber-300 hover:bg-amber-100/60 active:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm cursor-pointer"
            >
              <Icon
                v-if="!isRestoring"
                name="lucide:rotate-ccw"
                size="14"
                class="mr-1.5 shrink-0 text-amber-600"
              />
              <Icon
                v-else
                name="lucide:loader-2"
                size="14"
                class="mr-1.5 shrink-0 animate-spin text-amber-600"
              />
              Restore to Pending
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
