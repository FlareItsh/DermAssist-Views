<script setup lang="ts">
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'
  import { toast } from 'vue-sonner'

  interface QuestionOption {
    id: string
    label: string
    description: string
    icon: string
  }

  interface QuestionItem {
    id: string
    title: string
    question: string
    options: QuestionOption[]
  }

  interface Props {
    modelValue: boolean
    diagnosisUuid?: string
    priorLabel?: string
    priorConfidence?: number
    priorProbabilities?: Record<string, number>
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    diagnosisUuid: '',
    priorLabel: '',
    priorConfidence: 0,
    priorProbabilities: () => ({})
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'refined', result: any): void
  }>()

  const { setDiagnosis, currentDiagnosis, saveActiveDiagnosisState } = useDiagnosis()

  // State
  const loading = ref(false)
  const isFetchingQuestions = ref(false)
  const currentStep = ref(0)
  const questions = ref<QuestionItem[]>([])
  const selectedAnswers = ref<Record<string, string>>({})

  // Fallback default questions in case AI service is offline
  const DEFAULT_QUESTIONS: QuestionItem[] = [
    {
      id: 'sensation',
      title: 'Primary Sensation',
      question: 'What does this affected skin area primarily feel like?',
      options: [
        {
          id: 'itchy',
          label: 'Intense itching',
          description:
            'Severe, irritating itch that makes you want to scratch, especially at night or when warm',
          icon: '🔴'
        },
        {
          id: 'burning_tingling',
          label: 'Tingling, burning, or prickling',
          description: 'Hot, stinging, or electric tingling that started before the bumps appeared',
          icon: '⚡'
        },
        {
          id: 'tender_sore',
          label: 'Sore or tender pressure',
          description: 'Achy or tender when pressed or bumped, but does not constantly itch',
          icon: '🩹'
        },
        {
          id: 'painless',
          label: 'Painless / No sensation',
          description: 'Does not hurt, sting, or itch at all; only noticed visually',
          icon: '⚪'
        },
        {
          id: 'unsure',
          label: "I'm not sure",
          description: 'Hard to describe or varies throughout the day',
          icon: '❓'
        }
      ]
    },
    {
      id: 'texture',
      title: 'Lesion Texture & Surface',
      question: 'How does the surface of the skin feel when touched gently?',
      options: [
        {
          id: 'pimples_clogged',
          label: 'Pimples or clogged bumps',
          description: 'Raised red bumps, whiteheads, blackheads, or spots with white/yellow pus',
          icon: '🔴'
        },
        {
          id: 'rough_dry_scaly',
          label: 'Dry, rough, or flaky',
          description: 'Sandpaper-like, rough, scaly patches that feel tight or peel',
          icon: '🌾'
        },
        {
          id: 'clustered_blisters',
          label: 'Clustered tiny blisters',
          description:
            'A tight cluster of small, delicate bubbles filled with clear fluid that pop and crust',
          icon: '💧'
        },
        {
          id: 'unsure',
          label: "I'm not sure",
          description: 'Surface texture is indistinct or mixed',
          icon: '❓'
        }
      ]
    },
    {
      id: 'progression',
      title: 'Timeline & Progression',
      question: 'How has this condition developed over time?',
      options: [
        {
          id: 'ongoing_breakouts',
          label: 'Ongoing daily breakouts',
          description: 'New bumps appear continuously over weeks or months in oily areas',
          icon: '🔄'
        },
        {
          id: 'rapid_blister_cycle',
          label: 'Rapid cycle (1–2 weeks)',
          description:
            'Appeared suddenly, formed small sores, and is drying into scabs within 7–10 days',
          icon: '⚡'
        },
        {
          id: 'chronic_flares',
          label: 'Periodic flare-ups',
          description:
            'Comes and goes over months; calms down with moisturizing and flares up again',
          icon: '📈'
        },
        {
          id: 'unsure',
          label: "I'm not sure",
          description: 'First time observing or uncertain of onset',
          icon: '❓'
        }
      ]
    },
    {
      id: 'distribution',
      title: 'Body Location & Distribution',
      question: 'Where on your body is this or similar skin flare-ups located?',
      options: [
        {
          id: 'face_chest_back',
          label: 'Face, forehead, cheeks, chest, or upper back',
          description: 'Common on the T-zone, cheeks, jawline, upper chest, or shoulder blades',
          icon: '👤'
        },
        {
          id: 'flexural_creases',
          label: 'Inside elbows, behind knees, wrists, or neck',
          description: 'Inside creases of the arms, behind the knees, around the wrists, or hands',
          icon: '🦾'
        },
        {
          id: 'lips_vermilion_mucosa',
          label: 'Along the lip border, mouth, or sensitive areas',
          description:
            'Right along the edge of the lip (cold sore area) or sensitive personal areas',
          icon: '👄'
        },
        {
          id: 'single_isolated',
          label: 'Only in this single isolated spot',
          description: 'Nowhere else on the entire body',
          icon: '📍'
        },
        {
          id: 'unsure',
          label: "I'm not sure",
          description: 'Affects various unlisted regions',
          icon: '❓'
        }
      ]
    }
  ]

  // Computed
  const activeQuestion = computed<QuestionItem | null>(() => {
    if (!questions.value.length) return null
    return questions.value[currentStep.value] || null
  })

  const progressPercentage = computed(() => {
    if (!questions.value.length) return 0
    return Math.round(((currentStep.value + 1) / questions.value.length) * 100)
  })

  const isCurrentQuestionAnswered = computed(() => {
    if (!activeQuestion.value) return false
    return Boolean(selectedAnswers.value[activeQuestion.value.id])
  })

  const isLastStep = computed(() => {
    if (!questions.value.length) return false
    return currentStep.value === questions.value.length - 1
  })

  // Methods
  const fetchQuestions = async () => {
    if (!props.diagnosisUuid) {
      questions.value = DEFAULT_QUESTIONS
      return
    }

    isFetchingQuestions.value = true
    try {
      const response = await diagnosisService.getQuestionnaire(props.diagnosisUuid)
      if (
        response?.questions &&
        Array.isArray(response.questions) &&
        response.questions.length > 0
      ) {
        questions.value = response.questions
      } else {
        questions.value = DEFAULT_QUESTIONS
      }
    } catch (e) {
      console.warn('Failed to fetch dynamic questionnaire from API, using clinical fallback', e)
      questions.value = DEFAULT_QUESTIONS
    } finally {
      isFetchingQuestions.value = false
    }
  }

  const handleSelectOption = (questionId: string, optionId: string) => {
    selectedAnswers.value[questionId] = optionId
  }

  const handleNextStep = () => {
    if (currentStep.value < questions.value.length - 1) {
      currentStep.value++
    }
  }

  const handlePreviousStep = () => {
    if (currentStep.value > 0) {
      currentStep.value--
    }
  }

  const handleSkipCurrentQuestion = () => {
    if (!activeQuestion.value) return
    selectedAnswers.value[activeQuestion.value.id] = 'unsure'
    if (isLastStep.value) {
      handleCalculateRefinement()
    } else {
      handleNextStep()
    }
  }

  const handleClose = () => {
    if (loading.value) return
    emit('update:modelValue', false)
  }

  const handleCalculateRefinement = async () => {
    if (!props.diagnosisUuid) {
      toast.error('Unable to refine: Diagnosis UUID is missing.')
      return
    }

    loading.value = true
    try {
      const response = await diagnosisService.refineDiagnosis(
        props.diagnosisUuid,
        selectedAnswers.value
      )

      const updated = response?.data || response
      if (updated) {
        // Sync with useDiagnosis global state
        if (currentDiagnosis.value) {
          currentDiagnosis.value = {
            ...currentDiagnosis.value,
            is_questionnaire_refined: true,
            questionnaire_answers: selectedAnswers.value,
            refined_label: updated.refined_label,
            refined_confidence: updated.refined_confidence,
            refined_probabilities: updated.refined_probabilities,
            clinical_evidence: updated.clinical_evidence
          }
          saveActiveDiagnosisState()
        }

        toast.success('Diagnosis refined with multimodal Bayesian clinical evidence!')
        emit('refined', updated)
        emit('update:modelValue', false)
      }
    } catch (e: any) {
      console.error('Failed to calculate refinement', e)
      toast.error(e?.message || 'Failed to refine diagnosis. Please try again.')
    } finally {
      loading.value = false
    }
  }

  const detectedConditions = computed(() => {
    const rawProbs =
      props.priorProbabilities && Object.keys(props.priorProbabilities).length > 0
        ? props.priorProbabilities
        : currentDiagnosis.value?.all_probabilities || {}

    return Object.entries(rawProbs)
      .filter(([name]) => ['Acne', 'Eczema', 'Herpes'].includes(name))
      .map(([name, prob]) => ({
        name,
        percentage: Math.round(Number(prob) * 100),
        rawProb: Number(prob)
      }))
      .sort((a, b) => b.percentage - a.percentage)
  })

  const isContenderBattle = computed(() => {
    if (detectedConditions.value.length < 2) return false
    const top1 = detectedConditions.value[0]?.percentage ?? 0
    const top2 = detectedConditions.value[1]?.percentage ?? 0
    return Math.abs(top1 - top2) <= 20
  })

  const purposeExplanation = computed(() => {
    if (detectedConditions.value.length < 2) {
      return 'These symptom questions verify physical sensations against image features to enhance diagnostic accuracy.'
    }
    const top1 = detectedConditions.value[0]?.name
    const top2 = detectedConditions.value[1]?.name
    if (isContenderBattle.value) {
      return `Visual AI detected close competing patterns between ${top1} and ${top2}. These symptom questions mathematically separate them to establish a decisive diagnosis.`
    }
    return `Visual AI identified ${top1} as primary with minor overlapping features of ${top2}. These questions verify clinical history to maximize diagnostic confidence.`
  })

  watch(
    () => props.modelValue,
    visible => {
      if (visible) {
        currentStep.value = 0
        selectedAnswers.value = {}
        fetchQuestions()
      }
    },
    { immediate: true }
  )
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="Clinical Symptom Questionnaire"
    description="Verify your visual scan against medical history & physical sensations"
    size="xl"
    compact
    @update:model-value="emit('update:modelValue', $event)"
    @close="handleClose"
  >
    <!-- Visual AI Screened Conditions & Clarification Purpose Card -->
    <div
      v-if="detectedConditions.length > 0"
      class="bg-card border-border/80 -mt-1 mb-4 rounded-2xl border p-3.5 shadow-xs"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
          Visual AI Detected Conditions
        </span>
        <span
          class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold"
          :class="
            isContenderBattle
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-primary/10 text-primary'
          "
        >
          <Icon
            :name="isContenderBattle ? 'lucide:scale' : 'lucide:badge-check'"
            class="h-3 w-3"
          />
          {{
            isContenderBattle ? 'Differentiating Close Contenders' : 'Enhancing Diagnostic Accuracy'
          }}
        </span>
      </div>

      <!-- Condition Pills -->
      <div class="mt-2.5 flex flex-wrap items-center gap-2">
        <div
          v-for="(c, idx) in detectedConditions"
          :key="c.name"
          class="flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all"
          :class="[
            idx === 0
              ? 'border-primary/30 bg-primary/10 text-primary font-bold'
              : c.percentage >= 15
                ? 'border-border/80 bg-muted/40 text-foreground'
                : 'border-border/40 bg-muted/10 text-muted-foreground'
          ]"
        >
          <span
            class="h-2 w-2 rounded-full"
            :class="[
              c.name === 'Acne'
                ? 'bg-rose-500'
                : c.name === 'Eczema'
                  ? 'bg-amber-500'
                  : 'bg-purple-600'
            ]"
          ></span>
          <span>{{ c.name }}</span>
          <span class="font-mono text-[11px] font-bold opacity-80">{{ c.percentage }}%</span>
        </div>
      </div>

      <!-- Explanatory Context Note -->
      <p class="text-muted-foreground mt-2.5 text-[11px] leading-relaxed">
        <Icon
          name="lucide:info"
          class="text-primary mr-1 inline-block h-3.5 w-3.5 align-sub"
        />
        {{ purposeExplanation }}
      </p>
    </div>

    <!-- Fallback Visual Prior Pill if no distribution -->
    <div
      v-else-if="priorLabel"
      class="bg-card border-border/80 text-muted-foreground -mt-1 mb-3.5 flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-xs"
    >
      <span class="text-primary font-bold">Visual AI Prior:</span>
      <span class="text-foreground font-semibold">{{ priorLabel }}</span>
      <span class="text-muted-foreground/60">•</span>
      <span>{{ Math.round(priorConfidence * 100) }}% confidence</span>
    </div>

    <!-- Progress Bar -->
    <div class="mb-4">
      <div class="flex items-center justify-between text-[11px] font-semibold">
        <span class="text-muted-foreground">
          Question {{ currentStep + 1 }} of {{ questions.length }}
        </span>
        <span class="text-primary font-bold">{{ progressPercentage }}%</span>
      </div>
      <div class="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
        <div
          class="bg-primary h-full rounded-full transition-all duration-300"
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
    </div>

    <!-- Question Body -->
    <div
      v-if="isFetchingQuestions"
      class="flex flex-col items-center justify-center py-12 text-center"
    >
      <Icon
        name="lucide:loader-2"
        class="text-primary h-8 w-8 animate-spin"
      />
      <p class="text-muted-foreground mt-3 text-xs font-medium">
        Personalizing clinical questions based on scan priors...
      </p>
    </div>

    <div
      v-else-if="activeQuestion"
      class="space-y-4"
    >
      <div>
        <span class="text-primary text-[11px] font-bold tracking-wider uppercase">
          {{ activeQuestion.title }}
        </span>
        <h4 class="text-foreground mt-1 text-base font-bold sm:text-lg">
          {{ activeQuestion.question }}
        </h4>
      </div>

      <!-- Options Grid -->
      <div class="space-y-2.5 pt-1">
        <div
          v-for="opt in activeQuestion.options"
          :key="opt.id"
          class="group flex cursor-pointer items-start gap-3.5 rounded-2xl border p-3.5 transition-all duration-200"
          :class="[
            selectedAnswers[activeQuestion.id] === opt.id
              ? 'border-primary bg-primary/10 ring-primary/20 shadow-xs ring-2'
              : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40'
          ]"
          @click="handleSelectOption(activeQuestion.id, opt.id)"
        >
          <div
            class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-base"
            :class="[
              selectedAnswers[activeQuestion.id] === opt.id ? 'bg-primary/20' : 'bg-muted/60'
            ]"
          >
            {{ opt.icon }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between">
              <p
                class="text-xs font-bold transition-colors sm:text-sm"
                :class="[
                  selectedAnswers[activeQuestion.id] === opt.id
                    ? 'text-primary font-extrabold'
                    : 'text-foreground'
                ]"
              >
                {{ opt.label }}
              </p>
              <div
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all"
                :class="[
                  selectedAnswers[activeQuestion.id] === opt.id
                    ? 'border-primary bg-primary text-white'
                    : 'border-border/80 bg-card'
                ]"
              >
                <div
                  v-if="selectedAnswers[activeQuestion.id] === opt.id"
                  class="h-1.5 w-1.5 rounded-full bg-white"
                ></div>
              </div>
            </div>
            <p class="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
              {{ opt.description }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <AppButton
          variant="outline"
          size="sm"
          class="h-10 rounded-xl px-4 text-xs font-semibold"
          :disabled="loading || currentStep === 0"
          @click="handlePreviousStep"
        >
          <Icon
            name="lucide:arrow-left"
            class="mr-1.5 h-3.5 w-3.5"
          />
          Back
        </AppButton>

        <div class="flex items-center gap-2">
          <AppButton
            variant="ghost"
            size="sm"
            class="text-muted-foreground hover:text-foreground h-10 rounded-xl px-3 text-xs"
            :disabled="loading"
            @click="handleSkipCurrentQuestion"
          >
            Skip Question
          </AppButton>

          <AppButton
            v-if="!isLastStep"
            variant="primary"
            size="sm"
            class="h-10 rounded-xl px-5 text-xs font-bold"
            :disabled="loading || !isCurrentQuestionAnswered"
            @click="handleNextStep"
          >
            Next
            <Icon
              name="lucide:arrow-right"
              class="ml-1.5 h-3.5 w-3.5"
            />
          </AppButton>

          <AppButton
            v-else
            variant="primary"
            size="sm"
            class="h-10 rounded-xl px-6 text-xs font-black shadow-md"
            :disabled="loading"
            @click="handleCalculateRefinement"
          >
            <Icon
              v-if="loading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            <Icon
              v-else
              name="lucide:sparkles"
              class="mr-2 h-4 w-4"
            />
            Calculate Refinement
          </AppButton>
        </div>
      </div>
    </template>
  </AppModal>
</template>
