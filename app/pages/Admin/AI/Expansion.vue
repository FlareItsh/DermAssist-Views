<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
  import {
    modelTrainingService,
    type ModelStatsResponse,
    type TrainingStatusResponse
  } from '~/api/modelTraining/ModelTrainingService'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  // Configuration & State
  const selectedExpansionDisease = ref<string>('psoriasis')
  const selectedEpochs = ref(5)
  const syncDataset = ref(true)
  const epochPresets = [3, 5, 10, 15, 20, 30]

  const adjustEpochs = (delta: number) => {
    if (isTrainingActive.value) return
    const current = Number(selectedEpochs.value) || 5
    selectedEpochs.value = Math.max(1, Math.min(100, current + delta))
  }

  const isLoadingStats = ref(false)
  const isStarting = ref(false)
  const isCancelling = ref(false)
  const isSyncing = ref(false)
  const stats = ref<ModelStatsResponse | null>(null)
  const trainingStatus = ref<TrainingStatusResponse | null>(null)
  const showCancelConfirm = ref(false)
  const showDatasetSlideover = ref(false)

  const logContainer = ref<HTMLElement | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const expansionDiseases = [
    {
      id: 'psoriasis',
      name: 'Psoriasis',
      category: 'Autoimmune',
      desc: 'Chronic autoimmune condition with scaly, erythematous plaques.',
      badge: 'High Priority',
      icon: 'lucide:flame'
    },
    {
      id: 'ringworm',
      name: 'Ringworm (Tinea)',
      category: 'Fungal Infection',
      desc: 'Annular dermatophyte lesions with characteristic raised borders.',
      badge: 'Common',
      icon: 'lucide:circle-dot'
    },
    {
      id: 'vitiligo',
      name: 'Vitiligo',
      category: 'Pigmentary Disorder',
      desc: 'Autoimmune destruction of melanocytes resulting in depigmented patches.',
      badge: 'Pigmentary',
      icon: 'lucide:sun'
    },
    {
      id: 'melanoma',
      name: 'Melanoma (Research)',
      category: 'Atypical Lesion',
      desc: 'Asymmetric pigmented lesions requiring careful boundary analysis.',
      badge: 'Critical',
      icon: 'lucide:alert-octagon'
    },
    {
      id: 'hives',
      name: 'Hives (Urticaria)',
      category: 'Allergic Reaction',
      desc: 'Transient pruritic edematous erythematous wheals and flares.',
      badge: 'Allergic',
      icon: 'lucide:wind'
    },
    {
      id: 'warts',
      name: 'Warts (HPV)',
      category: 'Viral Infection',
      desc: 'Hyperkeratotic verrucous exophytic papules caused by HPV.',
      badge: 'Viral',
      icon: 'lucide:shield-alert'
    },
    {
      id: 'lupus',
      name: 'Lupus Erythematosus',
      category: 'Autoimmune',
      desc: 'Cutaneous lupus lesions including discoid and malar photosensitive patterns.',
      badge: 'Autoimmune',
      icon: 'lucide:dna'
    },
    {
      id: 'rosacea',
      name: 'Rosacea',
      category: 'Vascular Condition',
      desc: 'Centrofacial erythema, telangiectasia, and inflammatory papulopustules.',
      badge: 'Vascular',
      icon: 'lucide:sparkles'
    }
  ]

  const isTrainingActive = computed(() => {
    const s = trainingStatus.value?.status
    return s === 'syncing' || s === 'training' || s === 'evaluating' || s === 'cancelling'
  })

  const isCancellingActive = computed(() => {
    return trainingStatus.value?.status === 'cancelling'
  })

  const getCandidateCount = (diseaseId: string) => {
    return stats.value?.out_of_scope_candidates?.by_category?.[diseaseId] ?? 0
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0s'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    if (m === 0) return `${s}s`
    return `${m}m ${s}s`
  }

  const fetchStats = async () => {
    isLoadingStats.value = true
    try {
      stats.value = await modelTrainingService.getStats()
    } catch (err: any) {
      console.error('Failed to load model stats:', err)
      toast.error('Could not connect to AI algorithm service.')
    } finally {
      isLoadingStats.value = false
    }
  }

  const pollStatus = async () => {
    try {
      const res = await modelTrainingService.getStatus()
      trainingStatus.value = res

      await nextTick()
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }

      if (
        res.status === 'completed' ||
        res.status === 'failed' ||
        res.status === 'cancelled' ||
        res.status === 'idle'
      ) {
        stopPolling()
        if (res.status === 'completed') {
          try {
            await modelTrainingService.markCompleted()
          } catch (e) {
            console.error('Failed to mark training completion timestamp', e)
          }
          fetchStats()
          if (res.model_promoted) {
            toast.success('Expansion training complete! Expanded models promoted to production.')
          } else {
            toast.info('Training complete. Baseline model preserved by Validation Guard.')
          }
        } else {
          fetchStats()
          if (res.status === 'failed') {
            toast.error(res.message || 'Training failed.')
          }
        }
      }
    } catch (err) {
      console.error('Failed to poll status:', err)
    }
  }

  const startPolling = () => {
    stopPolling()
    pollStatus()
    pollTimer = setInterval(pollStatus, 1200)
  }

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const handleStartExpansionTraining = async () => {
    isStarting.value = true
    try {
      await modelTrainingService.startTraining({
        architecture: 'ensemble',
        epochs: Number(selectedEpochs.value),
        sync_dataset: syncDataset.value,
        expansion_disease: selectedExpansionDisease.value
      })
      const diseaseName =
        expansionDiseases.find(d => d.id === selectedExpansionDisease.value)?.name ||
        selectedExpansionDisease.value
      toast.success(
        `Model expansion training started for +${diseaseName}! Baseline models safely archived.`
      )
      startPolling()
    } catch (err: any) {
      const msg =
        err.data?.message || err.data?.error || err.message || 'Failed to start expansion training.'
      toast.error(msg)
    } finally {
      isStarting.value = false
    }
  }

  const confirmCancelTraining = () => {
    showCancelConfirm.value = true
  }

  const handleExecuteCancel = async () => {
    isCancelling.value = true
    try {
      await modelTrainingService.cancelTraining()
      toast.info('Training cancellation requested.')
      showCancelConfirm.value = false
      await pollStatus()
      startPolling()
    } catch (err: any) {
      const errorMsg =
        err?.data?.message ||
        err?.data?.error ||
        err?.data?.detail ||
        err?.message ||
        'Failed to cancel training.'
      toast.error(errorMsg)
    } finally {
      isCancelling.value = false
    }
  }

  onMounted(() => {
    fetchStats()
    startPolling()
  })

  onBeforeUnmount(() => {
    stopPolling()
  })
