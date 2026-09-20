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

// Configuration
const selectedArch = ref<'swin_transformer' | 'resnet50' | 'efficientnet_v2'>('swin_transformer')
const selectedEpochs = ref(3)
const syncDataset = ref(true)

// State
const isLoadingStats = ref(false)
const isStarting = ref(false)
const isCancelling = ref(false)
const isSyncing = ref(false)
const stats = ref<ModelStatsResponse | null>(null)
const trainingStatus = ref<TrainingStatusResponse | null>(null)
const showCancelConfirm = ref(false)
const showDatasetSlideover = ref(false)
const showResultsModal = ref(false)

const logContainer = ref<HTMLElement | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const isTrainingActive = computed(() => {
  const s = trainingStatus.value?.status
  return s === 'syncing' || s === 'training' || s === 'evaluating'
})

const isModelInEnsemble = (filename: string) => {
  const f = filename.toLowerCase()
  return f.includes('swin') || f.includes('resnet') || f.includes('efficientnet')
}

const ensembleModelsList = [
  { id: 'swin_transformer', name: 'Swin Transformer', short: 'Swin', step: 1 },
  { id: 'resnet50', name: 'ResNet50', short: 'ResNet', step: 2 },
  { id: 'efficientnet_v2', name: 'EfficientNet-V2', short: 'EfficientNet', step: 3 },
]

const getEnsembleModelStatus = (archId: string) => {
  const current = (trainingStatus.value?.architecture || '').toLowerCase()
  const isAllDone = trainingStatus.value?.status === 'completed'
  const order = ['swin_transformer', 'resnet50', 'efficientnet_v2']
  const currentIndex = order.indexOf(current)
  const targetIndex = order.indexOf(archId)

  if (isAllDone) return 'completed'
  if (currentIndex === -1) {
    return targetIndex === 0 && isTrainingActive.value ? 'active' : 'pending'
  }
  if (targetIndex < currentIndex) return 'completed'
  if (targetIndex === currentIndex) return isTrainingActive.value ? 'active' : 'completed'
  return 'pending'
}

const displayTrainingMessage = computed(() => {
  if (!trainingStatus.value) return 'AI Training Engine Ready'
  const msg = trainingStatus.value.message || 'AI Training Engine Ready'
  return msg
    .replace(/\s*-\s*Epoch\s+\d+\/\d+/i, '')
    .replace(/\[\d+\/\d+\]\s*/i, '')
    .trim()
})

const modelDescriptions: Record<string, string> = {
  swin_transformer: 'Captures fine micro-textures, borders, and shifted-window local spatial correlations.',
  resnet50: 'Provides robust macro-lesion geometric features across diverse skin phototypes.',
  efficientnet_v2: 'Compound-scaled convolutional network ensuring balanced depth, width, and resolution.',
  ensemble: 'Tri-fusion neural pipeline training Vision Attention, Deep Residuals, and Progressively Scaled CNNs in consensus.',
}

const displayModelDescription = computed(() => {
  if (!trainingStatus.value || trainingStatus.value.status === 'idle') {
    return 'Supervised PyTorch training engine with automated validation safeguarding.'
  }
  const arch = (trainingStatus.value.architecture || '').toLowerCase()
  return modelDescriptions[arch] || 'Deep learning neural backbone active.'
})

const parsedEnsembleResults = computed(() => {
  const logs = trainingStatus.value?.logs || []
  const models = [
    { id: 'swin_transformer', name: 'Swin Transformer', baseline: 94.04, achieved: 94.04, promoted: false, weights: 'best_model_swin.pth' },
    { id: 'resnet50', name: 'ResNet50', baseline: 93.33, achieved: 93.33, promoted: false, weights: 'best_model_resnet50.pth' },
    { id: 'efficientnet_v2', name: 'EfficientNet-V2', baseline: 95.44, achieved: 95.44, promoted: false, weights: 'best_model_efficientnet_v2.pth' },
  ]

  for (const m of models) {
    const guardIdx = logs.findIndex((l) => l.toUpperCase().includes(`VALIDATION GUARD: ${m.id.toUpperCase()}`))
    if (guardIdx !== -1) {
      for (let i = guardIdx; i < Math.min(guardIdx + 6, logs.length); i++) {
        const line = logs[i]
        const match = line.match(/Baseline:\s*([\d\.]+)%\s*\|\s*Best Achieved:\s*([\d\.]+)%/i)
        if (match) {
          m.baseline = parseFloat(match[1])
          m.achieved = parseFloat(match[2])
        }
        if (line.includes('PASSED GUARD') || line.includes('Deployed to production')) {
          m.promoted = true
        }
      }
    }
  }

  return models
})

