<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { toast } from 'vue-sonner'
  import { appealService } from '~/api/appeal/AppealService'
  import { useDiseaseCatalog, type CatalogDisease } from '~/composables/useDiseaseCatalog'

  interface Props {
    modelValue: boolean
    diagnosisUuid?: string
    activeDisease: string
    confidence?: number | string
    imageSrc?: string
    patientName?: string
    date?: string
    activeAppeal?: any | null
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    diagnosisUuid: '',
    activeDisease: '',
    confidence: '',
    imageSrc: '',
    patientName: '',
    date: '',
    activeAppeal: null
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'close'): void
    (e: 'appeal-submitted', appeal: any, updatedLabel: string): void
    (e: 'appeal-updated', appeal: any): void
  }>()

  const userUuid = useCookie('user_uuid')

  // Form states
  const suggestedLabel = ref('')
  const appealDescription = ref('')
  const isSubmitting = ref(false)
  const errorMessage = ref<string | null>(null)
  const isEditing = ref(false)
  const isImageZoomed = ref(false)

  // Disease catalog
  const { searchDiseases, fetchCandidateDiseases } = useDiseaseCatalog()
  const diseaseSearchQuery = ref('')
  const isDiseaseDropdownOpen = ref(false)

  onMounted(() => {
    fetchCandidateDiseases()
  })

  // Watch modal open to reset / seed states
  watch(
    () => props.modelValue,
    isOpen => {
      if (isOpen) {
        errorMessage.value = null
        fetchCandidateDiseases(true)
        if (props.activeAppeal) {
          if (props.activeAppeal.status === 'pending') {
            suggestedLabel.value = props.activeAppeal.suggested_label || ''
            diseaseSearchQuery.value = props.activeAppeal.suggested_label || ''
            appealDescription.value = props.activeAppeal.description || ''
            isEditing.value = false
          } else if (props.activeAppeal.status === 'rejected') {
            suggestedLabel.value = props.activeAppeal.suggested_label || ''
            diseaseSearchQuery.value = props.activeAppeal.suggested_label || ''
            appealDescription.value = ''
            isEditing.value = false
          } else {
            isEditing.value = false
          }
        } else {
          suggestedLabel.value = ''
          diseaseSearchQuery.value = ''
          appealDescription.value = ''
          isEditing.value = true
        }
      }
    },
    { immediate: true }
  )

  const filteredDiseases = computed(() => {
    return searchDiseases(diseaseSearchQuery.value || suggestedLabel.value, props.activeDisease)
  })

  const handleSelectDisease = (disease: CatalogDisease) => {
    suggestedLabel.value = disease.name
    diseaseSearchQuery.value = disease.name
    isDiseaseDropdownOpen.value = false
  }

  const handleClearDisease = () => {
    suggestedLabel.value = ''
    diseaseSearchQuery.value = ''
    isDiseaseDropdownOpen.value = false
  }

  const handleDiseaseInputBlur = () => {
    setTimeout(() => {
      isDiseaseDropdownOpen.value = false
    }, 200)
  }

  const handleDiseaseInputFocus = () => {
    isDiseaseDropdownOpen.value = true
    fetchCandidateDiseases()
  }

  const handleStartEdit = () => {
    if (props.activeAppeal) {
      suggestedLabel.value = props.activeAppeal.suggested_label || ''
      diseaseSearchQuery.value = props.activeAppeal.suggested_label || ''
      appealDescription.value = props.activeAppeal.description || ''
    }
    isEditing.value = true
  }

  const handleStartReappeal = () => {
    if (props.activeAppeal) {
      suggestedLabel.value = props.activeAppeal.suggested_label || ''
      diseaseSearchQuery.value = props.activeAppeal.suggested_label || ''
      appealDescription.value = ''
    }
    isEditing.value = true
  }

  const handleCancelEdit = () => {
    if (props.activeAppeal) {
      isEditing.value = false
      errorMessage.value = null
    } else {
      closeModal()
    }
  }

  const closeModal = () => {
    emit('update:modelValue', false)
    emit('close')
  }

  const handleSubmit = async () => {
    if (!suggestedLabel.value) {
      errorMessage.value = 'Please select a suggested diagnosis.'
      return
    }

    if (!appealDescription.value.trim() || appealDescription.value.trim().length < 10) {
      errorMessage.value = 'Please provide clinical justification (minimum 10 characters).'
      return
    }

    isSubmitting.value = true
    errorMessage.value = null

    try {
      const payload: any = {
        user_uuid: userUuid.value,
        diagnosis_uuid: props.diagnosisUuid,
        diagnosis_label: props.activeDisease,
        suggested_label: suggestedLabel.value,
        description: appealDescription.value.trim()
      }

      if (props.activeAppeal?.uuid && props.activeAppeal?.status === 'rejected') {
        payload.parent_appeal_uuid = props.activeAppeal.uuid
      }

      let res: any
      if (props.activeAppeal?.uuid && props.activeAppeal?.status === 'pending') {
        res = await appealService.update(props.activeAppeal.uuid, payload)
        emit('appeal-updated', res?.data || res)
        toast.success(`Appeal updated: Suggested diagnosis set to "${suggestedLabel.value}".`)
      } else {
        res = await appealService.create(payload)
        emit('appeal-submitted', res?.data || res, suggestedLabel.value)
        toast.success(`Appeal filed: Clinical diagnosis updated to "${suggestedLabel.value}".`)
      }

      isEditing.value = false
      closeModal()
    } catch (err: any) {
      errorMessage.value =
        err?.data?.message || err?.message || 'Failed to submit appeal. Please try again.'
    } finally {
      isSubmitting.value = false
    }
  }

  const formattedConfidence = computed(() => {
    if (!props.confidence) return null
    const num = Number(props.confidence)
    if (isNaN(num)) return props.confidence
    return num <= 1 ? `${(num * 100).toFixed(1)}%` : `${num.toFixed(1)}%`
  })
