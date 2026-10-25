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
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
        @click.self="handleClose"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          @click="handleClose"
        ></div>

        <!-- Modal Container -->
        <div
          class="modal-container bg-card border-border text-foreground relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border shadow-2xl transition-all"
        >
          <!-- Header -->
          <div class="border-border/60 bg-muted/20 relative border-b px-6 pt-6 pb-5 sm:px-8">
            <AppButton
              variant="ghost"
              size="icon"
              class="hover:bg-foreground/5 text-muted-foreground hover:text-foreground absolute top-5 right-5 z-10 h-8 w-8 rounded-full"
              :disabled="loading"
              @click="handleClose"
            >
              <Icon
                name="lucide:x"
                class="h-4 w-4"
              />
            </AppButton>

            <div class="flex items-center gap-3">
              <div
                class="bg-primary/10 text-primary ring-primary/20 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-4"
              >
                <Icon
                  name="lucide:clipboard-check"
                  class="h-5 w-5"
                />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="text-foreground text-base font-bold sm:text-lg">
                    Clinical Symptom Questionnaire
                  </h3>
                  <span
                    class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-black tracking-wider uppercase"
                  >
                    Bayesian CDSS
                  </span>
                </div>
                <p class="text-muted-foreground text-xs">
                  Verify your visual scan against medical history & physical sensations
                </p>
              </div>
            </div>

            <!-- Visual Prior Pill -->
            <div
              v-if="priorLabel"
              class="bg-card border-border/80 text-muted-foreground mt-3 flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-xs"
            >
              <span class="text-primary font-bold">Visual AI Prior:</span>
              <span class="text-foreground font-semibold">{{ priorLabel }}</span>
              <span class="text-muted-foreground/60">•</span>
              <span>{{ Math.round(priorConfidence * 100) }}% confidence</span>
            </div>

            <!-- Progress Bar -->
            <div class="mt-4 flex items-center justify-between text-[11px] font-semibold">
              <span class="text-muted-foreground">
                Question {{ currentStep + 1 }} of {{ questions.length }}
              </span>
              <span class="text-primary">{{ progressPercentage }}%</span>
            </div>
            <div class="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
              <div
                class="bg-primary h-full rounded-full transition-all duration-300"
                :style="{ width: `${progressPercentage}%` }"
              ></div>
            </div>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-6 sm:p-8">
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
                      selectedAnswers[activeQuestion.id] === opt.id
                        ? 'bg-primary/20'
                        : 'bg-muted/60'
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
          </div>

          <!-- Footer Actions -->
          <div
            class="border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-3 border-t p-4 sm:px-8 sm:py-5"
          >
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
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .modal-enter-active,
  .modal-leave-active {
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
    transform: scale(0.97);
  }
</style>