</script>

<template>
  <div class="space-y-8 pb-16">
    <!-- Page Header -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <div class="mb-1 flex items-center gap-2.5">
          <h1 class="text-foreground text-2xl font-black md:text-3xl">Train with New Disease</h1>
          <AppBadge
            color="info"
            variant="subtle"
            size="sm"
            >Research to Production</AppBadge
          >
        </div>
        <p class="text-muted-foreground max-w-3xl text-sm">
          Expand baseline diagnostic AI models (<span class="text-foreground font-semibold"
            >Acne, Eczema, Herpes</span
          >) into an
          <span class="text-foreground font-semibold">expanded multi-disease model</span> using
          collected out-of-scope research scans.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <AppButton
          variant="outline"
          class="gap-2 font-medium"
          @click="showDatasetSlideover = true"
        >
          <Icon
            name="lucide:images"
            size="16"
          />
          Browse Research Scans
        </AppButton>

        <AppButton
          v-if="isTrainingActive"
          variant="destructive"
          class="gap-2 font-bold shadow-sm"
          :loading="isCancellingActive || isCancelling"
          :disabled="isCancellingActive || isCancelling"
          @click="confirmCancelTraining"
        >
          <Icon
            name="lucide:square"
            size="16"
          />
          {{ isCancellingActive ? 'Stopping...' : 'Stop Pipeline' }}
        </AppButton>
      </div>
    </div>

    <!-- Dual-Safekeeping Callout Banner -->
    <div
      class="flex flex-col justify-between gap-4 rounded-3xl border border-violet-500/20 bg-violet-500/10 p-5 md:flex-row md:items-center"
    >
      <div class="flex items-start gap-3.5">
        <div
          class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-600 dark:text-violet-400"
        >
          <Icon
            name="lucide:shield-check"
            size="22"
          />
        </div>
        <div>
          <h4 class="text-foreground flex items-center gap-2 text-sm font-bold">
            Dual-Safekeeping Checkpoint Guarantee Active
          </h4>
          <p class="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-relaxed">
            Training with a new disease automatically backs up your existing baseline models into
            <code class="text-foreground font-mono font-semibold"
              >models/production_3class_backup/</code
            >. The newly trained expanded weights are saved in
            <code class="text-foreground font-mono font-semibold">models/checkpoints_4class/</code>.
            Standard baseline retraining remains untouched and conflict-free.
          </p>
        </div>
      </div>

      <div
        class="text-muted-foreground bg-background/60 border-border flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 font-mono text-xs"
      >
        <Icon
          name="lucide:database"
          size="14"
          class="text-violet-500"
        />
        <span>{{ stats?.out_of_scope_candidates?.total ?? 0 }} Research Images in Pool</span>
      </div>
    </div>

    <!-- Main 2-Column Grid -->
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <!-- Left Column: Disease Selection & Configuration (7 cols) -->
      <div class="space-y-6 lg:col-span-7">
        <!-- Candidate Disease Selector Card -->
        <div class="bg-card border-border space-y-5 rounded-3xl border p-6 shadow-sm">
          <div class="border-border flex items-center justify-between border-b pb-3">
            <div>
              <h3 class="text-foreground flex items-center gap-2 text-base font-bold">
                <Icon
                  name="lucide:flask-conical"
                  size="18"
                  class="text-violet-500"
                />
                Select Candidate Disease (+1 Class)
              </h3>
              <p class="text-muted-foreground mt-0.5 text-xs">
                Choose the out-of-scope research category to integrate into the model.
              </p>
            </div>
            <AppBadge
              color="primary"
              size="sm"
              variant="subtle"
              >8 Available</AppBadge
            >
          </div>

          <!-- Disease Cards Grid -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              v-for="d in expansionDiseases"
              :key="d.id"
              class="flex cursor-pointer flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-200"
              :class="[
                selectedExpansionDisease === d.id
                  ? 'border-violet-500 bg-violet-500/10 shadow-xs ring-2 ring-violet-500/30'
                  : 'bg-background hover:bg-muted/40 border-border',
                isTrainingActive ? 'pointer-events-none cursor-not-allowed opacity-60' : ''
              ]"
              @click="selectedExpansionDisease = d.id"
            >
              <div class="space-y-1.5">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <div
                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      :class="
                        selectedExpansionDisease === d.id
                          ? 'bg-violet-500 text-white'
                          : 'bg-muted text-muted-foreground'
                      "
                    >
                      <Icon
                        :name="d.icon"
                        size="15"
                      />
                    </div>
                    <span class="text-foreground truncate text-sm font-bold">{{ d.name }}</span>
                  </div>
                  <AppBadge
                    size="sm"
                    :color="selectedExpansionDisease === d.id ? 'primary' : 'gray'"
                    variant="subtle"
                  >
                    {{ d.badge }}
                  </AppBadge>
                </div>
                <p class="text-muted-foreground text-[11px] leading-relaxed">
                  {{ d.desc }}
                </p>
              </div>

              <div class="border-border/60 flex items-center justify-between border-t pt-2 text-xs">
                <span class="text-muted-foreground text-[11px] font-medium">Research Scans</span>
                <span
                  class="rounded-md px-2 py-0.5 font-mono text-xs font-bold"
                  :class="
                    getCandidateCount(d.id) > 0
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  "
                >
                  {{ getCandidateCount(d.id) }} images
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Training Configuration Card -->
        <div class="bg-card border-border space-y-5 rounded-3xl border p-6 shadow-sm">
          <h3
            class="text-foreground border-border flex items-center gap-2 border-b pb-3 text-base font-bold"
          >
            <Icon
              name="lucide:sliders"
              size="18"
              class="text-primary"
            />
            Expansion Training Parameters
          </h3>

          <!-- Custom Editable Epoch Selection -->
          <div
            class="space-y-3"
            :class="{ 'opacity-60': isTrainingActive }"
          >
            <div class="flex items-center justify-between">
              <label
                class="text-muted-foreground block text-xs font-semibold tracking-wider uppercase"
              >
                Training Epochs (Per Backbone)
              </label>
              <span class="font-mono text-xs font-bold text-violet-600 dark:text-violet-400">
                {{ Number(selectedEpochs) || 5 }} Epochs / Backbone
              </span>
            </div>

            <!-- Custom Number Input with Stepper Buttons -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                :disabled="isTrainingActive || selectedEpochs <= 1"
                class="bg-background border-border text-foreground hover:bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                @click="adjustEpochs(-1)"
              >
                <Icon
                  name="lucide:minus"
                  size="16"
                />
              </button>

              <div class="relative flex-1">
                <input
                  v-model.number="selectedEpochs"
                  type="number"
                  min="1"
                  max="100"
                  :disabled="isTrainingActive"
                  class="bg-background border-border text-foreground w-full [appearance:textfield] rounded-xl border px-4 py-2 text-center font-mono text-base font-bold focus:ring-2 focus:ring-violet-500 focus:outline-none disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="Custom Epochs (1 - 100)"
                />
                <span
                  class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium"
                >
                  epochs
                </span>
              </div>

              <button
                type="button"
                :disabled="isTrainingActive || selectedEpochs >= 100"
                class="bg-background border-border text-foreground hover:bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                @click="adjustEpochs(1)"
              >
                <Icon
                  name="lucide:plus"
                  size="16"
                />
              </button>
            </div>

            <!-- Quick Preset Pills -->
            <div class="space-y-1.5 pt-0.5">
              <span class="text-muted-foreground text-[11px] font-semibold">Quick Presets:</span>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="ep in epochPresets"
                  :key="ep"
                  type="button"
                  :disabled="isTrainingActive"
                  class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all"
                  :class="[
                    Number(selectedEpochs) === ep
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-muted/70 hover:bg-muted text-foreground border-border/80 border',
                    isTrainingActive ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  ]"
                  @click="selectedEpochs = ep"
                >
                  {{ ep }} Epochs
                </button>
              </div>
            </div>

            <p class="text-muted-foreground text-[11px] leading-relaxed">
              All 3 ensemble backbones (Swin, ResNet50, EfficientNet-V2) will each run for
              <strong class="text-foreground font-semibold"
                >{{ Number(selectedEpochs) || 5 }} epochs</strong
              >
              (total:
              <strong class="text-foreground font-semibold"
                >{{ (Number(selectedEpochs) || 5) * 3 }} full passes</strong
              >) with Cosine Annealing learning rate schedule.
            </p>
          </div>

          <!-- Sync Scan Images Toggle -->
          <div class="border-border border-t pt-2">
            <label
              class="flex items-start gap-3"
              :class="isTrainingActive ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
            >
              <input
                v-model="syncDataset"
                :disabled="isTrainingActive"
                type="checkbox"
                class="border-border mt-1 h-4 w-4 rounded text-violet-600 focus:ring-violet-500 disabled:cursor-not-allowed"
              />
              <div>
                <span class="text-foreground block text-xs font-bold"
                  >Sync Research Dataset Scans</span
                >
                <span class="text-muted-foreground mt-0.5 block text-[11px] leading-relaxed">
                  Automatically pulls the latest verified research scans for the selected disease
                  from storage into the algorithm training space.
                </span>
              </div>
            </label>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-2 pt-3">
            <AppButton
              variant="outline"
              size="lg"
              class="w-full justify-center gap-2 font-semibold shadow-xs"
              @click="showDatasetSlideover = true"
            >
              <Icon
                name="lucide:images"
                size="16"
              />
              Browse Research Scans
            </AppButton>

            <AppButton
              v-if="isTrainingActive"
              variant="destructive"
              size="lg"
              class="w-full justify-center gap-2 font-bold shadow-md"
              :loading="isCancellingActive || isCancelling"
              :disabled="isCancellingActive || isCancelling"
              @click="confirmCancelTraining"
            >
              <Icon
                name="lucide:square"
                size="18"
              />
              {{ isCancellingActive ? 'Stopping Pipeline...' : 'Stop Pipeline' }}
            </AppButton>
            <AppButton
              v-else
              variant="solid"
              size="lg"
              class="w-full justify-center gap-2 bg-violet-600 font-bold text-white shadow-md hover:bg-violet-700"
              :loading="isStarting"
              @click="handleStartExpansionTraining"
            >
              <Icon
                name="lucide:sparkles"
                size="18"
              />
              Start Model Expansion Training
            </AppButton>
          </div>
        </div>
      </div>

      <!-- Right Column: Live Console & Progress (5 cols) -->
      <div class="space-y-6 lg:col-span-5">
        <!-- Live Progress Overview Card -->
        <div class="bg-card border-border space-y-4 rounded-3xl border p-6 shadow-sm">
          <div class="border-border flex items-center justify-between border-b pb-3">
            <h4 class="text-foreground flex items-center gap-2 text-sm font-bold">
              <Icon
                :name="isTrainingActive ? 'lucide:loader-2' : 'lucide:activity'"
                size="16"
                class="text-violet-500"
                :class="{ 'animate-spin': isTrainingActive }"
              />
              Training Pipeline Status
            </h4>
            <AppBadge
              :color="
                isTrainingActive
                  ? 'primary'
                  : trainingStatus?.status === 'completed'
                    ? 'success'
                    : 'gray'
              "
              size="sm"
            >
              {{
                isCancellingActive
                  ? 'Stopping...'
                  : isTrainingActive
                    ? 'Active'
                    : trainingStatus?.status === 'completed'
                      ? 'Completed'
                      : 'Idle'
              }}
            </AppBadge>
          </div>

          <!-- Progress Bar Track -->
          <div class="space-y-2">
            <div class="flex justify-between text-xs font-semibold">
              <span class="text-muted-foreground">Overall Progress</span>
              <span class="text-foreground font-mono">{{ trainingStatus?.progress ?? 0 }}%</span>
            </div>
            <div
              class="bg-muted border-border/40 h-3 w-full overflow-hidden rounded-full border p-0.5"
            >
              <div
                class="h-full rounded-full bg-violet-600 transition-all duration-300"
                :style="{ width: `${trainingStatus?.progress ?? 0}%` }"
              ></div>
            </div>
            <div class="text-muted-foreground flex justify-between pt-0.5 text-[11px]">
              <span>Elapsed: {{ formatDuration(trainingStatus?.elapsed_seconds) }}</span>
              <span v-if="trainingStatus?.eta_seconds && isTrainingActive">
                Remaining: ~{{ formatDuration(trainingStatus.eta_seconds) }}
              </span>
            </div>
          </div>

          <!-- Real-time 4-Metric Grid -->
          <div class="grid grid-cols-2 gap-2.5 pt-2">
            <div class="bg-background border-border rounded-2xl border p-3 text-center">
              <p class="text-muted-foreground text-[11px] font-semibold">Train Loss</p>
              <p class="text-foreground mt-0.5 font-mono text-base font-black">
                {{ trainingStatus?.train_loss ?? '0.0000' }}
              </p>
            </div>
            <div class="bg-background border-border rounded-2xl border p-3 text-center">
              <p class="text-muted-foreground text-[11px] font-semibold">Train Acc</p>
              <p class="text-foreground mt-0.5 font-mono text-base font-black">
                {{ trainingStatus?.train_acc ?? '0.00' }}%
              </p>
            </div>
            <div class="bg-background border-border rounded-2xl border p-3 text-center">
              <p class="text-muted-foreground text-[11px] font-semibold">Val Acc</p>
              <p class="text-foreground mt-0.5 font-mono text-base font-black">
                {{ trainingStatus?.val_acc ?? '0.00' }}%
              </p>
            </div>
            <div class="bg-background border-border rounded-2xl border p-3 text-center">
              <p class="text-muted-foreground text-[11px] font-semibold">Baseline Acc</p>
              <p class="text-foreground mt-0.5 font-mono text-base font-black">
                {{ trainingStatus?.baseline_val_acc ?? '0.00' }}%
              </p>
            </div>
          </div>
        </div>

        <!-- Python Training Activity Console -->
        <div
          class="flex h-[460px] flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-xl"
        >
          <!-- Console Top Bar -->
          <div
            class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-5 py-3"
          >
            <div class="flex items-center gap-2.5">
              <span class="flex items-center gap-2 font-mono text-xs font-bold text-zinc-300">
                <Icon
                  name="lucide:terminal"
                  size="14"
                  class="text-violet-400"
                />
                Expansion Activity Console
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span class="font-mono text-[11px] text-zinc-500">
                {{ trainingStatus?.logs?.length ?? 0 }} lines
              </span>
              <button
                v-if="isTrainingActive"
                type="button"
                :disabled="isCancellingActive || isCancelling"
                class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-mono text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                @click="confirmCancelTraining"
              >
                <Icon
                  :name="isCancellingActive ? 'lucide:loader-2' : 'lucide:square'"
                  size="12"
                  :class="{ 'animate-spin': isCancellingActive }"
                />
                {{ isCancellingActive ? 'Stopping...' : 'Stop Pipeline' }}
              </button>
            </div>
          </div>

          <!-- Console Output Box -->
          <div
            ref="logContainer"
            class="scrollbar-thin scrollbar-thumb-zinc-800 flex-1 space-y-1.5 overflow-y-auto p-5 font-mono text-xs text-zinc-300 select-text"
          >
            <div
              v-if="!trainingStatus?.logs || trainingStatus.logs.length === 0"
              class="py-4 text-zinc-500 italic"
            >
              Terminal idle. Select a disease and click "Start Model Expansion Training" to stream
              live training output...
            </div>
            <div
              v-for="(log, idx) in trainingStatus?.logs"
              :key="idx"
              class="leading-relaxed break-words"
              :class="{
                'font-bold text-emerald-400':
                  log.includes('SUCCESS') || log.includes('PASSED') || log.includes('promoted'),
                'font-semibold text-violet-400':
                  log.includes('Safekeeping') ||
                  log.includes('Expansion') ||
                  log.includes('Expanded'),
                'text-amber-400':
                  log.includes('VALIDATION GUARD') ||
                  log.includes('PRESERVED') ||
                  log.includes('cancelling'),
                'font-bold text-red-400': log.includes('failed') || log.includes('ERROR'),
                'text-cyan-400': log.includes('Epoch')
              }"
            >
              {{ log }}
            </div>
          </div>

          <!-- Console Footer Bar -->
          <div
            class="flex items-center justify-between border-t border-zinc-800/80 bg-zinc-900/60 px-5 py-2.5 font-mono text-[11px] text-zinc-500"
          >
            <span>Dual-Safekeeping Checkpoints</span>
            <span>Non-blocking FastApi Worker</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal for Stopping Training -->
    <AppModalConfirmation
      v-model="showCancelConfirm"
      title="Stop Expansion Training Pipeline?"
      description="Are you sure you want to cancel the active expansion training run? The baseline models in production will remain completely active and unaffected."
      icon="lucide:alert-triangle"
      icon-color="danger"
      confirm-text="Stop Training"
      cancel-text="Continue Training"
      confirm-variant="destructive"
      :loading="isCancelling"
      @confirm="handleExecuteCancel"
    />

    <!-- Research Dataset Slideover -->
    <AppDatasetSlideover
      v-model="showDatasetSlideover"
      dataset-type="out_of_scope"
      :initial-category="selectedExpansionDisease"
      @deleted="fetchStats"
    />
  </div>
</template>

<style scoped>
  /* Suppress browser native spinner arrows on number inputs */
  input[type='number']::-webkit-outer-spin-button,
  input[type='number']::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
