<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DonutEntry } from '../DonutChart.vue'

const userName = useCookie('user_name')

const props = defineProps<{
  conditionName?: string
  patientName?: string
  age?: number | string
  date?: string
  description?: string
  symptoms?: string[]
  causes?: string[]
  diagnosisData?: DonutEntry[]
  doctor?: {
    name: string
    photo?: string
    hospital?: string
    location?: string
    summary?: string
  }
}>()

defineEmits(['close'])

// ── Disease database ──────────────────────────────────────────────
const diseases = {
  Eczema: {
    description: 'also known as atopic dermatitis, is a chronic skin condition characterized by patches of skin that become inflamed, itchy, cracked, and rough. It is not contagious, but it can be persistent and often flares up periodically.',
    symptoms: [
      'Intense Itching: Often the most burdensome symptom, which can lead to sleep disruption.',
      'Dry, Sensitive Skin: The skin may feel tight or look scaly.',
      'Discoloration: On lighter skin, it often appears red or pink. On darker skin, it may look brown, purple, or gray.',
      'Texture Changes: Small, raised bumps may leak fluid when scratched, or the skin may thicken and become leathery.'
    ],
    causes: [
      'Genetics: It often runs in families, especially those with a history of asthma or hay fever.',
      'Immune System: An overactive immune response to small triggers.',
      'Environmental Triggers: Things like harsh soaps, detergents, stress, weather changes, or certain fabrics like wool.'
    ],
    color: '#7B5EF5'
  },
  Acne: {
    description: 'is a common skin condition that occurs when hair follicles become clogged with oil and dead skin cells. It causes whiteheads, blackheads, or pimples and is most common among teenagers, though it affects people of all ages.',
    symptoms: [
      'Whiteheads: Closed clogged pores that appear as small white bumps on the skin.',
      'Blackheads: Open clogged pores that turn dark due to oxidation on the surface.',
      'Papules: Small, red, tender bumps that signal inflammation or infection.',
      'Nodules and Cysts: Large, solid, painful lumps deep in the skin that can cause scarring.'
    ],
    causes: [
      'Excess Oil Production: Sebaceous glands producing too much sebum can clog pores.',
      'Bacteria: Propionibacterium acnes bacteria on the skin can trigger inflammation.',
      'Hormonal Changes: Androgens that increase during puberty, pregnancy, or stress can enlarge sebaceous glands.'
    ],
    color: '#E53935'
  },
  Herpes: {
    description: 'HSV (Herpes Simplex Virus) is a common viral infection that causes sores on the mouth or genitals. HSV-1 typically causes oral herpes while HSV-2 causes genital herpes. The virus remains dormant in the body and can reactivate periodically.',
    symptoms: [
      'Cold Sores or Blisters: Fluid-filled blisters around the mouth, lips, or genitals that can break and crust over.',
      'Pain and Itching: Tingling, itching, or burning sensations often precede the appearance of sores.',
      'Flu-like Symptoms: During the first outbreak, fever, swollen lymph nodes, and body aches may occur.',
      'Recurrent Outbreaks: The virus reactivates periodically, often triggered by stress, illness, or sun exposure.'
    ],
    causes: [
      'HSV-1 Transmission: Spread through oral contact such as kissing or sharing utensils with an infected person.',
      'HSV-2 Transmission: Primarily spread through sexual contact with an infected individual.',
      'Reactivation Triggers: Stress, weakened immune system, fever, or prolonged sun exposure can trigger outbreaks.'
    ],
    color: '#4FC3F7'
  }
}

type DiseaseName = keyof typeof diseases

const defaultChartData: DonutEntry[] = [
  { label: 'Herpes', value: 5, color: '#4FC3F7' },
  { label: 'Acne', value: 20, color: '#E53935' },
  { label: 'Eczema', value: 75, color: '#7B5EF5' }
]

// ── Active disease state ──────────────────────────────────────────
const activeDisease = ref<DiseaseName>((props.conditionName as DiseaseName) || 'Eczema')

const currentDisease = computed(() => diseases[activeDisease.value])

const displaySymptoms = computed(() => props.symptoms ?? currentDisease.value.symptoms)
const displayCauses = computed(() => props.causes ?? currentDisease.value.causes)
const displayChartData = computed(() => props.diagnosisData ?? defaultChartData)
const filterPills = computed(() =>
  displayChartData.value.filter(e => e.label !== activeDisease.value)
)
</script>

