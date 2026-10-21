<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
  import {
    modelTrainingService,
    type ModelStatsResponse,
    type TrainingStatusResponse,
    type TrainingImageItem
  } from '~/api/modelTraining/ModelTrainingService'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const { getStorageUrl } = useStorage()

  // Configuration
  const selectedArch = ref<'swin_transformer' | 'resnet50' | 'efficientnet_v2'>('swin_transformer')
  const selectedEpochs = ref(3)
  const syncDataset = ref(false)
  const epochPresets = [3, 5, 10, 15, 20, 30]

  const adjustEpochs = (delta: number) => {
    if (isTrainingActive.value) return
    const current = Number(selectedEpochs.value) || 3
    selectedEpochs.value = Math.max(1, Math.min(100, current + delta))
  }

  // State
  const isLoadingStats = ref(false)
  const isStarting = ref(false)
  const isCancelling = ref(false)
  const isSyncing = ref(false)
  const stats = ref<ModelStatsResponse | null>(null)
  const trainingStatus = ref<TrainingStatusResponse | null>(null)
  const showCancelConfirm = ref(false)
  const showRollbackConfirm = ref(false)
  const isRollingBack = ref(false)
  const showRetrainConfirm = ref(false)
  const showSyncConfirm = ref(false)
  const unsyncedScansCount = ref(0)
  const isCheckingSyncBeforeTrain = ref(false)
  const showDatasetSlideover = ref(false)
  const showResultsModal = ref(false)
  const selectedTrainingImageUuids = ref<string[]>([])
  const selectedTrainingMode = ref<'quick' | 'full'>('quick')
  const freshStart = ref(false)

  // Retraining Scope & Included Images
  const allTrainingImages = ref<TrainingImageItem[]>([])
  const isLoadingTrainingImages = ref(false)
  const showIncludedImagesModal = ref(false)

  const fetchTrainingImages = async () => {
    isLoadingTrainingImages.value = true
    try {
      const res: any = await modelTrainingService.getTrainingImages()
      allTrainingImages.value = res.images || res.data || []
    } catch (e) {
      console.error('Failed to load training images', e)
    } finally {
      isLoadingTrainingImages.value = false
    }
  }

  const includedTrainingImages = computed<TrainingImageItem[]>(() => {
    if (selectedTrainingImageUuids.value.length > 0) {
      const uuidSet = new Set(selectedTrainingImageUuids.value)
      return allTrainingImages.value.filter(img => uuidSet.has(img.uuid))
    }
    return allTrainingImages.value
  })

  const includedCategoryCounts = computed(() => {
    const counts: Record<string, number> = { acne: 0, eczema: 0, herpes: 0 }
    includedTrainingImages.value.forEach(img => {
      const cat = (img.category || '').toLowerCase()
      if (cat in counts) counts[cat]++
    })
    return counts
  })

  const removeImageFromScope = (uuid: string) => {
    if (selectedTrainingImageUuids.value.length === 0) {
      selectedTrainingImageUuids.value = allTrainingImages.value
        .map(i => i.uuid)
        .filter(id => id !== uuid)
    } else {
      selectedTrainingImageUuids.value = selectedTrainingImageUuids.value.filter(id => id !== uuid)
    }
    toast.info('Removed scan from retraining scope.')
  }

  const resetToAllImages = () => {
    selectedTrainingImageUuids.value = []
    toast.info('Retraining scope reset to all available dataset scans.')
  }

  const openImageSelector = () => {
    showDatasetSlideover.value = true
  }

  const openIncludedImagesModal = () => {
    showIncludedImagesModal.value = true
  }

  const handleOpenSelectorFromPreview = () => {
    showIncludedImagesModal.value = false
    showDatasetSlideover.value = true
  }

  const setTrainingMode = (mode: 'quick' | 'full') => {
    selectedTrainingMode.value = mode
  }

  const toggleFreshStart = () => {
    if (isTrainingActive.value) return
    freshStart.value = !freshStart.value
  }

  const logContainer = ref<HTMLElement | null>(null)
  const terminalInputRef = ref<HTMLInputElement | null>(null)
  const { getEcho } = useEcho()
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
    return s === 'syncing' || s === 'training' || s === 'evaluating' || s === 'cancelling'
  })

  const isCancellingActive = computed(() => {
    return trainingStatus.value?.status === 'cancelling'
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
          const match = line.match(
            /Baseline(?:\s*\([^\)]+\))?:\s*([\d\.]+)%\s*\|\s*(?:Session Best|Best Achieved):\s*([\d\.]+)%/i
          )
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
      id: 'swin_transformer' as const,
      name: 'Swin Transformer',
      short: 'Swin-T',
      type: 'State-of-the-Art (Vision Transformer)',
      desc: 'Shifted-window attention network. Highest accuracy on clinical skin lesions.',
      descSummary: 'Backbone Frozen • 512-dim Head Tuned',
      badge: 'Recommended',
      badgeColor: 'primary' as const,
      icon: 'lucide:sparkles'
    },
    {
      id: 'resnet50' as const,
      name: 'ResNet-50',
      short: 'ResNet50',
      type: 'Residual Convolutional Backbone',
      desc: 'Deep residual network with stable feature representation across skin tones.',
      descSummary: 'Residual ConvNet • 512-dim Head Tuned',
      badge: 'Stable',
      badgeColor: 'gray' as const,
      icon: 'lucide:network'
    },
    {
      id: 'efficientnet_v2' as const,
      name: 'EfficientNet-V2',
      short: 'EfficientNet',
      type: 'Optimized Convolutional Network',
      desc: 'Lightweight architecture with fast training and low latency inference.',
      descSummary: 'Compound Scaled CNN • 512-dim Head Tuned',
      badge: 'Fast',
      badgeColor: 'gray' as const,
      icon: 'lucide:cpu'
    }
  ]

  const isArchInitialized = ref(false)

  const dynamicArchitectures = computed(() => {
    const modelsAvailable = stats.value?.ai_service?.models_available || []
    const activeArch = (stats.value?.ai_service?.active_architecture || '').toLowerCase()

    return architectures.map(arch => {
      const hasCheckpoint = modelsAvailable.some((m: string) => {
        const lower = m.toLowerCase()
        if (arch.id === 'swin_transformer') return lower.includes('swin')
        if (arch.id === 'resnet50') return lower.includes('resnet50')
        if (arch.id === 'efficientnet_v2') return lower.includes('efficientnet')
        return false
      })

      const isAlgoActive =
        activeArch.includes(arch.id.replace('_', '')) ||
        activeArch.includes(arch.id) ||
        (activeArch.includes('ensemble') && arch.id === 'swin_transformer')

      return {
        ...arch,
        hasCheckpoint,
        isAlgoActive
      }
    })
  })

  const selectedArchData = computed(() => {
    return (
      dynamicArchitectures.value.find(a => a.id === selectedArch.value) ||
      dynamicArchitectures.value[0] ||
      architectures[0]
    )
  })

  const handleSelectArch = (archId: 'swin_transformer' | 'resnet50' | 'efficientnet_v2') => {
    if (isTrainingActive.value) return
    selectedArch.value = archId
    isArchInitialized.value = true
  }

  const fetchStats = async () => {
    isLoadingStats.value = true
    try {
      stats.value = await modelTrainingService.getStats()
      if (!isArchInitialized.value && stats.value?.ai_service?.active_architecture) {
        const active = stats.value.ai_service.active_architecture.toLowerCase()
        if (active.includes('resnet50')) {
          selectedArch.value = 'resnet50'
        } else if (active.includes('efficientnet')) {
          selectedArch.value = 'efficientnet_v2'
        } else if (active.includes('swin')) {
          selectedArch.value = 'swin_transformer'
        }
        isArchInitialized.value = true
      }
    } catch (err: any) {
      console.error('Failed to load model stats:', err)
      toast.error('Could not connect to AI algorithm service.')
    } finally {
      isLoadingStats.value = false
    }
  }

  const updateTrainingState = async (res: any) => {
    if (!res) return
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
  }

  const pollStatus = async () => {
    try {
      const res = await modelTrainingService.getStatus()
      await updateTrainingState(res)
    } catch (err) {
      console.error('Failed to poll status:', err)
    }
  }

  const startPolling = () => {
    stopPolling()
    pollStatus()
    pollTimer = setInterval(pollStatus, 5000)
  }

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const handleStartTraining = async (forceSync?: boolean) => {
    if (isStarting.value || isTrainingActive.value) return
    isStarting.value = true
    try {
      const shouldSync = forceSync !== undefined ? forceSync : syncDataset.value
      const chosenArch = selectedTrainingMode.value === 'quick' ? selectedArch.value : 'ensemble'
      const payload: any = {
        architecture: chosenArch,
        epochs: Number(selectedEpochs.value),
        sync_dataset: shouldSync,
        training_mode: selectedTrainingMode.value,
        fresh_start: freshStart.value
      }
      if (selectedTrainingImageUuids.value.length > 0) {
        payload.selected_image_uuids = selectedTrainingImageUuids.value
      }
      await modelTrainingService.startTraining(payload)
      const modeText =
        selectedTrainingMode.value === 'quick'
          ? `Rapid Quick-Tune (${selectedArchData.value.name})`
          : 'Tri-Model Ensemble'
      toast.success(`${modeText} retraining pipeline started!`)
      startPolling()
    } catch (err: any) {
      const msg =
        err.data?.message || err.data?.error || err.message || 'Failed to start retraining.'
      toast.error(msg)
    } finally {
      isStarting.value = false
    }
  }

  const promptRetrainConfirmation = async () => {
    if (isStarting.value || isTrainingActive.value || isCheckingSyncBeforeTrain.value) return
    isCheckingSyncBeforeTrain.value = true
    try {
      const res: any = await modelTrainingService.getTrainingImages()
      const rawImages: TrainingImageItem[] = res.images || res.data || []
      const unsynced = rawImages.filter(img => !img.is_in_local_storage && !img.is_in_raw)
      unsyncedScansCount.value =
        res.needs_sync_count ?? res.summary?.needs_sync_count ?? unsynced.length
      showRetrainConfirm.value = true
    } catch {
      unsyncedScansCount.value = 0
      showRetrainConfirm.value = true
    } finally {
      isCheckingSyncBeforeTrain.value = false
    }
  }

  const handleConfirmProceedAnyway = async () => {
    showRetrainConfirm.value = false
    await handleStartTraining(false)
  }

  const handleSyncDataset = async () => {
    isSyncing.value = true
    try {
      const targets =
        selectedTrainingImageUuids.value.length > 0 ? selectedTrainingImageUuids.value : undefined
      const res = await modelTrainingService.syncDataset(targets)
      toast.success(res.message || 'Dataset synchronized successfully.')
      await fetchStats()
    } catch {
      toast.error('Failed to synchronize dataset.')
    } finally {
      isSyncing.value = false
    }
  }

  const handleConfirmSyncAndProceed = async () => {
    showRetrainConfirm.value = false
    await handleSyncDataset()
    await handleStartTraining(true)
  }

  const handleImagesSelected = (uuids: string[]) => {
    selectedTrainingImageUuids.value = uuids
    if (uuids.length > 0) {
      toast.success(`${uuids.length} scan(s) selected for retraining.`)
    } else {
      toast.info('Full dataset scope active for retraining.')
    }
    fetchTrainingImages()
  }

  const promptSyncDataset = () => {
    showDatasetSlideover.value = true
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

  const openRollbackConfirm = () => {
    if (isTrainingActive.value) {
      toast.error('Cannot rollback model checkpoints while training is active.')
      return
    }
    showRollbackConfirm.value = true
  }

  const handleRollbackWeights = async () => {
    isRollingBack.value = true
    try {
      const res: any = await modelTrainingService.rollbackModel('ensemble')
      toast.success(res?.message || 'Model checkpoints rolled back to backup weights.')

      const pushLine = (line: string) => {
        if (trainingStatus.value?.logs) {
          trainingStatus.value.logs.push(line)
        } else {
          localSessionLogs.value.push(line)
        }
      }
      pushLine('🔄 [ROLLBACK] Reverted model checkpoints to previous backup (.pth).')
      if (res?.restored && Array.isArray(res.restored)) {
        res.restored.forEach((f: string) => pushLine(`  • Restored: ${f}`))
      }
      await fetchStats()
      await nextTick()
      scrollToBottom()
    } catch (err: any) {
      const errorMsg =
        err?.data?.message ||
        err?.data?.error ||
        err?.data?.detail ||
        err?.message ||
        'Failed to rollback model weights.'
      toast.error(errorMsg)
    } finally {
      isRollingBack.value = false
      showRollbackConfirm.value = false
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
      pushLog('  rollback           Roll back model checkpoints to previous backup')
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
    } else if (cmd === 'rollback') {
      if (isTrainingActive.value) {
        pushLog('❌ Error: Cannot rollback model while a training pipeline is active.')
      } else {
        pushLog('🔄 Submitting rollback request to Python AI worker...')
        await handleRollbackWeights()
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
    fetchTrainingImages()
    startPolling()

    if (import.meta.client) {
      const echo = getEcho()
      if (echo) {
        echo.private('admin.ai-retraining').listen('.ModelTrainingProgressUpdated', (e: any) => {
          if (e?.status) {
            updateTrainingState(e.status)
          }
        })
      }
    }
  })

  onBeforeUnmount(() => {
    stopPolling()
    if (import.meta.client) {
      const echo = getEcho()
      if (echo) {
        echo.leave('admin.ai-retraining')
      }
    }
  })
</script>

<template>
  <div class="space-y-8 pb-16">
    <!-- Page Header -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div class="max-w-2xl min-w-0">
        <div class="mb-1 flex items-center gap-2">
          <h1 class="text-foreground text-2xl font-black md:text-3xl">AI Model Intelligence</h1>
        </div>
        <p class="text-muted-foreground text-sm">
          Monitor PyTorch vision backbones, trigger clinical fine-tuning, and supervise automated
          Validation Guard accuracy.
        </p>
      </div>

      <div
        class="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap sm:justify-end sm:gap-2.5"
      >
        <AppButton
          variant="outline"
          class="!h-9 gap-1.5 !px-3 !text-xs md:!h-11 md:gap-2 md:!px-5 md:!text-sm"
          @click="showResultsModal = true"
        >
          <Icon
            name="lucide:clipboard-check"
            size="16"
          />
          Retraining Report
        </AppButton>

        <AppButton
          v-if="isTrainingActive"
          variant="destructive"
          class="!h-9 gap-1.5 !px-3 !text-xs shadow-sm md:!h-11 md:gap-2 md:!px-5 md:!text-sm"
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
      <AdminSideComponentsMetricCard
        label="Inference Engine"
        value="3-Model Ensemble"
        badge="Tri-Fusion"
        detail="Swin + ResNet + EfficientNet"
      />

      <AdminSideComponentsMetricCard
        label="Baseline Dataset"
        :value="stats?.ai_service.total_baseline_images || 15719"
        unit="images"
        badge="Benchmark"
        detail="Clinical benchmark foundation"
      />

      <AdminSideComponentsMetricCard
        label="Gathered Scans"
        :value="stats?.gathered_dataset.total ?? 0"
        unit="collected"
        :badge="
          (stats?.gathered_dataset.untrained_count ?? 0) > 0
            ? `${stats?.gathered_dataset.untrained_count} new`
            : 'All trained'
        "
        detail="Acne, Eczema & Herpes pool"
      />

      <AdminSideComponentsMetricCard
        label="Accuracy Guard"
        value="Validation Guard"
        badge="Active Guard"
        detail="Rejects lower accuracy; keeps best model"
      />
    </div>

    <!-- Active Pipeline Status & Live Progress Card -->
    <div class="bg-card border-border space-y-5 rounded-3xl border p-4 shadow-sm md:p-6">
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

      <!-- Persistent 3-Model Baseline & Validation Guard Benchmark Section -->
      <div class="space-y-4 pt-2">
        <div
          class="border-border flex flex-col items-start justify-between gap-2 border-t pt-4 sm:flex-row sm:items-center"
        >
          <div class="flex items-center gap-2">
            <Icon
              name="lucide:shield-check"
              size="18"
              class="text-primary"
            />
            <div>
              <h4 class="text-foreground text-sm font-bold">
                Preserved Model Baselines & Validation Guard Benchmarks
              </h4>
              <p class="text-muted-foreground text-[11px]">
                Active production checkpoints safeguarded against accuracy regression.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <AppBadge
              :color="
                trainingStatus?.model_promoted ? 'success' : isTrainingActive ? 'primary' : 'gray'
              "
              size="sm"
            >
              {{
                isTrainingActive
                  ? 'Live Benchmark Running'
                  : trainingStatus?.model_promoted
                    ? 'Production Models Promoted'
                    : 'Historical Baselines Protected'
              }}
            </AppBadge>
          </div>
        </div>

        <!-- 3-Model Results Cards Grid -->
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div
            v-for="res in parsedEnsembleResults"
            :key="res.id"
            class="rounded-2xl border p-4 transition-all"
            :class="[
              res.promoted
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'bg-background border-border',
              selectedArch === res.id && selectedTrainingMode === 'quick'
                ? 'ring-1 ring-amber-500/40'
                : ''
            ]"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-1.5">
                  <h5 class="text-foreground text-sm font-bold">{{ res.name }}</h5>
                  <span
                    v-if="selectedArch === res.id && selectedTrainingMode === 'quick'"
                    class="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400"
                  >
                    Focus
                  </span>
                </div>
                <p class="text-muted-foreground font-mono text-[11px]">{{ res.weights }}</p>
              </div>
              <AppBadge
                :color="
                  res.promoted
                    ? 'success'
                    : isTrainingActive && getEnsembleModelStatus(res.id) === 'active'
                      ? 'primary'
                      : 'gray'
                "
                size="sm"
              >
                {{
                  res.promoted
                    ? 'Promoted'
                    : isTrainingActive && getEnsembleModelStatus(res.id) === 'active'
                      ? 'Tuning'
                      : 'Preserved'
                }}
              </AppBadge>
            </div>

            <div class="border-border/60 mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
              <div>
                <span class="text-muted-foreground block text-[11px]">Preserved Baseline</span>
                <span class="text-foreground font-mono font-bold"
                  >{{ res.baseline.toFixed(2) }}%</span
                >
              </div>
              <div>
                <span class="text-muted-foreground block text-[11px]">Last Retrain Achieved</span>
                <span
                  class="font-mono font-bold"
                  :class="
                    res.achieved > res.baseline
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : res.achieved < res.baseline
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-foreground'
                  "
                >
                  {{ res.achieved.toFixed(2) }}%
                </span>
              </div>
            </div>

            <div
              class="border-border/40 mt-2.5 flex items-center justify-between border-t pt-2 text-[11px]"
            >
              <span class="text-muted-foreground">Guard Difference</span>
              <span
                class="flex items-center gap-1 font-semibold"
                :class="
                  res.promoted || res.achieved > res.baseline
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : res.achieved < res.baseline
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground'
                "
              >
                <Icon
                  :name="
                    res.promoted || res.achieved > res.baseline
                      ? 'lucide:trending-up'
                      : res.achieved < res.baseline
                        ? 'lucide:shield-alert'
                        : 'lucide:shield-check'
                  "
                  size="13"
                />
                {{
                  res.achieved > res.baseline
                    ? `+${(res.achieved - res.baseline).toFixed(2)}% (Passed)`
                    : res.achieved < res.baseline
                      ? `${(res.achieved - res.baseline).toFixed(2)}% (Protected)`
                      : '±0.00% (Baseline Match)'
                }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main 2-Column Section: Configuration & Console -->
    <div class="grid grid-cols-1 gap-5 md:gap-8 lg:grid-cols-12">
      <!-- Left Column: Unified Ensemble Training Control (5 cols) -->
      <div class="space-y-6 lg:col-span-5">
        <div class="bg-card border-border space-y-5 rounded-3xl border p-4 shadow-sm md:p-6">
          <div class="border-border flex items-center justify-between border-b pb-3">
            <h3 class="text-foreground flex items-center gap-2 text-base font-bold">
              <Icon
                name="lucide:sparkles"
                size="18"
                class="text-primary"
              />
              {{ selectedTrainingMode === 'quick' ? 'Quick Model Retrain' : 'Retrain Ensemble' }}
            </h3>
            <AppBadge
              :color="selectedTrainingMode === 'quick' ? 'warning' : 'primary'"
              size="sm"
              variant="subtle"
            >
              {{ selectedTrainingMode === 'quick' ? '⚡ Quick (~20s)' : 'All 3 Backbones (~1.5h)' }}
            </AppBadge>
          </div>

          <!-- Training Mode Selection Toggle -->
          <div
            class="space-y-2 pt-1"
            :class="{ 'opacity-60': isTrainingActive }"
          >
            <label
              class="text-muted-foreground block text-xs font-semibold tracking-wider uppercase"
            >
              Training Mode
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                :disabled="isTrainingActive"
                class="flex flex-col items-start rounded-2xl border p-3 text-left transition-all disabled:cursor-not-allowed"
                :class="
                  selectedTrainingMode === 'quick'
                    ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/50'
                    : 'border-border bg-background hover:bg-muted/40'
                "
                @click="setTrainingMode('quick')"
              >
                <div class="flex w-full items-center justify-between">
                  <span class="text-foreground flex items-center gap-1.5 text-xs font-bold">
                    <Icon
                      name="lucide:zap"
                      size="14"
                      class="text-amber-500"
                    />
                    Quick Tune
                  </span>
                  <span
                    class="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400"
                  >
                    ~20s
                  </span>
                </div>
                <span class="text-muted-foreground mt-1 text-[11px] leading-tight">
                  Frozen backbone + 90 anchor exemplars. Fast & safe.
                </span>
              </button>

              <button
                type="button"
                :disabled="isTrainingActive"
                class="flex flex-col items-start rounded-2xl border p-3 text-left transition-all disabled:cursor-not-allowed"
                :class="
                  selectedTrainingMode === 'full'
                    ? 'border-primary bg-primary/10 ring-primary ring-1'
                    : 'border-border bg-background hover:bg-muted/40'
                "
                @click="setTrainingMode('full')"
              >
                <div class="flex w-full items-center justify-between">
                  <span class="text-foreground flex items-center gap-1.5 text-xs font-bold">
                    <Icon
                      name="lucide:refresh-cw"
                      size="13"
                      class="text-primary"
                    />
                    Full Retrain
                  </span>
                  <span
                    class="bg-primary/15 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  >
                    ~1.5h
                  </span>
                </div>
                <span class="text-muted-foreground mt-1 text-[11px] leading-tight">
                  All 21k images across all 3 backbones.
                </span>
              </button>
            </div>
          </div>

          <!-- Sequential Pipeline Visual Indicator (Dynamic based on mode) -->
          <div
            v-if="selectedTrainingMode === 'quick'"
            class="bg-muted/40 border-border/80 space-y-2.5 rounded-2xl border p-4"
          >
            <div class="text-foreground flex items-center justify-between text-xs font-bold">
              <span class="flex items-center gap-1.5">
                <Icon
                  name="lucide:zap"
                  size="14"
                  class="text-amber-500"
                />
                Rapid Fine-Tuning Pipeline
              </span>
              <span class="text-primary text-[11px] font-semibold">Select Model Focus</span>
            </div>

            <!-- Dynamic Model Selector Cards -->
            <div class="space-y-2">
              <button
                v-for="arch in dynamicArchitectures"
                :key="arch.id"
                type="button"
                :disabled="isTrainingActive"
                class="border-border bg-background hover:bg-muted/60 flex w-full cursor-pointer items-center justify-between rounded-xl border p-2.5 text-left transition-all disabled:cursor-not-allowed"
                :class="
                  selectedArch === arch.id
                    ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500'
                    : 'border-border bg-background hover:bg-muted/60'
                "
                @click="handleSelectArch(arch.id)"
              >
                <div class="flex min-w-0 items-center gap-2.5">
                  <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    :class="
                      selectedArch === arch.id
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                    "
                  >
                    <Icon
                      :name="arch.icon || 'lucide:cpu'"
                      size="16"
                    />
                  </div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="text-foreground truncate text-xs font-bold">
                        {{ arch.name }}
                      </span>
                      <span
                        v-if="arch.isAlgoActive"
                        class="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400"
                      >
                        Algo Active
                      </span>
                    </div>
                    <span class="text-muted-foreground block truncate text-[10px]">
                      {{ arch.descSummary }}
                    </span>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-1.5 pl-2">
                  <span
                    v-if="selectedArch === arch.id"
                    class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white"
                  >
                    <Icon
                      name="lucide:check"
                      size="12"
                    />
                  </span>
                  <AppBadge
                    v-else
                    :color="arch.badgeColor"
                    size="sm"
                    variant="subtle"
                  >
                    {{ arch.badge }}
                  </AppBadge>
                </div>
              </button>
            </div>

            <p class="text-muted-foreground pt-0.5 text-[11px] leading-relaxed">
              Fine-tunes the classification head for {{ selectedArchData.name }} using selected
              scans plus 90 balanced anchor exemplars to guarantee zero catastrophic forgetting.
            </p>
          </div>

          <div
            v-else
            class="bg-muted/40 border-border/80 space-y-2.5 rounded-2xl border p-4"
          >
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

          <!-- Custom Editable Epoch Selection with Stepper & Presets -->
          <div
            class="space-y-3 pt-1"
            :class="{ 'opacity-60': isTrainingActive }"
          >
            <div class="flex items-center justify-between">
              <label
                class="text-muted-foreground block text-xs font-semibold tracking-wider uppercase"
              >
                Training Epochs (Per Model)
              </label>
              <span class="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                {{ Number(selectedEpochs) || 3 }}
                {{ Number(selectedEpochs) === 1 ? 'Epoch' : 'Epochs' }} / Model
              </span>
            </div>

            <!-- Custom Number Input with Stepper Buttons -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                :disabled="isTrainingActive || selectedEpochs <= 1"
                class="bg-background border-border text-foreground hover:bg-muted flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
                  class="bg-background border-border text-foreground w-full [appearance:textfield] rounded-xl border px-4 py-2 text-center font-mono text-base font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
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
                class="bg-background border-border text-foreground hover:bg-muted flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
                      ? 'bg-amber-500 text-white shadow-xs'
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
              <template v-if="selectedTrainingMode === 'quick'">
                The selected focus model (
                <strong class="text-foreground font-semibold">{{ selectedArchData.name }}</strong>
                ) will train its classification head for
                <strong class="text-foreground font-semibold"
                  >{{ Number(selectedEpochs) || 3 }} epoch(s)</strong
                >
                (~20s).
              </template>
              <template v-else>
                All 3 ensemble backbones (Swin, ResNet50, EfficientNet-V2) will each run for
                <strong class="text-foreground font-semibold"
                  >{{ Number(selectedEpochs) || 3 }} epochs</strong
                >
                (total:
                <strong class="text-foreground font-semibold"
                  >{{ (Number(selectedEpochs) || 3) * 3 }} full passes</strong
                >) with Cosine Annealing learning rate schedule.
              </template>
            </p>
          </div>

          <!-- Dataset Scope / Selective Retraining Trigger -->
          <div
            class="space-y-2 pt-1"
            :class="{ 'opacity-60': isTrainingActive }"
          >
            <div class="flex items-center justify-between">
              <label
                class="text-muted-foreground block text-xs font-semibold tracking-wider uppercase"
              >
                Training Dataset Scope
              </label>
              <span
                v-if="selectedTrainingImageUuids.length > 0"
                class="text-primary text-[11px] font-bold"
              >
                Custom Scope ({{ selectedTrainingImageUuids.length }} Scans)
              </span>
              <span
                v-else
                class="text-muted-foreground text-[11px] font-medium"
              >
                Full Dataset Scope
              </span>
            </div>

            <div
              class="border-border bg-card relative overflow-hidden rounded-2xl border p-4 shadow-xs transition-all"
              :class="{
                'ring-primary/30 border-primary/50 bg-primary/[0.02] ring-1':
                  selectedTrainingImageUuids.length > 0
              }"
            >
              <!-- Scope Header & Summary -->
              <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
                    :class="
                      selectedTrainingImageUuids.length > 0
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-primary/10 text-primary'
                    "
                  >
                    <Icon
                      :name="
                        selectedTrainingImageUuids.length > 0
                          ? 'lucide:check-circle-2'
                          : 'lucide:images'
                      "
                      size="20"
                    />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-foreground text-sm font-bold">
                        {{
                          selectedTrainingImageUuids.length > 0
                            ? `${selectedTrainingImageUuids.length} Scans Selected for Retraining`
                            : `All Dataset Scans (${includedTrainingImages.length})`
                        }}
                      </span>
                      <AppBadge
                        v-if="selectedTrainingImageUuids.length > 0"
                        color="primary"
                        size="xs"
                        variant="subtle"
                        class="font-bold"
                      >
                        Curated
                      </AppBadge>
                      <AppBadge
                        v-else
                        color="gray"
                        size="xs"
                        variant="subtle"
                      >
                        Default
                      </AppBadge>
                    </div>

                    <!-- Category Breakdown -->
                    <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span class="text-muted-foreground font-medium">Included:</span>
                      <span
                        class="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                      >
                        {{ includedCategoryCounts.acne }} Acne
                      </span>
                      <span
                        class="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400"
                      >
                        {{ includedCategoryCounts.eczema }} Eczema
                      </span>
                      <span
                        class="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                      >
                        {{ includedCategoryCounts.herpes }} Herpes
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Action Controls -->
                <div class="flex items-center gap-2 self-end sm:self-center">
                  <AppButton
                    v-if="selectedTrainingImageUuids.length > 0"
                    variant="ghost"
                    size="xs"
                    class="text-muted-foreground hover:text-foreground text-xs"
                    @click="resetToAllImages"
                  >
                    Reset to All
                  </AppButton>

                  <AppButton
                    variant="outline"
                    size="sm"
                    class="border-primary/30 hover:bg-primary/5 text-primary gap-1.5 text-xs font-semibold shadow-xs"
                    @click="openImageSelector"
                  >
                    <Icon
                      name="lucide:check-square"
                      size="14"
                    />
                    {{
                      selectedTrainingImageUuids.length > 0 ? 'Change Selection' : 'Choose Images'
                    }}
                  </AppButton>
                </div>
              </div>

              <!-- Thumbnail Strip of Included Scans -->
              <div
                v-if="includedTrainingImages.length > 0"
                class="border-border/60 mt-3.5 border-t pt-3"
              >
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-muted-foreground text-[11px] font-medium">
                    Preview of Included Scans:
                  </span>
                  <button
                    type="button"
                    class="text-primary inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold hover:underline"
                    @click="openIncludedImagesModal"
                  >
                    <span>View all {{ includedTrainingImages.length }} scans</span>
                    <Icon
                      name="lucide:arrow-right"
                      size="12"
                    />
                  </button>
                </div>

                <div class="scrollbar-thin flex items-center gap-2 overflow-x-auto pb-1">
                  <div
                    v-for="img in includedTrainingImages.slice(0, 8)"
                    :key="img.uuid"
                    class="group/thumb border-border bg-muted relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border"
                    :title="`${img.category ? img.category.toUpperCase() : 'Scan'}: ${img.filename || 'Scan image'}`"
                    @click="openIncludedImagesModal"
                  >
                    <img
                      :src="getStorageUrl(img.image_url || img.file_name || img.filename || '')"
                      :alt="img.filename || 'Scan Image'"
                      class="h-full w-full object-cover transition-transform group-hover/thumb:scale-110"
                      loading="lazy"
                    />
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/thumb:opacity-100"
                    >
                      <Icon
                        name="lucide:eye"
                        size="14"
                        class="text-white"
                      />
                    </div>
                  </div>
                  <div
                    v-if="includedTrainingImages.length > 8"
                    class="border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-dashed text-xs font-bold transition-colors"
                    @click="openIncludedImagesModal"
                  >
                    +{{ includedTrainingImages.length - 8 }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Fresh Start (Ignore Checkpoints) Toggle -->
          <div
            class="space-y-2 pt-1"
            :class="{ 'opacity-60': isTrainingActive }"
          >
            <div
              class="border-border flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 transition-all"
              :class="
                freshStart
                  ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'bg-muted/30 hover:bg-muted/50'
              "
              @click="toggleFreshStart"
            >
              <div class="flex items-center gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  :class="
                    freshStart
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  "
                >
                  <Icon
                    name="lucide:sprout"
                    size="18"
                  />
                </div>
                <div>
                  <span class="text-foreground flex items-center gap-1.5 text-xs font-bold">
                    Fresh Start (Ignore Checkpoints)
                    <AppBadge
                      v-if="freshStart"
                      color="success"
                      size="sm"
                      variant="subtle"
                    >
                      Active
                    </AppBadge>
                  </span>
                  <span class="text-muted-foreground block text-[11px] leading-tight">
                    {{
                      freshStart
                        ? 'Trains from base ImageNet weights. Existing checkpoints safely backed up.'
                        : 'Default: Resumes and fine-tunes from existing production checkpoints.'
                    }}
                  </span>
                </div>
              </div>
              <div
                class="flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors"
                :class="freshStart ? 'bg-emerald-500' : 'bg-muted-foreground/30'"
              >
                <div
                  class="h-4 w-4 rounded-full bg-white shadow-xs transition-transform"
                  :class="freshStart ? 'translate-x-4' : 'translate-x-0'"
                />
              </div>
            </div>
          </div>

          <!-- Start Button & Sync Actions -->
          <div class="space-y-2">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <AppButton
                variant="outline"
                size="lg"
                class="border-primary/40 text-primary hover:bg-primary/5 hover:border-primary w-full justify-center gap-2 font-bold shadow-xs transition-all"
                :loading="isSyncing"
                :disabled="isTrainingActive || isSyncing"
                @click="promptSyncDataset"
              >
                <Icon
                  name="lucide:refresh-cw"
                  size="17"
                  :class="isSyncing ? 'animate-spin' : ''"
                />
                {{ isSyncing ? 'Syncing...' : 'Sync Dataset' }}
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
                class="w-full justify-center gap-2 font-bold shadow-md"
                :loading="isStarting || isCheckingSyncBeforeTrain"
                :disabled="isStarting || isTrainingActive || isCheckingSyncBeforeTrain"
                @click="promptRetrainConfirmation"
              >
                <Icon
                  :name="selectedTrainingMode === 'quick' ? 'lucide:zap' : 'lucide:play'"
                  size="18"
                />
                {{
                  isCheckingSyncBeforeTrain
                    ? 'Checking Sync Status...'
                    : selectedTrainingMode === 'quick'
                      ? 'Quick Retrain (~20s)'
                      : 'Retrain All 3 Models'
                }}
              </AppButton>
            </div>
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

              <!-- Rollback Model Weights Button -->
              <button
                type="button"
                :disabled="isTrainingActive || isRollingBack"
                title="Rollback Model Checkpoints to Previous Backup"
                class="flex cursor-pointer items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 font-mono text-[11px] text-amber-400 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40 sm:px-2 sm:py-1"
                @click="openRollbackConfirm"
              >
                <Icon
                  :name="isRollingBack ? 'lucide:loader-2' : 'lucide:rotate-ccw'"
                  size="12"
                  :class="{ 'animate-spin': isRollingBack }"
                />
                <span class="hidden sm:inline">Rollback</span>
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
        <div class="bg-card border-border space-y-4 rounded-3xl border p-4 shadow-sm md:p-6">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h4 class="text-foreground flex items-center gap-2 text-sm font-bold">
              <Icon
                name="lucide:hard-drive"
                size="16"
                class="text-primary"
              />
              Deployed Production Model Checkpoints
            </h4>
            <div class="flex items-center gap-2">
              <button
                type="button"
                :disabled="isTrainingActive || isRollingBack"
                class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                @click="openRollbackConfirm"
              >
                <Icon
                  :name="isRollingBack ? 'lucide:loader-2' : 'lucide:rotate-ccw'"
                  size="13"
                  :class="{ 'animate-spin': isRollingBack }"
                />
                Rollback Checkpoints
              </button>
              <AppBadge
                color="gray"
                size="sm"
                >models/production/</AppBadge
              >
            </div>
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

    <!-- Confirmation Modal for Rolling Back Weights -->
    <AppModalConfirmation
      v-model="showRollbackConfirm"
      title="Rollback Model Checkpoints?"
      description="Are you sure you want to rollback active production models to their previous backup checkpoints? The restored weights will be immediately hot-reloaded into the inference engine."
      icon="lucide:rotate-ccw"
      icon-color="warning"
      confirm-text="Rollback Model"
      cancel-text="Keep Current"
      confirm-variant="solid"
      :loading="isRollingBack"
      @confirm="handleRollbackWeights"
    />

    <!-- Retrain Confirmation Modal (With Un-synced Scans Warning) -->
    <AppModal
      v-model="showRetrainConfirm"
      size="lg"
    >
      <div class="space-y-5">
        <div class="flex items-start gap-4">
          <div
            v-if="unsyncedScansCount > 0"
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400"
          >
            <Icon
              name="lucide:alert-triangle"
              size="26"
            />
          </div>
          <div
            v-else
            class="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          >
            <Icon
              name="lucide:play"
              size="26"
            />
          </div>

          <div class="flex-1 pr-6 sm:pr-8">
            <h3 class="text-foreground text-lg font-bold sm:text-xl">
              {{
                unsyncedScansCount > 0 ? 'Un-synced Scans Detected' : 'Confirm Retraining Pipeline'
              }}
            </h3>
            <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
              <template v-if="unsyncedScansCount > 0">
                There are
                <strong class="text-foreground font-bold">{{ unsyncedScansCount }}</strong>
                consultation scan image(s) from patient & doctor visits that have not been synced to
                the local dataset yet.
              </template>
              <template v-else>
                All candidate images and dataset galleries are fully synced and ready.
              </template>
            </p>
          </div>
        </div>

        <div
          v-if="unsyncedScansCount > 0"
          class="border-border bg-muted/40 rounded-2xl border p-4 text-xs"
        >
          <div class="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
            <Icon
              name="lucide:info"
              size="15"
            />
            <span>Impact on Model Retraining</span>
          </div>
          <p class="text-muted-foreground mt-1 text-[11px] leading-relaxed">
            If you proceed anyway, the model will train only on images currently present in the
            local dataset. Un-synced scans will be excluded until synchronized.
          </p>
        </div>

        <div
          v-else
          class="border-border bg-muted/30 rounded-2xl border p-4 text-xs"
        >
          <div class="text-foreground flex items-center gap-2 font-semibold">
            <Icon
              :name="selectedTrainingMode === 'quick' ? 'lucide:zap' : 'lucide:layers'"
              size="15"
              class="text-primary"
            />
            <span>
              {{
                selectedTrainingMode === 'quick'
                  ? 'Rapid Quick-Tune Architecture'
                  : 'Tri-Model Ensemble Architecture'
              }}
            </span>
          </div>
          <p class="text-muted-foreground mt-1 text-[11px] leading-relaxed">
            {{
              selectedTrainingMode === 'quick'
                ? `Will fine-tune ${selectedArchData.name} classification head for ${selectedEpochs} epochs using new scans plus 90 balanced anchor exemplars in ~20s.`
                : `Will train Swin Transformer, ResNet-50, and EfficientNet-V2 for ${selectedEpochs} epochs across Acne, Eczema, and Herpes.`
            }}
          </p>
          <div
            v-if="freshStart"
            class="mt-2.5 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
          >
            <Icon
              name="lucide:sprout"
              size="14"
            />
            <span
              >Fresh Start Active: Previous checkpoints will be bypassed and safely archived.</span
            >
          </div>
        </div>

        <!-- Training Scope Transparency Card -->
        <div class="border-border bg-card rounded-2xl border p-4 text-xs shadow-xs">
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon
                name="lucide:check-circle-2"
                size="15"
                class="text-primary"
              />
              <span class="text-foreground font-bold">
                Training Scope:
                {{
                  selectedTrainingImageUuids.length > 0
                    ? `${selectedTrainingImageUuids.length} Curated Scans`
                    : `Full Dataset (${includedTrainingImages.length} Scans)`
                }}
              </span>
            </div>
            <button
              type="button"
              class="text-primary cursor-pointer text-[11px] font-semibold hover:underline"
              @click="openIncludedImagesModal"
            >
              Inspect all scans
            </button>
          </div>

          <div class="text-muted-foreground mb-2.5 flex items-center gap-1.5 text-[11px]">
            <span class="font-semibold text-emerald-600 dark:text-emerald-400"
              >{{ includedCategoryCounts.acne }} Acne</span
            >
            <span>·</span>
            <span class="font-semibold text-blue-600 dark:text-blue-400"
              >{{ includedCategoryCounts.eczema }} Eczema</span
            >
            <span>·</span>
            <span class="font-semibold text-amber-600 dark:text-amber-400"
              >{{ includedCategoryCounts.herpes }} Herpes</span
            >
          </div>

          <!-- Thumbnails Row -->
          <div class="scrollbar-thin flex items-center gap-2 overflow-x-auto pb-1">
            <div
              v-for="img in includedTrainingImages.slice(0, 8)"
              :key="img.uuid"
              class="border-border bg-muted relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border"
            >
              <img
                :src="getStorageUrl(img.image_url || img.file_name || img.filename || '')"
                :alt="img.filename || 'Scan Image'"
                class="h-full w-full object-cover"
              />
            </div>
            <div
              v-if="includedTrainingImages.length > 8"
              class="border-border bg-muted/60 text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed text-[11px] font-bold"
            >
              +{{ includedTrainingImages.length - 8 }}
            </div>
          </div>
        </div>

        <div class="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
          <AppButton
            variant="outline"
            class="text-xs font-semibold sm:mr-auto"
            @click="showRetrainConfirm = false"
          >
            Cancel
          </AppButton>

          <template v-if="unsyncedScansCount > 0">
            <AppButton
              variant="destructive"
              class="gap-1.5 text-xs font-bold"
              :loading="isStarting"
              @click="handleConfirmProceedAnyway"
            >
              Proceed Anyway
            </AppButton>
          </template>

          <template v-else>
            <AppButton
              variant="solid"
              class="gap-1.5 text-xs font-bold"
              :loading="isStarting"
              @click="handleConfirmProceedAnyway"
            >
              <Icon
                name="lucide:play"
                size="14"
              />
              Start Retraining
            </AppButton>
          </template>
        </div>
      </div>
    </AppModal>

    <!-- Unified Dataset & Retraining Scope Slideover -->
    <AppDatasetSlideover
      v-model="showDatasetSlideover"
      :initial-selected-uuids="selectedTrainingImageUuids"
      @confirm="handleImagesSelected"
      @deleted="
        () => {
          fetchStats()
          fetchTrainingImages()
        }
      "
      @synced="
        () => {
          fetchStats()
          fetchTrainingImages()
        }
      "
    />

    <!-- Included Training Images Preview Modal -->
    <AppModal
      v-model="showIncludedImagesModal"
      title="Images Included in Retraining Scope"
      size="3xl"
    >
      <div class="space-y-4 p-1">
        <!-- Header Summary Banner -->
        <div
          class="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-xs"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="text-foreground text-sm font-bold">
                {{ includedTrainingImages.length }} Scans in Training Scope
              </span>
              <AppBadge
                v-if="selectedTrainingImageUuids.length > 0"
                color="primary"
                size="xs"
                variant="solid"
              >
                Curated Selection
              </AppBadge>
              <AppBadge
                v-else
                color="gray"
                size="xs"
                variant="solid"
              >
                Full Dataset
              </AppBadge>
            </div>
            <div class="text-muted-foreground mt-1 flex items-center gap-2 text-[11px]">
              <span>{{ includedCategoryCounts.acne }} Acne</span>
              <span>·</span>
              <span>{{ includedCategoryCounts.eczema }} Eczema</span>
              <span>·</span>
              <span>{{ includedCategoryCounts.herpes }} Herpes</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <AppButton
              v-if="selectedTrainingImageUuids.length > 0"
              variant="outline"
              size="sm"
              class="text-xs"
              @click="resetToAllImages"
            >
              Reset to Full Dataset
            </AppButton>
            <AppButton
              variant="solid"
              size="sm"
              class="gap-1.5 text-xs font-bold"
              @click="handleOpenSelectorFromPreview"
            >
              <Icon
                name="lucide:check-square"
                size="14"
              />
              Modify Selection
            </AppButton>
          </div>
        </div>

        <!-- Image Grid -->
        <div class="max-h-[60vh] overflow-y-auto pr-1">
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <div
              v-for="img in includedTrainingImages"
              :key="img.uuid"
              class="group border-border bg-card relative overflow-hidden rounded-2xl border shadow-xs transition-all hover:shadow-md"
            >
              <!-- Thumbnail -->
              <div class="bg-muted relative aspect-square w-full overflow-hidden">
                <img
                  :src="getStorageUrl(img.image_url || img.file_name || img.filename || '')"
                  :alt="img.filename || 'Scan Image'"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />

                <!-- Category Badge -->
                <div class="absolute top-2 left-2 z-10">
                  <span
                    class="rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-xs backdrop-blur-xs"
                  >
                    {{ img.category }}
                  </span>
                </div>

                <!-- Remove Button (Top Right) -->
                <button
                  type="button"
                  class="hover:bg-destructive absolute top-2 right-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg bg-black/60 text-white/80 opacity-0 shadow-xs backdrop-blur-xs transition-all group-hover:opacity-100 hover:text-white"
                  title="Remove from training scope"
                  @click="removeImageFromScope(img.uuid)"
                >
                  <Icon
                    name="lucide:x"
                    size="13"
                  />
                </button>
              </div>

              <!-- Metadata Footer -->
              <div class="p-2.5">
                <p class="text-foreground truncate font-mono text-[11px] font-semibold">
                  {{ img.filename || img.file_name || 'scan.jpg' }}
                </p>
                <div
                  class="text-muted-foreground mt-1 flex items-center justify-between text-[10px]"
                >
                  <span
                    v-if="img.is_synced"
                    class="font-medium text-emerald-600 dark:text-emerald-400"
                  >
                    ● Synced
                  </span>
                  <span
                    v-else
                    class="font-medium text-amber-600 dark:text-amber-400"
                  >
                    ○ Pending Sync
                  </span>
                  <span class="capitalize">{{
                    img.source === 'diagnosis' ? 'Visit' : 'Gallery'
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex w-full items-center justify-between">
          <span class="text-muted-foreground text-xs">
            {{ includedTrainingImages.length }} scans will be passed to PyTorch algorithms worker.
          </span>
          <AppButton
            variant="solid"
            size="sm"
            class="font-semibold"
            @click="showIncludedImagesModal = false"
          >
            Done
          </AppButton>
        </div>
      </template>
    </AppModal>

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
