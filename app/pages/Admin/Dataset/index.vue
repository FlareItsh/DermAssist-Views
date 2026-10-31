<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import {
    datasetService,
    type DatasetCategory,
    type DatasetImageItem
  } from '~/api/dataset/DatasetService'
  import {
    outOfScopeDatasetService,
    type OutOfScopeDatasetCategory,
    OUT_OF_SCOPE_CATEGORIES
  } from '~/api/dataset/OutOfScopeDatasetService'
  import { modelTrainingService } from '~/api/modelTraining/ModelTrainingService'
  import { toast } from 'vue-sonner'

  const { getStorageUrl } = useStorage()

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  // ── Modals & Action State ────────────────────────────────────────────
  const showDatasetSlideover = ref(false)
  const showUploadModal = ref(false)
  const uploadMode = ref<'priority' | 'out_of_scope'>('priority')

  const openUploadModal = (mode: 'priority' | 'out_of_scope' = 'priority') => {
    uploadMode.value = mode
    showUploadModal.value = true
  }

  const handleUploadSuccess = () => {
    if (uploadMode.value === 'out_of_scope') {
      fetchOutOfScopeDataset()
    } else {
      fetchDataset()
    }
    showUploadModal.value = false
  }

  const showDeleteConfirm = ref(false)
  const isDeleteOutOfScope = ref(false)
  const imageToDelete = ref<string | null>(null)

  const promptDeleteImage = (url: string, isOos: boolean = false) => {
    imageToDelete.value = url
    isDeleteOutOfScope.value = isOos
    showDeleteConfirm.value = true
  }

  const handleConfirmDelete = async () => {
    if (!imageToDelete.value) return

    if (isDeleteOutOfScope.value) {
      isDeletingOutOfScope.value = true
      try {
        await outOfScopeDatasetService.deleteImage(imageToDelete.value)
        selectedOosUrls.value.delete(imageToDelete.value)
        await fetchOutOfScopeDataset()
        toast.success('Image removed from research dataset.')
        showDeleteConfirm.value = false
        imageToDelete.value = null
      } catch (e) {
        console.error('Failed to delete research image', e)
        toast.error('Failed to delete image.')
      } finally {
        isDeletingOutOfScope.value = false
      }
    } else {
      isDeleting.value = true
      try {
        await datasetService.deleteImage(imageToDelete.value)
        selectedPriorityUrls.value.delete(imageToDelete.value)
        await fetchDataset()
        toast.success('Image removed from priority dataset.')
        showDeleteConfirm.value = false
        imageToDelete.value = null
      } catch (e) {
        console.error('Failed to delete image', e)
        toast.error('Failed to delete image.')
      } finally {
        isDeleting.value = false
      }
    }
  }

  const isApprovingDiagnosis = ref(false)
  const handleApproveDiagnosis = async (diagnosisUuid: string) => {
    isApprovingDiagnosis.value = true
    try {
      await datasetService.adminApproveDiagnosis(diagnosisUuid)
      toast.success('Clinical scan approved by admin for AI retraining dataset.')
      await fetchDataset()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to approve diagnosis for dataset.')
    } finally {
      isApprovingDiagnosis.value = false
    }
  }

  // ── Multi-Select & Bulk Delete State ──────────────────────────────────
  const selectedPriorityUrls = ref<Set<string>>(new Set())
  const selectedOosUrls = ref<Set<string>>(new Set())
  const isBulkDeleting = ref(false)
  const showBulkDeleteConfirm = ref(false)
  const bulkDeleteTarget = ref<'priority' | 'out_of_scope'>('priority')

  const toggleSelectPriorityImage = (url: string) => {
    const next = new Set(selectedPriorityUrls.value)
    if (next.has(url)) {
      next.delete(url)
    } else {
      next.add(url)
    }
    selectedPriorityUrls.value = next
  }

  const toggleSelectAllCategoryPriority = (categoryImages: string[]) => {
    const next = new Set(selectedPriorityUrls.value)
    const isAll = categoryImages.length > 0 && categoryImages.every(u => next.has(u))
    if (isAll) {
      categoryImages.forEach(u => next.delete(u))
    } else {
      categoryImages.forEach(u => next.add(u))
    }
    selectedPriorityUrls.value = next
  }

  const isCategoryAllSelectedPriority = (categoryImages: string[]) => {
    return categoryImages.length > 0 && categoryImages.every(u => selectedPriorityUrls.value.has(u))
  }

  const getCategorySelectedCountPriority = (categoryImages: string[]) => {
    return categoryImages.filter(u => selectedPriorityUrls.value.has(u)).length
  }

  const clearPrioritySelection = () => {
    selectedPriorityUrls.value = new Set()
  }

  const promptBulkDeletePriority = () => {
    if (selectedPriorityUrls.value.size === 0) return
    bulkDeleteTarget.value = 'priority'
    showBulkDeleteConfirm.value = true
  }

  const toggleSelectOosImage = (url: string) => {
    const next = new Set(selectedOosUrls.value)
    if (next.has(url)) {
      next.delete(url)
    } else {
      next.add(url)
    }
    selectedOosUrls.value = next
  }

  const toggleSelectAllCategoryOos = (categoryImages: string[]) => {
    const next = new Set(selectedOosUrls.value)
    const isAll = categoryImages.length > 0 && categoryImages.every(u => next.has(u))
    if (isAll) {
      categoryImages.forEach(u => next.delete(u))
    } else {
      categoryImages.forEach(u => next.add(u))
    }
    selectedOosUrls.value = next
  }

  const isCategoryAllSelectedOos = (categoryImages: string[]) => {
    return categoryImages.length > 0 && categoryImages.every(u => selectedOosUrls.value.has(u))
  }

  const getCategorySelectedCountOos = (categoryImages: string[]) => {
    return categoryImages.filter(u => selectedOosUrls.value.has(u)).length
  }

  const clearOosSelection = () => {
    selectedOosUrls.value = new Set()
  }

  const promptBulkDeleteOos = () => {
    if (selectedOosUrls.value.size === 0) return
    bulkDeleteTarget.value = 'out_of_scope'
    showBulkDeleteConfirm.value = true
  }

  const handleConfirmBulkDelete = async () => {
    isBulkDeleting.value = true
    try {
      if (bulkDeleteTarget.value === 'priority') {
        const urls = Array.from(selectedPriorityUrls.value)
        await datasetService.deleteImages(urls)
        toast.success(`Deleted ${urls.length} images from priority dataset.`)
        selectedPriorityUrls.value = new Set()
        await fetchDataset()
      } else {
        const urls = Array.from(selectedOosUrls.value)
        await outOfScopeDatasetService.deleteImages(urls)
        toast.success(`Deleted ${urls.length} images from research dataset.`)
        selectedOosUrls.value = new Set()
        await fetchOutOfScopeDataset()
      }
      showBulkDeleteConfirm.value = false
    } catch (e: any) {
      console.error('Failed to bulk delete images', e)
      toast.error('Failed to delete selected images.')
    } finally {
      isBulkDeleting.value = false
    }
  }

  // ── Category Transfer State & Actions ────────────────────────────────
  const showTransferModal = ref(false)
  const isTransferring = ref(false)
  const isBulkTransfer = ref(false)
  const itemToTransfer = ref<DatasetImageItem | null>(null)
  const targetTransferCategory = ref<string>('acne')

  const transferTargetOptions = [
    {
      id: 'acne',
      name: 'Acne',
      desc: 'Follicular eruptions, inflammatory papules & pustules',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
    },
    {
      id: 'eczema',
      name: 'Eczema',
      desc: 'Atopic dermatitis, inflamed, scaling, or pruritic patches',
      badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
    },
    {
      id: 'herpes',
      name: 'Herpes',
      desc: 'Clustered vesicular eruptions, ulcerations & viral lesions',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
    }
  ]

  const selectedPriorityItems = computed(() => {
    return allPriorityItems.value.filter(item => selectedPriorityUrls.value.has(item.url))
  })

  const currentSelectionCategory = computed(() => {
    if (!isBulkTransfer.value && itemToTransfer.value) {
      for (const d of datasets.value) {
        if (
          (d.items || []).some(i => i.url === itemToTransfer.value?.url) ||
          (d.images || []).includes(itemToTransfer.value?.url || '')
        ) {
          return d.category.toLowerCase()
        }
      }
      return null
    }
    if (isBulkTransfer.value && selectedPriorityItems.value.length > 0) {
      const cats = new Set<string>()
      for (const item of selectedPriorityItems.value) {
        for (const d of datasets.value) {
          if (
            (d.items || []).some(i => i.url === item.url) ||
            (d.images || []).includes(item.url)
          ) {
            cats.add(d.category.toLowerCase())
            break
          }
        }
      }
      if (cats.size === 1) {
        return Array.from(cats)[0]
      }
    }
    return null
  })

  const promptTransferPriorityImage = (item: DatasetImageItem) => {
    itemToTransfer.value = item
    isBulkTransfer.value = false

    let currentCat = ''
    for (const d of datasets.value) {
      if ((d.items || []).some(i => i.url === item.url) || (d.images || []).includes(item.url)) {
        currentCat = d.category.toLowerCase()
        break
      }
    }

    if (currentCat === 'acne') {
      targetTransferCategory.value = 'eczema'
    } else {
      targetTransferCategory.value = 'acne'
    }
    showTransferModal.value = true
  }

  const promptBulkTransferPriority = () => {
    if (selectedPriorityUrls.value.size === 0) return
    itemToTransfer.value = null
    isBulkTransfer.value = true

    if (currentSelectionCategory.value === 'acne') {
      targetTransferCategory.value = 'herpes'
    } else {
      targetTransferCategory.value = 'acne'
    }
    showTransferModal.value = true
  }

  const promptCategorySelectedTransfer = (dataset: DatasetCategory) => {
    const catUrls = getCategoryItems(dataset).map(i => i.url)
    const selectedInCat = catUrls.filter(url => selectedPriorityUrls.value.has(url))
    if (selectedInCat.length === 0) return

    selectedPriorityUrls.value = new Set(selectedInCat)
    itemToTransfer.value = null
    isBulkTransfer.value = true

    const catName = (dataset.category || '').toLowerCase()
    if (catName === 'acne') {
      targetTransferCategory.value = 'herpes'
    } else if (catName === 'herpes') {
      targetTransferCategory.value = 'acne'
    } else {
      targetTransferCategory.value = 'acne'
    }
    showTransferModal.value = true
  }

  const closeTransferModal = () => {
    if (isTransferring.value) return
    showTransferModal.value = false
    itemToTransfer.value = null
  }

  const handleConfirmTransfer = async () => {
    const target = targetTransferCategory.value
    isTransferring.value = true

    try {
      const targets: string[] = isBulkTransfer.value
        ? selectedPriorityItems.value.map(i => i.diagnosis_uuid || i.filename || i.url)
        : itemToTransfer.value
          ? ([
              itemToTransfer.value.diagnosis_uuid ||
                itemToTransfer.value.filename ||
                itemToTransfer.value.url
            ].filter(Boolean) as string[])
          : []

      if (targets.length === 0) {
        showTransferModal.value = false
        return
      }

      const res = await modelTrainingService.recategorizeTrainingImages(targets, target)
      const targetTitle = target.charAt(0).toUpperCase() + target.slice(1)

      toast.success(
        res.message || `Successfully transferred ${targets.length} scan(s) to ${targetTitle}.`
      )

      selectedPriorityUrls.value = new Set()
      showTransferModal.value = false
      itemToTransfer.value = null
      await fetchDataset()
    } catch (err: any) {
      console.error('Failed to transfer image category:', err)
      toast.error(err?.data?.message || err?.message || 'Failed to transfer image category.')
    } finally {
      isTransferring.value = false
    }
  }

  // ── Standard Dataset & Sync State ─────────────────────────────────────
  const isLoading = ref(false)
  const isDeleting = ref(false)
  const isSyncing = ref(false)
  const showSyncConfirm = ref(false)
  const syncFilter = ref<'all' | 'synced' | 'pending'>('all')
  const datasets = ref<DatasetCategory[]>([])

  const totalImagesCount = computed(() => {
    return datasets.value.reduce((acc, cat) => acc + (cat.total ?? cat.images?.length ?? 0), 0)
  })

  const allPriorityItems = computed<DatasetImageItem[]>(() => {
    const items: DatasetImageItem[] = []
    datasets.value.forEach(cat => {
      if (cat.items && cat.items.length > 0) {
        items.push(...cat.items)
      } else if (cat.images) {
        cat.images.forEach(url => {
          items.push({
            url,
            filename: url.split('/').pop(),
            is_synced: true,
            sync_status: 'synced',
            source: 'dataset_gallery',
            storage_location: 'dataset_storage'
          })
        })
      }
    })
    return items
  })

  const syncedPriorityCount = computed(() => {
    return datasets.value.reduce((acc, cat) => acc + (cat.synced_count ?? 0), 0)
  })

  const pendingSyncPriorityCount = computed(() => {
    return datasets.value.reduce((acc, cat) => acc + (cat.needs_sync_count ?? 0), 0)
  })

  const syncedPercentage = computed(() => {
    if (totalImagesCount.value === 0) return 100
    return Math.round((syncedPriorityCount.value / totalImagesCount.value) * 100)
  })

  const getCategoryItems = (dataset: DatasetCategory): DatasetImageItem[] => {
    const raw: DatasetImageItem[] =
      dataset.items && dataset.items.length > 0
        ? dataset.items
        : (dataset.images || []).map(url => ({
            url,
            filename: url.split('/').pop(),
            is_synced: true,
            sync_status: 'synced',
            source: 'dataset_gallery',
            storage_location: 'dataset_storage'
          }))

    if (syncFilter.value === 'synced') {
      return raw.filter(i => i.is_synced)
    }
    if (syncFilter.value === 'pending') {
      return raw.filter(i => !i.is_synced)
    }
    return raw
  }

  const promptSyncDataset = () => {
    showDatasetSlideover.value = true
  }

  const handleExecuteSync = async () => {
    showSyncConfirm.value = false
    isSyncing.value = true
    try {
      const res = await modelTrainingService.syncDataset()
      toast.success(res.message || 'Dataset synchronized successfully.')
      await fetchDataset()
    } catch (e: any) {
      console.error('Failed to sync dataset', e)
      toast.error('Failed to synchronize dataset.')
    } finally {
      isSyncing.value = false
    }
  }

  // ── Category Pagination ──────────────────────────────────────────────
  const pageSize = 12
  const priorityCategoryPage = ref<Record<string, number>>({})
  const oosCategoryPage = ref<Record<string, number>>({})
  const categoryLoadingMap = ref<Record<string, boolean>>({})

  const isCategoryLoading = (category: string): boolean => {
    return Boolean(categoryLoadingMap.value[category.toLowerCase()])
  }

  const getCategoryCurrentPage = (category: string, isOos: boolean = false): number => {
    const list = isOos ? outOfScopeDatasets.value : datasets.value
    const found = list.find(d => (d.category || '').toLowerCase() === category.toLowerCase())
    if (found?.current_page) {
      return found.current_page
    }
    const map = isOos ? oosCategoryPage.value : priorityCategoryPage.value
    return map[category] || 1
  }

  const getCategoryTotalItems = (dataset: DatasetCategory | OutOfScopeDatasetCategory): number => {
    return dataset.total ?? dataset.images?.length ?? 0
  }

  const getCategoryTotalPages = (dataset: DatasetCategory | OutOfScopeDatasetCategory): number => {
    if (dataset.last_page) {
      return dataset.last_page
    }
    const count = getCategoryTotalItems(dataset)
    return Math.max(1, Math.ceil(count / pageSize))
  }

  const setCategoryPage = async (category: string, page: number, isOos: boolean = false) => {
    const catKey = category.toLowerCase()
    const targetMap = isOos ? oosCategoryPage : priorityCategoryPage
    targetMap.value = {
      ...targetMap.value,
      [category]: page
    }

    categoryLoadingMap.value = {
      ...categoryLoadingMap.value,
      [catKey]: true
    }

    try {
      if (isOos) {
        const res = await outOfScopeDatasetService.getDataset({
          category,
          page,
          per_page: pageSize
        })
        if (res && res.length > 0) {
          const index = outOfScopeDatasets.value.findIndex(
            d => (d.category || '').toLowerCase() === catKey
          )
          if (index !== -1) {
            outOfScopeDatasets.value[index] = res[0]
          }
        }
      } else {
        const res = await datasetService.getDataset({
          category,
          page,
          per_page: pageSize
        })
        if (res && res.length > 0) {
          const index = datasets.value.findIndex(d => (d.category || '').toLowerCase() === catKey)
          if (index !== -1) {
            datasets.value[index] = res[0]
          }
        }
      }
    } catch (e) {
      console.error(`Failed to load page ${page} for ${category}`, e)
      toast.error(`Failed to load page ${page} for ${category}.`)
    } finally {
      categoryLoadingMap.value = {
        ...categoryLoadingMap.value,
        [catKey]: false
      }
    }
  }

  const fetchDataset = async () => {
    isLoading.value = true
    try {
      const res = await datasetService.getDataset({ page: 1, per_page: pageSize })
      datasets.value = (res || []).filter(d => (d.category || '').toLowerCase() !== 'none')
    } catch (e) {
      console.error('Failed to fetch dataset', e)
      toast.error('Failed to load dataset gallery.')
    } finally {
      isLoading.value = false
    }
  }

  const downloadZip = async (category?: string) => {
    try {
      const blob = await datasetService.downloadDataset(category)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        category ? `dataset_${category.toLowerCase()}.zip` : 'dataset_all.zip'
      )
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Download started.')
    } catch (e) {
      console.error('Failed to download zip', e)
      toast.error('Failed to download zip. It might be empty or unavailable.')
    }
  }

  // ── Out-of-Scope Research Dataset ────────────────────────────────────
  const isLoadingOutOfScope = ref(false)
  const isDeletingOutOfScope = ref(false)
  const outOfScopeDatasets = ref<OutOfScopeDatasetCategory[]>([])
  const showOosInfo = ref(false)

  const totalOutOfScopeCount = computed(() => {
    return outOfScopeDatasets.value.reduce(
      (acc, cat) => acc + (cat.total ?? cat.images?.length ?? 0),
      0
    )
  })

  const fetchOutOfScopeDataset = async () => {
    isLoadingOutOfScope.value = true
    try {
      const res = await outOfScopeDatasetService.getDataset({ page: 1, per_page: pageSize })
      outOfScopeDatasets.value = (res || []).filter(
        d => (d.category || '').toLowerCase() !== 'none'
      )
    } catch (e) {
      console.error('Failed to fetch out-of-scope dataset', e)
      toast.error('Failed to load out-of-scope dataset gallery.')
    } finally {
      isLoadingOutOfScope.value = false
    }
  }

  const downloadOosZip = async (category?: string) => {
    try {
      const blob = await outOfScopeDatasetService.downloadDataset(category)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        category ? `out_of_scope_${category.toLowerCase()}.zip` : 'out_of_scope_all.zip'
      )
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Download started.')
    } catch (e) {
      console.error('Failed to download OOS zip', e)
      toast.error('Failed to download zip. It might be empty or unavailable.')
    }
  }

  onMounted(() => {
    fetchDataset()
    fetchOutOfScopeDataset()
  })
