<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import {
    modelTrainingService,
    type TrainingImageItem
  } from '~/api/modelTraining/ModelTrainingService'
  import {
    outOfScopeDatasetService,
    type OutOfScopeDatasetCategory
  } from '~/api/dataset/OutOfScopeDatasetService'
  import { toast } from 'vue-sonner'

  const { getStorageUrl } = useStorage()

  interface Props {
    modelValue: boolean
    datasetType?: 'standard' | 'out_of_scope'
    initialCategory?: string | null
    initialSelectedUuids?: string[]
  }

  const props = withDefaults(defineProps<Props>(), {
    datasetType: 'standard',
    initialCategory: null,
    initialSelectedUuids: () => []
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'deleted'): void
    (e: 'confirm', selectedUuids: string[]): void
  }>()

  const isOpen = computed({
    get: () => props.modelValue,
    set: val => emit('update:modelValue', val)
  })

  // State
  const isLoading = ref(false)
  const isDeleting = ref(false)
  const isSyncingScans = ref(false)
  const showDeleteConfirm = ref(false)
  const showSyncConfirm = ref(false)
  const isBulkDelete = ref(false)
  const imageToDelete = ref<TrainingImageItem | null>(null)

  // Standard Training Dataset State
  const images = ref<TrainingImageItem[]>([])
  const selectedUuids = ref<Set<string>>(new Set())
  const activeCategory = ref<string>('all')
  const activeInclusionFilter = ref<'all' | 'included' | 'excluded'>('all')
  const activeLocationFilter = ref<'all' | 'webapp_scans' | 'uploaded'>('all')
  const activeSyncFilter = ref<'all' | 'synced' | 'needs_sync'>('all')
  const searchQuery = ref('')
  const failedImageUuids = ref<Set<string>>(new Set())

  const categoryCounts = ref<Record<string, number>>({})
  const uploadedCount = ref(0)
  const webappScansCount = ref(0)
  const syncedCount = ref(0)
  const needsSyncCount = ref(0)

  // Out of Scope Dataset State (for Expansion training)
  const outOfScopeDataset = ref<OutOfScopeDatasetCategory[]>([])
  const outOfScopeSelectedUrls = ref<Set<string>>(new Set())

  const standardCategories = [
    { id: 'all', label: 'All Categories' },
    { id: 'acne', label: 'Acne' },
    { id: 'eczema', label: 'Eczema' },
    { id: 'herpes', label: 'Herpes' }
  ]

  const close = () => {
    isOpen.value = false
  }

  const handleImageError = (uuid: string) => {
    const next = new Set(failedImageUuids.value)
    next.add(uuid)
    failedImageUuids.value = next
  }

  const loadStandardDataset = async () => {
    isLoading.value = true
    failedImageUuids.value = new Set()
    try {
      const res: any = await modelTrainingService.getTrainingImages()
      const rawImages: TrainingImageItem[] = res.images || res.data || []
      images.value = rawImages

      let upCount = 0
      let scanCount = 0
      let sCount = 0
      let nsCount = 0

      rawImages.forEach(img => {
        const isSynced = Boolean(img.is_synced ?? (img.is_in_local_storage || img.is_in_raw))
        if (isSynced) {
          sCount++
        } else {
          nsCount++
        }

        if (img.is_in_local_storage || img.is_in_raw) {
          upCount++
        } else {
          scanCount++
        }
      })

      uploadedCount.value = upCount
      webappScansCount.value = scanCount
      syncedCount.value = sCount
      needsSyncCount.value = nsCount

      categoryCounts.value = res.by_category ?? {
        acne: rawImages.filter(i => (i.category || '').toLowerCase() === 'acne').length,
        eczema: rawImages.filter(i => (i.category || '').toLowerCase() === 'eczema').length,
        herpes: rawImages.filter(i => (i.category || '').toLowerCase() === 'herpes').length
      }

      // Initialize selected UUIDs (default to all candidate images)
      if (props.initialSelectedUuids && props.initialSelectedUuids.length > 0) {
        const availableUuids = new Set(images.value.map(img => img.uuid))
        const validSelections = props.initialSelectedUuids.filter(uuid => availableUuids.has(uuid))
        if (validSelections.length > 0) {
          selectedUuids.value = new Set(validSelections)
        } else {
          selectedUuids.value = new Set(images.value.map(img => img.uuid))
        }
      } else {
        selectedUuids.value = new Set(images.value.map(img => img.uuid))
      }
    } catch (err) {
      console.error('Failed to load training images:', err)
      toast.error('Failed to load dataset images.')
    } finally {
      isLoading.value = false
    }
  }

  const loadOutOfScopeDataset = async () => {
    isLoading.value = true
    outOfScopeSelectedUrls.value = new Set()
    try {
      const data = await outOfScopeDatasetService.getDataset()
      outOfScopeDataset.value = data
      if (data.length > 0) {
        if (props.initialCategory) {
          const match = data.find(
            d => d.category.toLowerCase() === props.initialCategory?.toLowerCase()
          )
          activeCategory.value = match ? match.category : data[0].category
        } else if (!activeCategory.value || activeCategory.value === 'all') {
          activeCategory.value = data[0].category
        }
      }
    } catch {
      toast.error('Failed to load out-of-scope dataset.')
    } finally {
      isLoading.value = false
    }
  }

  const loadData = async () => {
    if (props.datasetType === 'out_of_scope') {
      await loadOutOfScopeDataset()
    } else {
      await loadStandardDataset()
    }
  }

  watch(
    () => props.modelValue,
    val => {
      if (val) {
        activeCategory.value = props.initialCategory
          ? props.initialCategory.toLowerCase()
          : props.datasetType === 'out_of_scope'
            ? ''
            : 'all'
        activeInclusionFilter.value = 'all'
        activeLocationFilter.value = 'all'
        activeSyncFilter.value = 'all'
        searchQuery.value = ''
        loadData()
      } else {
        outOfScopeSelectedUrls.value = new Set()
      }
    }
  )

  // Standard Dataset Filtered Images
  const filteredStandardImages = computed(() => {
    return images.value.filter(img => {
      // 1. Category filter
      if (
        activeCategory.value !== 'all' &&
        (img.category || '').toLowerCase() !== activeCategory.value.toLowerCase()
      ) {
        return false
      }

      // 2. Inclusion filter
      const isSelected = selectedUuids.value.has(img.uuid)
      if (activeInclusionFilter.value === 'included' && !isSelected) {
        return false
      }
      if (activeInclusionFilter.value === 'excluded' && isSelected) {
        return false
      }

      // 3. Origin filter
      const isUploaded = img.is_in_local_storage || img.is_in_raw
      if (activeLocationFilter.value === 'uploaded' && !isUploaded) {
        return false
      }
      if (activeLocationFilter.value === 'webapp_scans' && isUploaded) {
        return false
      }

      // 4. Sync status filter
      const isSynced = Boolean(img.is_synced ?? (img.is_in_local_storage || img.is_in_raw))
      if (activeSyncFilter.value === 'synced' && !isSynced) {
        return false
      }
      if (activeSyncFilter.value === 'needs_sync' && isSynced) {
        return false
      }

      // 5. Search query
      if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase()
        const nameMatch = (img.original_name || img.file_name || img.filename || '')
          .toLowerCase()
          .includes(query)
        const catMatch = (img.category || '').toLowerCase().includes(query)
        const uuidMatch = (img.uuid || '').toLowerCase().includes(query)
        if (!nameMatch && !catMatch && !uuidMatch) return false
      }

      return true
    })
  })

  // Selection counts
  const selectedCount = computed(() => selectedUuids.value.size)
  const excludedCount = computed(() => Math.max(0, images.value.length - selectedCount.value))

  const imagesInView = computed(() => filteredStandardImages.value)
  const isAllInViewSelected = computed(() => {
    if (imagesInView.value.length === 0) return false
    return imagesInView.value.every(img => selectedUuids.value.has(img.uuid))
  })

  // Selection toggles
  const toggleImageSelection = (img: TrainingImageItem) => {
    const next = new Set(selectedUuids.value)
    if (next.has(img.uuid)) {
      next.delete(img.uuid)
    } else {
      next.add(img.uuid)
    }
    selectedUuids.value = next
  }

  const toggleSelectAllInView = () => {
    const next = new Set(selectedUuids.value)
    if (isAllInViewSelected.value) {
      imagesInView.value.forEach(img => next.delete(img.uuid))
    } else {
      imagesInView.value.forEach(img => next.add(img.uuid))
    }
    selectedUuids.value = next
  }

  const selectAllImages = () => {
    const next = new Set<string>()
    images.value.forEach(img => next.add(img.uuid))
    selectedUuids.value = next
    toast.success(`Included all ${images.value.length} images for retraining.`)
  }

  const deselectAllImages = () => {
    selectedUuids.value = new Set()
    toast.info('Excluded all images from selection.')
  }

  // Deletion Actions
  const promptDeleteSingle = (img: TrainingImageItem) => {
    imageToDelete.value = img
    isBulkDelete.value = false
    showDeleteConfirm.value = true
  }

  const promptDeleteBulk = () => {
    if (selectedCount.value === 0) return
    imageToDelete.value = null
    isBulkDelete.value = true
    showDeleteConfirm.value = true
  }

  const handleExecuteDelete = async () => {
    isDeleting.value = true
    try {
      if (props.datasetType === 'out_of_scope') {
        const urlsToDelete = Array.from(outOfScopeSelectedUrls.value)
        if (urlsToDelete.length === 0) {
          showDeleteConfirm.value = false
          return
        }
        const res = await outOfScopeDatasetService.deleteImages(urlsToDelete)
        toast.success(res.message || `${urlsToDelete.length} images deleted.`)
        showDeleteConfirm.value = false
        outOfScopeSelectedUrls.value = new Set()
        emit('deleted')
        await loadOutOfScopeDataset()
      } else {
        const targets = isBulkDelete.value
          ? Array.from(selectedUuids.value)
          : imageToDelete.value
            ? [imageToDelete.value.uuid]
            : []

        if (targets.length === 0) {
          showDeleteConfirm.value = false
          return
        }

        await modelTrainingService.deleteTrainingImages(targets)

        const targetSet = new Set(targets)
        images.value = images.value.filter(img => !targetSet.has(img.uuid))

        const next = new Set(selectedUuids.value)
        targets.forEach(id => next.delete(id))
        selectedUuids.value = next

        let upCount = 0
        let scanCount = 0
        images.value.forEach(img => {
          if (img.is_in_local_storage || img.is_in_raw) {
            upCount++
          } else {
            scanCount++
          }
        })
        uploadedCount.value = upCount
        webappScansCount.value = scanCount

        toast.success(
          isBulkDelete.value
            ? `Permanently deleted ${targets.length} image(s).`
            : 'Image permanently deleted.'
        )
        showDeleteConfirm.value = false
        imageToDelete.value = null
        emit('deleted')
      }
    } catch (err: any) {
      console.error('Failed to delete training images:', err)
      toast.error(err?.data?.message || err?.message || 'Failed to delete images.')
    } finally {
      isDeleting.value = false
    }
  }

  // Scan Synchronization Action
  const promptSyncAllScans = () => {
    showSyncConfirm.value = true
  }

  const handleExecuteSyncScans = async () => {
    isSyncingScans.value = true
    try {
      const res: any = await modelTrainingService.syncDataset()
      toast.success(res.message || 'Scans synchronized to local dataset storage!')
      showSyncConfirm.value = false
      await loadStandardDataset()
      emit('deleted')
    } catch {
      toast.error('Failed to synchronize scans to local dataset.')
    } finally {
      isSyncingScans.value = false
    }
  }

  // Save / Confirm Selection
  const handleConfirmScope = () => {
    const chosen = Array.from(selectedUuids.value)
    emit('confirm', chosen)
    emit('update:modelValue', false)
  }

  // Badges & Formatting
  const formatCategoryBadge = (cat: string) => {
    const lower = (cat || '').toLowerCase()
    if (lower === 'acne') return { label: 'Acne', color: 'primary' as const }
    if (lower === 'eczema') return { label: 'Eczema', color: 'info' as const }
    if (lower === 'herpes') return { label: 'Herpes', color: 'warning' as const }
    return { label: cat || 'Skin Lesion', color: 'gray' as const }
  }

  const resolveImageUrl = (img: TrainingImageItem) => {
    const raw = img.image_url || img.file_name || img.filename
    if (!raw) return ''
    return getStorageUrl(raw)
  }

  const getSyncBadgeInfo = (img: TrainingImageItem) => {
    const isSynced = Boolean(img.is_synced ?? (img.is_in_local_storage || img.is_in_raw))
    if (isSynced) {
      return {
        label: 'Synced',
        tooltip: 'Present in local dataset and training pool',
        icon: 'lucide:check-circle-2',
        colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
      }
    }
    return {
      label: 'Unsynced',
      tooltip: 'Webapp consultation scan pending synchronization to local dataset storage',
      icon: 'lucide:refresh-cw',
      colorClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    }
  }

  // Out of Scope specific helpers
  const activeOutOfScopeCategoryData = computed(() =>
    outOfScopeDataset.value.find(
      d => d.category.toLowerCase() === activeCategory.value?.toLowerCase()
    )
  )

  const toggleOutOfScopeImage = (url: string) => {
    const next = new Set(outOfScopeSelectedUrls.value)
    if (next.has(url)) {
      next.delete(url)
    } else {
      next.add(url)
    }
    outOfScopeSelectedUrls.value = next
  }
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop (Low Opacity Black) -->
    <Transition name="backdrop">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[90] bg-black/40 transition-opacity"
        @click="close"
      />
    </Transition>

    <!-- Slideover Panel (Expanded Width) -->
    <Transition name="slideover">
      <div
        v-if="isOpen"
        class="bg-card border-border fixed inset-y-0 right-0 z-[100] flex w-full max-w-3xl flex-col border-l shadow-2xl sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl"
      >
        <!-- Header -->
        <div
          class="border-border bg-card/95 relative z-10 flex shrink-0 items-start justify-between border-b px-6 py-4.5 backdrop-blur-sm sm:px-8"
        >
          <div>
            <div class="flex items-center gap-3">
              <div
                class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl"
              >
                <Icon
                  name="lucide:images"
                  size="19"
                />
              </div>
              <div>
                <h3 class="text-foreground text-base font-bold sm:text-lg">
                  {{
                    datasetType === 'out_of_scope'
                      ? 'Out-of-Scope Research Dataset'
                      : 'Dataset Browser & Training Scope'
                  }}
                </h3>
                <p class="text-muted-foreground mt-0.5 text-xs">
                  {{
                    datasetType === 'out_of_scope'
                      ? 'Browse and manage out-of-scope skin lesion samples for exploratory expansion models.'
                      : 'Inspect candidate photos, filter synced vs. un-synced scans, and select images included for retraining.'
                  }}
                </p>
              </div>
            </div>

            <!-- Standard Dataset Status & Origin Pill Badges -->
            <div
              v-if="datasetType === 'standard' && !isLoading"
              class="mt-3 flex flex-wrap items-center gap-1.5"
            >
              <span
                class="bg-primary/10 text-primary border-primary/30 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold"
              >
                <Icon
                  name="lucide:check"
                  size="13"
                />
                {{ selectedCount }} of {{ images.length }} Included
              </span>

              <span
                v-if="excludedCount > 0"
                class="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400"
              >
                <Icon
                  name="lucide:slash"
                  size="12"
                />
                {{ excludedCount }} Excluded
              </span>

              <span
                v-if="webappScansCount > 0"
                class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                title="Clinical scans from patient and doctor consultations"
              >
                <Icon
                  name="lucide:sparkles"
                  size="12"
                />
                {{ webappScansCount }} From Webapp Scans
              </span>

              <span
                v-if="syncedCount > 0"
                class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                title="Images already synchronized into local dataset storage"
              >
                <Icon
                  name="lucide:check-circle-2"
                  size="12"
                />
                {{ syncedCount }} Synced
              </span>

              <span
                v-if="needsSyncCount > 0"
                class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
                title="Consultation scans not yet copied into local dataset storage"
              >
                <Icon
                  name="lucide:refresh-cw"
                  size="12"
                />
                {{ needsSyncCount }} Needs Sync
              </span>

              <span
                v-if="uploadedCount > 0"
                class="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400"
                title="Images uploaded to dataset or synced into algorithm training files"
              >
                <Icon
                  name="lucide:upload-cloud"
                  size="12"
                />
                {{ uploadedCount }} Uploaded
              </span>
            </div>
          </div>

          <!-- Close Button -->
          <AppButton
            variant="ghost"
            size="icon"
            class="hover:bg-foreground/5 text-muted-foreground hover:text-foreground h-8 w-8 rounded-full"
            @click="close"
          >
            <Icon
              name="lucide:x"
              class="h-4 w-4"
            />
          </AppButton>
        </div>

        <!-- Controls Toolbar: Standard Mode -->
        <div
          v-if="datasetType === 'standard'"
          class="border-border bg-muted/20 shrink-0 space-y-3 border-b px-6 py-3.5 sm:px-8"
        >
          <!-- Row 1: Category Chips & Search Bar -->
          <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <!-- Category Tabs -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                v-for="cat in standardCategories"
                :key="cat.id"
                type="button"
                class="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
                :class="
                  activeCategory === cat.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-card text-muted-foreground hover:text-foreground border-border border'
                "
                @click="activeCategory = cat.id"
              >
                <span>{{ cat.label }}</span>
                <span
                  class="py-0.2 rounded-full px-1.5 text-[10px] font-bold"
                  :class="
                    activeCategory === cat.id
                      ? 'bg-white/20 text-white'
                      : 'bg-muted text-muted-foreground'
                  "
                >
                  {{
                    cat.id === 'all'
                      ? images.length
                      : (categoryCounts[cat.id] ??
                        images.filter(i => (i.category || '').toLowerCase() === cat.id).length)
                  }}
                </span>
              </button>
            </div>

            <!-- Search Bar -->
            <div class="relative w-full sm:w-64">
              <Icon
                name="lucide:search"
                size="14"
                class="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
              />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search scans by name or ID..."
                class="bg-card border-border text-foreground placeholder:text-muted-foreground focus:ring-primary w-full rounded-xl border py-1.5 pr-7 pl-8 text-xs focus:ring-2 focus:outline-none"
              />
              <button
                v-if="searchQuery"
                type="button"
                class="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                @click="searchQuery = ''"
              >
                <Icon
                  name="lucide:x"
                  size="12"
                />
              </button>
            </div>
          </div>

          <!-- Row 2: Status & Location Filters + Bulk Selection Actions -->
          <div class="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
            <!-- Filter Chips (Included/Excluded, Origins, Sync) -->
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <!-- Inclusion status -->
              <div class="border-border bg-card flex items-center gap-0.5 rounded-xl border p-0.5">
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all"
                  :class="
                    activeInclusionFilter === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="activeInclusionFilter = 'all'"
                >
                  All ({{ images.length }})
                </button>
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all"
                  :class="
                    activeInclusionFilter === 'included'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="activeInclusionFilter = 'included'"
                >
                  Included ({{ selectedCount }})
                </button>
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all"
                  :class="
                    activeInclusionFilter === 'excluded'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="activeInclusionFilter = 'excluded'"
                >
                  Excluded ({{ excludedCount }})
                </button>
              </div>

              <!-- Origin filter -->
              <div
                class="border-border bg-card hidden items-center gap-0.5 rounded-xl border p-0.5 md:flex"
              >
                <button
                  type="button"
                  class="rounded-lg px-2 py-1 text-[11px] font-medium transition-all"
                  :class="
                    activeLocationFilter === 'all'
                      ? 'bg-foreground/10 text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="activeLocationFilter = 'all'"
                >
                  All Origins
                </button>
                <button
                  v-if="webappScansCount > 0"
                  type="button"
                  class="rounded-lg px-2 py-1 text-[11px] font-medium transition-all"
                  :class="
                    activeLocationFilter === 'webapp_scans'
                      ? 'bg-foreground/10 text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="activeLocationFilter = 'webapp_scans'"
                >
                  From Webapp Scans ({{ webappScansCount }})
                </button>
                <button
                  v-if="uploadedCount > 0"
                  type="button"
                  class="rounded-lg px-2 py-1 text-[11px] font-medium transition-all"
                  :class="
                    activeLocationFilter === 'uploaded'
                      ? 'bg-foreground/10 text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="activeLocationFilter = 'uploaded'"
                >
                  Uploaded ({{ uploadedCount }})
                </button>
              </div>

              <!-- Sync Status Filter -->
              <div
                class="border-border bg-card hidden items-center gap-0.5 rounded-xl border p-0.5 lg:flex"
              >
                <button
                  type="button"
                  class="rounded-lg px-2 py-1 text-[11px] font-medium transition-all"
                  :class="
                    activeSyncFilter === 'all'
                      ? 'bg-foreground/10 text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="activeSyncFilter = 'all'"
                >
                  All
                </button>
                <button
                  type="button"
                  class="rounded-lg px-2 py-1 text-[11px] font-medium transition-all"
                  :class="
                    activeSyncFilter === 'synced'
                      ? 'bg-emerald-500/15 font-bold text-emerald-700 dark:text-emerald-300'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="activeSyncFilter = 'synced'"
                >
                  Synced ({{ syncedCount }})
                </button>
                <button
                  v-if="needsSyncCount > 0"
                  type="button"
                  class="rounded-lg px-2 py-1 text-[11px] font-medium transition-all"
                  :class="
                    activeSyncFilter === 'needs_sync'
                      ? 'bg-amber-500/15 font-bold text-amber-700 dark:text-amber-300'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="activeSyncFilter = 'needs_sync'"
                >
                  Needs Sync ({{ needsSyncCount }})
                </button>
              </div>
            </div>

            <!-- Quick Selection & Deletion Helpers -->
            <div class="flex flex-wrap items-center gap-2">
              <AppButton
                variant="outline"
                size="sm"
                class="h-7 gap-1.5 text-xs font-semibold"
                :disabled="imagesInView.length === 0"
                @click="toggleSelectAllInView"
              >
                <Icon
                  :name="isAllInViewSelected ? 'lucide:minus-square' : 'lucide:check-square'"
                  size="13"
                />
                {{
                  isAllInViewSelected
                    ? `Exclude View (${imagesInView.length})`
                    : `Include View (${imagesInView.length})`
                }}
              </AppButton>

              <AppButton
                v-if="selectedCount < images.length"
                variant="ghost"
                size="sm"
                class="text-primary hover:bg-primary/10 h-7 text-xs font-semibold"
                @click="selectAllImages"
              >
                Include All ({{ images.length }})
              </AppButton>

              <AppButton
                v-if="selectedCount > 0"
                variant="ghost"
                size="sm"
                class="text-muted-foreground hover:bg-foreground/10 h-7 text-xs font-medium"
                @click="deselectAllImages"
              >
                Exclude All
              </AppButton>

              <!-- Bulk Permanent Delete Button -->
              <AppButton
                v-if="selectedCount > 0"
                variant="ghost"
                size="sm"
                class="text-destructive hover:bg-destructive/10 h-7 gap-1 text-xs font-semibold"
                @click="promptDeleteBulk"
              >
                <Icon
                  name="lucide:trash-2"
                  size="12"
                />
                Delete Selected ({{ selectedCount }})
              </AppButton>

              <!-- Sync All to Local Dataset Action -->
              <AppButton
                v-if="needsSyncCount > 0"
                variant="outline"
                size="sm"
                class="border-primary/40 text-primary hover:bg-primary/5 h-7 gap-1 text-xs font-semibold"
                :loading="isSyncingScans"
                :disabled="isSyncingScans"
                @click="promptSyncAllScans"
              >
                <Icon
                  name="lucide:refresh-cw"
                  size="11"
                  :class="isSyncingScans ? 'animate-spin' : ''"
                />
                Sync {{ needsSyncCount }} Scans
              </AppButton>
            </div>
          </div>
        </div>

        <!-- Controls Toolbar: Out-of-Scope Mode (Expansion) -->
        <div
          v-else
          class="border-border flex shrink-0 items-center justify-between border-b px-6 py-3"
        >
          <!-- Category Tabs -->
          <div class="flex items-center gap-1.5 overflow-x-auto">
            <button
              v-for="cat in outOfScopeDataset"
              :key="cat.category"
              type="button"
              class="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all"
              :class="
                activeCategory === cat.category.toLowerCase()
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted border-transparent'
              "
              @click="activeCategory = cat.category.toLowerCase()"
            >
              <span>{{ cat.category.charAt(0).toUpperCase() + cat.category.slice(1) }}</span>
              <span class="py-0.2 rounded-full bg-white/20 px-1.5 text-[10px] font-bold">
                {{ cat.images.length }}
              </span>
            </button>
          </div>

          <!-- Out of Scope Delete Actions -->
          <div
            v-if="outOfScopeSelectedUrls.size > 0"
            class="flex items-center gap-2"
          >
            <button
              class="text-muted-foreground hover:text-foreground text-xs font-medium"
              @click="outOfScopeSelectedUrls = new Set()"
            >
              Clear
            </button>
            <AppButton
              variant="destructive"
              size="sm"
              class="h-7 gap-1.5 text-xs"
              @click="showDeleteConfirm = true"
            >
              <Icon
                name="lucide:trash-2"
                size="12"
              />
              Delete {{ outOfScopeSelectedUrls.size }}
            </AppButton>
          </div>
        </div>

        <!-- Body: Gallery Grid -->
        <div class="flex-1 overflow-y-auto p-6 sm:p-8">
          <!-- Loading State -->
          <div
            v-if="isLoading"
            class="flex flex-col items-center justify-center py-20 text-center"
          >
            <Icon
              name="lucide:loader-2"
              size="36"
              class="text-primary animate-spin"
            />
            <p class="text-muted-foreground mt-3 text-sm font-medium">
              Loading dataset images & checking synchronization...
            </p>
          </div>

          <!-- Out of Scope Gallery Grid -->
          <template v-else-if="datasetType === 'out_of_scope'">
            <div
              v-if="
                !activeOutOfScopeCategoryData || activeOutOfScopeCategoryData.images.length === 0
              "
              class="flex flex-col items-center justify-center py-20 text-center"
            >
              <div
                class="bg-muted text-muted-foreground mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
              >
                <Icon
                  name="lucide:image-off"
                  size="24"
                />
              </div>
              <h4 class="text-foreground text-base font-bold">No images found</h4>
              <p class="text-muted-foreground mt-1 text-xs">
                This category has no uploaded images yet.
              </p>
            </div>

            <div
              v-else
              class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            >
              <div
                v-for="url in activeOutOfScopeCategoryData.images"
                :key="url"
                class="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-150"
                :class="
                  outOfScopeSelectedUrls.has(url)
                    ? 'border-primary shadow-primary/20 shadow-md'
                    : 'hover:border-border border-transparent'
                "
                @click="toggleOutOfScopeImage(url)"
              >
                <img
                  :src="getStorageUrl(url)"
                  :alt="activeCategory"
                  class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />

                <div
                  class="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-150"
                  :class="
                    outOfScopeSelectedUrls.has(url)
                      ? 'bg-primary border-primary scale-110 text-white'
                      : 'border-white/60 bg-white/80 opacity-0 group-hover:opacity-100'
                  "
                >
                  <Icon
                    v-if="outOfScopeSelectedUrls.has(url)"
                    name="lucide:check"
                    size="11"
                  />
                </div>
              </div>
            </div>
          </template>

          <!-- Standard Retraining Dataset Gallery Grid -->
          <template v-else>
            <!-- Empty State -->
            <div
              v-if="filteredStandardImages.length === 0"
              class="flex flex-col items-center justify-center py-20 text-center"
            >
              <div
                class="bg-muted text-muted-foreground flex h-16 w-16 items-center justify-center rounded-3xl"
              >
                <Icon
                  name="lucide:image-off"
                  size="28"
                />
              </div>
              <h4 class="text-foreground mt-4 text-base font-bold">No scans found</h4>
              <p class="text-muted-foreground mt-1 max-w-sm text-xs">
                {{
                  searchQuery
                    ? 'No scans match your search query or active filter.'
                    : 'No images available matching this selection.'
                }}
              </p>
            </div>

            <!-- Standard Image Cards Grid (Up to 7 Columns) -->
            <div
              v-else
              class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
            >
              <div
                v-for="img in filteredStandardImages"
                :key="img.uuid"
                class="group bg-card border-border relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition-all select-none hover:shadow-md"
                :class="{
                  'ring-primary border-primary bg-primary/5 shadow-xs ring-2': selectedUuids.has(
                    img.uuid
                  ),
                  'border-border/60 bg-muted/20 hover:border-foreground/30 opacity-70 hover:opacity-100':
                    !selectedUuids.has(img.uuid)
                }"
                @click="toggleImageSelection(img)"
              >
                <!-- Thumbnail Image Container -->
                <div class="bg-muted relative aspect-square w-full overflow-hidden">
                  <!-- Fallback placeholder if image load fails -->
                  <div
                    v-if="failedImageUuids.has(img.uuid)"
                    class="bg-muted/60 flex h-full w-full flex-col items-center justify-center p-3 text-center"
                  >
                    <Icon
                      name="lucide:image"
                      size="26"
                      class="text-muted-foreground/60"
                    />
                    <span class="text-muted-foreground mt-1 text-[11px] font-semibold capitalize">
                      {{ img.category }} Scan
                    </span>
                    <span class="text-muted-foreground/80 font-mono text-[9px]">
                      {{ img.filename || img.file_name || 'Scan image' }}
                    </span>
                  </div>

                  <!-- Image -->
                  <img
                    v-else
                    :src="resolveImageUrl(img)"
                    :alt="img.original_name || img.file_name || img.filename || 'Scan Image'"
                    class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    :class="{ 'brightness-90 saturate-75': !selectedUuids.has(img.uuid) }"
                    loading="lazy"
                    @error="handleImageError(img.uuid)"
                  />

                  <!-- Selection Checkbox (Top Left) -->
                  <div class="absolute top-2 left-2 z-10">
                    <div
                      class="flex h-6 w-6 items-center justify-center rounded-lg transition-all"
                      :class="
                        selectedUuids.has(img.uuid)
                          ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-white/30'
                          : 'border border-white/40 bg-black/50 text-white/40 backdrop-blur-xs'
                      "
                    >
                      <Icon
                        v-if="selectedUuids.has(img.uuid)"
                        name="lucide:check"
                        size="14"
                        class="stroke-3"
                      />
                    </div>
                  </div>

                  <!-- Category Badge (Top Right) -->
                  <div class="absolute top-2 right-2 z-10">
                    <AppBadge
                      :color="formatCategoryBadge(img.category).color"
                      size="xs"
                      variant="solid"
                      class="text-[10px] font-bold uppercase shadow-xs backdrop-blur-xs"
                    >
                      {{ formatCategoryBadge(img.category).label }}
                    </AppBadge>
                  </div>

                  <!-- Trash Delete Button (Bottom Right overlay) -->
                  <button
                    type="button"
                    class="hover:bg-destructive absolute right-2 bottom-2 z-20 flex h-6 w-6 items-center justify-center rounded-lg bg-black/60 text-white/70 shadow-sm backdrop-blur-xs transition-all hover:scale-110 hover:text-white"
                    title="Permanently Delete Image"
                    @click.stop="promptDeleteSingle(img)"
                  >
                    <Icon
                      name="lucide:trash-2"
                      size="12"
                    />
                  </button>
                </div>

                <!-- Footer Card Info -->
                <div class="flex flex-col justify-between p-2.5 text-xs">
                  <div class="flex items-center justify-between gap-1">
                    <span
                      class="truncate font-mono text-[11px] font-semibold"
                      :class="
                        selectedUuids.has(img.uuid) ? 'text-foreground' : 'text-muted-foreground'
                      "
                    >
                      {{
                        img.original_name ||
                        (img.filename || img.file_name || '').substring(0, 16) + '...'
                      }}
                    </span>
                  </div>

                  <div class="mt-1.5 flex items-center justify-between text-[10px]">
                    <span
                      v-if="selectedUuids.has(img.uuid)"
                      class="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400"
                    >
                      <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      Included
                    </span>
                    <span
                      v-else
                      class="text-muted-foreground inline-flex items-center gap-1 font-medium"
                    >
                      <span class="bg-muted-foreground/40 h-1.5 w-1.5 rounded-full"></span>
                      Excluded
                    </span>

                    <span
                      class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold"
                      :class="getSyncBadgeInfo(img).colorClass"
                      :title="getSyncBadgeInfo(img).tooltip"
                    >
                      <Icon
                        :name="getSyncBadgeInfo(img).icon"
                        size="9"
                      />
                      {{ getSyncBadgeInfo(img).label }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer Action Bar -->
        <div
          class="border-border bg-card/95 relative z-10 flex shrink-0 flex-col justify-between gap-3 border-t px-6 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:px-8"
        >
          <!-- Standard Mode Summary Info -->
          <template v-if="datasetType === 'standard'">
            <div class="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <span class="text-foreground font-bold">
                {{ selectedCount }} of {{ images.length }}
              </span>
              images included for retraining.
              <span
                v-if="excludedCount > 0"
                class="font-semibold text-rose-600 dark:text-rose-400"
              >
                ({{ excludedCount }} excluded)
              </span>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center justify-end gap-2.5">
              <AppButton
                variant="ghost"
                size="md"
                class="rounded-xl font-semibold"
                @click="close"
              >
                Close
              </AppButton>
              <AppButton
                variant="solid"
                size="md"
                class="rounded-xl font-bold shadow-md"
                :disabled="selectedCount === 0"
                @click="handleConfirmScope"
              >
                <Icon
                  name="lucide:check"
                  size="16"
                  class="mr-1.5"
                />
                Confirm Selection ({{ selectedCount }} Included)
              </AppButton>
            </div>
          </template>

          <!-- Out of Scope Mode Footer -->
          <template v-else>
            <span class="text-muted-foreground font-mono text-xs">
              {{ activeOutOfScopeCategoryData?.images.length ?? 0 }} images in
              {{ activeCategory || 'selected category' }}
            </span>
            <div class="flex items-center gap-2">
              <AppButton
                variant="outline"
                size="sm"
                @click="loadOutOfScopeDataset"
              >
                <Icon
                  name="lucide:refresh-cw"
                  size="12"
                  class="mr-1"
                />
                Refresh
              </AppButton>
              <AppButton
                variant="solid"
                size="sm"
                @click="close"
              >
                Done
              </AppButton>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Delete Confirmation Modal -->
  <AppModalConfirmation
    v-model="showDeleteConfirm"
    title="Permanently Delete Images?"
    :description="
      datasetType === 'out_of_scope'
        ? `You are about to permanently delete ${outOfScopeSelectedUrls.size} image(s) from the research dataset. This action cannot be undone.`
        : isBulkDelete
          ? `Are you sure you want to permanently delete ${selectedCount} selected image(s)? They will be purged from storage, consultation records, and AI training data. This action cannot be undone.`
          : 'Are you sure you want to permanently delete this image? It will be purged from storage, consultation records, and AI training data. This action cannot be undone.'
    "
    icon="lucide:trash-2"
    icon-color="danger"
    confirm-text="Delete Permanently"
    cancel-text="Cancel"
    confirm-variant="destructive"
    :loading="isDeleting"
    @confirm="handleExecuteDelete"
  />

  <!-- Sync Confirmation Modal -->
  <AppModalConfirmation
    v-model="showSyncConfirm"
    title="Synchronize Scans to Dataset?"
    :description="`This will copy ${needsSyncCount} approved consultation scan image(s) into local dataset storage under their respective disease categories. Do you want to proceed?`"
    icon="lucide:refresh-cw"
    icon-color="primary"
    confirm-text="Sync Now"
    cancel-text="Cancel"
    confirm-variant="solid"
    :loading="isSyncingScans"
    @confirm="handleExecuteSyncScans"
  />
</template>

<style scoped>
  .backdrop-enter-active,
  .backdrop-leave-active {
    transition: opacity 0.25s ease;
  }
  .backdrop-enter-from,
  .backdrop-leave-to {
    opacity: 0;
  }

  .slideover-enter-active,
  .slideover-leave-active {
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .slideover-enter-from,
  .slideover-leave-to {
    transform: translateX(100%);
  }
</style>
