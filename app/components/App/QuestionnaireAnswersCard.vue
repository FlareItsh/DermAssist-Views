<script setup lang="ts">
  import { computed } from 'vue'

  interface Props {
    diagnosis?: {
      label?: string
      confidence?: number
      original_ai_label?: string
      is_questionnaire_refined?: boolean
      questionnaire_answers?: Record<string, string>
      refined_label?: string
      refined_confidence?: number
      refined_probabilities?: Record<string, number>
      all_probabilities?: Record<string, number>
      probabilities?: Record<string, number>
      clinical_evidence?: string[]
    } | null
    allowRetake?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    diagnosis: null,
    allowRetake: true
  })

  const emit = defineEmits<{
    (e: 'retake'): void
  }>()

  // Dimension titles
  const DIMENSION_TITLES: Record<string, string> = {
    sensation: 'Primary Sensation',
    texture: 'Lesion Texture & Surface',
    progression: 'Timeline & Progression',
    distribution: 'Body Location & Distribution',
    triggers: 'Triggers & Environmental Factors',
    history: 'Personal & Family History',
    secretion: 'Fluid & Secretion'
  }

  // Dimension icons
  const DIMENSION_ICONS: Record<string, string> = {
    sensation: 'lucide:flame',
    texture: 'lucide:layers',
    progression: 'lucide:timer',
    distribution: 'lucide:map-pin',
    triggers: 'lucide:sparkles',
    history: 'lucide:dna',
    secretion: 'lucide:droplets'
  }

  // Option labels
  const OPTION_LABELS: Record<string, string> = {
    // Sensation
    itchy: 'Intense itching',
    burning_tingling: 'Tingling, burning, or prickling',
    tender_sore: 'Sore or tender pressure',
    painless: 'Painless / No sensation',
    // Texture
    pimples_clogged: 'Pimples or clogged bumps',
    rough_dry_scaly: 'Dry, rough, or flaky',
    clustered_blisters: 'Clustered tiny blisters',
    // Progression
    ongoing_breakouts: 'Ongoing daily breakouts',
    rapid_blister_cycle: 'Rapid cycle (1–2 weeks)',
    chronic_flares: 'Periodic flare-ups',
    // Distribution
    face_chest_back: 'Face, forehead, cheeks, chest, or upper back',
    flexural_creases: 'Inside elbows, behind knees, wrists, or neck',
    lips_vermilion_mucosa: 'Along lip border, mouth, or sensitive areas',
    single_isolated: 'Only in this single isolated spot',
    // Triggers
    oils_cosmetics_sweat: 'Skincare oils, cosmetics, sweat, or friction',
    cold_dry_air_soaps: 'Cold dry weather, hot baths, or harsh soaps',
    stress_sun_illness: 'Stress, physical exhaustion, sunlight, or fever',
    // History
    atopic_triad: 'Asthma, hay fever (allergies), or childhood eczema',
    previous_cold_sores: 'Previous cold sores or fever blisters',
    family_acne: 'Family history of persistent teen or adult acne',
    none: 'None of the above',
    // Secretion
    pus_thick: 'Thick white or yellowish pus',
    clear_fluid_blister: 'Tiny clear fluid bubbles that pop and crust',
    weeping_watery: 'Clear watery oozing across a raw patch',
    dry_no_fluid: 'Completely dry — no fluid, pus, or oozing',
    // Universal fallback
    unsure: "Patient marked 'Not sure'"
  }

  // Option specific icons
  const OPTION_ICONS: Record<string, string> = {
    itchy: 'lucide:flame',
    burning_tingling: 'lucide:zap',
    tender_sore: 'lucide:bandage',
    painless: 'lucide:shield-check',
    pimples_clogged: 'lucide:circle-dot',
    rough_dry_scaly: 'lucide:layers',
    clustered_blisters: 'lucide:droplets',
    ongoing_breakouts: 'lucide:refresh-cw',
    rapid_blister_cycle: 'lucide:timer',
    chronic_flares: 'lucide:trending-up',
    face_chest_back: 'lucide:user',
    flexural_creases: 'lucide:activity',
    lips_vermilion_mucosa: 'lucide:smile',
    single_isolated: 'lucide:map-pin',
    oils_cosmetics_sweat: 'lucide:sparkles',
    cold_dry_air_soaps: 'lucide:cloud-snow',
    stress_sun_illness: 'lucide:sun',
    atopic_triad: 'lucide:dna',
    previous_cold_sores: 'lucide:repeat',
    family_acne: 'lucide:users',
    none: 'lucide:shield',
    pus_thick: 'lucide:alert-circle',
    clear_fluid_blister: 'lucide:droplet',
    weeping_watery: 'lucide:waves',
    dry_no_fluid: 'lucide:feather',
    unsure: 'lucide:help-circle'
  }

  const formatOption = (val?: string) => {
    if (!val) return 'Not reported'
    if (OPTION_LABELS[val]) return OPTION_LABELS[val]
    return val
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  const getAnswerIcon = (key: string, val: string): string => {
    if (OPTION_ICONS[val]) return OPTION_ICONS[val]
    if (DIMENSION_ICONS[key]) return DIMENSION_ICONS[key]
    return 'lucide:check-circle-2'
  }

  const hasAnswers = computed(() => {
    return (
      props.diagnosis?.questionnaire_answers &&
      Object.keys(props.diagnosis.questionnaire_answers).length > 0
    )
  })

  const priorProbs = computed(() => {
    return props.diagnosis?.all_probabilities || props.diagnosis?.probabilities || {}
  })

  const refinedProbs = computed(() => {
    return props.diagnosis?.refined_probabilities || {}
  })

  const hasProbabilityComparison = computed(() => {
    return Object.keys(refinedProbs.value).length > 0 && Object.keys(priorProbs.value).length > 0
  })

  const handleRetakeClick = () => {
    emit('retake')
  }
</script>

<template>
  <div
    v-if="hasAnswers || diagnosis?.is_questionnaire_refined"
    class="border-border/80 bg-card overflow-hidden rounded-2xl border shadow-xs transition-all"
  >
    <!-- Header -->
    <div
      class="border-border/60 from-muted/30 to-card flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r p-4 sm:px-6"
    >
      <div class="flex items-center gap-2.5">
        <div class="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-xl">
          <Icon
            name="lucide:clipboard-check"
            class="h-4 w-4"
          />
        </div>
        <div>
          <h4 class="text-foreground text-sm font-bold tracking-tight">
            Reported Clinical Assessment & Anamnesis
          </h4>
          <p class="text-muted-foreground text-[11px]">
            Self-reported symptom answers verified via multimodal Bayesian updating
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span
          class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400"
        >
          <Icon
            name="lucide:sparkles"
            class="h-3.5 w-3.5"
          />
          Multimodal Bayesian Verified
        </span>

        <button
          v-if="allowRetake"
          type="button"
          class="text-primary hover:bg-primary/10 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors"
          @click="handleRetakeClick"
        >
          Retake
        </button>
      </div>
    </div>

    <div class="space-y-4 p-4 sm:p-6">
      <!-- Bayesian Probability Shift Comparison (if present) -->
      <div
        v-if="hasProbabilityComparison"
        class="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <!-- Prior Visual AI -->
        <div class="border-border/60 bg-muted/20 rounded-2xl border p-3.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground font-semibold">1. Visual AI Prior</span>
            <span class="text-foreground font-bold">
              {{ Math.round((diagnosis?.confidence ?? 0) * 100) }}%
            </span>
          </div>
          <p class="text-foreground mt-1 text-sm font-bold">
            {{ diagnosis?.original_ai_label || diagnosis?.label || 'Inconclusive' }}
          </p>
          <div class="mt-2 space-y-1">
            <div
              v-for="(val, cls) in priorProbs"
              :key="cls"
              class="flex items-center justify-between text-[11px]"
            >
              <span class="text-muted-foreground">{{ cls }}</span>
              <span class="font-medium">{{ Math.round(Number(val) * 100) }}%</span>
            </div>
          </div>
        </div>

        <!-- Refined Multimodal Posterior -->
        <div class="border-primary/30 bg-primary/5 rounded-2xl border p-3.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-primary font-bold">2. Refined Posterior</span>
            <span class="text-primary font-black">
              {{ Math.round((diagnosis?.refined_confidence ?? diagnosis?.confidence ?? 0) * 100) }}%
            </span>
          </div>
          <p class="text-foreground mt-1 text-sm font-black">
            {{ diagnosis?.refined_label || diagnosis?.label }}
          </p>
          <div class="mt-2 space-y-1">
            <div
              v-for="(val, cls) in refinedProbs"
              :key="cls"
              class="flex items-center justify-between text-[11px]"
            >
              <span class="text-muted-foreground font-medium">{{ cls }}</span>
              <span class="text-primary font-bold">{{ Math.round(Number(val) * 100) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Explainable Clinical Evidence (XAI) -->
      <div
        v-if="diagnosis?.clinical_evidence && diagnosis.clinical_evidence.length > 0"
        class="border-border/60 bg-muted/10 rounded-2xl border p-4"
      >
        <div class="text-foreground flex items-center gap-2 text-xs font-bold">
          <Icon
            name="lucide:sparkles"
            class="text-primary h-4 w-4"
          />
          Explainable Clinical Evidence (XAI)
        </div>
        <ul class="text-muted-foreground mt-2 space-y-1.5 text-xs leading-relaxed">
          <li
            v-for="(reason, idx) in diagnosis.clinical_evidence"
            :key="idx"
            class="flex items-start gap-2"
          >
            <span class="text-primary font-bold">•</span>
            <span>{{ reason }}</span>
          </li>
        </ul>
      </div>

      <!-- Answered Questionnaire Cards Grid -->
      <div v-if="hasAnswers">
        <h5 class="text-foreground text-xs font-bold tracking-wider uppercase">
          Your Reported Symptoms
        </h5>

        <div class="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div
            v-for="(ansKey, dimKey) in diagnosis?.questionnaire_answers"
            :key="dimKey"
            class="border-border/60 bg-card hover:border-border hover:bg-muted/10 flex items-start gap-3 rounded-xl border p-3 transition-colors"
          >
            <div
              class="bg-primary/10 text-primary mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            >
              <Icon
                :name="getAnswerIcon(String(dimKey), String(ansKey))"
                class="h-3.5 w-3.5"
              />
            </div>
            <div class="min-w-0 flex-1">
              <span
                class="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase"
              >
                {{ DIMENSION_TITLES[dimKey] || dimKey }}
              </span>
              <p class="text-foreground mt-0.5 text-xs font-bold">
                {{ formatOption(String(ansKey)) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
