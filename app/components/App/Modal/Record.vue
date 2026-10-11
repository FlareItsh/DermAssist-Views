<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { DISEASE_DATABASE, COLOR_MAP } from '~/composables/useDiagnosis'
  import { useStorage } from '~/composables/useStorage'

  const props = defineProps<{
    record: any
  }>()

  const emit = defineEmits(['close'])

  const userName = useCookie('user_name')
  const { getStorageUrl } = useStorage()
  const isImageExpanded = ref(false)

  const activeDiseaseInfo = computed(() => {
    if (!props.record) return null
    const label = props.record.label || props.record.title || 'None'
    return DISEASE_DATABASE[label] || DISEASE_DATABASE['None']
  })

  const diseaseColor = computed(() => {
    if (!props.record) return '#7B5EF5'
    const label = props.record.label
    return COLOR_MAP[label] || activeDiseaseInfo.value?.color || '#7B5EF5'
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
</script>

<template>
  <div class="flex flex-col gap-4 bg-white p-6 text-gray-900 sm:p-7">
    <!-- Header Row -->
    <div class="flex items-center justify-between border-b border-gray-100 pb-3.5">
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
    </div>

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
            v-if="record.confidence"
            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            :style="{ backgroundColor: `${diseaseColor}15`, color: diseaseColor }"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :style="{ backgroundColor: diseaseColor }"
            ></span>
            {{ Math.round(record.confidence * 100) }}% Confidence
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

    <!-- Probability Distribution (if AI scan with probabilities) -->
    <div
      v-if="probabilityList.length > 0 && record.type !== 'doctor_diagnosis'"
      class="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-2xs"
    >
      <div class="mb-2 flex items-center justify-between">
        <span class="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
          AI Probability Breakdown
        </span>
        <span class="text-[10px] text-gray-400">
          {{ probabilityList.length }} Conditions Analyzed
        </span>
      </div>
      <div class="flex flex-col gap-2">
        <div
          v-for="item in probabilityList"
          :key="item.label"
          class="flex items-center gap-2.5 text-xs"
        >
          <span class="w-20 truncate font-medium text-gray-700">{{ item.label }}</span>
          <div class="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              class="h-full rounded-full transition-all duration-500"
              :style="{ width: `${item.value}%`, backgroundColor: item.color }"
            ></div>
          </div>
          <span class="w-10 text-right font-bold text-gray-900">{{ item.value }}%</span>
        </div>
      </div>
    </div>

    <!-- Doctor Clinical Assessment View -->
    <template v-if="record.type === 'doctor_diagnosis'">
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

      <!-- Prescriptions & Plan Highlight -->
      <div
        v-if="record.clinical_note?.prescription"
        class="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-xs text-amber-950 shadow-2xs"
      >
        <div class="mb-1 flex items-center gap-1.5 font-semibold text-amber-900">
          <Icon
            name="material-symbols:prescriptions-outline-rounded"
            size="16"
            class="text-amber-700"
          />
          <span class="text-[10px] tracking-wider uppercase">Prescriptions & Plan</span>
        </div>
        <p class="leading-relaxed font-normal whitespace-pre-wrap">
          {{ record.clinical_note.prescription }}
        </p>
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
          v-if="record.clinical_note.follow_up_instructions || record.clinical_note.follow_up_date"
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

    <!-- AI Scan Knowledge Guidance -->
    <template v-else-if="activeDiseaseInfo">
      <div class="rounded-2xl border border-gray-100 bg-white p-3.5 text-xs shadow-2xs">
        <span class="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
          Clinical Overview
        </span>
        <p class="mt-1 leading-relaxed text-gray-600">
          {{ activeDiseaseInfo.description }}
        </p>

        <!-- Common Symptoms Grid -->
        <div
          v-if="activeDiseaseInfo.symptoms && activeDiseaseInfo.symptoms.length > 0"
          class="mt-3 border-t border-gray-100 pt-2.5"
        >
          <span class="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
            Common Symptoms
          </span>
          <div class="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
      </div>
    </template>

    <!-- Footer Actions -->
    <div class="flex items-center justify-between border-t border-gray-100 pt-3">
      <div class="flex items-center gap-2">
        <AppButton
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          class="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-gray-800 active:scale-95"
        >
          <Icon
            name="solar:printer-bold"
            size="14"
          />
          <span>Print Summary</span>
        </AppButton>
        <AppButton
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          class="inline-flex items-center gap-2 rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs transition-all hover:bg-gray-50 active:scale-95"
        >
          <Icon
            name="solar:share-bold"
            size="14"
          />
          <span>Share</span>
        </AppButton>
      </div>

      <button
        type="button"
        @click="emit('close')"
        class="rounded-xl px-4 py-2 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-100"
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