const architectures = [
  {
    id: 'swin_transformer',
    name: 'Swin Transformer',
    type: 'State-of-the-Art (Vision Transformer)',
    desc: 'Shifted-window attention network. Highest accuracy on clinical skin lesions.',
    badge: 'Recommended',
    badgeColor: 'primary' as const
  },
  {
    id: 'resnet50',
    name: 'ResNet50',
    type: 'Residual Convolutional Backbone',
    desc: 'Deep residual network with stable feature representation across skin tones.',
    badge: 'Stable',
    badgeColor: 'gray' as const
  },
  {
    id: 'efficientnet_v2',
    name: 'EfficientNet-V2',
    type: 'Optimized Convolutional Network',
    desc: 'Lightweight architecture with fast training and low latency inference.',
    badge: 'Fast',
    badgeColor: 'gray' as const
  }
]

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

    if (res.status === 'completed' || res.status === 'failed' || res.status === 'cancelled') {
      stopPolling()
      if (res.status === 'completed') {
        try {
          await modelTrainingService.markCompleted()
        } catch (e) {
          console.error('Failed to mark training completion timestamp', e)
        }
        fetchStats()
        if (res.model_promoted) {
          toast.success('Retraining complete! New model promoted to production.')
        } else {
          toast.info('Retraining complete. Baseline model preserved by Validation Guard.')
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

const handleStartTraining = async () => {
  isStarting.value = true
  try {
    await modelTrainingService.startTraining({
      architecture: 'ensemble',
      epochs: Number(selectedEpochs.value),
      sync_dataset: syncDataset.value
    })
    toast.success('Tri-Model Ensemble retraining pipeline started!')
    startPolling()
  } catch (err: any) {
    const msg = err.data?.message || err.data?.error || err.message || 'Failed to start retraining.'
    toast.error(msg)
  } finally {
    isStarting.value = false
  }
}

const handleSyncDataset = async () => {
  isSyncing.value = true
  try {
    const res = await modelTrainingService.syncDataset()
    toast.success(res.message || 'Dataset synchronized successfully.')
    fetchStats()
  } catch (err: any) {
    toast.error('Failed to synchronize dataset.')
  } finally {
    isSyncing.value = false
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
  } catch (err: any) {
    toast.error('Failed to cancel training.')
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
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <h1 class="text-2xl md:text-3xl font-black text-foreground">AI Model Intelligence</h1>
        </div>
        <p class="text-sm text-muted-foreground">
          Monitor PyTorch vision backbones, trigger clinical fine-tuning, and supervise automated Validation Guard accuracy.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <AppButton
          variant="outline"
          class="gap-2"
          @click="showResultsModal = true"
        >
          <Icon name="lucide:clipboard-check" size="16" />
          Retraining Report
        </AppButton>

        <AppButton
          variant="outline"
          class="gap-2"
          :loading="isSyncing"
          :disabled="isTrainingActive"
          @click="handleSyncDataset"
        >
          <Icon name="lucide:refresh-cw" size="16" />
          Sync Scan Images
        </AppButton>

        <AppButton
          v-if="isTrainingActive"
          variant="destructive"
          class="gap-2 shadow-sm"
          @click="confirmCancelTraining"
        >
          <Icon name="lucide:square" size="16" />
          Stop Pipeline
        </AppButton>
      </div>
    </div>

    <!-- Top Metrics Overview Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Metric 1: Active Architecture -->
      <div class="p-5 rounded-3xl bg-card border border-border shadow-sm flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inference Engine</span>
          <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon name="lucide:layers" size="18" />
          </div>
        </div>
        <div class="mt-4">
          <h3 class="text-base font-bold text-foreground flex items-center gap-1.5">
            3-Model Ensemble
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">Tri-Fusion</span>
          </h3>
          <p class="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            Swin + ResNet + EfficientNet
          </p>
        </div>
      </div>

      <!-- Metric 2: Baseline Benchmark Data -->
      <div class="p-5 rounded-3xl bg-card border border-border shadow-sm flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Baseline Dataset</span>
          <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon name="lucide:database" size="18" />
          </div>
        </div>
        <div class="mt-4">
          <h3 class="text-2xl font-black text-foreground">
            {{ stats?.ai_service.total_baseline_images.toLocaleString() || '15,719' }}
            <span class="text-xs font-normal text-muted-foreground">images</span>
          </h3>
          <p class="text-xs text-muted-foreground mt-0.5">Clinical benchmark foundation</p>
        </div>
      </div>

      <!-- Metric 3: Gathered Clinical Scans -->
      <div class="p-5 rounded-3xl bg-card border border-border shadow-sm flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gathered Scans</span>
          <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon name="lucide:images" size="18" />
          </div>
        </div>
        <div class="mt-4">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="text-2xl font-black text-foreground">
              {{ stats?.gathered_dataset.total ?? 0 }}
              <span class="text-xs font-normal text-muted-foreground">collected</span>
            </h3>
            <span
              v-if="(stats?.gathered_dataset.untrained_count ?? 0) > 0"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              {{ stats?.gathered_dataset.untrained_count }} new untrained
            </span>
            <span
              v-else-if="(stats?.gathered_dataset.total ?? 0) > 0"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <Icon name="lucide:check" size="12" />
              All trained
            </span>
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            Acne: {{ stats?.gathered_dataset.by_category.acne ?? 0 }} |
            Eczema: {{ stats?.gathered_dataset.by_category.eczema ?? 0 }} |
            Herpes: {{ stats?.gathered_dataset.by_category.herpes ?? 0 }}
          </p>
        </div>
      </div>

      <!-- Metric 4: Validation Guard Safeguard -->
      <div class="p-5 rounded-3xl bg-card border border-border shadow-sm flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accuracy Guard</span>
          <div class="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Icon name="lucide:shield-check" size="18" />
          </div>
        </div>
        <div class="mt-4">
          <h3 class="text-base font-bold text-foreground flex items-center gap-1.5">
            Validation Guard
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </h3>
          <p class="text-xs text-muted-foreground mt-0.5">Rejects lower accuracy; keeps best model</p>
        </div>
      </div>
    </div>


    <!-- Active Pipeline Status & Live Progress Card -->
    <div class="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-2xl flex items-center justify-center"
            :class="isTrainingActive ? 'bg-primary/10 text-primary animate-spin' : trainingStatus?.model_promoted ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'"
          >
            <Icon :name="isTrainingActive ? 'lucide:loader-2' : trainingStatus?.model_promoted ? 'lucide:check-circle-2' : 'lucide:brain'" size="20" />
          </div>
          <div>
            <h3 class="font-bold text-base text-foreground flex items-center gap-2">
              {{ displayTrainingMessage }}
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed max-w-xl">
              {{ displayModelDescription }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <AppBadge v-if="trainingStatus?.status === 'idle' || !trainingStatus" color="gray" variant="subtle">
            Engine Idle
          </AppBadge>
          <AppBadge v-else-if="trainingStatus?.status === 'syncing'" color="info" variant="solid">
            Syncing Images
          </AppBadge>
          <AppBadge v-else-if="trainingStatus?.status === 'training'" color="primary" variant="solid">
            Training Active
          </AppBadge>
          <AppBadge v-else-if="trainingStatus?.status === 'evaluating'" color="warning" variant="solid">
            Evaluating Checkpoint
          </AppBadge>
          <AppBadge v-else-if="trainingStatus?.status === 'completed'" color="success" variant="solid">
            Completed
          </AppBadge>
          <AppBadge v-else-if="trainingStatus?.status === 'cancelled'" color="danger" variant="subtle">
            Cancelled
          </AppBadge>
        </div>
      </div>

      <!-- Progress Track -->
      <div class="space-y-3.5">
        <!-- 3-Model Sequence Divided Cards (Distinct Visual Design) -->
        <div v-if="isTrainingActive || trainingStatus?.status === 'completed'" class="space-y-1.5 pt-1">
          <div class="flex justify-between text-xs font-semibold">
            <span class="text-muted-foreground">Tri-Model Sequence</span>
            <span class="text-foreground font-mono">
              {{
                trainingStatus?.status === 'completed'
                  ? '3 of 3 Backbones Finished'
                  : `Model ${
                      Math.max(1, ['swin_transformer', 'resnet50', 'efficientnet_v2'].indexOf((trainingStatus?.architecture || '').toLowerCase()) + 1)
                    } of 3`
              }}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div
              v-for="m in ensembleModelsList"
              :key="m.id"
              class="px-3.5 py-2 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-2"
              :class="{
                'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400': getEnsembleModelStatus(m.id) === 'completed',
                'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/30': getEnsembleModelStatus(m.id) === 'active',
                'bg-muted/40 border-border/80 text-muted-foreground opacity-60': getEnsembleModelStatus(m.id) === 'pending'
              }"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  :class="{
                    'bg-emerald-500 text-white': getEnsembleModelStatus(m.id) === 'completed',
                    'bg-primary text-white': getEnsembleModelStatus(m.id) === 'active',
                    'bg-muted-foreground/20 text-muted-foreground': getEnsembleModelStatus(m.id) === 'pending'
                  }"
                >
                  {{ m.step }}
                </span>
                <span class="text-xs font-bold truncate">{{ m.name }}</span>
              </div>

              <div class="shrink-0">
                <Icon
                  v-if="getEnsembleModelStatus(m.id) === 'completed'"
                  name="lucide:check"
                  size="14"
                  class="text-emerald-600 dark:text-emerald-400"
                />
                <Icon
                  v-else-if="getEnsembleModelStatus(m.id) === 'active'"
                  name="lucide:loader-2"
                  size="14"
                  class="text-primary animate-spin"
                />
                <span v-else class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Queued</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Sub-progress indicators (Segmented Epochs + Thin Step Bar) -->
        <div v-if="trainingStatus?.total_epochs && isTrainingActive" class="space-y-3">
          <!-- Epoch Progress -->
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs font-semibold">
              <span class="text-muted-foreground">Epoch</span>
              <span class="text-foreground font-mono">Epoch {{ trainingStatus.current_epoch }} of {{ trainingStatus.total_epochs }}</span>
            </div>
            <!-- Segmented Bars for Epochs -->
            <div class="grid gap-2" :style="{ gridTemplateColumns: `repeat(${trainingStatus.total_epochs}, minmax(0, 1fr))` }">
              <div
                v-for="ep in trainingStatus.total_epochs"
                :key="ep"
                class="h-2 bg-muted rounded-full overflow-hidden p-0.5"
              >
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="{
                    'bg-primary': ep <= trainingStatus.current_epoch,
                    'bg-transparent': ep > trainingStatus.current_epoch
                  }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Step / Batch Thin Progress Bar -->
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs font-semibold">
              <span class="text-muted-foreground">Current Batch Step</span>
              <span class="text-foreground font-mono">
                Step {{ trainingStatus.current_batch }} of {{ trainingStatus.total_batches }}
                <span class="text-muted-foreground">({{ Math.min(100, Math.round(((trainingStatus.current_batch || 0) / Math.max(1, trainingStatus.total_batches || 1)) * 100)) }}%)</span>
              </span>
            </div>
            <!-- Thin Step Progress Bar Track -->
            <div class="w-full h-2 bg-muted rounded-full overflow-hidden p-0.5">
              <div
                class="h-full bg-primary rounded-full transition-all duration-150"
                :style="{
                  width: `${Math.min(100, Math.round(((trainingStatus.current_batch || 0) / Math.max(1, trainingStatus.total_batches || 1)) * 100))}%`
                }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Main Overall Pipeline Progress -->
        <div class="space-y-2">
          <div class="flex justify-between text-xs font-semibold">
            <span class="text-muted-foreground">Overall Pipeline Progress</span>
            <span class="text-foreground font-mono">{{ trainingStatus?.progress ?? 0 }}%</span>
          </div>
          <div class="w-full h-4.5 bg-muted rounded-full overflow-hidden p-0.5 border border-border/40">
            <div
              class="h-full bg-primary rounded-full transition-all duration-300 shadow-xs shadow-primary/30"
              :style="{ width: `${trainingStatus?.progress ?? 0}%` }"
            ></div>
          </div>
          <div class="flex justify-between text-xs text-muted-foreground pt-0.5">
            <span>Elapsed Time: {{ trainingStatus?.elapsed_seconds ?? 0 }}s</span>
            <span v-if="trainingStatus?.eta_seconds && isTrainingActive">
              Estimated Remaining: ~{{ trainingStatus.eta_seconds }}s
            </span>
          </div>
        </div>
      </div>

      <!-- Live 4-Metric Badges Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
        <div class="p-4 rounded-2xl bg-background border border-border text-center">
          <p class="text-xs font-semibold text-muted-foreground">Train Loss</p>
          <p class="text-xl font-black text-foreground mt-1">{{ trainingStatus?.train_loss ?? '0.0000' }}</p>
        </div>
        <div class="p-4 rounded-2xl bg-background border border-border text-center">
          <p class="text-xs font-semibold text-muted-foreground">Train Accuracy</p>
          <p class="text-xl font-black text-foreground mt-1">{{ trainingStatus?.train_acc ?? '0.00' }}%</p>
        </div>
        <div class="p-4 rounded-2xl bg-background border border-border text-center">
          <p class="text-xs font-semibold text-muted-foreground">Val Accuracy</p>
          <p class="text-xl font-black text-foreground mt-1">{{ trainingStatus?.val_acc ?? '0.00' }}%</p>
        </div>
        <div class="p-4 rounded-2xl bg-background border border-border text-center">
          <p class="text-xs font-semibold text-muted-foreground">Baseline Acc</p>
          <p class="text-xl font-black text-foreground mt-1">{{ trainingStatus?.baseline_val_acc ?? '0.00' }}%</p>
        </div>
      </div>

      <!-- Completion Summary: Full 3-Model Outcome Breakdown -->
      <div v-if="trainingStatus?.status === 'completed'" class="space-y-4 pt-2">
        <div class="flex items-center justify-between border-t border-border pt-4">
          <div class="flex items-center gap-2">
            <Icon name="lucide:clipboard-check" size="18" class="text-primary" />
            <h4 class="font-bold text-sm text-foreground">Retraining Results & Validation Guard Summary</h4>
          </div>
          <AppBadge :color="trainingStatus.model_promoted ? 'success' : 'gray'" size="sm">
            {{ trainingStatus.model_promoted ? 'Production Models Updated' : 'Historical Baselines Protected' }}
          </AppBadge>
        </div>

        <!-- 3-Model Results Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            v-for="res in parsedEnsembleResults"
            :key="res.id"
            class="p-4 rounded-2xl border transition-all"
            :class="res.promoted ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-background border-border'"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <h5 class="font-bold text-sm text-foreground">{{ res.name }}</h5>
                <p class="text-[11px] font-mono text-muted-foreground">{{ res.weights }}</p>
              </div>
              <AppBadge :color="res.promoted ? 'success' : 'gray'" size="sm">
                {{ res.promoted ? 'Promoted' : 'Preserved' }}
              </AppBadge>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/60 text-xs">
              <div>
                <span class="text-muted-foreground block text-[11px]">Baseline Acc</span>
                <span class="font-bold font-mono text-foreground">{{ res.baseline.toFixed(2) }}%</span>
              </div>
              <div>
                <span class="text-muted-foreground block text-[11px]">Achieved Acc</span>
                <span
                  class="font-bold font-mono"
                  :class="res.achieved >= res.baseline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'"
                >
                  {{ res.achieved.toFixed(2) }}%
                </span>
              </div>
            </div>

            <div class="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
              <span class="text-muted-foreground">Guard Decision</span>
              <span class="font-semibold flex items-center gap-1" :class="res.promoted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'">
                <Icon :name="res.promoted ? 'lucide:badge-check' : 'lucide:shield-check'" size="13" />
                {{ res.promoted ? 'New Weights Deployed' : 'Baseline Preserved' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main 2-Column Section: Configuration & Console -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Left Column: Unified Ensemble Training Control (5 cols) -->
      <div class="lg:col-span-5 space-y-6">
        <div class="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-5" :class="{ 'opacity-60 pointer-events-none': isTrainingActive }">
          <div class="flex items-center justify-between border-b border-border pb-3">
            <h3 class="font-bold text-base text-foreground flex items-center gap-2">
              <Icon name="lucide:sparkles" size="18" class="text-primary" />
              Retrain Ensemble
            </h3>
            <AppBadge color="primary" size="sm" variant="subtle">All 3 Backbones</AppBadge>
          </div>

          <!-- Sequential Pipeline Visual Indicator -->
          <div class="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
            <div class="flex items-center justify-between text-xs font-bold text-foreground">
              <span>Tri-Model Training Order</span>
              <span class="text-primary text-[11px]">100% Equal Exposure</span>
            </div>
            <div class="flex items-center justify-between gap-1.5 pt-1">
              <div class="flex-1 px-2 py-2 rounded-xl bg-background border border-border text-center">
                <span class="text-[10px] font-bold text-primary block">Step 1</span>
                <span class="text-xs font-semibold text-foreground">Swin</span>
              </div>
              <Icon name="lucide:arrow-right" size="14" class="text-muted-foreground shrink-0" />
              <div class="flex-1 px-2 py-2 rounded-xl bg-background border border-border text-center">
                <span class="text-[10px] font-bold text-primary block">Step 2</span>
                <span class="text-xs font-semibold text-foreground">ResNet50</span>
              </div>
              <Icon name="lucide:arrow-right" size="14" class="text-muted-foreground shrink-0" />
              <div class="flex-1 px-2 py-2 rounded-xl bg-background border border-border text-center">
                <span class="text-[10px] font-bold text-primary block">Step 3</span>
                <span class="text-xs font-semibold text-foreground">EfficientNet</span>
              </div>
            </div>
            <p class="text-[11px] text-muted-foreground pt-1 leading-relaxed">
              All 3 models are fine-tuned sequentially on the exact same clinical dataset and each independently tested by the Validation Guard.
            </p>
          </div>

          <!-- Epoch Selection -->
          <div class="space-y-2 pt-1">
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Training Epochs (Per Model)
            </label>
            <select
              v-model="selectedEpochs"
              class="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option :value="3">3 Epochs / Model (Recommended — Fast & Balanced)</option>
              <option :value="5">5 Epochs / Model (Standard fine-tuning)</option>
              <option :value="10">10 Epochs / Model (Deep convergence)</option>
            </select>
            <p class="text-[11px] text-muted-foreground">
              Fine-tuning starts from existing weights using Cosine Annealing learning rate schedule.
            </p>
          </div>

          <!-- Untrained Notice Banner -->
          <div
            v-if="(stats?.gathered_dataset.untrained_count ?? 0) > 0"
            class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300"
          >
            <Icon name="lucide:sparkles" size="16" class="shrink-0 text-amber-500" />
            <span>
              <strong>{{ stats?.gathered_dataset.untrained_count }} new scan(s)</strong> ready to be incorporated into the model.
            </span>
          </div>

          <!-- Sync Toggle -->
          <div class="pt-2 border-t border-border">
            <label class="flex items-start gap-3 cursor-pointer">
              <input
                v-model="syncDataset"
                type="checkbox"
                class="mt-1 rounded border-border text-primary focus:ring-primary w-4 h-4"
              />
              <div>
                <span class="text-xs font-bold text-foreground block">Sync Clinical Scans</span>
                <span class="text-[11px] text-muted-foreground block mt-0.5 leading-relaxed">
                  Pulls newly uploaded Acne, Eczema, and Herpes scans and automatically removes deleted images from the training queue.
                </span>
              </div>
            </label>
          </div>

          <!-- Start Button -->
          <div class="pt-3 space-y-2">
            <AppButton
              variant="outline"
              size="lg"
              class="w-full gap-2 justify-center pointer-events-auto"
              @click="showDatasetSlideover = true"
            >
              <Icon name="lucide:images" size="16" />
              Browse Dataset
            </AppButton>
            <AppButton
              v-if="isTrainingActive"
              variant="destructive"
              size="lg"
              class="w-full gap-2 justify-center shadow-md font-bold pointer-events-auto"
              @click="confirmCancelTraining"
            >
              <Icon name="lucide:square" size="18" />
              Stop Pipeline
            </AppButton>
            <AppButton
              v-else
              variant="solid"
              size="lg"
              class="w-full gap-2 justify-center shadow-md font-bold"
              :loading="isStarting"
              @click="handleStartTraining"
            >
              <Icon name="lucide:play" size="18" />
              Retrain All 3 Models
            </AppButton>
          </div>
        </div>

        <!-- Safeguard Info Card -->
        <div class="p-5 rounded-3xl bg-card border border-border shadow-sm flex items-start gap-3.5">
          <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
            <Icon name="lucide:shield-check" size="20" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">Independent Validation Guard</h4>
            <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
              Each model is tested against its own validation split. If a retrained backbone drops below its baseline accuracy, the guard preserves the existing weights to ensure zero diagnostic regression.
            </p>
          </div>
        </div>
      </div>

      <!-- Right Column: Terminal Activity Console (7 cols) -->
      <div class="lg:col-span-7 space-y-6">
        <!-- Monospace Console -->
        <div class="rounded-3xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-xl flex flex-col h-[520px]">
          <!-- Console Top Bar -->
          <div class="px-5 py-3.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="text-xs font-mono font-bold text-zinc-300 ml-2 flex items-center gap-2">
                <Icon name="lucide:terminal" size="14" class="text-emerald-400" />
                Python Training Activity Console
              </span>
            </div>

            <div class="flex items-center gap-3">
              <span class="text-[11px] font-mono text-zinc-500">
                {{ trainingStatus?.logs?.length ?? 0 }} lines
              </span>
              <button
                v-if="isTrainingActive"
                type="button"
                class="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                @click="confirmCancelTraining"
              >
                <Icon name="lucide:square" size="12" />
                Stop Pipeline
              </button>
            </div>
          </div>

          <!-- Console Output Box -->
          <div
            ref="logContainer"
            class="p-5 font-mono text-xs text-zinc-300 flex-1 overflow-y-auto space-y-1.5 select-text scrollbar-thin scrollbar-thumb-zinc-800"
          >
            <div v-if="!trainingStatus?.logs || trainingStatus.logs.length === 0" class="text-zinc-500 italic py-4">
              Terminal idle. Click "Start Retraining" to stream live batch outputs and validation metrics...
            </div>
            <div
              v-for="(log, idx) in trainingStatus?.logs"
              :key="idx"
              class="leading-relaxed break-words"
              :class="{
                'text-emerald-400 font-bold': log.includes('SUCCESS') || log.includes('PASSED') || log.includes('promoted'),
                'text-amber-400': log.includes('VALIDATION GUARD') || log.includes('PREVENTED') || log.includes('cancelling'),
                'text-red-400 font-bold': log.includes('failed') || log.includes('ERROR'),
                'text-cyan-400': log.includes('Epoch')
              }"
            >
              {{ log }}
            </div>
          </div>

          <!-- Console Footer Bar -->
          <div class="px-5 py-2.5 bg-zinc-900/60 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
            <span>Non-blocking FastAPI background worker</span>
            <span>Hot-reload enabled</span>
          </div>
        </div>

        <!-- Production Model Inventory -->
        <div class="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-bold text-foreground flex items-center gap-2">
              <Icon name="lucide:hard-drive" size="16" class="text-primary" />
              Deployed Production Model Checkpoints
            </h4>
            <AppBadge color="gray" size="sm">models/production/</AppBadge>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="modelFile in stats?.ai_service.models_available || ['best_model_swin_transformer.pth', 'best_model_resnet50.pth']"
              :key="modelFile"
              class="p-3.5 rounded-2xl bg-background border border-border flex items-center justify-between"
            >
              <div class="flex items-center gap-2.5 overflow-hidden">
                <Icon name="lucide:file-check" size="16" class="text-primary shrink-0" />
                <span class="text-xs font-mono font-medium text-foreground truncate">{{ modelFile }}</span>
              </div>
              <AppBadge
                size="sm"
                :color="isModelInEnsemble(modelFile) ? 'primary' : 'gray'"
              >
                {{ isModelInEnsemble(modelFile) ? 'Active in Ensemble' : 'Backup Checkpoint' }}
              </AppBadge>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal for Stopping Training -->
    <AppModalConfirmation
      v-model="showCancelConfirm"
      title="Stop Retraining Pipeline?"
      description="Are you sure you want to cancel the active training run? The current checkpoint will not be promoted and the existing production model will remain active."
      icon="lucide:alert-triangle"
      icon-color="danger"
      confirm-text="Stop Training"
      cancel-text="Continue Training"
      confirm-variant="destructive"
      :loading="isCancelling"
      @confirm="handleExecuteCancel"
    />

    <!-- Dataset Slideover -->
    <AppDatasetSlideover
      v-model="showDatasetSlideover"
      @deleted="fetchStats"
    />

    <!-- Comprehensive Retraining Summary Modal -->
    <AppModal
      v-model="showResultsModal"
      title="Tri-Model Retraining & Validation Guard Report"
      size="4xl"
    >
      <div class="space-y-5 p-1">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/40 border border-border">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
              <Icon :name="isTrainingActive ? 'lucide:loader-2' : 'lucide:shield-check'" size="22" :class="{ 'animate-spin': isTrainingActive }" />
            </div>
            <div>
              <h4 class="font-bold text-sm text-foreground">Validation Guard Status</h4>
              <p class="text-xs text-muted-foreground">
                {{
                  isTrainingActive
                    ? 'Training pipeline is actively executing. Validation Guard will compare checkpoints against baseline benchmarks upon completion.'
                    : trainingStatus?.status === 'completed'
                      ? trainingStatus.model_promoted
                        ? 'New model weights beat baseline accuracy and were promoted to production.'
                        : 'Production baselines were protected from accuracy degradation.'
                      : 'System is ready to retrain and compare against active baseline benchmarks.'
                }}
              </p>
            </div>
          </div>
          <AppBadge :color="isTrainingActive ? 'primary' : trainingStatus?.model_promoted ? 'success' : 'gray'" class="shrink-0">
            {{ isTrainingActive ? 'Ongoing' : trainingStatus?.model_promoted ? 'Promoted' : 'Protected' }}
          </AppBadge>
        </div>

        <!-- 3-Model Results Cards Grid in Modal -->
        <div class="space-y-3">
          <h5 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ensemble Model Breakdown</h5>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div
              v-for="res in parsedEnsembleResults"
              :key="res.id"
              class="p-4 rounded-2xl border transition-all overflow-hidden flex flex-col justify-between"
              :class="{
                'bg-emerald-500/10 border-emerald-500/30': res.promoted && !isTrainingActive,
                'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30': isTrainingActive && getEnsembleModelStatus(res.id) === 'active',
                'bg-background border-border': !res.promoted && !(isTrainingActive && getEnsembleModelStatus(res.id) === 'active')
              }"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 pr-1">
                  <h6 class="font-bold text-sm text-foreground truncate">{{ res.name }}</h6>
                  <p class="text-[10px] font-mono text-muted-foreground truncate">{{ res.weights }}</p>
                </div>
                <AppBadge
                  :color="isTrainingActive && getEnsembleModelStatus(res.id) === 'active' ? 'primary' : res.promoted ? 'success' : 'gray'"
                  size="sm"
                  class="shrink-0"
                >
                  {{
                    isTrainingActive && getEnsembleModelStatus(res.id) === 'active'
                      ? 'Ongoing'
                      : isTrainingActive && getEnsembleModelStatus(res.id) === 'pending'
                        ? 'Queued'
                        : res.promoted
                          ? 'Promoted'
                          : 'Preserved'
                  }}
                </AppBadge>
              </div>

              <div class="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-border/60 text-xs">
                <div>
                  <span class="text-muted-foreground block text-[10px]">Baseline</span>
                  <span class="font-bold font-mono text-foreground text-xs">{{ res.baseline.toFixed(2) }}%</span>
                </div>
                <div>
                  <span class="text-muted-foreground block text-[10px]">Achieved</span>
                  <span
                    v-if="!isTrainingActive || getEnsembleModelStatus(res.id) === 'completed'"
                    class="font-bold font-mono text-xs"
                    :class="res.achieved >= res.baseline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'"
                  >
                    {{ res.achieved.toFixed(2) }}%
                  </span>
                  <span v-else class="font-mono text-xs text-primary font-semibold flex items-center gap-1">
                    <Icon v-if="getEnsembleModelStatus(res.id) === 'active'" name="lucide:loader-2" size="11" class="animate-spin" />
                    {{ getEnsembleModelStatus(res.id) === 'active' ? 'Evaluating' : 'Queued' }}
                  </span>
                </div>
              </div>

              <div class="mt-2.5 pt-2 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Guard Decision:</span>
                <span class="font-semibold text-foreground">
                  {{
                    isTrainingActive && getEnsembleModelStatus(res.id) === 'active'
                      ? 'Ongoing'
                      : isTrainingActive && getEnsembleModelStatus(res.id) === 'pending'
                        ? 'Queued'
                        : res.promoted
                          ? 'Updated'
                          : 'Preserved'
                  }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-xs text-muted-foreground flex items-center justify-between">
          <span class="flex items-center gap-1.5 font-mono text-[11px]">
            <Icon name="lucide:clock" size="14" />
            Last Retrain: {{ stats?.gathered_dataset.last_trained_at ? new Date(stats.gathered_dataset.last_trained_at).toLocaleString() : 'Recent Session' }}
          </span>
          <span class="font-mono text-[11px] text-foreground font-semibold">
            {{ (stats?.ai_service.total_baseline_images ?? 15719) + (stats?.gathered_dataset.total ?? 0) }} total images in training split
          </span>
        </div>
      </div>
    </AppModal>
  </div>
</template>
