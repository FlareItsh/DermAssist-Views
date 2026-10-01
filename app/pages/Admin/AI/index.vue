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
  const terminalInputRef = ref<HTMLInputElement | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  // Real Terminal Controls & CLI State
  const terminalInput = ref('')
  const commandHistory = ref<string[]>([])
  const historyIndex = ref(-1)
  const isAutoScrollEnabled = ref(true)
  const isTerminalFullscreen = ref(false)
  const localSessionLogs = ref<string[]>([
    'System initialized: dermassist-ai-runtime v2.4.0 (PyTorch 2.x)',
    'Type "help" to list available commands, or "train" to start pipeline.'
  ])

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
    { id: 'efficientnet_v2', name: 'EfficientNet-V2', short: 'EfficientNet', step: 3 }
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
    swin_transformer:
      'Captures fine micro-textures, borders, and shifted-window local spatial correlations.',
    resnet50: 'Provides robust macro-lesion geometric features across diverse skin phototypes.',
    efficientnet_v2:
      'Compound-scaled convolutional network ensuring balanced depth, width, and resolution.',
    ensemble:
      'Tri-fusion neural pipeline training Vision Attention, Deep Residuals, and Progressively Scaled CNNs in consensus.'
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
      {
        id: 'swin_transformer',
        name: 'Swin Transformer',
        baseline: 94.04,
        achieved: 94.04,
        promoted: false,
        weights: 'best_model_swin.pth'
      },
      {
        id: 'resnet50',
        name: 'ResNet50',
        baseline: 93.33,
        achieved: 93.33,
        promoted: false,
        weights: 'best_model_resnet50.pth'
      },
      {
        id: 'efficientnet_v2',
        name: 'EfficientNet-V2',
        baseline: 95.44,
        achieved: 95.44,
        promoted: false,
        weights: 'best_model_efficientnet_v2.pth'
      }
    ]

    for (const m of models) {
      const guardIdx = logs.findIndex(l =>
        l.toUpperCase().includes(`VALIDATION GUARD: ${m.id.toUpperCase()}`)
      )
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
      if (isAutoScrollEnabled.value && logContainer.value) {
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
      const msg =
        err.data?.message || err.data?.error || err.message || 'Failed to start retraining.'
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

  // Unified terminal display logs
  const displayedTerminalLogs = computed(() => {
    const backendLogs = trainingStatus.value?.logs || []
    if (backendLogs.length === 0) {
      return localSessionLogs.value
    }
    // Return backend logs combined with any user executed commands that occurred
    return backendLogs
  })

  const scrollToBottom = () => {
    if (isAutoScrollEnabled.value && logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  }

  const toggleAutoScroll = () => {
    isAutoScrollEnabled.value = !isAutoScrollEnabled.value
    if (isAutoScrollEnabled.value) {
      scrollToBottom()
      toast.success('Terminal auto-scroll enabled')
    } else {
      toast.info('Terminal auto-scroll paused')
    }
  }

  const toggleFullscreen = () => {
    isTerminalFullscreen.value = !isTerminalFullscreen.value
    nextTick(() => {
      scrollToBottom()
      terminalInputRef.value?.focus()
    })
  }

  const copyTerminalOutput = async () => {
    const logs = displayedTerminalLogs.value.join('\n')
    try {
      await navigator.clipboard.writeText(logs)
      toast.success('Terminal output copied to clipboard!')
    } catch {
      toast.error('Failed to copy terminal logs.')
    }
  }

  const clearTerminalBuffer = () => {
    localSessionLogs.value = [
      'Console buffer cleared.',
      'Type "help" to list available commands, or "train" to start pipeline.'
    ]
    if (trainingStatus.value) {
      trainingStatus.value.logs = []
    }
    toast.success('Terminal buffer cleared.')
  }

  const executeTerminalCommand = async () => {
    const rawCmd = terminalInput.value.trim()
    if (!rawCmd) return

    // Push to history
    commandHistory.value.push(rawCmd)
    historyIndex.value = commandHistory.value.length
    terminalInput.value = ''

    const logPrompt = `dermassist@ai-worker:~/algorithms$ ${rawCmd}`
    const pushLog = (line: string) => {
      if (trainingStatus.value?.logs) {
        trainingStatus.value.logs.push(line)
      } else {
        localSessionLogs.value.push(line)
      }
    }

    pushLog(logPrompt)

    const parts = rawCmd.split(' ')
    const cmd = parts[0].toLowerCase()
    const arg1 = parts[1]

    if (cmd === 'clear' || cmd === 'cls') {
      clearTerminalBuffer()
      return
    }

    if (cmd === 'help') {
      pushLog('================== DERMASSIST CLI HELP ==================')
      pushLog('  train [epochs]     Start multi-model retraining (default: 3)')
      pushLog('  stop / cancel      Stop the running training pipeline')
      pushLog('  status             Display current pipeline training metrics')
      pushLog('  models             List available production .pth checkpoints')
      pushLog('  sync               Synchronize new patient clinical scans')
      pushLog('  device             Show compute hardware device (CPU/CUDA)')
      pushLog('  history            View loss and accuracy training progression')
      pushLog('  stats              Show gathered dataset counts & classes')
      pushLog('  clear              Clear the terminal buffer')
      pushLog('=========================================================')
    } else if (cmd === 'train' || cmd === 'retrain') {
      if (isTrainingActive.value) {
        pushLog('❌ Error: A training pipeline is already active.')
      } else {
        const ep = arg1 && !isNaN(Number(arg1)) ? Number(arg1) : Number(selectedEpochs.value)
        pushLog(`🚀 Triggering Tri-Model retraining for ${ep} epoch(s) per model...`)
        selectedEpochs.value = ep
        await handleStartTraining()
      }
    } else if (cmd === 'stop' || cmd === 'cancel') {
      if (!isTrainingActive.value) {
        pushLog('ℹ No active training pipeline running.')
      } else {
        pushLog('🛑 Submitting cancellation signal to Python background worker...')
        await handleExecuteCancel()
      }
    } else if (cmd === 'status') {
      const s = trainingStatus.value
      pushLog(`[STATUS] State: ${(s?.status || 'idle').toUpperCase()}`)
      pushLog(`[STATUS] Active Backbone: ${s?.architecture || 'None'}`)
      pushLog(`[STATUS] Overall Progress: ${s?.progress ?? 0}%`)
      pushLog(`[STATUS] Current Batch: ${s?.current_batch ?? 0} / ${s?.total_batches ?? 0}`)
      pushLog(
        `[STATUS] Train Loss: ${s?.train_loss ?? '0.0000'} | Train Acc: ${s?.train_acc ?? '0.00'}%`
      )
      pushLog(
        `[STATUS] Val Acc: ${s?.val_acc ?? '0.00'}% | Baseline: ${s?.baseline_val_acc ?? '0.00'}%`
      )
      pushLog(
        `[STATUS] Elapsed: ${formatDuration(s?.elapsed_seconds)} | Remaining: ~${formatDuration(s?.eta_seconds)}`
      )
    } else if (cmd === 'models') {
      const files = stats.value?.ai_service.models_available || [
        'best_model_swin_transformer.pth',
        'best_model_resnet50.pth',
        'best_model_efficientnet_v2.pth'
      ]
      pushLog('--- Deployed Production Model Weights ---')
      files.forEach(f => {
        pushLog(`  • models/production/${f} [Active Checkpoint]`)
      })
    } else if (cmd === 'device') {
      pushLog('Compute Target: CPU / CUDA Hardware Accelerator')
      pushLog('Torch Backend: PyTorch 2.x (Optimized float32 / Autocast)')
      pushLog('Ensemble Mode: Consensus Voting (Swin + ResNet50 + EfficientNet-V2)')
    } else if (cmd === 'sync') {
      pushLog('Synchronizing new patient clinical scans from Laravel storage...')
      await handleSyncDataset()
    } else if (cmd === 'stats') {
      const g = stats.value?.gathered_dataset
      const a = stats.value?.ai_service
      pushLog(`Baseline Dataset Images: ${a?.total_baseline_images ?? 15719}`)
      pushLog(
        `Gathered Clinical Scans : ${g?.total ?? 0} (Acne: ${g?.by_category?.acne ?? 0}, Eczema: ${g?.by_category?.eczema ?? 0}, Herpes: ${g?.by_category?.herpes ?? 0})`
      )
      pushLog(`Untrained Scans Pending: ${g?.untrained_count ?? 0}`)
    } else if (cmd === 'history') {
      const hist = trainingStatus.value?.history
      if (!hist || hist.train_loss.length === 0) {
        pushLog('No historical epoch metrics recorded for current session yet.')
      } else {
        pushLog('Epoch | Train Loss | Train Acc | Val Loss | Val Acc')
        pushLog('------+------------+-----------+----------+--------')
        for (let i = 0; i < hist.train_loss.length; i++) {
          pushLog(
            ` ${i + 1}    |   ${hist.train_loss[i]}   |  ${hist.train_acc[i]}%  |  ${hist.val_loss[i]}  | ${hist.val_acc[i]}%`
          )
        }
      }
    } else {
      pushLog(`bash: command not found: ${cmd}. Type "help" for a list of valid commands.`)
    }

    await nextTick()
    scrollToBottom()
  }

  const navigateHistory = (direction: 'up' | 'down') => {
    if (commandHistory.value.length === 0) return
    if (direction === 'up') {
      if (historyIndex.value > 0) {
        historyIndex.value--
        terminalInput.value = commandHistory.value[historyIndex.value]
      }
    } else if (direction === 'down') {
      if (historyIndex.value < commandHistory.value.length - 1) {
        historyIndex.value++
        terminalInput.value = commandHistory.value[historyIndex.value]
      } else {
        historyIndex.value = commandHistory.value.length
        terminalInput.value = ''
      }
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
        <div class="mb-1 flex items-center gap-2">
          <h1 class="text-foreground text-2xl font-black md:text-3xl">AI Model Intelligence</h1>
        </div>
        <p class="text-muted-foreground text-sm">
          Monitor PyTorch vision backbones, trigger clinical fine-tuning, and supervise automated
          Validation Guard accuracy.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <AppButton
          variant="outline"
          class="gap-2"
          @click="showResultsModal = true"
        >
          <Icon
            name="lucide:clipboard-check"
            size="16"
          />
          Retraining Report
        </AppButton>

        <AppButton
          variant="outline"
          class="gap-2"
          :loading="isSyncing"
          :disabled="isTrainingActive"
          @click="handleSyncDataset"
        >
          <Icon
            name="lucide:refresh-cw"
            size="16"
          />
          Sync Scan Images
        </AppButton>

        <AppButton
          v-if="isTrainingActive"
          variant="destructive"
          class="gap-2 shadow-sm"
          @click="confirmCancelTraining"
        >
          <Icon
            name="lucide:square"
            size="16"
          />
          Stop Pipeline
        </AppButton>
      </div>
    </div>

    <!-- Top Metrics Overview Grid -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Metric 1: Active Architecture -->
      <div
        class="bg-card border-border flex flex-col justify-between rounded-3xl border p-5 shadow-sm"
      >
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
            >Inference Engine</span
          >
          <div
            class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl"
          >
            <Icon
              name="lucide:layers"
              size="18"
            />
          </div>
        </div>
        <div class="mt-4">
          <h3 class="text-foreground flex items-center gap-1.5 text-base font-bold">
            3-Model Ensemble
            <span
              class="bg-primary/10 text-primary inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              >Tri-Fusion</span
            >
          </h3>
          <p class="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
            <span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            Swin + ResNet + EfficientNet
          </p>
        </div>
      </div>

      <!-- Metric 2: Baseline Benchmark Data -->
      <div
        class="bg-card border-border flex flex-col justify-between rounded-3xl border p-5 shadow-sm"
      >
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
            >Baseline Dataset</span
          >
          <div
            class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl"
          >
            <Icon
              name="lucide:database"
              size="18"
            />
          </div>
        </div>
        <div class="mt-4">
          <h3 class="text-foreground text-2xl font-black">
            {{ stats?.ai_service.total_baseline_images.toLocaleString() || '15,719' }}
            <span class="text-muted-foreground text-xs font-normal">images</span>
          </h3>
          <p class="text-muted-foreground mt-0.5 text-xs">Clinical benchmark foundation</p>
        </div>
      </div>

      <!-- Metric 3: Gathered Clinical Scans -->
      <div
        class="bg-card border-border flex flex-col justify-between rounded-3xl border p-5 shadow-sm"
      >
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
            >Gathered Scans</span
          >
          <div
            class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl"
          >
            <Icon
              name="lucide:images"
              size="18"
            />
          </div>
        </div>
        <div class="mt-4">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="text-foreground text-2xl font-black">
              {{ stats?.gathered_dataset.total ?? 0 }}
              <span class="text-muted-foreground text-xs font-normal">collected</span>
            </h3>
            <span
              v-if="(stats?.gathered_dataset.untrained_count ?? 0) > 0"
              class="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 shadow-xs dark:text-amber-400"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"></span>
              {{ stats?.gathered_dataset.untrained_count }} new untrained
            </span>
            <span
              v-else-if="(stats?.gathered_dataset.total ?? 0) > 0"
              class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
            >
              <Icon
                name="lucide:check"
                size="12"
              />
              All trained
            </span>
          </div>
          <p class="text-muted-foreground mt-1 text-xs">
            Acne: {{ stats?.gathered_dataset.by_category.acne ?? 0 }} | Eczema:
            {{ stats?.gathered_dataset.by_category.eczema ?? 0 }} | Herpes:
            {{ stats?.gathered_dataset.by_category.herpes ?? 0 }}
          </p>
        </div>
      </div>

      <!-- Metric 4: Validation Guard Safeguard -->
      <div
        class="bg-card border-border flex flex-col justify-between rounded-3xl border p-5 shadow-sm"
      >
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
            >Accuracy Guard</span
          >
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"
          >
            <Icon
              name="lucide:shield-check"
              size="18"
            />
          </div>
        </div>
        <div class="mt-4">
          <h3 class="text-foreground flex items-center gap-1.5 text-base font-bold">
            Validation Guard
            <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
          </h3>
          <p class="text-muted-foreground mt-0.5 text-xs">
            Rejects lower accuracy; keeps best model
          </p>
        </div>
      </div>
    </div>

    <!-- Active Pipeline Status & Live Progress Card -->
    <div class="bg-card border-border space-y-5 rounded-3xl border p-6 shadow-sm">
      <div
        class="border-border flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row sm:items-center"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-2xl"
            :class="
              isTrainingActive
                ? 'bg-primary/10 text-primary animate-spin'
                : trainingStatus?.model_promoted
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-muted text-muted-foreground'
            "
          >
            <Icon
              :name="
                isTrainingActive
                  ? 'lucide:loader-2'
                  : trainingStatus?.model_promoted
                    ? 'lucide:check-circle-2'
                    : 'lucide:brain'
              "
              size="20"
            />
          </div>
          <div>
            <h3 class="text-foreground flex items-center gap-2 text-base font-bold">
              {{ displayTrainingMessage }}
            </h3>
            <p class="text-muted-foreground mt-0.5 max-w-xl text-xs leading-relaxed">
              {{ displayModelDescription }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <AppBadge
            v-if="trainingStatus?.status === 'idle' || !trainingStatus"
            color="gray"
            variant="subtle"
          >
            Engine Idle
          </AppBadge>
          <AppBadge
            v-else-if="trainingStatus?.status === 'syncing'"
            color="info"
            variant="solid"
          >
            Syncing Images
          </AppBadge>
          <AppBadge
            v-else-if="trainingStatus?.status === 'training'"
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
        </div>
      </div>

      <!-- Progress Track -->
      <div class="space-y-3.5">
        <!-- 3-Model Sequence Divided Cards (Distinct Visual Design) -->
        <div
          v-if="isTrainingActive || trainingStatus?.status === 'completed'"
          class="space-y-1.5 pt-1"
        >
          <div class="flex justify-between text-xs font-semibold">
            <span class="text-muted-foreground">Tri-Model Sequence</span>
            <span class="text-foreground font-mono">
              {{
                trainingStatus?.status === 'completed'
                  ? '3 of 3 Backbones Finished'
                  : `Model ${Math.max(
                      1,
                      ['swin_transformer', 'resnet50', 'efficientnet_v2'].indexOf(
                        (trainingStatus?.architecture || '').toLowerCase()
                      ) + 1
                    )} of 3`
              }}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div
              v-for="m in ensembleModelsList"
              :key="m.id"
              class="flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 transition-all duration-300"
              :class="{
                'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400':
                  getEnsembleModelStatus(m.id) === 'completed',
                'bg-primary/10 border-primary text-primary ring-primary/30 shadow-xs ring-1':
                  getEnsembleModelStatus(m.id) === 'active',
                'bg-muted/40 border-border/80 text-muted-foreground opacity-60':
                  getEnsembleModelStatus(m.id) === 'pending'
              }"
            >
              <div class="flex min-w-0 items-center gap-2">
                <span
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="{
                    'bg-emerald-500 text-white': getEnsembleModelStatus(m.id) === 'completed',
                    'bg-primary text-white': getEnsembleModelStatus(m.id) === 'active',
                    'bg-muted-foreground/20 text-muted-foreground':
                      getEnsembleModelStatus(m.id) === 'pending'
                  }"
                >
                  {{ m.step }}
                </span>
                <span class="truncate text-xs font-bold">{{ m.name }}</span>
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
                <span
                  v-else
                  class="text-muted-foreground font-mono text-[10px] tracking-wider uppercase"
                  >Queued</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Sub-progress indicators (Segmented Epochs + Thin Step Bar) -->
        <div
          v-if="trainingStatus?.total_epochs && isTrainingActive"
          class="space-y-3"
        >
          <!-- Epoch Progress -->
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs font-semibold">
              <span class="text-muted-foreground">Epoch</span>
              <span class="text-foreground font-mono"
                >Epoch {{ trainingStatus.current_epoch }} of {{ trainingStatus.total_epochs }}</span
              >
            </div>
            <!-- Segmented Bars for Epochs -->
            <div
              class="grid gap-2"
              :style="{
                gridTemplateColumns: `repeat(${trainingStatus.total_epochs}, minmax(0, 1fr))`
              }"
            >
              <div
                v-for="ep in trainingStatus.total_epochs"
                :key="ep"
                class="bg-muted h-2 overflow-hidden rounded-full p-0.5"
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
                <span class="text-muted-foreground"
                  >({{
                    Math.min(
                      100,
                      Math.round(
                        ((trainingStatus.current_batch || 0) /
                          Math.max(1, trainingStatus.total_batches || 1)) *
                          100
                      )
                    )
                  }}%)</span
                >
              </span>
            </div>
            <!-- Thin Step Progress Bar Track -->
            <div class="bg-muted h-2 w-full overflow-hidden rounded-full p-0.5">
              <div
                class="bg-primary h-full rounded-full transition-all duration-150"
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
          <div
            class="bg-muted border-border/40 h-4.5 w-full overflow-hidden rounded-full border p-0.5"
          >
            <div
              class="bg-primary shadow-primary/30 h-full rounded-full shadow-xs transition-all duration-300"
              :style="{ width: `${trainingStatus?.progress ?? 0}%` }"
            ></div>
          </div>
          <div class="text-muted-foreground flex justify-between pt-0.5 text-xs">
            <span>Elapsed Time: {{ formatDuration(trainingStatus?.elapsed_seconds) }}</span>
            <span v-if="trainingStatus?.eta_seconds && isTrainingActive">
              Estimated Remaining: ~{{ formatDuration(trainingStatus.eta_seconds) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Live 4-Metric Badges Grid -->
      <div class="grid grid-cols-2 gap-3 pt-2 md:grid-cols-4">
        <div class="bg-background border-border rounded-2xl border p-4 text-center">
          <p class="text-muted-foreground text-xs font-semibold">Train Loss</p>
          <p class="text-foreground mt-1 text-xl font-black">
            {{ trainingStatus?.train_loss ?? '0.0000' }}
          </p>
        </div>
        <div class="bg-background border-border rounded-2xl border p-4 text-center">
          <p class="text-muted-foreground text-xs font-semibold">Train Accuracy</p>
          <p class="text-foreground mt-1 text-xl font-black">
            {{ trainingStatus?.train_acc ?? '0.00' }}%
          </p>
        </div>
        <div class="bg-background border-border rounded-2xl border p-4 text-center">
          <p class="text-muted-foreground text-xs font-semibold">Val Accuracy</p>
          <p class="text-foreground mt-1 text-xl font-black">
            {{ trainingStatus?.val_acc ?? '0.00' }}%
          </p>
        </div>
        <div class="bg-background border-border rounded-2xl border p-4 text-center">
          <p class="text-muted-foreground text-xs font-semibold">Baseline Acc</p>
          <p class="text-foreground mt-1 text-xl font-black">
            {{ trainingStatus?.baseline_val_acc ?? '0.00' }}%
          </p>
        </div>
      </div>

      <!-- Completion Summary: Full 3-Model Outcome Breakdown -->
      <div
        v-if="trainingStatus?.status === 'completed'"
        class="space-y-4 pt-2"
      >
        <div class="border-border flex items-center justify-between border-t pt-4">
          <div class="flex items-center gap-2">
            <Icon
              name="lucide:clipboard-check"
              size="18"
              class="text-primary"
            />
            <h4 class="text-foreground text-sm font-bold">
              Retraining Results & Validation Guard Summary
            </h4>
          </div>
          <AppBadge
            :color="trainingStatus.model_promoted ? 'success' : 'gray'"
            size="sm"
          >
            {{
              trainingStatus.model_promoted
                ? 'Production Models Updated'
                : 'Historical Baselines Protected'
            }}
          </AppBadge>
        </div>

        <!-- 3-Model Results Cards Grid -->
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div
            v-for="res in parsedEnsembleResults"
            :key="res.id"
            class="rounded-2xl border p-4 transition-all"
            :class="
              res.promoted
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'bg-background border-border'
            "
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <h5 class="text-foreground text-sm font-bold">{{ res.name }}</h5>
                <p class="text-muted-foreground font-mono text-[11px]">{{ res.weights }}</p>
              </div>
              <AppBadge
                :color="res.promoted ? 'success' : 'gray'"
                size="sm"
              >
                {{ res.promoted ? 'Promoted' : 'Preserved' }}
              </AppBadge>
            </div>

            <div class="border-border/60 mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
              <div>
                <span class="text-muted-foreground block text-[11px]">Baseline Acc</span>
                <span class="text-foreground font-mono font-bold"
                  >{{ res.baseline.toFixed(2) }}%</span
                >
              </div>
              <div>
                <span class="text-muted-foreground block text-[11px]">Achieved Acc</span>
                <span
                  class="font-mono font-bold"
                  :class="
                    res.achieved >= res.baseline
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  "
                >
                  {{ res.achieved.toFixed(2) }}%
                </span>
              </div>
            </div>

            <div
              class="border-border/40 mt-2.5 flex items-center justify-between border-t pt-2 text-[11px]"
            >
              <span class="text-muted-foreground">Guard Decision</span>
              <span
                class="flex items-center gap-1 font-semibold"
                :class="
                  res.promoted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                "
              >
                <Icon
                  :name="res.promoted ? 'lucide:badge-check' : 'lucide:shield-check'"
                  size="13"
                />
                {{ res.promoted ? 'New Weights Deployed' : 'Baseline Preserved' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main 2-Column Section: Configuration & Console -->
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <!-- Left Column: Unified Ensemble Training Control (5 cols) -->
      <div class="space-y-6 lg:col-span-5">
        <div class="bg-card border-border space-y-5 rounded-3xl border p-6 shadow-sm">
          <div class="border-border flex items-center justify-between border-b pb-3">
            <h3 class="text-foreground flex items-center gap-2 text-base font-bold">
              <Icon
                name="lucide:sparkles"
                size="18"
                class="text-primary"
              />
              Retrain Ensemble
            </h3>
            <AppBadge
              color="primary"
              size="sm"
              variant="subtle"
              >All 3 Backbones</AppBadge
            >
          </div>

          <!-- Sequential Pipeline Visual Indicator -->
          <div class="bg-muted/40 border-border/80 space-y-2.5 rounded-2xl border p-4">
            <div class="text-foreground flex items-center justify-between text-xs font-bold">
              <span>Tri-Model Training Order</span>
              <span class="text-primary text-[11px]">100% Equal Exposure</span>
            </div>
            <div class="flex items-center justify-between gap-1.5 pt-1">
              <div
                class="bg-background border-border flex-1 rounded-xl border px-2 py-2 text-center"
              >
                <span class="text-primary block text-[10px] font-bold">Step 1</span>
                <span class="text-foreground text-xs font-semibold">Swin</span>
              </div>
              <Icon
                name="lucide:arrow-right"
                size="14"
                class="text-muted-foreground shrink-0"
              />
              <div
                class="bg-background border-border flex-1 rounded-xl border px-2 py-2 text-center"
              >
                <span class="text-primary block text-[10px] font-bold">Step 2</span>
                <span class="text-foreground text-xs font-semibold">ResNet50</span>
              </div>
              <Icon
                name="lucide:arrow-right"
                size="14"
                class="text-muted-foreground shrink-0"
              />
              <div
                class="bg-background border-border flex-1 rounded-xl border px-2 py-2 text-center"
              >
                <span class="text-primary block text-[10px] font-bold">Step 3</span>
                <span class="text-foreground text-xs font-semibold">EfficientNet</span>
              </div>
            </div>
            <p class="text-muted-foreground pt-1 text-[11px] leading-relaxed">
              All 3 models are fine-tuned sequentially on the exact same clinical dataset and each
              independently tested by the Validation Guard.
            </p>
          </div>

          <!-- Epoch Selection -->
          <div
            class="space-y-2 pt-1"
            :class="{ 'opacity-60': isTrainingActive }"
          >
            <label
              class="text-muted-foreground block text-xs font-semibold tracking-wider uppercase"
            >
              Training Epochs (Per Model)
            </label>
            <select
              v-model="selectedEpochs"
              :disabled="isTrainingActive"
              class="bg-background border-border text-foreground focus:ring-primary w-full rounded-xl border px-3.5 py-2.5 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed"
            >
              <option :value="3">3 Epochs / Model (Recommended — Fast & Balanced)</option>
              <option :value="5">5 Epochs / Model (Standard fine-tuning)</option>
              <option :value="10">10 Epochs / Model (Deep convergence)</option>
            </select>
            <p class="text-muted-foreground text-[11px]">
              Fine-tuning starts from existing weights using Cosine Annealing learning rate
              schedule.
            </p>
          </div>

          <!-- Untrained Notice Banner -->
          <div
            v-if="(stats?.gathered_dataset.untrained_count ?? 0) > 0"
            class="flex items-center gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
          >
            <Icon
              name="lucide:sparkles"
              size="16"
              class="shrink-0 text-amber-500"
            />
            <span>
              <strong>{{ stats?.gathered_dataset.untrained_count }} new scan(s)</strong> ready to be
              incorporated into the model.
            </span>
          </div>

          <!-- Sync Toggle -->
          <div class="border-border border-t pt-2">
            <label
              class="flex items-start gap-3"
              :class="isTrainingActive ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
            >
              <input
                v-model="syncDataset"
                :disabled="isTrainingActive"
                type="checkbox"
                class="border-border text-primary focus:ring-primary mt-1 h-4 w-4 rounded disabled:cursor-not-allowed"
              />
              <div>
                <span class="text-foreground block text-xs font-bold">Sync Clinical Scans</span>
                <span class="text-muted-foreground mt-0.5 block text-[11px] leading-relaxed">
                  Pulls newly uploaded Acne, Eczema, and Herpes scans and automatically removes
                  deleted images from the training queue.
                </span>
              </div>
            </label>
          </div>

          <!-- Start Button -->
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
              Browse Dataset
            </AppButton>
            <AppButton
              v-if="isTrainingActive"
              variant="destructive"
              size="lg"
              class="w-full justify-center gap-2 font-bold shadow-md"
              @click="confirmCancelTraining"
            >
              <Icon
                name="lucide:square"
                size="18"
              />
              Stop Pipeline
            </AppButton>
            <AppButton
              v-else
              variant="solid"
              size="lg"
              class="w-full justify-center gap-2 font-bold shadow-md"
              :loading="isStarting"
              @click="handleStartTraining"
            >
              <Icon
                name="lucide:play"
                size="18"
              />
              Retrain All 3 Models
            </AppButton>
          </div>
        </div>

        <!-- Safeguard Info Card -->
        <div
          class="bg-card border-border flex items-start gap-3.5 rounded-3xl border p-5 shadow-sm"
        >
          <div
            class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"
          >
            <Icon
              name="lucide:shield-check"
              size="20"
            />
          </div>
          <div>
            <h4 class="text-foreground text-sm font-bold">Independent Validation Guard</h4>
            <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
              Each model is tested against its own validation split. If a retrained backbone drops
              below its baseline accuracy, the guard preserves the existing weights to ensure zero
              diagnostic regression.
            </p>
          </div>
        </div>
      </div>

      <!-- Right Column: Terminal Activity Console (7 cols) -->
      <div class="space-y-6 lg:col-span-7">
        <!-- Monospace Console (Normal or Fullscreen) -->
        <div
          class="flex flex-col overflow-hidden rounded-3xl border border-zinc-800/90 bg-zinc-950 shadow-2xl transition-all duration-300"
          :class="
            isTerminalFullscreen
              ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl ring-1 ring-zinc-700'
              : 'h-[560px]'
          "
        >
          <!-- Console Window Top Bar (Authentic Unix/macOS Chrome) -->
          <div
            class="flex items-center justify-between border-b border-zinc-800/90 bg-zinc-900/95 px-4 py-3 select-none"
          >
            <!-- Left: Traffic Lights & Terminal Shell Title -->
            <div class="flex items-center gap-3">
              <!-- Window Traffic Light Buttons -->
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Close / Clear Terminal Buffer"
                  class="h-3 w-3 cursor-pointer rounded-full bg-red-500/80 transition-transform hover:bg-red-500 hover:brightness-110 active:scale-95"
                  @click="clearTerminalBuffer"
                ></button>
                <button
                  type="button"
                  title="Toggle Auto-Scroll"
                  class="h-3 w-3 cursor-pointer rounded-full bg-amber-500/80 transition-transform hover:bg-amber-500 hover:brightness-110 active:scale-95"
                  @click="toggleAutoScroll"
                ></button>
                <button
                  type="button"
                  title="Toggle Fullscreen Terminal"
                  class="h-3 w-3 cursor-pointer rounded-full bg-emerald-500/80 transition-transform hover:bg-emerald-500 hover:brightness-110 active:scale-95"
                  @click="toggleFullscreen"
                ></button>
              </div>

              <!-- Terminal Shell Identification Tab -->
              <div class="flex items-center gap-2 border-l border-zinc-800 pl-2 font-mono text-xs">
                <span
                  class="inline-flex items-center gap-1.5 rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-zinc-300"
                >
                  <Icon
                    name="lucide:terminal"
                    size="13"
                    class="text-emerald-400"
                  />
                  dermassist-ai-worker (pty/0)
                </span>
                <span
                  class="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase"
                  :class="
                    isTrainingActive
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'bg-zinc-800/50 text-zinc-400'
                  "
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="isTrainingActive ? 'animate-pulse bg-emerald-400' : 'bg-zinc-500'"
                  ></span>
                  {{
                    isTrainingActive ? (trainingStatus?.status || 'Active').toUpperCase() : 'IDLE'
                  }}
                </span>
              </div>
            </div>

            <!-- Right: Utility Controls (Auto-Scroll, Copy, Clear, Fullscreen, Stop) -->
            <div class="flex items-center gap-1.5 sm:gap-2">
              <!-- Auto-Scroll Toggle -->
              <button
                type="button"
                :title="
                  isAutoScrollEnabled
                    ? 'Auto-scroll is ON (Click to Pause)'
                    : 'Auto-scroll is PAUSED (Click to Resume)'
                "
                class="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 font-mono text-[11px] font-medium transition-all"
                :class="
                  isAutoScrollEnabled
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border border-zinc-700 bg-zinc-800 text-zinc-400'
                "
                @click="toggleAutoScroll"
              >
                <Icon
                  :name="isAutoScrollEnabled ? 'lucide:arrow-down-to-line' : 'lucide:pause'"
                  size="12"
                />
                <span class="hidden sm:inline">{{
                  isAutoScrollEnabled ? 'Auto-Scroll' : 'Paused'
                }}</span>
              </button>

              <!-- Copy Output -->
              <button
                type="button"
                title="Copy Terminal Output"
                class="flex cursor-pointer items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-800/70 p-1.5 font-mono text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 sm:px-2 sm:py-1"
                @click="copyTerminalOutput"
              >
                <Icon
                  name="lucide:copy"
                  size="12"
                />
                <span class="hidden sm:inline">Copy</span>
              </button>

              <!-- Clear Buffer -->
              <button
                type="button"
                title="Clear Output Buffer"
                class="flex cursor-pointer items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-800/70 p-1.5 font-mono text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 sm:px-2 sm:py-1"
                @click="clearTerminalBuffer"
              >
                <Icon
                  name="lucide:trash-2"
                  size="12"
                />
                <span class="hidden sm:inline">Clear</span>
              </button>

              <!-- Fullscreen Toggle -->
              <button
                type="button"
                :title="isTerminalFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'"
                class="flex cursor-pointer items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-800/70 p-1.5 font-mono text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 sm:px-2 sm:py-1"
                @click="toggleFullscreen"
              >
                <Icon
                  :name="isTerminalFullscreen ? 'lucide:minimize-2' : 'lucide:maximize-2'"
                  size="12"
                />
              </button>

              <!-- Stop Training Button -->
              <button
                v-if="isTrainingActive"
                type="button"
                class="ml-1 flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-mono text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
                @click="confirmCancelTraining"
              >
                <Icon
                  name="lucide:square"
                  size="12"
                />
                <span class="font-bold">Stop</span>
              </button>
            </div>
          </div>

          <!-- Console Output Box (Monospace Stream) -->
          <div
            ref="logContainer"
            class="scrollbar-thin scrollbar-thumb-zinc-800 flex-1 space-y-1 overflow-y-auto p-4 font-mono text-[12px] text-zinc-300 select-text sm:p-5 sm:text-xs"
          >
            <!-- Welcome Terminal Banner -->
            <div
              class="space-y-0.5 border-b border-zinc-900 pb-2 text-[11px] text-zinc-500 select-none"
            >
              <div>Linux ai-worker 6.5.0-x86_64 #1 SMP PREEMPT DermAssist GNU/Linux</div>
              <div>
                Connected to PyTorch GPU/CPU worker at
                <span class="text-zinc-400">127.0.0.1:8001</span>
              </div>
              <div class="pt-1 text-emerald-400/90">
                Type <code class="rounded bg-zinc-900 px-1 py-0.5 text-emerald-300">help</code> for
                commands or
                <code class="rounded bg-zinc-900 px-1 py-0.5 text-emerald-300">train 3</code> to
                launch pipeline.
              </div>
            </div>

            <!-- Terminal Output Lines -->
            <div
              v-for="(log, idx) in displayedTerminalLogs"
              :key="idx"
              class="font-mono leading-relaxed break-all"
              :class="{
                'font-semibold text-emerald-400':
                  log.includes('SUCCESS') ||
                  log.includes('PASSED') ||
                  log.includes('promoted') ||
                  log.includes('🚀 Deployed'),
                'text-amber-400':
                  log.includes('VALIDATION GUARD') ||
                  log.includes('PREVENTED') ||
                  log.includes('cancelling') ||
                  log.includes('GUARD PRESERVED'),
                'font-semibold text-red-400':
                  log.includes('failed') || log.includes('ERROR') || log.includes('❌'),
                'font-medium text-cyan-400': log.includes('[STEP]') || log.includes('Epoch'),
                'text-primary font-bold': log.includes('dermassist@ai-worker'),
                'font-bold text-purple-400': log.includes('TRAINING BACKBONE'),
                'text-zinc-400':
                  !log.includes('SUCCESS') &&
                  !log.includes('PASSED') &&
                  !log.includes('failed') &&
                  !log.includes('[STEP]') &&
                  !log.includes('TRAINING BACKBONE')
              }"
            >
              <span
                v-if="log.startsWith('dermassist@ai-worker')"
                class="font-bold text-emerald-400"
                >$
              </span>
              {{
                log.startsWith('dermassist@ai-worker')
                  ? log.replace('dermassist@ai-worker:~/algorithms$ ', '')
                  : log
              }}
            </div>

            <!-- Live Active Cursor Indicator when Training is running -->
            <div
              v-if="isTrainingActive"
              class="text-primary flex items-center gap-2 pt-1 font-mono text-xs"
            >
              <span class="inline-block h-4 w-2 animate-pulse bg-emerald-400"></span>
              <span class="text-[11px] text-zinc-500"
                >Training worker executing in background...</span
              >
            </div>
          </div>

          <!-- Interactive Terminal Prompt Input Bar -->
          <div
            class="flex items-center gap-2 border-t border-zinc-800 bg-zinc-900/95 px-4 py-2.5 font-mono text-xs"
          >
            <span class="hidden font-bold text-emerald-400 select-none sm:inline"
              >dermassist@ai-worker:~/algorithms$</span
            >
            <span class="font-bold text-emerald-400 select-none sm:hidden">$</span>
            <input
              ref="terminalInputRef"
              v-model="terminalInput"
              type="text"
              placeholder="type 'help', 'status', 'train', 'models', or 'clear'..."
              class="flex-1 bg-transparent font-mono text-xs text-zinc-100 caret-emerald-400 placeholder:text-zinc-600 focus:outline-none"
              @keydown.enter.prevent="executeTerminalCommand"
              @keydown.up.prevent="navigateHistory('up')"
              @keydown.down.prevent="navigateHistory('down')"
            />
            <button
              type="button"
              class="cursor-pointer rounded bg-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-300 transition-colors select-none hover:bg-zinc-700"
              @click="executeTerminalCommand"
            >
              Enter
            </button>
          </div>

          <!-- Console Footer Bar -->
          <div
            class="flex items-center justify-between border-t border-zinc-900 bg-zinc-950 px-4 py-2 font-mono text-[11px] text-zinc-500 select-none"
          >
            <span class="flex items-center gap-1.5">
              <Icon
                name="lucide:cpu"
                size="12"
                class="text-zinc-400"
              />
              <span>Non-blocking FastAPI Worker</span>
            </span>
            <span class="flex items-center gap-2">
              <span>{{ displayedTerminalLogs.length }} lines</span>
              <span class="text-zinc-700">•</span>
              <span class="text-emerald-500/80">Hot-reload Active</span>
            </span>
          </div>
        </div>

        <!-- Production Model Inventory -->
        <div class="bg-card border-border space-y-4 rounded-3xl border p-6 shadow-sm">
          <div class="flex items-center justify-between">
            <h4 class="text-foreground flex items-center gap-2 text-sm font-bold">
              <Icon
                name="lucide:hard-drive"
                size="16"
                class="text-primary"
              />
              Deployed Production Model Checkpoints
            </h4>
            <AppBadge
              color="gray"
              size="sm"
              >models/production/</AppBadge
            >
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              v-for="modelFile in stats?.ai_service.models_available || [
                'best_model_swin_transformer.pth',
                'best_model_resnet50.pth'
              ]"
              :key="modelFile"
              class="bg-background border-border flex items-center justify-between rounded-2xl border p-3.5"
            >
              <div class="flex items-center gap-2.5 overflow-hidden">
                <Icon
                  name="lucide:file-check"
                  size="16"
                  class="text-primary shrink-0"
                />
                <span class="text-foreground truncate font-mono text-xs font-medium">{{
                  modelFile
                }}</span>
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
        <div
          class="bg-muted/40 border-border flex flex-col items-start justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center"
        >
          <div class="flex items-center gap-3">
            <div
              class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold"
            >
              <Icon
                :name="isTrainingActive ? 'lucide:loader-2' : 'lucide:shield-check'"
                size="22"
                :class="{ 'animate-spin': isTrainingActive }"
              />
            </div>
            <div>
              <h4 class="text-foreground text-sm font-bold">Validation Guard Status</h4>
              <p class="text-muted-foreground text-xs">
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
          <AppBadge
            :color="
              isTrainingActive ? 'primary' : trainingStatus?.model_promoted ? 'success' : 'gray'
            "
            class="shrink-0"
          >
            {{
              isTrainingActive
                ? 'Ongoing'
                : trainingStatus?.model_promoted
                  ? 'Promoted'
                  : 'Protected'
            }}
          </AppBadge>
        </div>

        <!-- 3-Model Results Cards Grid in Modal -->
        <div class="space-y-3">
          <h5 class="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            Ensemble Model Breakdown
          </h5>
          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div
              v-for="res in parsedEnsembleResults"
              :key="res.id"
              class="flex flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-all"
              :class="{
                'border-emerald-500/30 bg-emerald-500/10': res.promoted && !isTrainingActive,
                'bg-primary/10 border-primary ring-primary/30 shadow-xs ring-1':
                  isTrainingActive && getEnsembleModelStatus(res.id) === 'active',
                'bg-background border-border':
                  !res.promoted &&
                  !(isTrainingActive && getEnsembleModelStatus(res.id) === 'active')
              }"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 pr-1">
                  <h6 class="text-foreground truncate text-sm font-bold">{{ res.name }}</h6>
                  <p class="text-muted-foreground truncate font-mono text-[10px]">
                    {{ res.weights }}
                  </p>
                </div>
                <AppBadge
                  :color="
                    isTrainingActive && getEnsembleModelStatus(res.id) === 'active'
                      ? 'primary'
                      : res.promoted
                        ? 'success'
                        : 'gray'
                  "
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

              <div class="border-border/60 mt-3 grid grid-cols-2 gap-2 border-t pt-2.5 text-xs">
                <div>
                  <span class="text-muted-foreground block text-[10px]">Baseline</span>
                  <span class="text-foreground font-mono text-xs font-bold"
                    >{{ res.baseline.toFixed(2) }}%</span
                  >
                </div>
                <div>
                  <span class="text-muted-foreground block text-[10px]">Achieved</span>
                  <span
                    v-if="!isTrainingActive || getEnsembleModelStatus(res.id) === 'completed'"
                    class="font-mono text-xs font-bold"
                    :class="
                      res.achieved >= res.baseline
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    "
                  >
                    {{ res.achieved.toFixed(2) }}%
                  </span>
                  <span
                    v-else
                    class="text-primary flex items-center gap-1 font-mono text-xs font-semibold"
                  >
                    <Icon
                      v-if="getEnsembleModelStatus(res.id) === 'active'"
                      name="lucide:loader-2"
                      size="11"
                      class="animate-spin"
                    />
                    {{ getEnsembleModelStatus(res.id) === 'active' ? 'Evaluating' : 'Queued' }}
                  </span>
                </div>
              </div>

              <div
                class="border-border/40 text-muted-foreground mt-2.5 flex items-center justify-between border-t pt-2 text-[11px]"
              >
                <span>Guard Decision:</span>
                <span class="text-foreground font-semibold">
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

        <div
          class="bg-muted/20 border-border/60 text-muted-foreground flex items-center justify-between rounded-2xl border p-3.5 text-xs"
        >
          <span class="flex items-center gap-1.5 font-mono text-[11px]">
            <Icon
              name="lucide:clock"
              size="14"
            />
            Last Retrain:
            {{
              stats?.gathered_dataset.last_trained_at
                ? new Date(stats.gathered_dataset.last_trained_at).toLocaleString()
                : 'Recent Session'
            }}
          </span>
          <span class="text-foreground font-mono text-[11px] font-semibold">
            {{
              (stats?.ai_service.total_baseline_images ?? 15719) +
              (stats?.gathered_dataset.total ?? 0)
            }}
            total images in training split
          </span>
        </div>
      </div>
    </AppModal>
  </div>
</template>
