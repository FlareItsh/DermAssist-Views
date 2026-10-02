<script setup lang="ts">
  import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
  import {
    modelTrainingService,
    type ModelStatsResponse,
    type TrainingStatusResponse
  } from '~/api/modelTraining/ModelTrainingService'
  import { toast } from 'vue-sonner'

  interface Props {
    modelValue: boolean
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'retrain-complete'): void
  }>()

  const isOpen = computed({
    get: () => props.modelValue,
    set: val => emit('update:modelValue', val)
  })

  // Configuration options
  const selectedArch = ref<'swin_transformer' | 'resnet50' | 'efficientnet_v2'>('swin_transformer')
  const selectedEpochs = ref(3)
  const syncDataset = ref(true)

  // State
  const isLoadingStats = ref(false)
  const isStarting = ref(false)
  const isCancelling = ref(false)
  const stats = ref<ModelStatsResponse | null>(null)
  const trainingStatus = ref<TrainingStatusResponse | null>(null)
  const showCancelConfirm = ref(false)

  const logContainer = ref<HTMLElement | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const isTrainingActive = computed(() => {
    const s = trainingStatus.value?.status
    return s === 'syncing' || s === 'training' || s === 'evaluating'
  })

  const architectures = [
    {
      id: 'swin_transformer',
      name: 'Swin Transformer (SOTA)',
      desc: 'State-of-the-art vision transformer. Best for lesion classification.',
      badge: 'Recommended'
    },
    {
      id: 'resnet50',
      name: 'ResNet50',
      desc: 'Deep residual network with strong feature stability.',
      badge: 'Stable'
    },
    {
      id: 'efficientnet_v2',
      name: 'EfficientNet-V2',
      desc: 'Lightweight convolutional network optimized for rapid inference.',
      badge: 'Fast'
    }
  ]

  const fetchStats = async () => {
    isLoadingStats.value = true
    try {
      stats.value = await modelTrainingService.getStats()
    } catch (err: any) {
      console.error('Failed to load model stats:', err)
    } finally {
      isLoadingStats.value = false
    }
  }

  const pollStatus = async () => {
    try {
      const res = await modelTrainingService.getStatus()
      trainingStatus.value = res

      // Auto-scroll log console to bottom
      await nextTick()
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }

      if (res.status === 'completed' || res.status === 'failed' || res.status === 'cancelled') {
        stopPolling()
        if (res.status === 'completed') {
          emit('retrain-complete')
          if (res.model_promoted) {
            toast.success('Model retraining completed and deployed to production!')
          } else {
            toast.info('Retraining completed. Baseline model was preserved by Validation Guard.')
          }
        } else if (res.status === 'failed') {
          toast.error(res.message || 'Training failed.')
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

  const handleStartTraining = async () => {
    isStarting.value = true
    try {
      await modelTrainingService.startTraining({
        architecture: selectedArch.value,
        epochs: Number(selectedEpochs.value),
        sync_dataset: syncDataset.value
      })
      toast.success('AI retraining started in background!')
      startPolling()
    } catch (err: any) {
      const msg =
        err.data?.message || err.data?.error || err.message || 'Failed to start retraining.'
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

  watch(isOpen, open => {
    if (open) {
      fetchStats()
      startPolling()
    } else {
      stopPolling()
    }
  })

  onBeforeUnmount(() => {
    stopPolling()
  })
</script>

<template>
  <div>
    <AppModal
      v-model="isOpen"
      title="AI Model Intelligence & Retraining Center"
      description="Fine-tune your diagnostic AI on verified scan images with automated Validation Guard protection."
      size="4xl"
    >
      <div class="space-y-6 pt-2">
        <!-- Overview Header / Readiness Stats -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <!-- Card 1: Gathered Scans -->
          <div class="bg-card border-border flex items-center gap-4 rounded-2xl border p-4">
            <div
              class="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            >
              <Icon
                name="lucide:images"
                size="24"
              />
            </div>
            <div>
              <p class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Gathered Scans
              </p>
              <h4 class="text-foreground text-xl font-bold">
                {{ stats?.gathered_dataset.total ?? 0 }}
                <span class="text-muted-foreground text-xs font-normal">new photos</span>
              </h4>
              <p class="text-muted-foreground text-[11px]">
                Acne: {{ stats?.gathered_dataset.by_category.acne ?? 0 }} | Eczema:
                {{ stats?.gathered_dataset.by_category.eczema ?? 0 }} | Herpes:
                {{ stats?.gathered_dataset.by_category.herpes ?? 0 }}
              </p>
            </div>
          </div>

          <!-- Card 2: Baseline Benchmark -->
          <div class="bg-card border-border flex items-center gap-4 rounded-2xl border p-4">
            <div
              class="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            >
              <Icon
                name="lucide:database"
                size="24"
              />
            </div>
            <div>
              <p class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Baseline Dataset
              </p>
              <h4 class="text-foreground text-xl font-bold">
                {{ stats?.ai_service.total_baseline_images.toLocaleString() ?? '15,719' }}
                <span class="text-muted-foreground text-xs font-normal">images</span>
              </h4>
              <p class="text-muted-foreground text-[11px]">Clinical benchmark foundation</p>
            </div>
          </div>

          <!-- Card 3: Validation Guard Safeguard -->
          <div class="bg-card border-border flex items-center gap-4 rounded-2xl border p-4">
            <div
              class="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            >
              <Icon
                name="lucide:shield-check"
                size="24"
              />
            </div>
            <div>
              <p class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Accuracy Safeguard
              </p>
              <h4 class="text-foreground mt-0.5 flex items-center gap-1.5 text-sm font-bold">
                Validation Guard
                <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
              </h4>
              <p class="text-muted-foreground text-[11px]">Rejects regression; keeps best model</p>
            </div>
          </div>
        </div>

        <!-- Live Training Progress Bar (Shown when active or completed recently) -->
        <div
          v-if="isTrainingActive || trainingStatus?.status === 'completed'"
          class="bg-card border-border space-y-4 rounded-2xl border p-5"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                v-if="isTrainingActive"
                class="text-primary animate-spin"
              >
                <Icon
                  name="lucide:loader-2"
                  size="20"
                />
              </div>
              <div
                v-else-if="trainingStatus?.model_promoted"
                class="text-emerald-500"
              >
                <Icon
                  name="lucide:check-circle-2"
                  size="20"
                />
              </div>
              <div
                v-else
                class="text-amber-500"
              >
                <Icon
                  name="lucide:shield-alert"
                  size="20"
                />
              </div>
              <div>
                <h4 class="text-foreground flex items-center gap-2 text-sm font-bold">
                  {{ trainingStatus?.message || 'Processing training run...' }}
                </h4>
                <p class="text-muted-foreground text-xs">
                  Architecture:
                  <span class="text-foreground font-semibold uppercase">{{
                    trainingStatus?.architecture
                  }}</span>
                  <span v-if="trainingStatus?.total_epochs">
                    &bull; Epoch {{ trainingStatus?.current_epoch }} of
                    {{ trainingStatus?.total_epochs }} &bull; Step
                    {{ trainingStatus?.current_batch }} of {{ trainingStatus?.total_batches }}
                  </span>
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <AppBadge
                v-if="trainingStatus?.status === 'training'"
                color="primary"
                variant="solid"
              >
                Training Active
              </AppBadge>
              <AppBadge
                v-else-if="trainingStatus?.status === 'evaluating'"
                color="warning"
                variant="solid"
              >
                Evaluating Checkpoint
              </AppBadge>
              <AppBadge
                v-else-if="trainingStatus?.status === 'completed'"
                color="success"
                variant="solid"
              >
                Completed
              </AppBadge>
              <AppBadge
                v-else-if="trainingStatus?.status === 'cancelled'"
                color="danger"
                variant="subtle"
              >
                Cancelled
              </AppBadge>

              <AppButton
                v-if="isTrainingActive"
                variant="destructive"
                size="sm"
                class="gap-1.5"
                @click="confirmCancelTraining"
              >
                <Icon
                  name="lucide:square"
                  size="14"
                />
                Stop
              </AppButton>
            </div>
          </div>

          <!-- Progress Track -->
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs font-semibold">
              <span class="text-muted-foreground">Pipeline Progress</span>
              <span class="text-foreground">{{ trainingStatus?.progress ?? 0 }}%</span>
            </div>
            <div class="bg-muted relative h-3 w-full overflow-hidden rounded-full">
              <div
                class="bg-primary h-full rounded-full transition-all duration-300"
                :style="{ width: `${trainingStatus?.progress ?? 0}%` }"
              ></div>
            </div>
            <div class="text-muted-foreground flex justify-between pt-0.5 text-[11px]">
              <span>Elapsed: {{ formatDuration(trainingStatus?.elapsed_seconds) }}</span>
              <span v-if="trainingStatus?.eta_seconds && isTrainingActive"
                >ETA: ~{{ formatDuration(trainingStatus.eta_seconds) }}</span
              >
            </div>
          </div>

          <!-- Live Metrics 4-Box Grid -->
          <div class="grid grid-cols-2 gap-3 pt-1 md:grid-cols-4">
            <div class="bg-background border-border rounded-xl border p-3 text-center">
              <p class="text-muted-foreground text-[11px] font-semibold">Train Loss</p>
              <p class="text-foreground text-lg font-bold">
                {{ trainingStatus?.train_loss ?? '0.0000' }}
              </p>
            </div>
            <div class="bg-background border-border rounded-xl border p-3 text-center">
              <p class="text-muted-foreground text-[11px] font-semibold">Train Accuracy</p>
              <p class="text-foreground text-lg font-bold">
                {{ trainingStatus?.train_acc ?? '0.00' }}%
              </p>
            </div>
            <div class="bg-background border-border rounded-xl border p-3 text-center">
              <p class="text-muted-foreground text-[11px] font-semibold">Val Accuracy</p>
              <p class="text-foreground text-lg font-bold">
                {{ trainingStatus?.val_acc ?? '0.00' }}%
              </p>
            </div>
            <div class="bg-background border-border rounded-xl border p-3 text-center">
              <p class="text-muted-foreground text-[11px] font-semibold">Baseline Acc</p>
              <p class="text-foreground text-lg font-bold">
                {{ trainingStatus?.baseline_val_acc ?? '0.00' }}%
              </p>
            </div>
          </div>

          <!-- Completion Banner with Guard Outcome -->
          <div
            v-if="trainingStatus?.status === 'completed'"
            class="rounded-xl p-4 text-sm"
            :class="
              trainingStatus.model_promoted
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-950'
                : 'border border-amber-500/30 bg-amber-500/10 text-amber-950'
            "
          >
            <div class="flex items-start gap-3">
              <Icon
                :name="trainingStatus.model_promoted ? 'lucide:badge-check' : 'lucide:shield-alert'"
                class="mt-0.5 shrink-0 text-xl"
              />
              <div>
                <h5 class="font-bold">
                  {{
                    trainingStatus.model_promoted
                      ? 'Success: Model Promoted to Production'
                      : 'Protected: Baseline Model Kept'
                  }}
                </h5>
                <p class="mt-1 text-xs leading-relaxed">
                  {{
                    trainingStatus.model_promoted
                      ? `The retrained ${trainingStatus.architecture} model reached ${trainingStatus.best_val_acc}% validation accuracy (surpassing baseline ${trainingStatus.baseline_val_acc}%). Live predictions have been hot-reloaded automatically!`
                      : `The new training run concluded with ${trainingStatus.best_val_acc}% validation accuracy, which did not exceed the existing baseline of ${trainingStatus.baseline_val_acc}%. To safeguard diagnostics, the existing production weights were kept without modification.`
                  }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Training Configuration (Disabled while running) -->
        <div
          class="bg-card border-border space-y-4 rounded-2xl border p-5"
          :class="{ 'pointer-events-none opacity-60': isTrainingActive }"
        >
          <h4 class="text-foreground flex items-center gap-2 text-sm font-bold">
            <Icon
              name="lucide:sliders"
              size="18"
              class="text-primary"
            />
            Training Configuration
          </h4>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label
                class="text-muted-foreground block text-xs font-semibold tracking-wider uppercase"
                >Target Ensemble Backbone</label
              >
              <span class="text-muted-foreground text-[11px]"
                >Fine-tune 1 of 3 ensemble models</span
              >
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div
                v-for="arch in architectures"
                :key="arch.id"
                class="relative flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition-all"
                :class="
                  selectedArch === arch.id
                    ? 'border-primary bg-primary/5 ring-primary ring-1'
                    : 'border-border bg-background hover:border-primary/40'
                "
                @click="selectedArch = arch.id as any"
              >
                <div>
                  <div class="mb-1 flex items-center justify-between">
                    <span class="text-foreground text-sm font-bold">{{ arch.name }}</span>
                    <AppBadge
                      size="sm"
                      :color="arch.id === 'swin_transformer' ? 'primary' : 'gray'"
                    >
                      {{ arch.badge }}
                    </AppBadge>
                  </div>
                  <p class="text-muted-foreground text-xs">{{ arch.desc }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
            <div>
              <label class="text-muted-foreground mb-1.5 block text-xs font-semibold"
                >Epochs (Iterations)</label
              >
              <select
                v-model="selectedEpochs"
                class="bg-background border-border text-foreground focus:ring-primary w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              >
                <option :value="3">3 Epochs (Fast fine-tuning, recommended for CPU)</option>
                <option :value="5">5 Epochs (Balanced transfer learning)</option>
                <option :value="10">10 Epochs (Deep adaptation)</option>
              </select>
            </div>

            <div class="flex items-center pt-5">
              <label class="flex cursor-pointer items-center gap-3">
                <input
                  v-model="syncDataset"
                  type="checkbox"
                  class="border-border text-primary focus:ring-primary h-4 w-4 rounded"
                />
                <div>
                  <span class="text-foreground block text-xs font-bold"
                    >Sync Gathered Scan Images</span
                  >
                  <span class="text-muted-foreground block text-[11px]">
                    Copies new verified scan photos from app storage into training classes.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Live Terminal Log Console -->
        <div class="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-inner">
          <div
            class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-2.5"
          >
            <div class="flex items-center gap-2">
              <Icon
                name="lucide:terminal"
                size="16"
                class="text-emerald-400"
              />
              <span class="font-mono text-xs font-bold text-zinc-300"
                >Live Training Activity Console</span
              >
            </div>
            <span class="font-mono text-[11px] text-zinc-500">
              {{ trainingStatus?.logs?.length ?? 0 }} entries
            </span>
          </div>

          <div
            ref="logContainer"
            class="scrollbar-thin scrollbar-thumb-zinc-800 h-44 space-y-1 overflow-y-auto p-4 font-mono text-xs text-zinc-300 select-text"
          >
            <div
              v-if="!trainingStatus?.logs || trainingStatus.logs.length === 0"
              class="text-zinc-500 italic"
            >
              Terminal idle. Click "Start Retraining Pipeline" to stream live batch outputs...
            </div>
            <div
              v-for="(log, idx) in trainingStatus?.logs"
              :key="idx"
              class="leading-relaxed break-words"
              :class="{
                'font-bold text-emerald-400':
                  log.includes('SUCCESS') || log.includes('PASSED') || log.includes('promoted'),
                'text-amber-400': log.includes('VALIDATION GUARD') || log.includes('PREVENTED'),
                'font-bold text-red-400': log.includes('failed') || log.includes('ERROR'),
                'text-cyan-400': log.includes('Epoch')
              }"
            >
              {{ log }}
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <template #footer>
        <div class="flex w-full items-center justify-between pt-2">
          <p class="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Icon
              name="lucide:cpu"
              size="14"
            />
            Runs in background without interrupting live scanner predictions.
          </p>

          <div class="flex items-center gap-3">
            <AppButton
              variant="outline"
              @click="isOpen = false"
            >
              {{ isTrainingActive ? 'Keep Running in Background' : 'Close' }}
            </AppButton>

            <AppButton
              v-if="!isTrainingActive"
              variant="solid"
              :loading="isStarting"
              class="gap-2"
              @click="handleStartTraining"
            >
              <Icon
                name="lucide:play"
                size="16"
              />
              Start Retraining Pipeline
            </AppButton>
          </div>
        </div>
      </template>
    </AppModal>

    <!-- Confirmation Dialog for Stopping Training -->
    <AppModalConfirmation
      v-model="showCancelConfirm"
      title="Stop Training Session?"
      description="Are you sure you want to cancel the active training run? The current checkpoint will not be promoted and the existing production model will remain active."
      icon="lucide:alert-triangle"
      icon-color="danger"
      confirm-text="Stop Training"
      cancel-text="Continue Training"
      confirm-variant="destructive"
      :loading="isCancelling"
      @confirm="handleExecuteCancel"
    />
  </div>
</template>
