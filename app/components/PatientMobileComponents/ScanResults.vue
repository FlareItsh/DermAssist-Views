<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from '#app'
import { useDiagnosis, DISEASE_DATABASE } from '~/composables/useDiagnosis'

const router = useRouter()
const { currentDiagnosis, isHealthyState, chartData } = useDiagnosis()
const userName = useCookie('user_name')

const activeDiseaseLabel = computed(() => {
  if (!currentDiagnosis.value) return 'None'
  return currentDiagnosis.value.label
})

const activeDiseaseInfo = computed(() => {
  const label = activeDiseaseLabel.value
  return DISEASE_DATABASE[label] || DISEASE_DATABASE['None']
})

const confidencePercent = computed(() => {
  if (!currentDiagnosis.value) return 0
  return Math.round(currentDiagnosis.value.confidence * 100)
})

const formatListText = (text: string) => {
  if (text.includes(':')) {
    const parts = text.split(':')
    return `<strong>${parts[0]}:</strong>${parts[1]}`
  }
  return text
}
</script>

<template>
  <div class="px-4 flex flex-col gap-4 pb-20">
    <!-- Header Row -->
    <div class="flex items-center justify-between mt-4">
      <h2 class="text-foreground text-xl font-bold">Analysis Results</h2>
      <button
        @click="router.push('/Patient/Scan')"
        class="text-primary text-xs font-bold hover:underline flex items-center gap-1"
      >
        <Icon name="material-symbols:arrow-back-rounded" />
        Back
      </button>
    </div>

    <!-- Main Results Card -->
    <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col gap-4">
      
      <!-- Primary Condition Status -->
      <div class="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 border border-gray-100">
        <div
          class="h-12 w-12 rounded-full flex items-center justify-center text-white font-extrabold text-lg shadow-sm"
          :style="{ backgroundColor: activeDiseaseInfo.color || '#3b82f6' }"
        >
          <Icon name="solar:shield-warning-bold-duotone" size="24" />
        </div>
        <div class="flex-1 min-w-0">
          <span class="text-gray-400 text-[10px] font-black uppercase tracking-wider">Detected Condition</span>
          <h3 class="text-foreground text-lg font-black truncate leading-tight mt-0.5">
            {{ activeDiseaseLabel }}
          </h3>
          <p class="text-primary text-xs font-bold mt-1">
            Confidence: {{ confidencePercent }}%
          </p>
        </div>
      </div>

      <!-- Probability Distribution -->
      <div v-if="chartData && chartData.length > 0" class="flex flex-col gap-2 mt-1">
        <h4 class="text-foreground text-xs font-extrabold uppercase tracking-wide text-gray-400">Diagnosis Probability</h4>
        <div class="flex flex-col gap-3 mt-1">
          <div v-for="entry in chartData" :key="entry.label" class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs font-bold">
              <span class="text-foreground">{{ entry.label }}</span>
              <span :style="{ color: entry.color }">{{ entry.value }}%</span>
            </div>
            <div class="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :style="{ width: `${entry.value}%`, backgroundColor: entry.color }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Clinical Understanding Description -->
      <div class="mt-2 border-t border-gray-100 pt-4">
        <h4 class="text-foreground text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2">Clinical Understanding</h4>
        <p class="text-gray-600 text-sm leading-relaxed font-semibold">
          {{ activeDiseaseInfo.description }}
        </p>
      </div>

      <!-- Symptoms Section -->
      <div v-if="activeDiseaseInfo.symptoms && activeDiseaseInfo.symptoms.length > 0" class="border-t border-gray-100 pt-4">
        <h4 class="text-foreground text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-3">Common Symptoms</h4>
        <ul class="flex flex-col gap-2.5">
          <li
            v-for="(symptom, i) in activeDiseaseInfo.symptoms"
            :key="i"
            class="flex items-start gap-3"
          >
            <div class="h-5 w-5 rounded-md bg-[#22c55e]/10 text-[#22c55e] flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="material-symbols:check-small-rounded" size="18" />
            </div>
            <span class="text-gray-600 text-xs leading-relaxed font-medium" v-html="formatListText(symptom)"></span>
          </li>
        </ul>
      </div>

      <!-- Causes Section -->
      <div v-if="activeDiseaseInfo.causes && activeDiseaseInfo.causes.length > 0" class="border-t border-gray-100 pt-4">
        <h4 class="text-foreground text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-3">Potential Causes</h4>
        <ul class="flex flex-col gap-2.5">
          <li
            v-for="(cause, i) in activeDiseaseInfo.causes"
            :key="i"
            class="flex items-start gap-3"
          >
            <div class="h-5 w-5 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="material-symbols:info-outline-rounded" size="14" />
            </div>
            <span class="text-gray-600 text-xs leading-relaxed font-medium" v-html="formatListText(cause)"></span>
          </li>
        </ul>
      </div>

      <!-- Action Button (Consult Doctor) -->
      <div class="mt-4 flex flex-col gap-2">
        <button
          @click="router.push('/Patient')"
          class="w-full py-3.5 bg-primary text-white text-sm font-bold rounded-2xl shadow-md hover:bg-primary/95 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <Icon name="solar:user-speak-bold-duotone" size="18" />
          Consult Nearby Doctor
        </button>
      </div>

    </div>
  </div>
</template>
