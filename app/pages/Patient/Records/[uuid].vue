<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useRoute, navigateTo } from '#app'
  import { recordService, type RecordItem } from '~/api/record/RecordService'
  import { DISEASE_DATABASE, COLOR_MAP } from '~/composables/useDiagnosis'
  import { useStorage } from '~/composables/useStorage'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const route = useRoute()
  const uuid = computed(() => route.params.uuid as string)
  const { getStorageUrl } = useStorage()

  const activeRecordState = useState<any>('active_patient_record', () => null)
  const record = ref<RecordItem | any | null>(null)
  const isLoading = ref(true)
  const isImageExpanded = ref(false)

  const isAppealed = computed(() => {
    return Boolean(record.value?.is_appealed || record.value?.appeal)
  })

  const activeDiseaseInfo = computed(() => {
    if (!record.value) return null
    const label = record.value.label || record.value.title || 'None'
    return DISEASE_DATABASE[label] || DISEASE_DATABASE['None']
  })

  const diseaseColor = computed(() => {
    if (!record.value) return '#7B5EF5'
    const label = record.value.label
    return COLOR_MAP[label] || activeDiseaseInfo.value?.color || '#7B5EF5'
  })

  const probabilityList = computed(() => {
    if (!record.value?.probabilities) return []
    return Object.entries(record.value.probabilities)
      .map(([label, val]) => ({
        label,
        value: Math.round((val as number) * 100),
        color: COLOR_MAP[label] || '#94a3b8'
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
  })

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown Date'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const formatListText = (text: string) => {
    if (text.includes(':')) {
      const parts = text.split(':')
      return `<span class="font-medium text-gray-800">${parts[0]}:</span>${parts[1]}`
    }
    return text
  }

  const fetchRecord = async () => {
    if (
      activeRecordState.value &&
      (activeRecordState.value.uuid === uuid.value ||
        String(activeRecordState.value.id) === uuid.value)
    ) {
      record.value = activeRecordState.value
      isLoading.value = false
      return
    }

    isLoading.value = true
    try {
      const response = await recordService.getRecords()
      const records = (response as any).data || response || []
      const match = records.find((r: any) => r.uuid === uuid.value || String(r.id) === uuid.value)
      if (match) {
        record.value = match
        activeRecordState.value = match
      }
    } catch (e) {
      console.error('Failed to load record details:', e)
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    fetchRecord()
  })
</script>

<template>
  <div>
    <!-- Desktop Layout -->
    <div
      class="desktop-only flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm"
    >
      <!-- Header -->
      <header
        class="flex shrink-0 items-center justify-between border-b border-gray-100 px-10 py-4"
      >
        <AppButton
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          @click="navigateTo('/Patient/Records')"
          class="group hover:text-primary flex items-center gap-2 text-gray-500 transition-colors"
        >
          <div
            class="group-hover:bg-primary/10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 transition-colors"
          >
            <Icon
              name="material-symbols:arrow-back-rounded"
              class="text-lg"
            />
          </div>
          <span class="text-sm font-semibold">Back to Records</span>
        </AppButton>

        <span class="text-xs font-semibold text-gray-400">
          Record ID: #{{ record?.uuid?.slice(0, 8) || 'PENDING' }}
        </span>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto">
        <div
          v-if="isLoading"
          class="flex h-full items-center justify-center py-20"
        >
          <Icon
            name="svg-spinners:ring-resize"
            class="text-primary text-4xl"
          />
        </div>
        <AppModalRecord
          v-else-if="record"
          :record="record"
          role="patient"
          @close="navigateTo('/Patient/Records')"
        />
      </main>
    </div>

    <!-- Mobile Layout -->
    <div class="mobile-only flex flex-col gap-3.5 pb-8">
      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="flex items-center justify-center py-24"
      >
        <Icon
          name="svg-spinners:ring-resize"
          class="text-primary text-3xl"
        />
      </div>

      <!-- Record Found View -->
      <template v-else-if="record">
        <!-- Header Row -->
        <div class="mt-3 flex items-center justify-between">
          <h2 class="text-base font-semibold tracking-tight text-gray-900">Record Details</h2>
          <button
            @click="navigateTo('/Patient/Records')"
            class="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium transition-colors"
          >
            <Icon
              name="material-symbols:arrow-back-rounded"
              size="16"
            />
            Back
          </button>
        </div>

        <!-- Primary Overview Card -->
        <div
          class="flex items-center gap-3.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs"
        >
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            :style="{
              backgroundColor: `${diseaseColor}18`,
              color: diseaseColor
            }"
          >
            <Icon
              :name="
                record.type === 'doctor_diagnosis'
                  ? 'material-symbols:stethoscope-rounded'
                  : 'solar:shield-check-bold-duotone'
              "
              size="22"
            />
          </div>
          <div class="min-w-0 flex-1">
            <span class="text-[10px] font-medium tracking-wider text-gray-400 uppercase">
              {{ record.type === 'doctor_diagnosis' ? "Doctor's Assessment" : 'AI Scan Result' }}
            </span>
            <h3 class="truncate text-base leading-snug font-semibold text-gray-900">
              {{ record.label || record.title }}
            </h3>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <span
                v-if="record.confidence && !isAppealed"
                class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                :style="{
                  backgroundColor: `${diseaseColor}15`,
                  color: diseaseColor
                }"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :style="{ backgroundColor: diseaseColor }"
                ></span>
                {{ Math.round(record.confidence * 100) }}% Confidence
              </span>
              <span class="text-[11px] font-normal text-gray-500">
                {{ formatDate(record.created_at) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Attending Doctor / Metadata Card -->
        <div
          v-if="record.doctor"
          class="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xs"
        >
          <div class="relative shrink-0">
            <img
              :src="record.doctor.avatar_path ? getStorageUrl(record.doctor.avatar_path) : ''"
              :onerror="`this.src='https://ui-avatars.com/api/?name=${encodeURIComponent((record.doctor.first_name || 'D') + '+' + (record.doctor.last_name || 'r'))}&background=7B5EF5&color=fff&size=128'`"
              class="h-12 w-12 rounded-xl object-cover"
              alt="Doctor photo"
            />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-semibold text-gray-900">
              Dr. {{ record.doctor.first_name }} {{ record.doctor.last_name }}
            </p>
            <p
              v-if="record.doctor.affiliation"
              class="mt-0.5 truncate text-[11px] font-normal text-gray-500"
            >
              {{ record.doctor.affiliation }}
            </p>
          </div>
        </div>

        <!-- Doctor Clinical Notes (if available) -->
        <template v-if="record.type === 'doctor_diagnosis' && record.clinical_note">
          <!-- Prescriptions Card -->
          <div
            v-if="record.clinical_note.prescription"
            class="border-warning-border bg-warning-subtle flex flex-col gap-2 rounded-2xl border p-4 shadow-xs"
          >
            <div class="text-warning-text flex items-center gap-2">
              <Icon
                name="material-symbols:prescriptions-outline-rounded"
                size="18"
                class="text-warning"
              />
              <h4 class="text-warning-text text-xs font-semibold tracking-wider uppercase">
                Prescriptions & Plan
              </h4>
            </div>
            <p class="text-warning-text text-xs leading-relaxed font-normal whitespace-pre-wrap">
              {{ record.clinical_note.prescription }}
            </p>
          </div>

          <!-- Notes Card -->
          <div
            class="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs"
          >
            <h4 class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
              Clinical Assessment
            </h4>
            <div class="space-y-3 text-xs leading-relaxed">
              <div v-if="record.clinical_note.final_diagnosis">
                <p class="font-medium text-gray-800">Final Diagnosis:</p>
                <p class="mt-0.5 font-normal text-gray-600">
                  {{ record.clinical_note.final_diagnosis }}
                </p>
              </div>
              <div v-if="record.clinical_note.history_of_present_illness">
                <p class="font-medium text-gray-800">History of Present Illness:</p>
                <p class="mt-0.5 font-normal text-gray-600">
                  {{ record.clinical_note.history_of_present_illness }}
                </p>
              </div>
              <div v-if="record.clinical_note.physical_exam">
                <p class="font-medium text-gray-800">Physical Exam:</p>
                <p class="mt-0.5 font-normal text-gray-600">
                  {{ record.clinical_note.physical_exam }}
                </p>
              </div>
              <div v-if="record.clinical_note.patient_education">
                <p class="font-medium text-gray-800">Patient Education:</p>
                <p class="mt-0.5 font-normal text-gray-600">
                  {{ record.clinical_note.patient_education }}
                </p>
              </div>
              <div
                v-if="
                  record.clinical_note.follow_up_date || record.clinical_note.follow_up_instructions
                "
              >
                <p class="font-medium text-gray-800">Follow-up:</p>
                <p
                  v-if="record.clinical_note.follow_up_date"
                  class="mt-0.5 font-normal text-gray-600"
                >
                  Date: {{ record.clinical_note.follow_up_date }}
                </p>
                <p
                  v-if="record.clinical_note.follow_up_instructions"
                  class="mt-0.5 font-normal text-gray-600"
                >
                  {{ record.clinical_note.follow_up_instructions }}
                </p>
              </div>
            </div>
          </div>
        </template>

        <!-- Standard AI Scan Overview & Guidance -->
        <template v-else-if="activeDiseaseInfo">
          <div
            class="flex flex-col gap-3.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs"
          >
            <div>
              <h4 class="mb-1.5 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Clinical Overview
              </h4>
              <p class="text-xs leading-relaxed font-normal text-gray-600">
                {{ activeDiseaseInfo.description }}
              </p>
            </div>

            <!-- Symptoms Section -->
            <div
              v-if="activeDiseaseInfo.symptoms && activeDiseaseInfo.symptoms.length > 0"
              class="border-t border-gray-100 pt-3"
            >
              <h4 class="mb-2.5 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Common Symptoms
              </h4>
              <ul class="flex flex-col gap-2">
                <li
                  v-for="(symptom, i) in activeDiseaseInfo.symptoms"
                  :key="i"
                  class="flex items-start gap-2.5"
                >
                  <span
                    class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    :style="{ backgroundColor: diseaseColor }"
                  ></span>
                  <span
                    class="text-xs leading-relaxed font-normal text-gray-600"
                    v-html="formatListText(symptom)"
                  ></span>
                </li>
              </ul>
            </div>

            <!-- Causes Section -->
            <div
              v-if="activeDiseaseInfo.causes && activeDiseaseInfo.causes.length > 0"
              class="border-t border-gray-100 pt-3"
            >
              <h4 class="mb-2.5 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Potential Causes
              </h4>
              <ul class="flex flex-col gap-2">
                <li
                  v-for="(cause, i) in activeDiseaseInfo.causes"
                  :key="i"
                  class="flex items-start gap-2.5"
                >
                  <span
                    class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    :style="{ backgroundColor: diseaseColor }"
                  ></span>
                  <span
                    class="text-xs leading-relaxed font-normal text-gray-600"
                    v-html="formatListText(cause)"
                  ></span>
                </li>
              </ul>
            </div>
          </div>
        </template>

        <!-- Lesion Photograph (if available) -->
        <div
          v-if="record.image_path"
          class="flex flex-col gap-2.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs"
        >
          <h4 class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Captured Skin Photograph
          </h4>
          <div class="relative overflow-hidden rounded-xl border border-gray-100">
            <img
              :src="getStorageUrl(record.image_path)"
              class="h-48 w-full cursor-pointer object-cover transition-transform hover:scale-102"
              alt="Scan image"
              @click="isImageExpanded = true"
            />
            <div
              class="absolute right-2 bottom-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-white"
            >
              <Icon
                name="material-symbols:zoom-in-rounded"
                size="14"
              />
              <span>Tap to enlarge</span>
            </div>
          </div>
        </div>

        <!-- Diagnosis Probability Breakdown -->
        <div
          v-if="probabilityList.length > 0 && !isAppealed"
          class="flex flex-col gap-2.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs"
        >
          <h4 class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Diagnosis Probability
          </h4>
          <div class="mt-1 flex flex-col gap-2.5">
            <div
              v-for="entry in probabilityList"
              :key="entry.label"
              class="flex flex-col gap-1.5"
            >
              <div class="flex items-center justify-between text-xs font-medium">
                <span class="text-gray-700">{{ entry.label }}</span>
                <span
                  class="font-semibold"
                  :style="{ color: entry.color }"
                >
                  {{ entry.value }}%
                </span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :style="{ width: `${entry.value}%`, backgroundColor: entry.color }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Record Not Found View -->
      <div
        v-else
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <Icon
          name="material-symbols:error-outline-rounded"
          size="40"
          class="mb-2 text-gray-300"
        />
        <p class="text-sm font-semibold text-gray-700">Record not found</p>
        <button
          @click="navigateTo('/Patient/Records')"
          class="text-primary mt-2 text-xs font-semibold hover:underline"
        >
          Return to Records
        </button>
      </div>
    </div>

    <!-- Image Lightbox Modal -->
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
          v-if="isImageExpanded && record?.image_path"
          class="fixed inset-0 z-999 flex items-center justify-center bg-black/85 p-4"
          @click="isImageExpanded = false"
        >
          <button
            @click="isImageExpanded = false"
            class="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <Icon
              name="material-symbols:close-rounded"
              size="22"
            />
          </button>
          <img
            :src="getStorageUrl(record.image_path)"
            class="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            alt="Expanded skin photo"
            @click.stop
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
  @media (min-width: 768px) {
    .mobile-only {
      display: none !important;
    }
  }
  @media (max-width: 767px) {
    .desktop-only {
      display: none !important;
    }
  }
</style>
