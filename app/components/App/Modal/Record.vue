<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { DISEASE_DATABASE, COLOR_MAP } from '~/composables/useDiagnosis'
  import { useStorage } from '~/composables/useStorage'
  import { recordService } from '~/api/record/RecordService'
  import { toast } from 'vue-sonner'

  const props = defineProps<{
    record: any
    role?: 'doctor' | 'patient'
  }>()

  const emit = defineEmits(['close'])

  const userRole = useCookie('user_role')
  const { getStorageUrl } = useStorage()
  const isImageExpanded = ref(false)
  const isDownloadingPdf = ref(false)

  const isPatientView = computed(() => {
    if (props.role === 'patient') return true
    if (props.role === 'doctor') return false
    return userRole.value === 'patient'
  })

  const isAppealed = computed(() => {
    return Boolean(props.record?.is_appealed || props.record?.appeal)
  })

  const prescriptionText = computed(() => {
    return props.record?.clinical_note?.prescription || props.record?.prescription || null
  })

  // Selected disease for dynamic characteristics and symptoms switching
  const selectedDisease = ref<string>('Acne')

  watch(
    () => props.record,
    rec => {
      if (rec) {
        selectedDisease.value = rec.label || rec.title || 'Acne'
      }
    },
    { immediate: true }
  )

  const activeDiseaseInfo = computed(() => {
    return (
      DISEASE_DATABASE[selectedDisease.value] ||
      DISEASE_DATABASE[props.record?.label] ||
      DISEASE_DATABASE['None']
    )
  })

  const diseaseColor = computed(() => {
    return (
      COLOR_MAP[selectedDisease.value] ||
      activeDiseaseInfo.value?.color ||
      COLOR_MAP[props.record?.label] ||
      '#7B5EF5'
    )
  })

  const probabilityList = computed(() => {
    if (!props.record?.probabilities) return []
    return Object.entries(props.record.probabilities)
      .map(([label, val]) => ({
        label,
        value: Math.round((val as number) * 100),
        color: COLOR_MAP[label] || '#94a3b8'
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
  })

  const activeConfidence = computed(() => {
    if (
      props.record?.probabilities &&
      props.record.probabilities[selectedDisease.value] !== undefined
    ) {
      return Math.round(props.record.probabilities[selectedDisease.value] * 100)
    }
    if (props.record?.confidence) {
      return Math.round(props.record.confidence * 100)
    }
    return 100
  })

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown Date'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const formatListText = (text: string) => {
    if (text.includes(':')) {
      const parts = text.split(':')
      return `<span class="font-semibold text-gray-800">${parts[0]}:</span>${parts[1]}`
    }
    return text
  }

  const handleExportPdf = async () => {
    if (!props.record?.uuid) return
    isDownloadingPdf.value = true
    try {
      const blob = await recordService.downloadPdf(props.record.uuid)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `clinical-assessment-${props.record.uuid.slice(0, 8)}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Clinical assessment PDF downloaded successfully')
    } catch (err: any) {
      if ((err?.status === 403 || err?.statusCode === 403) && userRole.value === 'doctor') {
        toast.error(
          'Plan restriction: PDF exports are not included in your current subscription. Please upgrade to unlock.',
          {
            action: {
              label: 'View Plans',
              onClick: () => navigateTo('/doctor/subscription')
            }
          }
        )
      } else {
        toast.error(err?.data?.message || err?.message || 'Failed to download PDF report')
      }
    } finally {
      isDownloadingPdf.value = false
    }
  }
</script>

<template>
  <div class="flex h-full max-h-[90vh] flex-col overflow-hidden bg-white text-gray-900">
    <!-- Header Row (Non-scrollable, fixed at top) -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 py-4 sm:px-7 sm:py-5"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          :style="{ backgroundColor: `${diseaseColor}15`, color: diseaseColor }"
        >
          <Icon
            :name="
              record.type === 'doctor_diagnosis'
                ? 'material-symbols:stethoscope-rounded'
                : 'solar:shield-check-bold-duotone'
            "
            size="20"
          />
        </div>
        <div>
          <h2 class="text-base font-bold text-gray-900 sm:text-lg">
            {{
              record.type === 'doctor_diagnosis' ? 'Doctor Clinical Assessment' : 'AI Scan Result'
            }}
          </h2>
          <p class="text-[11px] text-gray-500">
            Record ID:
            <span class="font-mono font-medium">#{{ record.uuid?.slice(0, 8) || 'RECORD' }}</span>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2.5">
        <span
          class="rounded-full px-2.5 py-1 text-xs font-bold"
          :style="{ backgroundColor: `${diseaseColor}15`, color: diseaseColor }"
        >
          {{ selectedDisease }}
        </span>
        <button
          type="button"
          @click="emit('close')"
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-95"
          aria-label="Close modal"
        >
          <Icon
            name="material-symbols:close-rounded"
            class="text-xl"
          />
        </button>
      </div>
    </div>

    <!-- Scrollable Content Body with Custom Scrollbar Inside -->
    <div class="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-6 py-5 sm:px-7 sm:py-6">
      <!-- Primary Overview Card -->
      <div class="flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-3.5">
        <!-- Lesion Image Thumbnail (if available) -->
        <div
          v-if="record.image_path"
          class="group relative shrink-0"
        >
          <NuxtImg
            :src="getStorageUrl(record.image_path)"
            class="h-20 w-20 cursor-pointer rounded-xl border border-gray-200/80 object-cover shadow-2xs transition-transform group-hover:scale-105"
            alt="Lesion Scan"
            @click="isImageExpanded = true"
          />
          <div
            class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Icon
              name="solar:magnifer-zoom-in-bold"
              class="text-lg text-white"
            />
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <span class="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
            {{ record.type === 'doctor_diagnosis' ? 'Diagnosed Condition' : 'Primary Detection' }}
          </span>
          <h3 class="truncate text-base leading-tight font-bold text-gray-900 sm:text-lg">
            {{ record.label || record.title }}
          </h3>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <span
              v-if="activeConfidence && !(isPatientView && isAppealed)"
              class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :style="{ backgroundColor: `${diseaseColor}15`, color: diseaseColor }"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :style="{ backgroundColor: diseaseColor }"
              ></span>
              {{ activeConfidence }}% Confidence
            </span>
            <span class="text-[11px] text-gray-500">
              {{ formatDate(record.created_at) }}
            </span>
            <span
              v-if="record.patient"
              class="text-[11px] text-gray-400"
            >
              • Patient: {{ record.patient.first_name }} {{ record.patient.last_name }}
            </span>
          </div>
        </div>
      </div>

      <!-- Probability Distribution & Interactive Disease Selector -->
      <div
        v-if="probabilityList.length > 0 && !(isPatientView && isAppealed)"
        class="rounded-2xl border border-gray-100 bg-white p-4 shadow-2xs"
      >
        <div class="mb-3 flex items-center justify-between">
          <div>
            <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              AI Probability Breakdown
            </span>
            <p class="text-[11px] text-gray-500">
              Click any condition to view its specific clinical profile and symptoms.
            </p>
          </div>
          <span class="text-[10px] font-semibold text-gray-400">
            {{ probabilityList.length }} Analyzed
          </span>
        </div>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div
            v-for="item in probabilityList"
            :key="item.label"
            @click="selectedDisease = item.label"
            class="flex cursor-pointer items-center justify-between gap-2.5 rounded-xl border p-2.5 transition-all"
            :class="
              selectedDisease === item.label
                ? 'border-indigo-500/50 bg-indigo-50/60 shadow-2xs'
                : 'border-gray-100 bg-gray-50/40 hover:border-gray-200 hover:bg-gray-50'
            "
          >
            <div class="flex min-w-0 items-center gap-2">
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                :style="{ backgroundColor: item.color }"
              ></span>
              <span
                class="truncate text-xs font-bold"
                :class="selectedDisease === item.label ? 'text-indigo-900' : 'text-gray-700'"
              >
                {{ item.label }}
              </span>
            </div>
            <span
              class="text-xs font-black"
              :class="selectedDisease === item.label ? 'text-indigo-700' : 'text-gray-900'"
            >
              {{ item.value }}%
            </span>
          </div>
        </div>
      </div>

      <!-- Doctor Clinical Assessment Section (when doctor notes exist) -->
      <template
        v-if="record.type === 'doctor_diagnosis' || record.clinical_note || prescriptionText"
      >
        <!-- Doctor Card -->
        <div
          v-if="record.doctor"
          class="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-2xs"
        >
          <img
            :src="record.doctor.avatar_path ? getStorageUrl(record.doctor.avatar_path) : ''"
            :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((record.doctor.first_name || 'D') + '+' + (record.doctor.last_name || 'r'))}&background=7B5EF5&color=fff&size=128'`"
            class="h-10 w-10 rounded-xl object-cover"
            alt="Doctor photo"
          />
          <div class="min-w-0 flex-1 text-xs">
            <p class="font-semibold text-gray-900">
              Dr. {{ record.doctor.first_name }} {{ record.doctor.last_name }}
            </p>
            <p
              v-if="record.doctor.affiliation"
              class="truncate text-[11px] text-gray-500"
            >
              {{ record.doctor.affiliation }}
            </p>
          </div>
        </div>

        <!-- Prescription -->
        <div
          v-if="prescriptionText"
          class="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs"
        >
          <div class="mb-2 flex items-center gap-1.5 font-semibold text-gray-900">
            <Icon
              name="material-symbols:prescriptions-outline-rounded"
              size="18"
              class="text-indigo-600"
            />
            <span class="text-xs font-bold tracking-wider uppercase">Prescription</span>
          </div>
          <div
            class="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-800 select-text"
          >
            {{ prescriptionText }}
          </div>
        </div>

        <!-- Clinical Notes Summary -->
        <div
          v-if="record.clinical_note"
          class="space-y-2.5 rounded-2xl border border-gray-100 bg-white p-3.5 text-xs shadow-2xs"
        >
          <div v-if="record.clinical_note.final_diagnosis">
            <p class="font-semibold text-gray-800">Final Diagnosis:</p>
            <p class="mt-0.5 leading-relaxed text-gray-600">
              {{ record.clinical_note.final_diagnosis }}
            </p>
          </div>
          <div v-if="record.clinical_note.patient_education">
            <p class="font-semibold text-gray-800">Patient Education:</p>
            <p class="mt-0.5 leading-relaxed text-gray-600">
              {{ record.clinical_note.patient_education }}
            </p>
          </div>
          <div
            v-if="
              record.clinical_note.follow_up_instructions || record.clinical_note.follow_up_date
            "
          >
            <p class="font-semibold text-gray-800">Follow-up:</p>
            <p
              v-if="record.clinical_note.follow_up_date"
              class="mt-0.5 text-gray-600"
            >
              Date: {{ record.clinical_note.follow_up_date }}
            </p>
            <p
              v-if="record.clinical_note.follow_up_instructions"
              class="mt-0.5 text-gray-600"
            >
              {{ record.clinical_note.follow_up_instructions }}
            </p>
          </div>
        </div>
      </template>

      <!-- Clinical Overview & Understanding -->
      <div
        v-if="activeDiseaseInfo"
        class="rounded-2xl border border-gray-100 bg-white p-4 text-xs shadow-2xs"
      >
        <div class="mb-2 flex items-center gap-2">
          <div
            class="h-3 w-1.5 rounded-full"
            :style="{ backgroundColor: diseaseColor }"
          ></div>
          <span class="text-xs font-bold tracking-wider text-gray-800 uppercase">
            Clinical Overview — {{ selectedDisease }}
          </span>
        </div>
        <p class="leading-relaxed text-gray-600">
          {{ activeDiseaseInfo.description }}
        </p>

        <!-- Dynamic Key Clinical Characteristics (Patient Side Only) -->
        <div
          v-if="isPatientView"
          class="mt-4 border-t border-gray-100 pt-3.5"
        >
          <div class="mb-3 flex items-center justify-between">
            <div>
              <span class="text-[10px] font-bold tracking-wider text-indigo-700 uppercase">
                Everyday Skin Guide
              </span>
              <p class="text-[10px] text-gray-400">
                Simple, easy-to-understand features of {{ selectedDisease }}.
              </p>
            </div>
            <span class="text-[10px] font-semibold text-gray-400">
              {{ selectedDisease }} Guide
            </span>
          </div>

          <!-- Only display the 5 characteristics cards for our 3 main conditions: Acne, Eczema, Herpes -->
          <div
            v-if="
              ['Acne', 'Eczema', 'Herpes'].includes(selectedDisease) &&
              activeDiseaseInfo?.characteristics
            "
            class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
          >
            <!-- What It Looks Like -->
            <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
              <div class="mb-1 flex items-center gap-1.5 text-indigo-600">
                <Icon
                  name="lucide:shapes"
                  class="text-xs"
                />
                <span class="text-[10px] font-bold tracking-wider text-gray-500 uppercase"
                  >What It Looks Like</span
                >
              </div>
              <p class="text-[11px] leading-snug font-medium text-gray-800">
                {{ activeDiseaseInfo.characteristics.lesionType }}
              </p>
            </div>

            <!-- Where It Shows Up -->
            <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
              <div class="mb-1 flex items-center gap-1.5 text-emerald-600">
                <Icon
                  name="lucide:map-pin"
                  class="text-xs"
                />
                <span class="text-[10px] font-bold tracking-wider text-gray-500 uppercase"
                  >Where It Shows Up</span
                >
              </div>
              <p class="text-[11px] leading-snug font-medium text-gray-800">
                {{ activeDiseaseInfo.characteristics.distribution }}
              </p>
            </div>

            <!-- How It Feels to Touch -->
            <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
              <div class="mb-1 flex items-center gap-1.5 text-amber-600">
                <Icon
                  name="lucide:fingerprint"
                  class="text-xs"
                />
                <span class="text-[10px] font-bold tracking-wider text-gray-500 uppercase"
                  >How It Feels to Touch</span
                >
              </div>
              <p class="text-[11px] leading-snug font-medium text-gray-800">
                {{ activeDiseaseInfo.characteristics.texture }}
              </p>
            </div>

            <!-- What You Might Feel -->
            <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
              <div class="mb-1 flex items-center gap-1.5 text-rose-600">
                <Icon
                  name="lucide:flame"
                  class="text-xs"
                />
                <span class="text-[10px] font-bold tracking-wider text-gray-500 uppercase"
                  >What You Might Feel</span
                >
              </div>
              <p class="text-[11px] leading-snug font-medium text-gray-800">
                {{ activeDiseaseInfo.characteristics.sensation }}
              </p>
            </div>

            <!-- How It Starts & Heals -->
            <div
              class="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 sm:col-span-2 lg:col-span-2"
            >
              <div class="mb-1 flex items-center gap-1.5 text-purple-600">
                <Icon
                  name="lucide:activity"
                  class="text-xs"
                />
                <span class="text-[10px] font-bold tracking-wider text-gray-500 uppercase"
                  >How It Starts & Heals</span
                >
              </div>
              <p class="text-[11px] leading-snug font-medium text-gray-800">
                {{ activeDiseaseInfo.characteristics.progression }}
              </p>
            </div>
          </div>

          <!-- Outside Main 3 Conditions: Friendly Message -->
          <div
            v-else
            class="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-amber-900"
          >
            <div
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"
            >
              <Icon
                name="solar:info-circle-bold"
                class="text-base"
              />
            </div>
            <div class="space-y-0.5">
              <h4 class="text-xs font-bold text-amber-900">Outside Our 3 Main Conditions</h4>
              <p class="text-[11px] leading-relaxed text-amber-800/90">
                This result is not one of our 3 main focus conditions (Acne, Eczema, or Herpes).
                Detailed characteristics are only available for our 3 primary conditions. Please
                consult a licensed doctor or dermatologist for personal guidance.
              </p>
            </div>
          </div>
        </div>

        <!-- Common Symptoms Grid -->
        <div
          v-if="activeDiseaseInfo.symptoms && activeDiseaseInfo.symptoms.length > 0"
          class="mt-4 border-t border-gray-100 pt-3"
        >
          <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Common Symptoms
          </span>
          <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div
              v-for="(symptom, i) in activeDiseaseInfo.symptoms"
              :key="i"
              class="flex items-start gap-2"
            >
              <span
                class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                :style="{ backgroundColor: diseaseColor }"
              ></span>
              <span
                class="leading-snug text-gray-600"
                v-html="formatListText(symptom)"
              ></span>
            </div>
          </div>
        </div>

        <!-- General Guidelines -->
        <div
          v-if="activeDiseaseInfo.guidelines && activeDiseaseInfo.guidelines.length > 0"
          class="mt-3 border-t border-gray-100 pt-2.5"
        >
          <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Care Guidelines
          </span>
          <ul class="mt-1.5 list-inside list-disc space-y-1 text-gray-600">
            <li
              v-for="(guide, i) in activeDiseaseInfo.guidelines"
              :key="i"
              class="leading-snug"
            >
              {{ guide }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Footer Actions (Non-scrollable, pinned at bottom) -->
    <div
      class="flex shrink-0 items-center justify-between border-t border-gray-100 bg-white px-6 py-3.5 sm:px-7 sm:py-4"
    >
      <div class="flex items-center gap-2">
        <AppButton
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          :disabled="isDownloadingPdf"
          @click="handleExportPdf"
          class="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-gray-800 active:scale-95 disabled:opacity-50"
        >
          <Icon
            :name="isDownloadingPdf ? 'svg-spinners:ring-resize' : 'solar:file-download-bold'"
            size="14"
          />
          <span>{{ isDownloadingPdf ? 'Generating PDF...' : 'Export PDF Report' }}</span>
        </AppButton>
      </div>

      <button
        type="button"
        @click="emit('close')"
        class="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-100"
      >
        Close
      </button>
    </div>
  </div>

  <!-- Expanded Image Lightbox -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-300"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isImageExpanded"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-8"
        @click="isImageExpanded = false"
      >
        <button
          type="button"
          @click="isImageExpanded = false"
          class="group absolute top-6 right-6 z-10 rounded-full bg-white/10 p-3 transition-all hover:bg-white/20 active:scale-90"
        >
          <Icon
            name="material-symbols:close-rounded"
            class="text-3xl text-white"
          />
        </button>
        <NuxtImg
          :src="getStorageUrl(record.image_path)"
          class="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
          alt="Scan Image Expanded"
          @click.stop
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 9999px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
</style>