<template>
  <div class="flex h-[100vh] overflow-hidden rounded-3xl">

    <!-- Left Column -->
    <div class="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-8 pr-6">
      <h1 class="text-4xl font-black text-foreground mb-6">{{ activeDisease }}</h1>

      <div class="flex flex-col gap-1 mb-8">
        <p class="text-base">
          <span class="font-bold">Patient Name:</span>
          <span class="ml-2">{{ patientName || userName || 'Guest User' }}</span>
        </p>
        <p class="text-base">
          <span class="font-bold">Age:</span>
          <span class="ml-2">{{ age || '--' }}</span>
        </p>
        <p class="text-base">
          <span class="font-bold">Date:</span>
          <span class="ml-2">{{ date || new Date().toLocaleDateString() }}</span>
        </p>
      </div>

      <div class="mb-6">
        <p class="text-base leading-relaxed">
          <span class="inline-flex items-center gap-2 mr-1">
            <span class="w-3 h-3 bg-primary rounded-full inline-block shrink-0"></span>
            <strong>{{ activeDisease }}</strong>
          </span>
          {{ description || currentDisease.description }}
        </p>
      </div>

      <div class="mb-6">
        <p class="font-semibold mb-2">Common Symptoms</p>
        <p class="text-sm text-gray-600 mb-2">The appearance can vary significantly depending on skin tone and severity:
        </p>
        <ul class="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li v-for="(symptom, i) in displaySymptoms" :key="i">{{ symptom }}</li>
        </ul>
      </div>

      <div class="mb-8">
        <p class="font-semibold mb-2">What Causes It?</p>
        <p class="text-sm text-gray-600 mb-2">Generally believed to be a combination of factors:</p>
        <ol class="text-sm text-gray-700 list-decimal pl-5 space-y-1">
          <li v-for="(cause, i) in displayCauses" :key="i">{{ cause }}</li>
        </ol>
      </div>

      <!-- Disease switcher pills -->
      <div class="flex gap-3 mt-auto pt-4">
        <button v-for="(entry, i) in displayChartData" :key="i" @click="activeDisease = entry.label as DiseaseName"
          class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors" :class="activeDisease === entry.label
            ? 'text-white shadow-md'
            : 'bg-gray-100 hover:bg-gray-200 cursor-pointer'"
          :style="activeDisease === entry.label ? { backgroundColor: entry.color } : {}">
          <span class="w-3 h-3 rounded-full shrink-0"
            :style="{ backgroundColor: activeDisease === entry.label ? 'white' : entry.color }"></span>
          <span>{{ entry.label }}</span>
          <Icon :name="activeDisease === entry.label ? 'material-symbols:check' : 'material-symbols:search'"
            class="text-base" :class="activeDisease === entry.label ? 'text-white' : 'text-gray-500'" />
        </button>
      </div>
    </div>

    <!-- Right Column -->
    <div
      class="w-[450px] lg:w-[600px] shrink-0 flex flex-col gap-6 p-8 pl-6 overflow-y-auto custom-scrollbar border-l border-gray-50">
      <div>
        <h2 class="text-2xl font-bold mb-4">Findings</h2>
        <div class="flex items-center justify-center gap-6">
          <AppDonutChart :data="displayChartData" :size="180" :stroke-width="30" />
          <div class="flex flex-col gap-3">
            <div v-for="(entry, i) in displayChartData" :key="i"
              class="flex items-center justify-between gap-4 p-2 rounded-xl transition-colors hover:bg-gray-50 group cursor-pointer"
              @click="activeDisease = entry.label as DiseaseName">
              <div class="flex items-center gap-2">
                <span class="w-4 h-4 rounded-full shrink-0" :style="{ backgroundColor: entry.color }"></span>
                <span class="text-base font-semibold"
                  :class="activeDisease === entry.label ? 'text-secondary' : 'text-foreground'">
                  {{ entry.value }}% {{ entry.label }}
                </span>
              </div>
              <button class="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                :class="activeDisease === entry.label ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-600'">
                <Icon :name="activeDisease === entry.label ? 'material-symbols:check' : 'material-symbols:search'"
                  class="text-lg" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-card rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
        <h3 class="text-xl font-bold">Referred Doctor</h3>
        <div class="flex gap-4">
          <div class="shrink-0 border-2 p-3 rounded-2xl border-gray-200">
            <img :src="doctor?.photo || ''"
              onerror="this.src='https://ui-avatars.com/api/?name=Doctor&background=7B5EF5&color=fff&size=128'"
              class="w-45 h-28 object-cover rounded-xl" alt="Doctor photo" />
            <p class="text-xs text-gray-500 mt-1">{{ doctor?.hospital || 'Davao Doctors Hospital' }}</p>
            <p class="text-md text-foreground leading-4">{{ doctor?.location || 'Blacktor' }}</p>
            <div class="flex justify-end gap-3 mt-7">
              <button
                class="w-10 h-10 rounded-full border border-primary flex items-center justify-center hover:bg-gray-50 transition-colors">
                <Icon name="material-symbols:call-outline" class="text-secondary text-lg" />
              </button>
              <button
                class="w-10 h-10 rounded-full border border-primary flex items-center justify-center hover:bg-gray-50 transition-colors">
                <Icon name="material-symbols:chat-outline" class="text-secondary text-lg" />
              </button>
            </div>
          </div>
          <div class="flex-1">
            <p class="text-sm font-bold mb-1">Professional Summary</p>
            <p class="text-xs text-gray-600 leading-relaxed">
              {{ doctor?.summary || `A leading expert in chronic inflammatory skin conditions with over 12 years of
              experience, recognized for a holistic approach combining traditional treatments with advanced diagnostic
              tools.` }}
            </p>
          </div>

        </div>



        <div class="flex gap-3 mt-1">
          <button
            class="flex-1 bg-primary-light text-gray-600 font-semibold rounded-full py-2.5 text-sm hover:opacity-90 transition-all active:scale-95">
            Select a Doctor
          </button>
          <button
            class="flex-1 bg-primary text-card font-semibold rounded-full py-2.5 text-sm hover:opacity-90 transition-all active:scale-95">
            Send Diagnosis
          </button>
        </div>
      </div>
    </div>

  </div>
</template>