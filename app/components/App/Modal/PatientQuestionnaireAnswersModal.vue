<script setup lang="ts">
  interface Props {
    modelValue: boolean
    diagnosis?: {
      label?: string
      confidence?: number
      image_path?: string
      patient_name?: string
      patient_age?: number | string
      date?: string
      is_questionnaire_refined?: boolean
      questionnaire_answers?: Record<string, string>
      refined_label?: string
      refined_confidence?: number
      refined_probabilities?: Record<string, number>
      all_probabilities?: Record<string, number>
      probabilities?: Record<string, number>
      clinical_evidence?: string[]
      original_ai_label?: string
    } | null
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    diagnosis: null
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
  }>()

  const config = useRuntimeConfig()
  const getStorageUrl = (path?: string | null) => {
    if (!path) return ''
    if (path.startsWith('http')) return path
    const base = config.public.storageUrl || 'http://localhost:8000/storage'
    return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  }

  const handleClose = () => {
    emit('update:modelValue', false)
  }

  // Dimension label helper
  const DIMENSION_TITLES: Record<string, string> = {
    sensation: 'Primary Sensation',
    texture: 'Lesion Texture & Surface',
    progression: 'Timeline & Progression',
    distribution: 'Body Location & Distribution',
    triggers: 'Aggravating Triggers',
    history: 'Medical & Family History',
    secretion: 'Fluid & Secretion'
  }

  const DIMENSION_ICONS: Record<string, string> = {
    sensation: 'lucide:flame',
    texture: 'lucide:layers',
    progression: 'lucide:timer',
    distribution: 'lucide:map-pin',
    triggers: 'lucide:sparkles',
    history: 'lucide:dna',
    secretion: 'lucide:droplets'
  }

  const formatOptionLabel = (val?: string) => {
    if (!val) return 'Not reported'
    if (val === 'unsure') return "Patient marked 'Unsure'"
    return val
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  const priorProbs = computed(() => {
    return props.diagnosis?.all_probabilities || props.diagnosis?.probabilities || {}
  })

  const refinedProbs = computed(() => {
    return props.diagnosis?.refined_probabilities || {}
  })

  const hasAnswers = computed(() => {
    return (
      props.diagnosis?.is_questionnaire_refined &&
      props.diagnosis?.questionnaire_answers &&
      Object.keys(props.diagnosis.questionnaire_answers).length > 0
    )
  })
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="Patient Clinical Anamnesis"
    description="Patient self-reported history and mathematical Bayesian probability shifts"
    size="2xl"
    compact
    @update:model-value="emit('update:modelValue', $event)"
    @close="handleClose"
  >
    <div class="space-y-5">
      <!-- Patient Metadata Summary Card -->
      <div
        v-if="diagnosis"
        class="bg-card border-border/80 flex items-center gap-3.5 rounded-2xl border p-3 shadow-xs"
      >
        <img
          v-if="diagnosis.image_path"
          :src="getStorageUrl(diagnosis.image_path)"
          class="border-border h-12 w-12 shrink-0 rounded-xl border object-cover"
          alt="Scan photo"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-foreground truncate text-sm font-bold">
              {{ diagnosis.patient_name || 'Patient Scan' }}
            </h4>
            <span class="text-muted-foreground text-[11px] font-medium">
              {{ diagnosis.date }}
            </span>
          </div>
          <p class="text-muted-foreground mt-0.5 text-xs">
            {{
              diagnosis.patient_age != null && diagnosis.patient_age !== ''
                ? `${diagnosis.patient_age} years old • `
                : ''
            }}
            Final Label:
            <span class="text-primary font-bold">
              {{ diagnosis.refined_label || diagnosis.label }}
            </span>
            ({{ Math.round((diagnosis.refined_confidence ?? diagnosis.confidence ?? 0) * 100) }}%)
          </p>
        </div>
      </div>
      <!-- Mathematical Comparison (Prior vs Posterior) -->
      <div>
        <div class="flex items-center justify-between">
          <h5 class="text-foreground text-xs font-bold tracking-wider uppercase">
            Diagnostic Probability Evolution
          </h5>
          <span class="text-primary text-[11px] font-extrabold"> Bayesian Updating </span>
        </div>

        <div class="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <!-- Visual Prior -->
          <div class="border-border/60 bg-muted/20 rounded-2xl border p-3.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-muted-foreground font-semibold">1. Visual AI Prior</span>
              <span class="text-foreground font-bold">
                {{ Math.round((diagnosis?.confidence || 0) * 100) }}%
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

          <!-- Multimodal Posterior -->
          <div class="border-primary/30 bg-primary/5 rounded-2xl border p-3.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-primary font-bold">2. Refined Posterior</span>
              <span class="text-primary font-black">
                {{
                  Math.round((diagnosis?.refined_confidence ?? diagnosis?.confidence ?? 0) * 100)
                }}%
              </span>
            </div>
            <p class="text-foreground mt-1 text-sm font-black">
              {{ diagnosis?.refined_label || diagnosis?.label || 'Inconclusive' }}
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
      </div>

      <!-- Clinical Evidence (Explainable AI) -->
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

      <!-- Patient Answered Symptoms -->
      <div>
        <h5 class="text-foreground text-xs font-bold tracking-wider uppercase">
          Reported Patient History & Sensation
        </h5>

        <div
          v-if="hasAnswers"
          class="divide-border/60 border-border/60 mt-2.5 divide-y rounded-2xl border"
        >
          <div
            v-for="(ans, dimKey) in diagnosis!.questionnaire_answers"
            :key="dimKey"
            class="flex items-center justify-between gap-4 p-3.5 text-xs"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
              >
                <Icon
                  :name="DIMENSION_ICONS[String(dimKey)] || 'lucide:circle-dot'"
                  class="h-3.5 w-3.5"
                />
              </div>
              <span class="text-muted-foreground font-semibold">
                {{ DIMENSION_TITLES[dimKey] || dimKey }}
              </span>
            </div>
            <span class="text-foreground text-right font-bold">
              {{ formatOptionLabel(ans) }}
            </span>
          </div>
        </div>

        <div
          v-else
          class="border-border/60 bg-muted/20 text-muted-foreground mt-2.5 rounded-2xl border p-6 text-center text-xs"
        >
          <Icon
            name="lucide:info"
            class="mx-auto mb-2 h-5 w-5 opacity-50"
          />
          This scan was conducted as visual-only screening. The patient did not complete the
          optional clinical questionnaire.
        </div>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <div class="flex w-full items-center justify-end">
        <AppButton
          variant="outline"
          size="sm"
          class="h-9 rounded-xl px-5 text-xs font-bold"
          @click="handleClose"
        >
          Close
        </AppButton>
      </div>
    </template>
  </AppModal>
</template>