</script>

<template>
  <AppModal
    :model-value="modelValue"
    size="5xl"
    compact
    @update:model-value="emit('update:modelValue', $event)"
    @close="closeModal"
  >
    <!-- Modal Header (pr-12 sm:pr-16 prevents collision with absolute modal close button) -->
    <div
      class="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pr-12 pb-4 sm:pr-16"
    >
      <div class="flex items-center gap-3">
        <div
          class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-2xs"
        >
          <Icon
            name="solar:scale-bold"
            class="text-xl"
          />
        </div>
        <div>
          <h2 class="text-base font-bold text-gray-950 sm:text-lg">
            Clinical Diagnostic Dispute & Appeal
          </h2>
          <p class="text-xs text-gray-500">
            Submit a clinical override to correct AI findings and queue scan for model retraining.
          </p>
        </div>
      </div>
      <span
        class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600 shadow-2xs"
      >
        <Icon
          name="solar:stethoscope-bold"
          class="text-primary text-sm"
        />
        Doctor Workspace
      </span>
    </div>

    <!-- Main Content: Two-Column Responsive Grid -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <!-- Left Column: Lesion Scan Reference & Metadata (Desktop 5 cols) -->
      <div class="flex flex-col gap-4 lg:col-span-5">
        <div class="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-xs font-bold tracking-wider text-gray-500 uppercase">
              Lesion Evidence
            </span>
            <span
              v-if="diagnosisUuid"
              class="font-mono text-[11px] font-bold text-gray-400"
            >
              #{{ diagnosisUuid.slice(0, 8) }}
            </span>
          </div>

          <!-- Image Preview with Zoom -->
          <div
            class="group relative aspect-4/3 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xs"
          >
            <img
              v-if="imageSrc"
              :src="imageSrc"
              alt="Lesion scan capture"
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div
              v-else
              class="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400"
            >
              <Icon
                name="lucide:image"
                class="text-3xl"
              />
              <span class="text-xs font-medium">No scan preview available</span>
            </div>

            <!-- Zoom trigger overlay -->
            <button
              v-if="imageSrc"
              type="button"
              @click="isImageZoomed = true"
              class="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white shadow-xs backdrop-blur-xs transition-colors hover:bg-black"
              title="Click to view full lesion image"
            >
              <Icon
                name="lucide:zoom-in"
                class="text-xs"
              />
              <span>Zoom</span>
            </button>
          </div>

          <!-- AI Finding Context Card -->
          <div class="mt-4 space-y-2.5 rounded-lg border border-gray-200 bg-white p-3 shadow-2xs">
            <div class="flex items-center justify-between text-xs">
              <span class="font-medium text-gray-500">Neural Detection:</span>
              <span class="font-bold text-gray-900">{{ activeDisease || 'Unknown' }}</span>
            </div>
            <div
              v-if="formattedConfidence"
              class="flex items-center justify-between text-xs"
            >
              <span class="font-medium text-gray-500">AI Confidence:</span>
              <span class="bg-primary/10 text-primary rounded px-1.5 py-0.5 font-bold">
                {{ formattedConfidence }}
              </span>
            </div>
            <div
              v-if="patientName"
              class="flex items-center justify-between text-xs"
            >
              <span class="font-medium text-gray-500">Patient:</span>
              <span class="font-semibold text-gray-800">{{ patientName }}</span>
            </div>
            <div
              v-if="date"
              class="flex items-center justify-between text-xs"
            >
              <span class="font-medium text-gray-500">Recorded:</span>
              <span class="font-medium text-gray-600">{{ date }}</span>
            </div>
          </div>
        </div>

        <!-- Clinical Retraining Notice -->
        <div
          class="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900"
        >
          <Icon
            name="lucide:info"
            class="mt-0.5 shrink-0 text-sm text-blue-600"
          />
          <p class="leading-relaxed">
            Your clinical diagnosis immediately replaces the AI prediction on this patient's record.
            The image and your rationale will be routed to medical moderation for dataset
            retraining.
          </p>
        </div>
      </div>

      <!-- Right Column: Appeal Form or Appeal Status (Desktop 7 cols) -->
      <div class="flex flex-col justify-between gap-5 lg:col-span-7">
        <!-- Status View: When NOT editing and an active appeal exists -->
        <template v-if="activeAppeal && !isEditing">
          <!-- 1. Approved State -->
          <div
            v-if="activeAppeal.status === 'resolved'"
            class="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5"
          >
            <div class="flex items-start gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-2xs"
              >
                <Icon
                  name="material-symbols:verified-rounded"
                  class="text-xl"
                />
              </div>
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-sm font-bold text-emerald-950">Appeal Approved & Ingested</h3>
                  <span
                    class="rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-xs font-bold text-emerald-800 shadow-2xs"
                  >
                    Verified: {{ activeAppeal.suggested_label }}
                  </span>
                </div>
                <p class="text-xs leading-relaxed text-emerald-900/90">
                  Medical moderation verified your diagnosis. This scan has been successfully
                  transferred to the production neural retraining dataset.
                </p>
              </div>
            </div>

            <div
              v-if="activeAppeal.resolution_notes"
              class="rounded-lg border border-emerald-200/80 bg-white/90 p-3 text-xs text-emerald-950"
            >
              <strong class="font-bold">Moderation feedback:</strong>
              "{{ activeAppeal.resolution_notes }}"
            </div>

            <div
              v-if="activeAppeal.description"
              class="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700"
            >
              <span class="font-bold text-gray-900">Your Submitted Rationale:</span>
              <p class="mt-1 leading-relaxed">{{ activeAppeal.description }}</p>
            </div>
          </div>

          <!-- 2. Pending State -->
          <div
            v-else-if="activeAppeal.status === 'pending'"
            class="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50/70 p-5"
          >
            <div class="flex items-start gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shadow-2xs"
              >
                <Icon
                  name="lucide:clock"
                  class="text-xl"
                />
              </div>
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-sm font-bold text-amber-950">Appeal Under Moderation Review</h3>
                  <span
                    class="rounded-md border border-amber-200 bg-white px-2 py-0.5 text-xs font-bold text-amber-800 shadow-2xs"
                  >
                    Suggested: {{ activeAppeal.suggested_label }}
                  </span>
                </div>
                <p class="text-xs leading-relaxed text-amber-900/90">
                  Your clinical override is active on the patient's record. The scan is awaiting
                  review by the dermatological moderation team before being added to retraining
                  datasets.
                </p>
              </div>
            </div>

            <div
              v-if="activeAppeal.description"
              class="rounded-lg border border-amber-200/80 bg-white/90 p-3 text-xs text-amber-950"
            >
              <span class="font-bold text-amber-900">Your Clinical Rationale:</span>
              <p class="mt-1 leading-relaxed">{{ activeAppeal.description }}</p>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <AppButton
                variant="outline"
                size="sm"
                @click="handleStartEdit"
                class="rounded-lg border-amber-300 bg-white text-xs font-bold text-amber-900 shadow-2xs hover:bg-amber-50"
              >
                <Icon
                  name="lucide:edit-3"
                  class="mr-1.5 text-xs"
                />
                Modify Appeal
              </AppButton>
            </div>
          </div>

          <!-- 3. Rejected State -->
          <div
            v-else-if="activeAppeal.status === 'rejected'"
            class="flex flex-col gap-4 rounded-xl border border-rose-200 bg-rose-50/70 p-5"
          >
            <div class="flex items-start gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 shadow-2xs"
              >
                <Icon
                  name="lucide:x-circle"
                  class="text-xl"
                />
              </div>
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-sm font-bold text-rose-950">Previous Appeal Rejected</h3>
                  <span
                    v-if="activeAppeal.resubmission_count"
                    class="rounded-md border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 shadow-2xs"
                  >
                    Round {{ activeAppeal.resubmission_count + 1 }}
                  </span>
                  <span
                    class="rounded-md border border-rose-200 bg-white px-2 py-0.5 text-xs font-bold text-rose-700 shadow-2xs"
                  >
                    Suggested: {{ activeAppeal.suggested_label }}
                  </span>
                </div>
                <p class="text-xs leading-relaxed text-rose-900/90">
                  <strong class="font-bold">Moderation feedback:</strong>
                  "{{
                    activeAppeal.resolution_notes ||
                    'Scan image does not meet retraining criteria or clinical diagnosis was unsubstantiated.'
                  }}"
                </p>
                <p class="text-[11px] leading-relaxed text-rose-700/80">
                  Your clinical diagnosis remains active on this record. You can submit another
                  appeal with additional findings or choose an alternative diagnosis.
                </p>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <AppButton
                variant="outline"
                size="sm"
                @click="handleStartReappeal"
                class="rounded-lg border-rose-300 bg-white text-xs font-bold text-rose-700 shadow-2xs hover:bg-rose-50"
              >
                <Icon
                  name="lucide:rotate-ccw"
                  class="mr-1.5 text-xs"
                />
                Submit Re-Appeal
              </AppButton>
            </div>
          </div>
        </template>

        <!-- Form View: Active when creating, modifying, or re-appealing -->
        <div
          v-else
          class="flex flex-col gap-4"
        >
          <div class="border-b border-gray-100 pb-2">
            <h3 class="text-sm font-bold text-gray-900">
              {{
                activeAppeal?.status === 'rejected'
                  ? 'Submit Re-Appeal for Moderation'
                  : activeAppeal?.status === 'pending'
                    ? 'Update Appeal Information'
                    : 'File Diagnostic Appeal'
              }}
            </h3>
            <p class="text-xs text-gray-500">
              Specify the correct clinical condition and outline diagnostic observations.
            </p>
          </div>

          <!-- Error Alert Banner -->
          <div
            v-if="errorMessage"
            class="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
          >
            <Icon
              name="lucide:alert-triangle"
              class="shrink-0 text-sm"
            />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Field 1: Suggested Diagnosis Search / Dropdown -->
          <div class="relative flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-gray-700">
                Suggested Diagnosis <span class="text-rose-500">*</span>
              </label>
              <span
                v-if="suggestedLabel"
                class="text-[11px] font-semibold text-emerald-600"
              >
                Selected: {{ suggestedLabel }}
              </span>
            </div>

            <div class="relative flex items-center">
              <Icon
                name="lucide:search"
                class="pointer-events-none absolute left-3 text-sm text-gray-400"
              />
              <input
                v-model="diseaseSearchQuery"
                type="text"
                placeholder="Search candidate disease catalog (e.g. Psoriasis, Rosacea, Vitiligo)..."
                @focus="handleDiseaseInputFocus"
                @blur="handleDiseaseInputBlur"
                @input="isDiseaseDropdownOpen = true"
                class="focus:border-primary focus:ring-primary/20 w-full rounded-lg border border-gray-300 bg-white py-2 pr-9 pl-9 text-xs font-medium text-gray-900 shadow-2xs transition-all placeholder:text-gray-400 focus:ring-2 focus:outline-none"
              />
              <button
                v-if="suggestedLabel || diseaseSearchQuery"
                type="button"
                @click="handleClearDisease"
                class="absolute right-2.5 rounded p-0.5 text-gray-400 hover:text-gray-600"
                title="Clear selection"
              >
                <Icon
                  name="material-symbols:close-rounded"
                  class="text-base"
                />
              </button>
            </div>

            <!-- Dropdown Menu -->
            <div
              v-if="isDiseaseDropdownOpen"
              class="custom-scrollbar absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
            >
              <div
                v-if="filteredDiseases.length === 0"
                class="px-3 py-4 text-center text-xs text-gray-500"
              >
                No matching diseases found in catalog.
              </div>
              <button
                v-for="d in filteredDiseases"
                :key="d.id"
                type="button"
                @mousedown.prevent="handleSelectDisease(d)"
                class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                :class="suggestedLabel === d.name ? 'bg-primary/5 text-primary' : 'text-gray-800'"
              >
                <div class="flex min-w-0 items-center gap-2.5">
                  <div
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    :class="
                      suggestedLabel === d.name
                        ? 'bg-primary/15 text-primary'
                        : 'bg-gray-100 text-gray-500'
                    "
                  >
                    <Icon
                      :name="d.icon || 'lucide:activity'"
                      class="text-sm"
                    />
                  </div>
                  <div class="flex min-w-0 flex-col">
                    <span
                      class="text-xs leading-tight font-bold"
                      :class="suggestedLabel === d.name ? 'text-primary' : 'text-gray-900'"
                    >
                      {{ d.name }}
                    </span>
                    <span
                      v-if="d.description"
                      class="mt-0.5 max-w-xs truncate text-[11px] text-gray-500 sm:max-w-sm"
                    >
                      {{ d.description }}
                    </span>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-2">
                  <span class="text-[11px] font-medium text-gray-400">
                    {{ d.category }}
                  </span>
                  <Icon
                    v-if="suggestedLabel === d.name"
                    name="material-symbols:check-rounded"
                    class="text-primary text-base"
                  />
                </div>
              </button>
            </div>
          </div>

          <!-- Field 2: Clinical Justification Textarea -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-gray-700">
                Clinical Rationale & Observations <span class="text-rose-500">*</span>
              </label>
              <span class="text-[10px] text-gray-400">Min. 10 characters</span>
            </div>
            <textarea
              v-model="appealDescription"
              rows="4"
              placeholder="Detail morphological features, lesion margins, dermatoscopic patterns, or why this presentation differs from the neural prediction..."
              class="focus:border-primary focus:ring-primary/20 w-full rounded-lg border border-gray-300 bg-white p-3 text-xs leading-relaxed font-medium text-gray-900 shadow-2xs transition-all placeholder:text-gray-400 focus:ring-2 focus:outline-none"
            ></textarea>
          </div>

          <!-- Form Actions -->
          <div class="flex items-center justify-end gap-2.5 pt-2">
            <AppButton
              variant="outline"
              size="sm"
              :disabled="isSubmitting"
              @click="handleCancelEdit"
              class="rounded-lg border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              {{ activeAppeal ? 'Cancel Edit' : 'Cancel' }}
            </AppButton>
            <AppButton
              variant="solid"
              size="sm"
              :disabled="isSubmitting || !suggestedLabel || appealDescription.trim().length < 10"
              @click="handleSubmit"
              class="bg-primary hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-2xs disabled:opacity-50"
            >
              <Icon
                v-if="isSubmitting"
                name="svg-spinners:ring-resize"
                class="text-sm"
              />
              <Icon
                v-else
                name="solar:scale-bold"
                class="text-sm"
              />
              <span>
                {{
                  isSubmitting
                    ? 'Submitting...'
                    : activeAppeal?.status === 'pending'
                      ? 'Update Appeal'
                      : activeAppeal?.status === 'rejected'
                        ? 'Submit Re-Appeal'
                        : 'Submit Clinical Appeal'
                }}
              </span>
            </AppButton>
          </div>
        </div>

        <!-- Footer Dismiss (Only when viewing static resolved status) -->
        <div
          v-if="activeAppeal?.status === 'resolved' && !isEditing"
          class="flex items-center justify-end border-t border-gray-100 pt-3"
        >
          <AppButton
            variant="outline"
            size="sm"
            @click="closeModal"
            class="rounded-lg border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            Close
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Image Zoom Fullscreen Lightbox -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isImageZoomed"
          class="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          @click.self="isImageZoomed = false"
        >
          <div
            class="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-black shadow-2xl"
          >
            <button
              type="button"
              @click="isImageZoomed = false"
              class="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
            >
              <Icon
                name="material-symbols:close-rounded"
                class="text-xl"
              />
            </button>
            <img
              :src="imageSrc"
              alt="High-resolution lesion evidence"
              class="max-h-[85vh] max-w-[85vw] object-contain"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </AppModal>
</template>
