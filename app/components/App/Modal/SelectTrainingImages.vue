<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import {
    modelTrainingService,
    type TrainingImageItem
  } from '~/api/modelTraining/ModelTrainingService'
  import { toast } from 'vue-sonner'

  const { getStorageUrl } = useStorage()

  interface Props {
    modelValue: boolean
    initialCategory?: string | null
    initialSelectedUuids?: string[]
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    initialCategory: null,
    initialSelectedUuids: () => []
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'confirm', selectedUuids: string[]): void
  }>()

  const isOpen = computed({
    get: () => props.modelValue,
    set: val => emit('update:modelValue', val)
  })

  // State
  const isLoading = ref(false)
  const isDeleting = ref(false)
  const showDeleteConfirm = ref(false)
  const isBulkDelete = ref(false)
  const imageToDelete = ref<TrainingImageItem | null>(null)

  const images = ref<TrainingImageItem[]>([])
  const selectedUuids = ref<Set<string>>(new Set())
  const activeCategory = ref<string>('all')
  const activeInclusionFilter = ref<'all' | 'included' | 'excluded'>('all')
  const activeLocationFilter = ref<'all' | 'webapp_scans' | 'uploaded'>('all')
  const activeSyncFilter = ref<'all' | 'synced' | 'needs_sync'>('all')
  const searchQuery = ref('')
  const failedImageUuids = ref<Set<string>>(new Set())
  const isSyncingScans = ref(false)

  const categoryCounts = ref<Record<string, number>>({})
  const uploadedCount = ref(0)
  const webappScansCount = ref(0)
  const syncedCount = ref(0)
  const needsSyncCount = ref(0)

  const categories = [
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

  const loadImages = async () => {
    isLoading.value = true
    failedImageUuids.value = new Set()
    try {
      const res: any = await modelTrainingService.getTrainingImages()
      const rawImages: TrainingImageItem[] = res.images || res.data || []
      images.value = rawImages

      // Calculate origin & sync statistics:
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

      // Selection initialization: DEFAULT TO ALL SELECTED (INCLUDED)
      if (props.initialSelectedUuids && props.initialSelectedUuids.length > 0) {
        const availableUuids = new Set(images.value.map(img => img.uuid))
        const validSelections = props.initialSelectedUuids.filter(uuid => availableUuids.has(uuid))
        if (validSelections.length > 0) {
          selectedUuids.value = new Set(validSelections)
        } else {
          // Default to all selected if saved IDs no longer match
          selectedUuids.value = new Set(images.value.map(img => img.uuid))
        }
      } else {
        // Default is strictly ALL selected as requested by the user
        selectedUuids.value = new Set(images.value.map(img => img.uuid))
      }
    } catch (err) {
      console.error('Failed to load training images:', err)
      toast.error('Failed to load candidate training images.')
    } finally {
      isLoading.value = false
    }
  }

  watch(
    () => props.modelValue,
    val => {
      if (val) {
        activeCategory.value = props.initialCategory ? props.initialCategory.toLowerCase() : 'all'
        activeInclusionFilter.value = 'all'
        activeLocationFilter.value = 'all'
        searchQuery.value = ''
        loadImages()
      }
    }
  )

  // Filtered dataset computed
  const filteredImages = computed(() => {
    return images.value.filter(img => {
      // 1. Category filter
      if (
        activeCategory.value !== 'all' &&
        (img.category || '').toLowerCase() !== activeCategory.value.toLowerCase()
      ) {
        return false
      }

      // 2. Inclusion filter (Included vs Excluded)
      const isSelected = selectedUuids.value.has(img.uuid)
      if (activeInclusionFilter.value === 'included' && !isSelected) {
        return false
      }
      if (activeInclusionFilter.value === 'excluded' && isSelected) {
        return false
      }

      // 3. Origin filter (From Webapp Scans vs Uploaded)
      const isUploaded = img.is_in_local_storage || img.is_in_raw
      if (activeLocationFilter.value === 'uploaded' && !isUploaded) {
        return false
      }
      if (activeLocationFilter.value === 'webapp_scans' && isUploaded) {
        return false
      }

      // 4. Sync status filter (Synced vs Needs Sync)
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

  // Selected & Excluded Counts
  const selectedCount = computed(() => selectedUuids.value.size)
  const excludedCount = computed(() => Math.max(0, images.value.length - selectedCount.value))

  // In View selection status
  const imagesInView = computed(() => filteredImages.value)
  const isAllInViewSelected = computed(() => {
    if (imagesInView.value.length === 0) return false
    return imagesInView.value.every(img => selectedUuids.value.has(img.uuid))
  })

  // Toggle single image inclusion / exclusion
  const toggleImageSelection = (img: TrainingImageItem) => {
    const next = new Set(selectedUuids.value)
    if (next.has(img.uuid)) {
      next.delete(img.uuid)
    } else {
      next.add(img.uuid)
    }
    selectedUuids.value = next
  }

  // Toggle selection for all currently visible images
  const toggleSelectAllInView = () => {
    const next = new Set(selectedUuids.value)
    if (isAllInViewSelected.value) {
      imagesInView.value.forEach(img => next.delete(img.uuid))
    } else {
      imagesInView.value.forEach(img => next.add(img.uuid))
    }
    selectedUuids.value = next
  }

  // Include all images across the entire dataset
  const selectAllImages = () => {
    const next = new Set<string>()
    images.value.forEach(img => next.add(img.uuid))
    selectedUuids.value = next
    toast.success(`Included all ${images.value.length} images for retraining.`)
  }

  // Exclude all images
  const deselectAllImages = () => {
    selectedUuids.value = new Set()
    toast.info('Excluded all images from selection.')
  }

  // Prompt delete for a single image
  const promptDeleteSingle = (img: TrainingImageItem) => {
    imageToDelete.value = img
    isBulkDelete.value = false
    showDeleteConfirm.value = true
  }

  // Prompt delete for all currently selected images
  const promptDeleteBulk = () => {
    if (selectedCount.value === 0) return
    imageToDelete.value = null
    isBulkDelete.value = true
    showDeleteConfirm.value = true
  }

  // Execute permanent deletion
  const handleExecuteDelete = async () => {
    isDeleting.value = true
    try {
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

      // Remove targets from images list
      const targetSet = new Set(targets)
      images.value = images.value.filter(img => !targetSet.has(img.uuid))

      // Remove targets from selection
      const next = new Set(selectedUuids.value)
      targets.forEach(id => next.delete(id))
      selectedUuids.value = next

      // Recalculate statistics
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
    } catch (err: any) {
      console.error('Failed to delete training images:', err)
      toast.error(err?.data?.message || err?.message || 'Failed to delete images.')
    } finally {
      isDeleting.value = false
    }
  }

  const handleConfirm = () => {
    const chosen = Array.from(selectedUuids.value)
    emit('confirm', chosen)
    emit('update:modelValue', false)
  }

  const formatCategoryBadge = (cat: string) => {
    const lower = (cat || '').toLowerCase()
    if (lower === 'acne') return { label: 'Acne', color: 'primary' as const }
    if (lower === 'eczema') return { label: 'Eczema', color: 'info' as const }
    if (lower === 'herpes') return { label: 'Herpes', color: 'warning' as const }
    return { label: cat || 'Skin Lesion', color: 'gray' as const }
  }

  /**
   * Resilient URL resolver: always routes through getStorageUrl()
   * to ensure requests use NUXT_PUBLIC_STORAGE_BASE (e.g. http://127.0.0.1:8000/storage/...)
   * rather than failing on port 80 or port 3000.
   */
  const resolveImageUrl = (img: TrainingImageItem) => {
    const raw = img.image_url || img.file_name || img.filename
    if (!raw) return ''
    return getStorageUrl(raw)
  }

  const handleSyncAllScans = async () => {
    isSyncingScans.value = true
    try {
      const res: any = await modelTrainingService.syncDataset()
      toast.success(res.message || 'Scans synchronized to local dataset storage!')
      await loadImages()
    } catch {
      toast.error('Failed to synchronize scans to local dataset.')
    } finally {
      isSyncingScans.value = false
    }
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
      label: 'Needs Sync',
      tooltip: 'Webapp consultation scan pending synchronization to local dataset storage',
      icon: 'lucide:refresh-cw',
      colorClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    }
  }

  const getStorageBadgeInfo = (img: TrainingImageItem) => {
    const isUploaded = img.is_in_local_storage || img.is_in_raw
    if (isUploaded) {
      return {
        label: 'Uploaded',
        tooltip: 'Dataset image uploaded to training pool',
        icon: 'lucide:upload-cloud',
        colorClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
      }
    }
    return {
      label: 'From Webapp Scans',
      tooltip: 'Real clinical scan from patient/doctor consultation',
      icon: 'lucide:sparkles',
      colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    }
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-100 flex items-center justify-center p-3 sm:p-6"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"></div>

        <!-- Modal Box -->
        <div
          class="modal-container bg-card border-border relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border shadow-2xl transition-all"
        >
          <!-- Header -->
          <div
            class="border-border bg-card/95 relative z-10 flex shrink-0 items-start justify-between border-b px-6 py-5 backdrop-blur-sm sm:px-8"
          >
            <div>
              <div class="flex items-center gap-2.5">
                <div
                  class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl"
                >
                  <Icon
                    name="lucide:check-square"
                    size="20"
                  />
                </div>
                <div>
                  <h3 class="text-foreground text-lg font-bold sm:text-xl">
                    Select Training Images
                  </h3>
                  <p class="text-muted-foreground mt-0.5 text-xs">
                    Choose candidate consultation scans or uploaded images to include or exclude
                    from model retraining.
                  </p>
                </div>
              </div>

              <!-- Storage & Selection Summary Badges -->
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <span
                  class="bg-primary/10 text-primary border-primary/30 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold"
                >
                  <Icon
                    name="lucide:check"
                    size="13"
                  />
                  {{ selectedCount }} of {{ images.length }} Included
                </span>

                <span
                  v-if="excludedCount > 0"
                  class="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400"
                >
                  <Icon
                    name="lucide:slash"
                    size="12"
                  />
                  {{ excludedCount }} Excluded
                </span>

                <span
                  v-if="webappScansCount > 0"
                  class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
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
                  class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
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
                  class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400"
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
                  class="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400"
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
              class="hover:bg-foreground/5 text-muted-foreground hover:text-foreground rounded-full"
              @click="close"
            >
              <Icon
                name="lucide:x"
                class="h-5 w-5"
              />
            </AppButton>
          </div>

          <!-- Controls Bar (Tabs, Filter, Search) -->
          <div class="border-border bg-muted/20 shrink-0 space-y-3 border-b px-6 py-3.5 sm:px-8">
            <!-- Row 1: Category Tabs & Search Bar -->
            <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <!-- Category Tabs -->
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  v-for="cat in categories"
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
                  class="bg-card border-border text-foreground placeholder:text-muted-foreground focus:ring-primary w-full rounded-xl border py-1.5 pr-3 pl-8 text-xs focus:ring-2 focus:outline-none"
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
            <div class="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <!-- Filter Chips (Included/Excluded & Origins) -->
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <!-- Inclusion status -->
                <div class="border-border bg-card flex items-center gap-1 rounded-xl border p-0.5">
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

                <!-- Origin filter: All Origins, From Webapp Scans, Uploaded -->
                <div
                  class="border-border bg-card hidden items-center gap-1 rounded-xl border p-0.5 md:flex"
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
                  class="border-border bg-card hidden items-center gap-1 rounded-xl border p-0.5 lg:flex"
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
                  @click="handleSyncAllScans"
                >
                  <Icon
                    name="lucide:refresh-cw"
                    size="11"
                    :class="isSyncingScans ? 'animate-spin' : ''"
                  />
                  Sync {{ needsSyncCount }} Scans to Dataset
                </AppButton>
              </div>
            </div>
          </div>

          <!-- Body: Image Gallery Grid -->
          <div class="flex-1 overflow-y-auto p-6 sm:p-8">
            <!-- Loading State -->
            <div
              v-if="isLoading"
              class="flex flex-col items-center justify-center py-16 text-center"
            >
              <Icon
                name="lucide:loader-2"
                size="36"
                class="text-primary animate-spin"
              />
              <p class="text-muted-foreground mt-3 text-sm font-medium">
                Loading candidate photos & checking image statuses...
              </p>
            </div>

            <!-- Empty State -->
            <div
              v-else-if="filteredImages.length === 0"
              class="flex flex-col items-center justify-center py-16 text-center"
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

            <!-- Image Cards Grid -->
            <div
              v-else
              class="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              <div
                v-for="img in filteredImages"
                :key="img.uuid"
                class="group bg-card border-border relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition-all select-none hover:shadow-md"
                :class="{
                  'ring-primary border-primary bg-primary/5 shadow-sm ring-2': selectedUuids.has(
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
                      size="28"
                      class="text-muted-foreground/60"
                    />
                    <span class="text-muted-foreground mt-1 text-[11px] font-semibold capitalize">
                      {{ img.category }} Scan
                    </span>
                    <span class="text-muted-foreground/80 font-mono text-[9px]">
                      {{ img.filename || img.file_name || 'Scan image' }}
                    </span>
                  </div>

                  <!-- Actual Image -->
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

                  <!-- Trash Delete Button (Bottom Right overlay on hover/focus) -->
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
                    <!-- Selected / Excluded Status Text -->
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

                    <!-- Synced vs Needs Sync Status Badge -->
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
          </div>

          <!-- Footer Action Bar -->
          <div
            class="border-border bg-card/95 relative z-10 flex shrink-0 flex-col justify-between gap-3 border-t px-6 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:px-8"
          >
            <!-- Summary Info -->
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

            <!-- Buttons -->
            <div class="flex items-center justify-end gap-2.5">
              <AppButton
                variant="ghost"
                size="md"
                class="rounded-xl font-semibold"
                @click="close"
              >
                Cancel
              </AppButton>
              <AppButton
                variant="solid"
                size="md"
                class="rounded-xl font-bold shadow-md"
                :disabled="selectedCount === 0"
                @click="handleConfirm"
              >
                <Icon
                  name="lucide:sparkles"
                  size="16"
                  class="mr-1.5"
                />
                Confirm Selection ({{ selectedCount }} Included)
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Confirmation Dialog for Permanent Image Deletion -->
  <AppModalConfirmation
    v-model="showDeleteConfirm"
    title="Permanently Delete Image?"
    :description="
      isBulkDelete
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
</template>
