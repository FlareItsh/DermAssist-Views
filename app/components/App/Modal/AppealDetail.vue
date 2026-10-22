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
        class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        @click="handleClose"
      />

      <!-- Modal Dialog -->
      <div
        class="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl transition-all"
      >
        <!-- Modal Header -->
        <header
          class="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-6"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"
            >
              <Icon
                name="lucide:stethoscope"
                class="text-xl"
              />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-black text-gray-950 sm:text-lg">
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
              <p class="text-xs text-gray-500">
                Appeal filed {{ formatDate(props.appeal.created_at) }}
              </p>
            </div>
          </div>

          <!-- Controls: Cycling and Close -->
          <div class="flex items-center gap-2">
            <div
              v-if="props.appealsList.length > 1"
              class="hidden items-center gap-1.5 rounded-xl border border-gray-200/60 bg-white px-2 py-1 sm:flex"
            >
              <span class="text-[11px] font-semibold text-gray-400">
                {{ currentIndex + 1 }} of {{ props.appealsList.length }}
              </span>
              <button
                type="button"
                @click="goToPrev"
                :disabled="!hasPrev"
                class="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
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
                class="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
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
              class="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <Icon
                name="lucide:x"
                class="text-lg"
              />
            </button>
          </div>
        </header>

        <!-- Modal Body (Scrollable) -->
        <div class="overflow-y-auto p-5 sm:p-6">
          <div class="grid gap-6 md:grid-cols-12">
            <!-- Left Column: Scan Image & Scan Context -->
            <div class="space-y-4 md:col-span-5">
              <div
                class="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-950 shadow-inner"
              >
                <img
                  v-if="scanImageUrl"
                  :src="scanImageUrl"
                  alt="Scanned lesion"
                  class="h-full w-full object-cover transition-transform duration-300"
                  :class="isImageZoomed ? 'scale-125 cursor-zoom-out' : 'cursor-zoom-in'"
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
                  class="pointer-events-none absolute right-2 bottom-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm"
                >
                  Click to {{ isImageZoomed ? 'reset' : 'zoom' }}
                </div>
              </div>

              <!-- Scan Metadata -->
              <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 text-xs">
                <div class="space-y-2.5">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-500">Scan Reference</span>
                    <span class="font-mono font-bold text-gray-800">
                      #{{ props.appeal.diagnosis?.uuid?.slice(0, 10) || 'N/A' }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-500">Assigned Patient</span>
                    <span class="font-bold text-gray-800">{{ patientName }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-500">Scan Timestamp</span>
                    <span class="font-medium text-gray-700">
                      {{ formatDate(props.appeal.diagnosis?.created_at) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Comparative Assessment & Actions -->
            <div class="flex flex-col justify-between space-y-5 md:col-span-7">
              <div class="space-y-5">
                <!-- Comparison Header Card -->
                <div class="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 sm:p-5">
                  <span
                    class="text-[10px] font-bold tracking-widest text-gray-400 uppercase sm:text-xs"
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
                          class="ml-1 opacity-80"
                        >
                          ({{ Math.round(Number(props.appeal.diagnosis.confidence) * 100) }}%)
                        </span>
                      </AppBadge>
                    </div>

                    <Icon
                      name="lucide:arrow-right"
                      class="mt-3 text-lg text-gray-400"
                    />

                    <div class="flex flex-col">
                      <span class="text-[10px] font-semibold text-green-600">
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
                    class="mt-4 border-t border-gray-200/50 pt-3"
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
                        <span class="w-20 truncate font-medium text-gray-600">{{ p.label }}</span>
                        <div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                          <div
                            class="h-full rounded-full transition-all duration-500"
                            :class="
                              p.label === props.appeal.suggested_label
                                ? 'bg-green-500'
                                : p.label === props.appeal.diagnosis_label
                                  ? 'bg-rose-500'
                                  : 'bg-primary'
                            "
                            :style="{ width: `${p.value}%` }"
                          />
                        </div>
                        <span class="w-10 text-right font-mono font-bold text-gray-700"
                          >{{ p.value }}%</span
                        >
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Doctor Clinical Rationale Box -->
                <div class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                  <div class="flex items-center gap-3 border-b border-gray-100 pb-3">
                    <div
                      class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-black"
                    >
                      {{ doctorInitials }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <h4 class="truncate text-sm font-black text-gray-950">
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
                    <p class="mt-1.5 text-xs leading-relaxed text-gray-700 italic sm:text-sm">
                      "{{
                        props.appeal.description ||
                        'No specific clinical description was provided.'
                      }}"
                    </p>
                  </div>
                </div>

                <!-- Three-Gate Compliance & Dual-Consent Card -->
                <div class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                  <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                    AI Retraining Ingestion Gates (Dual-Consent & Admin Verification)
                  </span>
                  <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div
                      class="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-2.5"
                    >
                      <Icon
                        :name="
                          props.appeal.diagnosis?.patient_consent
                            ? 'lucide:check-circle-2'
                            : 'lucide:alert-circle'
                        "
                        :class="
                          props.appeal.diagnosis?.patient_consent
                            ? 'text-emerald-500'
                            : 'text-amber-500'
                        "
                        size="18"
                      />
                      <div class="flex flex-col">
                        <span class="text-[10px] font-semibold text-gray-400">Gate 1: Patient</span>
                        <span
                          class="text-xs font-bold"
                          :class="
                            props.appeal.diagnosis?.patient_consent
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          "
                        >
                          {{
                            props.appeal.diagnosis?.patient_consent
                              ? 'Research Consented'
                              : 'No Consent'
                          }}
                        </span>
                      </div>
                    </div>
                    <div
                      class="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-2.5"
                    >
                      <Icon
                        name="lucide:check-circle-2"
                        class="text-emerald-500"
                        size="18"
                      />
                      <div class="flex flex-col">
                        <span class="text-[10px] font-semibold text-gray-400">Gate 2: Doctor</span>
                        <span class="text-xs font-bold text-emerald-700">
                          Authorized (Appeal)
                        </span>
                      </div>
                    </div>
                    <div
                      class="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-2.5"
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
                            ? 'text-emerald-500'
                            : props.appeal.status === 'rejected'
                              ? 'text-rose-500'
                              : 'text-amber-500'
                        "
                        size="18"
                      />
                      <div class="flex flex-col">
                        <span class="text-[10px] font-semibold text-gray-400">Gate 3: Admin</span>
                        <span
                          class="text-xs font-bold"
                          :class="
                            props.appeal.status === 'resolved'
                              ? 'text-emerald-700'
                              : props.appeal.status === 'rejected'
                                ? 'text-rose-700'
                                : 'text-amber-700'
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
                  class="rounded-xl border border-purple-200/60 bg-purple-50/50 p-3 text-xs text-purple-900"
                >
                  <div class="flex items-center gap-2">
                    <Icon
                      name="lucide:rotate-ccw"
                      class="text-purple-600"
                      size="14"
                    />
                    <span class="font-bold">Resubmission History:</span>
                    <span class="text-purple-700">
                      Revision of rejected predecessor appeal #{{
                        (props.appeal as any).parent_appeal_uuid.slice(0, 8)
                      }}.
                    </span>
                  </div>
                </div>

                <!-- Moderation Notes Card for Pending Appeals -->
                <div
                  v-if="props.appeal.status === 'pending'"
                  class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"
                >
                  <label class="block text-xs font-bold text-gray-700">
                    Moderation Notes / Feedback (Optional)
                  </label>
                  <p class="mt-0.5 text-[11px] text-gray-400">
                    Will be saved in audit history and displayed to the doctor if rejected.
                  </p>
                  <textarea
                    v-model="resolutionNotes"
                    rows="2"
                    class="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs text-gray-800 transition-all outline-none focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                    placeholder="e.g. Scan resolution too blurry, atypical presentation requiring biopsy..."
                  />
                </div>

                <!-- Rejected Notice if Appeal was Rejected -->
                <div
                  v-else-if="props.appeal.status === 'rejected'"
                  class="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs"
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
                  class="rounded-2xl border border-green-500/20 bg-green-500/5 p-4 text-xs"
                >
                  <div class="flex items-start gap-2.5">
                    <Icon
                      name="lucide:check-circle-2"
                      class="mt-0.5 shrink-0 text-base text-green-600"
                    />
                    <div>
                      <span class="font-bold text-gray-900">Approved for AI Retraining</span>
                      <p class="mt-0.5 text-[11px] leading-relaxed text-gray-600">
                        Scan image is assigned to the
                        <strong>{{ props.appeal.suggested_label }}</strong> model dataset.
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

              <!-- Modal Footer Action Buttons -->
              <div
                class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4"
              >
                <!-- Mobile Prev/Next -->
                <div class="flex items-center gap-1 sm:hidden">
                  <button
                    type="button"
                    @click="goToPrev"
                    :disabled="!hasPrev"
                    class="rounded-lg border border-gray-200 p-1.5 text-gray-600 disabled:opacity-30"
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
                    class="rounded-lg border border-gray-200 p-1.5 text-gray-600 disabled:opacity-30"
                  >
                    <Icon
                      name="lucide:chevron-right"
                      size="14"
                    />
                  </button>
                </div>

                <div class="ml-auto flex items-center gap-2.5">
                  <AppButton
                    variant="outline"
                    @click="handleClose"
                    class="rounded-xl px-4 py-2 text-xs font-bold sm:text-sm"
                  >
                    Close
                  </AppButton>

                  <template v-if="props.appeal.status === 'pending'">
                    <AppButton
                      variant="outline"
                      @click="handleReject"
                      :loading="isRejecting"
                      class="rounded-xl px-4 py-2 text-xs font-bold text-rose-600 hover:border-rose-300 hover:bg-rose-50 sm:text-sm"
                    >
                      <Icon
                        name="lucide:x-circle"
                        size="15"
                        class="mr-1.5"
                      />
                      Reject Appeal
                    </AppButton>

                    <AppButton
                      variant="primary"
                      @click="handleResolve"
                      :loading="isResolving"
                      class="bg-primary rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm sm:text-sm"
                    >
                      <Icon
                        name="lucide:check-circle-2"
                        size="16"
                        class="mr-1.5"
                      />
                      Approve for AI Retraining
                    </AppButton>
                  </template>

                  <AppButton
                    v-else
                    variant="outline"
                    @click="handleRestore"
                    :loading="isRestoring"
                    class="rounded-xl px-4 py-2 text-xs font-bold text-amber-700 hover:border-amber-300 hover:text-amber-800 sm:text-sm"
                  >
                    <Icon
                      name="lucide:rotate-ccw"
                      size="14"
                      class="mr-1.5"
                    />
                    Restore to Pending
                  </AppButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