</script>

<template>
  <div class="space-y-8 pb-12">
    <!-- Page Header Toolbar -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-foreground text-2xl font-black md:text-3xl">Dataset Gallery</h1>
        <p class="text-muted-foreground mt-1 text-sm">
          Clinical skin scan repository and diagnostic model retraining pipeline.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <AppButton
          variant="solid"
          to="/admin/ai"
          class="gap-2 shadow-sm"
        >
          <Icon
            name="lucide:brain-circuit"
            size="18"
          />
          AI Models Center
        </AppButton>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         SECTION 1: Priority Dataset (Acne, Eczema, Herpes)
         ═══════════════════════════════════════════════════════════ -->
    <div class="space-y-6">
      <!-- Section Title & Global Actions -->
      <div class="flex w-full flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div class="flex items-center gap-3">
          <div
            class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs"
          >
            <Icon
              name="lucide:database"
              size="20"
            />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-foreground text-lg font-bold">Priority Retraining Dataset</h2>
              <AppBadge
                color="primary"
                size="sm"
                variant="subtle"
                >{{ totalImagesCount }} images</AppBadge
              >
              <AppBadge
                :color="pendingSyncPriorityCount > 0 ? 'amber' : 'green'"
                size="sm"
                variant="subtle"
              >
                {{
                  pendingSyncPriorityCount > 0
                    ? `${pendingSyncPriorityCount} Pending Sync`
                    : '100% Synced'
                }}
              </AppBadge>
            </div>
            <p class="text-muted-foreground text-xs">
              Acne, Eczema & Herpes — verified repository scans feeding tri-model ensemble
              retraining
            </p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2 sm:gap-3">
          <AppButton
            variant="solid"
            size="sm"
            class="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 font-bold shadow-xs"
            @click="promptSyncDataset"
          >
            <Icon
              name="lucide:refresh-cw"
              size="14"
            />
            Sync Scans
          </AppButton>
          <AppButton
            variant="outline"
            size="sm"
            class="gap-2"
            @click="downloadZip()"
          >
            <Icon
              name="lucide:download"
              size="14"
            />
            Download All
          </AppButton>
          <AppButton
            variant="outline"
            size="sm"
            class="gap-2"
            @click="openUploadModal('priority')"
          >
            <Icon
              name="lucide:upload"
              size="14"
            />
            Upload Image
          </AppButton>
        </div>
      </div>

      <!-- Rich Sync Overview & Status Control Center (Non-Minimalist) -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <!-- Metric 1: Total Scans -->
        <div
          class="bg-card border-border/80 relative overflow-hidden rounded-2xl border p-4 shadow-xs"
        >
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground text-xs font-semibold">Total Repository Scans</span>
            <div
              class="bg-muted text-muted-foreground flex h-7 w-7 items-center justify-center rounded-lg"
            >
              <Icon
                name="lucide:layers"
                size="14"
              />
            </div>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-foreground text-2xl font-black">{{ totalImagesCount }}</span>
            <span class="text-muted-foreground text-xs">images</span>
          </div>
          <div class="text-muted-foreground mt-2.5 flex items-center gap-2 text-[11px]">
            <span class="inline-flex items-center gap-1">
              <span class="bg-primary h-1.5 w-1.5 rounded-full"></span>
              3 Core Disease Classes
            </span>
          </div>
        </div>

        <!-- Metric 2: Synced to Model -->
        <div
          class="bg-card relative overflow-hidden rounded-2xl border border-emerald-500/30 p-4 shadow-xs"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-700 dark:text-emerald-400"
              >Synced to AI Model</span
            >
            <div
              class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <Icon
                name="lucide:check-circle-2"
                size="14"
              />
            </div>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-foreground text-2xl font-black">{{ syncedPriorityCount }}</span>
            <span class="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              ({{ syncedPercentage }}%)
            </span>
          </div>
          <div class="text-muted-foreground mt-2.5 flex items-center gap-1.5 text-[11px]">
            <Icon
              name="lucide:hard-drive"
              size="12"
              class="text-emerald-500"
            />
            <span>Mirrored in training storage</span>
          </div>
        </div>

        <!-- Metric 3: Pending Sync Scans -->
        <div
          class="bg-card relative overflow-hidden rounded-2xl border border-amber-500/30 p-4 shadow-xs"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-amber-700 dark:text-amber-400">Pending Sync</span>
            <div
              class="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"
            >
              <Icon
                name="lucide:clock"
                size="14"
              />
            </div>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-foreground text-2xl font-black">{{ pendingSyncPriorityCount }}</span>
            <span
              v-if="pendingSyncPriorityCount > 0"
              class="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"></span>
              Needs Sync
            </span>
            <span
              v-else
              class="text-muted-foreground text-xs"
              >All synced</span
            >
          </div>
          <div class="mt-2.5 flex items-center justify-between text-[11px]">
            <div class="text-muted-foreground flex items-center gap-1.5">
              <Icon
                name="lucide:user-check"
                size="12"
                class="text-amber-500"
              />
              <span>Consented clinical scans</span>
            </div>
            <button
              v-if="pendingSyncPriorityCount > 0"
              type="button"
              class="cursor-pointer font-bold text-amber-600 hover:text-amber-700 hover:underline dark:text-amber-400"
              @click="promptSyncDataset"
            >
              Review & Sync →
            </button>
          </div>
        </div>
      </div>

      <!-- Filter Controls: All / Synced / Pending Sync -->
      <div class="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div class="flex items-center gap-1.5">
          <span class="text-muted-foreground mr-1 text-xs font-semibold">Filter by Sync:</span>
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
            :class="
              syncFilter === 'all'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            "
            @click="syncFilter = 'all'"
          >
            <span>All Images</span>
            <span
              class="py-0.2 rounded-full px-1.5 text-[10px] font-bold"
              :class="
                syncFilter === 'all'
                  ? 'bg-background/20 text-background'
                  : 'bg-muted text-muted-foreground'
              "
            >
              {{ totalImagesCount }}
            </span>
          </button>

          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
            :class="
              syncFilter === 'synced'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600'
            "
            @click="syncFilter = 'synced'"
          >
            <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Synced to Training</span>
            <span
              class="py-0.2 rounded-full px-1.5 text-[10px] font-bold"
              :class="
                syncFilter === 'synced'
                  ? 'bg-white/20 text-white'
                  : 'bg-muted text-muted-foreground'
              "
            >
              {{ syncedPriorityCount }}
            </span>
          </button>

          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
            :class="
              syncFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600'
            "
            @click="syncFilter = 'pending'"
          >
            <span
              class="h-2 w-2 rounded-full bg-amber-500"
              :class="{ 'animate-pulse': pendingSyncPriorityCount > 0 }"
            ></span>
            <span>Pending Sync</span>
            <span
              class="py-0.2 rounded-full px-1.5 text-[10px] font-bold"
              :class="
                syncFilter === 'pending'
                  ? 'bg-white/20 text-white'
                  : 'bg-muted text-muted-foreground'
              "
            >
              {{ pendingSyncPriorityCount }}
            </span>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div
        v-if="isLoading"
        class="flex items-center justify-center py-20"
      >
        <div class="border-primary h-12 w-12 animate-spin rounded-full border-b-2"></div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="datasets.length === 0"
        class="bg-card border-border text-muted-foreground rounded-3xl border border-dashed p-6 py-14 text-center md:p-8 md:py-20"
      >
        <Icon
          name="lucide:image-off"
          size="48"
          class="mx-auto mb-4 opacity-40"
        />
        <h3 class="text-foreground mb-1 text-base font-bold">
          No images in the priority dataset yet
        </h3>
        <p class="mx-auto mb-6 max-w-sm text-xs">
          Upload clinical images or collect scan photos from completed diagnoses to populate the
          gallery.
        </p>
        <AppButton
          variant="solid"
          class="gap-2"
          @click="openUploadModal('priority')"
        >
          <Icon
            name="lucide:upload"
            size="16"
          />
          Upload First Image
        </AppButton>
      </div>

      <!-- Gallery -->
      <div
        v-else
        class="space-y-6"
      >
        <!-- Priority Bulk Selection Toolbar -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-2"
        >
          <div
            v-if="selectedPriorityUrls.size > 0"
            class="border-primary/30 bg-primary/5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 sm:px-6"
          >
            <div class="flex items-center gap-2.5">
              <span
                class="bg-primary inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
              >
                {{ selectedPriorityUrls.size }}
              </span>
              <span class="text-foreground text-xs font-bold">
                {{ selectedPriorityUrls.size }} image{{
                  selectedPriorityUrls.size === 1 ? '' : 's'
                }}
                selected
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1 text-xs font-semibold transition-colors"
                @click="clearPrioritySelection"
              >
                Clear
              </button>
              <AppButton
                variant="solid"
                size="sm"
                class="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 font-bold shadow-xs"
                @click="promptBulkTransferPriority"
              >
                <Icon
                  name="lucide:arrow-right-left"
                  size="14"
                />
                Transfer Selected ({{ selectedPriorityUrls.size }})
              </AppButton>
              <AppButton
                variant="destructive"
                size="sm"
                class="gap-1.5 shadow-xs"
                @click="promptBulkDeletePriority"
              >
                <Icon
                  name="lucide:trash-2"
                  size="14"
                />
                Delete Selected ({{ selectedPriorityUrls.size }})
              </AppButton>
            </div>
          </div>
        </Transition>

        <div
          v-for="dataset in datasets"
          :key="dataset.category"
          class="bg-card border-border overflow-hidden rounded-2xl border shadow-sm"
        >
          <div
            class="bg-muted/40 border-border flex items-center justify-between border-b px-4 py-3 md:px-6 md:py-4"
          >
            <div class="flex items-center gap-2">
              <div class="bg-primary h-2 w-2 rounded-full"></div>
              <h3 class="text-foreground text-sm font-bold capitalize">{{ dataset.category }}</h3>
              <AppBadge
                color="gray"
                size="sm"
              >
                {{ getCategoryTotalItems(dataset) }} total scans
              </AppBadge>
            </div>

            <div class="flex items-center gap-2.5">
              <label
                class="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-xs font-medium select-none"
              >
                <input
                  type="checkbox"
                  :checked="
                    isCategoryAllSelectedPriority(getCategoryItems(dataset).map(i => i.url))
                  "
                  class="border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer rounded"
                  @change="
                    toggleSelectAllCategoryPriority(getCategoryItems(dataset).map(i => i.url))
                  "
                />
                <span>Select All</span>
                <span
                  v-if="
                    getCategorySelectedCountPriority(getCategoryItems(dataset).map(i => i.url)) > 0
                  "
                  class="text-primary font-bold"
                >
                  ({{
                    getCategorySelectedCountPriority(getCategoryItems(dataset).map(i => i.url))
                  }})
                </span>
              </label>

              <AppButton
                v-if="
                  getCategorySelectedCountPriority(getCategoryItems(dataset).map(i => i.url)) > 0
                "
                variant="outline"
                size="sm"
                class="border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground gap-1.5 font-semibold shadow-xs transition-all"
                @click="promptCategorySelectedTransfer(dataset)"
              >
                <Icon
                  name="lucide:arrow-right-left"
                  size="14"
                />
                <span>
                  Transfer ({{
                    getCategorySelectedCountPriority(getCategoryItems(dataset).map(i => i.url))
                  }})
                </span>
              </AppButton>

              <AppButton
                variant="outline"
                size="sm"
                class="gap-1.5"
                @click="downloadZip(dataset.category)"
              >
                <Icon
                  name="lucide:download"
                  size="14"
                />
                Download Category
              </AppButton>
            </div>
          </div>

          <div class="relative min-h-[140px]">
            <!-- Category Loading Overlay -->
            <div
              v-if="isCategoryLoading(dataset.category)"
              class="bg-card/75 absolute inset-0 z-20 flex items-center justify-center"
            >
              <div
                class="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              />
            </div>

            <div
              v-if="getCategoryItems(dataset).length === 0"
              class="text-muted-foreground p-8 text-center text-xs"
            >
              No {{ dataset.category }} images match the current sync filter.
            </div>

            <div
              v-else
              class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 md:gap-4 md:p-6 lg:grid-cols-6"
            >
              <div
                v-for="item in getCategoryItems(dataset)"
                :key="item.url"
                class="group bg-muted border-border relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-150 select-none"
                :class="
                  selectedPriorityUrls.has(item.url)
                    ? 'border-primary ring-primary/40 shadow-sm ring-2'
                    : 'hover:border-foreground/30 border-transparent'
                "
                @click="toggleSelectPriorityImage(item.url)"
              >
                <NuxtImg
                  :src="getStorageUrl(item.url)"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  :class="{
                    'brightness-90':
                      !selectedPriorityUrls.has(item.url) && selectedPriorityUrls.size > 0
                  }"
                  loading="lazy"
                />

                <!-- Selection Checkbox (Top Left) -->
                <div
                  class="absolute top-2 left-2 z-10 transition-all"
                  title="Select image for bulk transfer or deletion"
                >
                  <div
                    class="flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-150"
                    :class="
                      selectedPriorityUrls.has(item.url)
                        ? 'bg-primary border-primary text-white shadow-xs ring-2 ring-white/40'
                        : 'border-white/80 bg-black/50 text-transparent opacity-85 shadow-xs group-hover:border-white group-hover:bg-black/70 group-hover:opacity-100'
                    "
                  >
                    <Icon
                      name="lucide:check"
                      size="12"
                      class="stroke-3"
                    />
                  </div>
                </div>

                <!-- Permanent Status Badge (Top Right) -->
                <div class="absolute top-2 right-2 z-10">
                  <div
                    v-if="item.is_synced"
                    class="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs"
                    title="Mirrored in AI Algorithm local training directory"
                  >
                    <Icon
                      name="lucide:check-circle-2"
                      size="11"
                    />
                    <span>Synced</span>
                  </div>
                  <div
                    v-else
                    class="inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs"
                    title="Webapp Consultation Scan pending sync to training raw directory"
                  >
                    <Icon
                      name="lucide:clock"
                      size="11"
                    />
                    <span>Pending Sync</span>
                  </div>
                </div>

                <!-- Rich Hover Metadata Overlay (Bottom) -->
                <div
                  class="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 pt-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                >
                  <div class="flex items-center justify-between gap-1.5">
                    <div class="min-w-0 flex-1">
                      <span
                        class="py-0.2 inline-flex items-center rounded px-1.5 text-[9px] font-semibold tracking-wider uppercase"
                        :class="
                          item.source === 'diagnosis'
                            ? 'bg-sky-500/30 text-sky-200'
                            : 'bg-white/20 text-white'
                        "
                      >
                        {{ item.source === 'diagnosis' ? 'Patient Scan' : 'Uploaded' }}
                      </span>
                      <p class="truncate font-mono text-[10px] text-white/90">
                        {{ item.filename || 'scan.jpg' }}
                      </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-1.5">
                      <button
                        v-if="item.diagnosis_uuid"
                        type="button"
                        class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-black/60 text-white/90 shadow-xs transition-transform hover:scale-110 hover:bg-emerald-600 hover:text-white"
                        title="Authorize / Verify for Dataset Retraining"
                        @click.stop="handleApproveDiagnosis(item.diagnosis_uuid)"
                      >
                        <Icon
                          name="lucide:check-circle"
                          size="13"
                        />
                      </button>
                      <button
                        type="button"
                        class="hover:bg-primary flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-black/60 text-white/90 shadow-xs transition-transform hover:scale-110 hover:text-white"
                        title="Transfer Category"
                        @click.stop="promptTransferPriorityImage(item)"
                      >
                        <Icon
                          name="lucide:arrow-right-left"
                          size="13"
                        />
                      </button>
                      <button
                        type="button"
                        class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-red-600/80 text-white shadow-xs transition-transform hover:scale-110 hover:bg-red-600"
                        title="Delete Image"
                        @click.stop="promptDeleteImage(item.url, false)"
                      >
                        <Icon
                          name="lucide:trash-2"
                          size="13"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Category Pagination Controls (Priority Dataset) -->
          <div
            v-if="getCategoryTotalItems(dataset) > pageSize"
            class="border-border bg-muted/20 flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row md:px-6"
          >
            <span class="text-muted-foreground text-xs">
              Showing
              <span class="text-foreground font-semibold">
                {{ (getCategoryCurrentPage(dataset.category, false) - 1) * pageSize + 1 }}
              </span>
              to
              <span class="text-foreground font-semibold">
                {{
                  Math.min(
                    getCategoryCurrentPage(dataset.category, false) * pageSize,
                    getCategoryTotalItems(dataset)
                  )
                }}
              </span>
              of
              <span class="text-foreground font-semibold">{{
                getCategoryTotalItems(dataset)
              }}</span>
              images
            </span>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="border-border bg-card text-foreground hover:bg-muted inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="getCategoryCurrentPage(dataset.category, false) <= 1"
                @click="
                  setCategoryPage(
                    dataset.category,
                    getCategoryCurrentPage(dataset.category, false) - 1,
                    false
                  )
                "
              >
                <Icon
                  name="lucide:chevron-left"
                  size="14"
                />
                <span>Prev</span>
              </button>

              <button
                v-for="p in getCategoryTotalPages(dataset)"
                :key="p"
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all"
                :class="
                  getCategoryCurrentPage(dataset.category, false) === p
                    ? 'bg-primary text-white shadow-xs'
                    : 'border-border bg-card text-foreground hover:bg-muted border'
                "
                @click="setCategoryPage(dataset.category, p, false)"
              >
                {{ p }}
              </button>

              <button
                type="button"
                class="border-border bg-card text-foreground hover:bg-muted inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="
                  getCategoryCurrentPage(dataset.category, false) >= getCategoryTotalPages(dataset)
                "
                @click="
                  setCategoryPage(
                    dataset.category,
                    getCategoryCurrentPage(dataset.category, false) + 1,
                    false
                  )
                "
              >
                <span>Next</span>
                <Icon
                  name="lucide:chevron-right"
                  size="14"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         SECTION 2: Out-of-Scope Research Dataset (OpenCLIP Categorized)
         ═══════════════════════════════════════════════════════════ -->
    <div class="border-border space-y-4 border-t pt-8">
      <div class="flex w-full flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600"
          >
            <Icon
              name="lucide:microscope"
              size="18"
            />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-foreground text-base font-bold">Out-of-Scope Research Dataset</h2>
              <AppBadge
                color="gray"
                size="sm"
                variant="subtle"
                >OpenCLIP Categorized</AppBadge
              >
              <button
                type="button"
                class="text-muted-foreground inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-violet-500/10 hover:text-violet-600"
                :class="{ 'bg-violet-500/15 text-violet-600': showOosInfo }"
                title="Toggle research dataset information"
                @click="showOosInfo = !showOosInfo"
              >
                <Icon
                  name="lucide:info"
                  size="15"
                />
              </button>
              <AppBadge
                color="gray"
                size="sm"
                variant="subtle"
                >{{ totalOutOfScopeCount }} images</AppBadge
              >
            </div>
            <p class="text-muted-foreground text-xs">
              Psoriasis, Ringworm, Vitiligo & more — collected for future new-disease model
              expansion
            </p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2 sm:gap-3">
          <AppButton
            variant="outline"
            size="sm"
            class="gap-2"
            @click="downloadOosZip()"
          >
            <Icon
              name="lucide:download"
              size="14"
            />
            Download All
          </AppButton>
          <AppButton
            variant="outline"
            size="sm"
            class="gap-2"
            @click="openUploadModal('out_of_scope')"
          >
            <Icon
              name="lucide:upload"
              size="14"
            />
            Upload Image
          </AppButton>
        </div>
      </div>

      <!-- Info Banner (Toggled via i icon) -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="showOosInfo"
          class="flex items-start justify-between gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"
        >
          <div class="flex items-start gap-3">
            <Icon
              name="lucide:info"
              size="16"
              class="mt-0.5 shrink-0 text-violet-600"
            />
            <p class="text-xs leading-relaxed text-violet-700 dark:text-violet-300">
              <strong>Research only.</strong> These images are automatically categorized by OpenCLIP
              when a doctor submits a scan flagged as out-of-scope (Psoriasis, Ringworm, Vitiligo,
              Melanoma, Hives, Warts, Lupus, Rosacea). They are
              <strong>strictly isolated</strong> from the Acne/Eczema/Herpes retraining pipeline and
              will never influence current model accuracy.
            </p>
          </div>
          <button
            type="button"
            class="-mt-1 -mr-1 cursor-pointer rounded-lg p-1 text-violet-600/70 transition-colors hover:bg-violet-500/10 hover:text-violet-600"
            title="Close information"
            @click="showOosInfo = false"
          >
            <Icon
              name="lucide:x"
              size="14"
            />
          </button>
        </div>
      </Transition>

      <!-- Loading -->
      <div
        v-if="isLoadingOutOfScope"
        class="flex items-center justify-center py-20"
      >
        <div class="h-12 w-12 animate-spin rounded-full border-b-2 border-violet-500"></div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="outOfScopeDatasets.length === 0"
        class="bg-card border-border text-muted-foreground rounded-3xl border border-dashed p-6 py-14 text-center md:p-8 md:py-20"
      >
        <Icon
          name="lucide:scan-search"
          size="48"
          class="mx-auto mb-4 opacity-40"
        />
        <h3 class="text-foreground mb-1 text-base font-bold">
          No out-of-scope scans collected yet
        </h3>
        <p class="mx-auto mb-6 max-w-sm text-xs">
          When doctors submit scans that OpenCLIP identifies as out-of-scope conditions (with
          patient consent), they will automatically appear here categorized by disease.
        </p>
        <AppButton
          variant="outline"
          class="gap-2"
          @click="openUploadModal('out_of_scope')"
        >
          <Icon
            name="lucide:upload"
            size="16"
          />
          Manually Upload Image
        </AppButton>
      </div>

      <!-- OOS Gallery Categories -->
      <div
        v-else
        class="space-y-6"
      >
        <!-- Out-of-Scope Bulk Selection Toolbar -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-2"
        >
          <div
            v-if="selectedOosUrls.size > 0"
            class="flex items-center justify-between gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 sm:px-6"
          >
            <div class="flex items-center gap-2.5">
              <span
                class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-xs"
              >
                {{ selectedOosUrls.size }}
              </span>
              <span class="text-foreground text-xs font-bold">
                {{ selectedOosUrls.size }} image{{ selectedOosUrls.size === 1 ? '' : 's' }} selected
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1 text-xs font-semibold transition-colors"
                @click="clearOosSelection"
              >
                Clear
              </button>
              <AppButton
                variant="destructive"
                size="sm"
                class="gap-1.5 shadow-xs"
                @click="promptBulkDeleteOos"
              >
                <Icon
                  name="lucide:trash-2"
                  size="14"
                />
                Delete Selected ({{ selectedOosUrls.size }})
              </AppButton>
            </div>
          </div>
        </Transition>

        <div
          v-for="dataset in outOfScopeDatasets"
          :key="dataset.category"
          class="bg-card overflow-hidden rounded-2xl border border-violet-500/20 shadow-sm"
        >
          <div
            class="flex items-center justify-between border-b border-violet-500/10 bg-violet-500/5 px-4 py-3 md:px-6 md:py-4"
          >
            <div class="flex items-center gap-2">
              <div class="h-2 w-2 rounded-full bg-violet-500"></div>
              <h3 class="text-foreground text-sm font-bold capitalize">
                {{ dataset.category }}
              </h3>
              <AppBadge
                color="gray"
                size="sm"
              >
                {{ getCategoryTotalItems(dataset) }} images
              </AppBadge>
            </div>

            <div class="flex items-center gap-2.5">
              <label
                class="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-xs font-medium select-none"
              >
                <input
                  type="checkbox"
                  :checked="isCategoryAllSelectedOos(dataset.images)"
                  class="border-border h-3.5 w-3.5 cursor-pointer rounded text-violet-600 focus:ring-violet-500"
                  @change="toggleSelectAllCategoryOos(dataset.images)"
                />
                <span>Select All</span>
                <span
                  v-if="getCategorySelectedCountOos(dataset.images) > 0"
                  class="font-bold text-violet-600"
                >
                  ({{ getCategorySelectedCountOos(dataset.images) }})
                </span>
              </label>

              <AppButton
                variant="outline"
                size="sm"
                class="gap-1.5 border-violet-500/30 hover:bg-violet-500/5"
                @click="downloadOosZip(dataset.category)"
              >
                <Icon
                  name="lucide:download"
                  size="14"
                />
                Download Category
              </AppButton>
            </div>
          </div>

          <div class="relative min-h-[140px]">
            <!-- Category Loading Overlay -->
            <div
              v-if="isCategoryLoading(dataset.category)"
              class="bg-card/75 absolute inset-0 z-20 flex items-center justify-center"
            >
              <div
                class="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent"
              />
            </div>

            <div
              class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 md:gap-4 md:p-6 lg:grid-cols-6"
            >
              <div
                v-for="(url, idx) in dataset.images"
                :key="idx"
                class="group bg-muted border-border relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-150 select-none"
                :class="
                  selectedOosUrls.has(url)
                    ? 'border-violet-500 shadow-sm ring-2 ring-violet-500/40'
                    : 'hover:border-foreground/30 border-transparent'
                "
                @click="toggleSelectOosImage(url)"
              >
                <NuxtImg
                  :src="getStorageUrl(url)"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  :class="{
                    'brightness-90': !selectedOosUrls.has(url) && selectedOosUrls.size > 0
                  }"
                  loading="lazy"
                />

                <!-- Selection Checkmark (Top Left) -->
                <div
                  class="absolute top-2 left-2 z-10 transition-all"
                  title="Select image"
                >
                  <div
                    class="flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-150"
                    :class="
                      selectedOosUrls.has(url)
                        ? 'border-violet-600 bg-violet-600 text-white shadow-xs ring-2 ring-white/40'
                        : 'border-white/80 bg-black/50 text-transparent opacity-85 shadow-xs group-hover:border-white group-hover:bg-black/70 group-hover:opacity-100'
                    "
                  >
                    <Icon
                      name="lucide:check"
                      size="12"
                      class="stroke-3"
                    />
                  </div>
                </div>

                <!-- Quick Delete Hover Button (Bottom Right) -->
                <div
                  class="absolute right-2 bottom-2 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                >
                  <button
                    type="button"
                    class="hover:bg-destructive flex h-7 w-7 transform cursor-pointer items-center justify-center rounded-lg bg-black/60 text-white/80 shadow-md transition-all hover:scale-110 hover:text-white"
                    title="Delete Single Image"
                    @click.stop="promptDeleteImage(url, true)"
                  >
                    <Icon
                      name="lucide:trash-2"
                      size="14"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Category Pagination Controls (Out-of-Scope Research Dataset) -->
          <div
            v-if="getCategoryTotalItems(dataset) > pageSize"
            class="flex flex-col items-center justify-between gap-3 border-t border-violet-500/10 bg-violet-500/5 px-4 py-3 sm:flex-row md:px-6"
          >
            <span class="text-muted-foreground text-xs">
              Showing
              <span class="text-foreground font-semibold">
                {{ (getCategoryCurrentPage(dataset.category, true) - 1) * pageSize + 1 }}
              </span>
              to
              <span class="text-foreground font-semibold">
                {{
                  Math.min(
                    getCategoryCurrentPage(dataset.category, true) * pageSize,
                    getCategoryTotalItems(dataset)
                  )
                }}
              </span>
              of
              <span class="text-foreground font-semibold">{{
                getCategoryTotalItems(dataset)
              }}</span>
              images
            </span>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="border-border bg-card text-foreground hover:bg-muted inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="getCategoryCurrentPage(dataset.category, true) <= 1"
                @click="
                  setCategoryPage(
                    dataset.category,
                    getCategoryCurrentPage(dataset.category, true) - 1,
                    true
                  )
                "
              >
                <Icon
                  name="lucide:chevron-left"
                  size="14"
                />
                <span>Prev</span>
              </button>

              <button
                v-for="p in getCategoryTotalPages(dataset)"
                :key="p"
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all"
                :class="
                  getCategoryCurrentPage(dataset.category, true) === p
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'border-border bg-card text-foreground hover:bg-muted border'
                "
                @click="setCategoryPage(dataset.category, p, true)"
              >
                {{ p }}
              </button>

              <button
                type="button"
                class="border-border bg-card text-foreground hover:bg-muted inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="
                  getCategoryCurrentPage(dataset.category, true) >= getCategoryTotalPages(dataset)
                "
                @click="
                  setCategoryPage(
                    dataset.category,
                    getCategoryCurrentPage(dataset.category, true) + 1,
                    true
                  )
                "
              >
                <span>Next</span>
                <Icon
                  name="lucide:chevron-right"
                  size="14"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Single Dynamic Upload Image Modal -->
    <AppModal
      v-model="showUploadModal"
      :title="
        uploadMode === 'out_of_scope'
          ? 'Upload to Out-of-Scope Research Dataset'
          : 'Upload to Priority Dataset'
      "
      :description="
        uploadMode === 'out_of_scope'
          ? 'Add scans of out-of-scope conditions to the research collection. Strictly isolated from retraining.'
          : 'Add Acne, Eczema, or Herpes scans to the AI retraining collection.'
      "
      size="xl"
    >
      <AppDatasetImageUploader
        :mode="uploadMode"
        @uploaded="handleUploadSuccess"
        @close="showUploadModal = false"
      />
    </AppModal>

    <!-- Single Dynamic Delete Confirmation Dialog -->
    <AppModalConfirmation
      v-model="showDeleteConfirm"
      :title="
        isDeleteOutOfScope
          ? 'Delete Image from Research Dataset?'
          : 'Delete Image from Priority Dataset?'
      "
      :description="
        isDeleteOutOfScope
          ? 'Are you sure you want to remove this image from the out-of-scope research collection? This action cannot be undone.'
          : 'Are you sure you want to remove this image from the training collection? This action cannot be undone.'
      "
      icon="lucide:trash-2"
      icon-color="danger"
      confirm-text="Delete Image"
      cancel-text="Keep Image"
      confirm-variant="destructive"
      :loading="isDeleteOutOfScope ? isDeletingOutOfScope : isDeleting"
      @confirm="handleConfirmDelete"
    />

    <!-- Bulk Delete Confirmation Dialog -->
    <AppModalConfirmation
      v-model="showBulkDeleteConfirm"
      :title="
        bulkDeleteTarget === 'out_of_scope'
          ? `Delete ${selectedOosUrls.size} Images from Research Dataset?`
          : `Delete ${selectedPriorityUrls.size} Images from Priority Dataset?`
      "
      :description="
        bulkDeleteTarget === 'out_of_scope'
          ? `Are you sure you want to permanently delete ${selectedOosUrls.size} selected image(s) from the out-of-scope research dataset? This action cannot be undone.`
          : `Are you sure you want to permanently delete ${selectedPriorityUrls.size} selected image(s) from the priority retraining dataset? This action cannot be undone.`
      "
      icon="lucide:trash-2"
      icon-color="danger"
      :confirm-text="
        bulkDeleteTarget === 'out_of_scope'
          ? `Delete ${selectedOosUrls.size} Images`
          : `Delete ${selectedPriorityUrls.size} Images`
      "
      cancel-text="Cancel"
      confirm-variant="destructive"
      :loading="isBulkDeleting"
      @confirm="handleConfirmBulkDelete"
    />

    <!-- Unified Dataset Browser & Selective Sync Slideover -->
    <AppDatasetSlideover
      v-model="showDatasetSlideover"
      @synced="fetchDataset"
      @deleted="fetchDataset"
      @transferred="fetchDataset"
    />

    <!-- Category Transfer Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showTransferModal"
          class="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
          @click.self="closeTransferModal"
        >
          <!-- Backdrop -->
          <div class="fixed inset-0 bg-black/60 transition-opacity" />

          <!-- Modal Container -->
          <div
            class="bg-card border-border relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border shadow-2xl transition-all"
          >
            <!-- Header -->
            <div
              class="border-border flex shrink-0 items-center justify-between border-b px-6 py-4 sm:px-8"
            >
              <div class="flex items-center gap-2.5">
                <div
                  class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl"
                >
                  <Icon
                    name="lucide:arrow-right-left"
                    size="18"
                  />
                </div>
                <div>
                  <h3 class="text-foreground text-base font-bold sm:text-lg">
                    {{
                      isBulkTransfer
                        ? `Transfer ${selectedPriorityUrls.size} Scans`
                        : 'Transfer Scan Category'
                    }}
                  </h3>
                  <p class="text-muted-foreground text-xs">
                    Reassign misclassified scans to their proper clinical disease category
                  </p>
                </div>
              </div>

              <AppButton
                variant="ghost"
                size="icon"
                class="hover:bg-foreground/5 text-muted-foreground hover:text-foreground h-8 w-8 rounded-full"
                :disabled="isTransferring"
                @click="closeTransferModal"
              >
                <Icon
                  name="lucide:x"
                  class="h-4 w-4"
                />
              </AppButton>
            </div>

            <!-- Body -->
            <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5 sm:px-8">
              <!-- Single Preview -->
              <div
                v-if="!isBulkTransfer && itemToTransfer"
                class="border-border/80 bg-muted/40 flex items-center gap-3.5 rounded-2xl border p-3"
              >
                <img
                  :src="getStorageUrl(itemToTransfer.url)"
                  :alt="itemToTransfer.filename"
                  class="border-border h-16 w-16 shrink-0 rounded-xl border object-cover"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-foreground truncate font-mono text-xs font-semibold">
                      {{ itemToTransfer.filename || 'scan.jpg' }}
                    </span>
                  </div>
                  <div class="mt-1 flex items-center gap-2 text-xs">
                    <span class="text-muted-foreground text-[11px]">Current Category:</span>
                    <span
                      class="bg-primary/10 border-primary/20 text-primary rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase"
                    >
                      {{ currentSelectionCategory || 'Acne' }}
                    </span>
                    <span
                      v-if="itemToTransfer.is_synced"
                      class="text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                    >
                      · Synced
                    </span>
                    <span
                      v-else
                      class="text-[10px] font-medium text-amber-600 dark:text-amber-400"
                    >
                      · Pending Sync
                    </span>
                  </div>
                </div>
              </div>

              <!-- Bulk Preview Strip -->
              <div
                v-else-if="isBulkTransfer"
                class="border-border/80 bg-muted/40 rounded-2xl border p-3.5"
              >
                <div class="mb-2 flex items-center justify-between text-xs">
                  <span class="text-foreground font-semibold">
                    Selected Images ({{ selectedPriorityUrls.size }})
                  </span>
                  <span
                    v-if="currentSelectionCategory"
                    class="text-muted-foreground text-[11px]"
                  >
                    All from
                    <strong class="text-foreground capitalize">{{
                      currentSelectionCategory
                    }}</strong>
                  </span>
                </div>
                <div class="scrollbar-thin flex items-center gap-2 overflow-x-auto pb-1">
                  <div
                    v-for="item in selectedPriorityItems.slice(0, 8)"
                    :key="item.url"
                    class="relative shrink-0"
                  >
                    <img
                      :src="getStorageUrl(item.url)"
                      :alt="item.filename"
                      class="border-border h-12 w-12 rounded-lg border object-cover"
                    />
                  </div>
                  <div
                    v-if="selectedPriorityUrls.size > 8"
                    class="border-border bg-background text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed text-[11px] font-bold"
                  >
                    +{{ selectedPriorityUrls.size - 8 }}
                  </div>
                </div>
              </div>

              <!-- Target Category Selection -->
              <div>
                <label
                  class="text-foreground mb-2.5 block text-xs font-bold tracking-wider uppercase"
                >
                  Select Destination Category
                </label>

                <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <button
                    v-for="opt in transferTargetOptions"
                    :key="opt.id"
                    type="button"
                    :disabled="opt.id === currentSelectionCategory"
                    class="relative flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all duration-150"
                    :class="[
                      opt.id === currentSelectionCategory
                        ? 'border-border/60 bg-muted/30 cursor-not-allowed opacity-50'
                        : targetTransferCategory === opt.id
                          ? 'border-primary bg-primary/5 ring-primary/20 shadow-xs ring-2'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50 cursor-pointer'
                    ]"
                    @click="targetTransferCategory = opt.id"
                  >
                    <div class="mb-1.5 flex w-full items-center justify-between">
                      <span
                        class="rounded-lg border px-2 py-0.5 text-[11px] font-bold uppercase"
                        :class="opt.badgeClass"
                      >
                        {{ opt.name }}
                      </span>

                      <Icon
                        v-if="
                          targetTransferCategory === opt.id && opt.id !== currentSelectionCategory
                        "
                        name="lucide:check-circle-2"
                        size="16"
                        class="text-primary"
                      />
                      <span
                        v-else-if="opt.id === currentSelectionCategory"
                        class="text-muted-foreground text-[9px] font-semibold uppercase"
                      >
                        Current
                      </span>
                    </div>

                    <p class="text-muted-foreground text-[11px] leading-snug">
                      {{ opt.desc }}
                    </p>
                  </button>
                </div>
              </div>

              <!-- Informational Banner -->
              <div
                class="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300"
              >
                <Icon
                  name="lucide:info"
                  size="15"
                  class="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                />
                <p class="text-[11px] leading-relaxed">
                  Reassigning will update consultation diagnostic labels, relocate physical files in
                  local dataset storage, and update the AI algorithm raw directory mirror for
                  upcoming model retraining.
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div
              class="border-border bg-card/95 flex shrink-0 items-center justify-end gap-2.5 border-t px-6 py-4 sm:px-8"
            >
              <AppButton
                variant="ghost"
                size="sm"
                class="rounded-xl text-xs font-semibold"
                :disabled="isTransferring"
                @click="closeTransferModal"
              >
                Cancel
              </AppButton>

              <AppButton
                variant="solid"
                size="sm"
                class="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-xl text-xs font-bold shadow-xs"
                :loading="isTransferring"
                :disabled="isTransferring || targetTransferCategory === currentSelectionCategory"
                @click="handleConfirmTransfer"
              >
                <Icon
                  name="lucide:arrow-right-left"
                  size="13"
                />
                Transfer to
                {{
                  targetTransferCategory.charAt(0).toUpperCase() + targetTransferCategory.slice(1)
                }}
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
