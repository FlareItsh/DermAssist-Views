<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import {
    datasetService,
    type DatasetCategory,
    type DatasetImageItem
  } from '~/api/dataset/DatasetService'
  import {
    outOfScopeDatasetService,
    type OutOfScopeDatasetCategory
  } from '~/api/dataset/OutOfScopeDatasetService'
  import { modelTrainingService } from '~/api/modelTraining/ModelTrainingService'
  import { toast } from 'vue-sonner'

  const { getStorageUrl } = useStorage()

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  // ── Navigation & View Mode ──────────────────────────────────────────
  const activeCollectionTab = ref<'priority' | 'out_of_scope'>('priority')
  const searchQuery = ref('')

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
        if (inspectingImage.value?.url === imageToDelete.value) {
          inspectingImage.value = null
        }
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
        if (inspectingImage.value?.url === imageToDelete.value) {
          inspectingImage.value = null
        }
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
    } catch (e) {
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
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
      id: 'eczema',
      name: 'Eczema',
      desc: 'Atopic dermatitis, inflamed, scaling, or pruritic patches',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    {
      id: 'herpes',
      name: 'Herpes',
      desc: 'Clustered vesicular eruptions, ulcerations & viral lesions',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
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
      if (inspectingImage.value) {
        inspectingImage.value.category = targetTitle
      }
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
    let raw: DatasetImageItem[] =
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
      raw = raw.filter(i => i.is_synced)
    } else if (syncFilter.value === 'pending') {
      raw = raw.filter(i => !i.is_synced)
    }

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      raw = raw.filter(i => {
        const fn = (i.filename || '').toLowerCase()
        const cat = (dataset.category || '').toLowerCase()
        const src = (i.source || '').toLowerCase()
        const diag = (i.diagnosis_uuid || '').toLowerCase()
        return fn.includes(q) || cat.includes(q) || src.includes(q) || diag.includes(q)
      })
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

  const getOosCategoryImages = (dataset: OutOfScopeDatasetCategory): string[] => {
    let images = dataset.images || []
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      images = images.filter(url => {
        const fn = (url.split('/').pop() || '').toLowerCase()
        const cat = (dataset.category || '').toLowerCase()
        return fn.includes(q) || cat.includes(q)
      })
    }
    return images
  }

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

  // ── High-Resolution Inspection Lightbox ─────────────────────────────
  interface InspectModalData {
    url: string
    filename: string
    category: string
    is_synced?: boolean
    source?: string
    diagnosis_uuid?: string
    isOos?: boolean
    item?: DatasetImageItem
  }

  const inspectingImage = ref<InspectModalData | null>(null)

  const openInspectModal = (
    itemOrUrl: DatasetImageItem | string,
    categoryName: string,
    isOos = false
  ) => {
    if (typeof itemOrUrl === 'string') {
      inspectingImage.value = {
        url: itemOrUrl,
        filename: itemOrUrl.split('/').pop() || 'scan.jpg',
        category: categoryName,
        is_synced: true,
        source: 'research_repository',
        isOos: true
      }
    } else {
      inspectingImage.value = {
        url: itemOrUrl.url,
        filename: itemOrUrl.filename || itemOrUrl.url.split('/').pop() || 'scan.jpg',
        category: categoryName,
        is_synced: itemOrUrl.is_synced,
        source: itemOrUrl.source || 'dataset_gallery',
        diagnosis_uuid: itemOrUrl.diagnosis_uuid,
        isOos: false,
        item: itemOrUrl
      }
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'acne':
        return {
          dot: 'bg-emerald-500',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          border: 'border-emerald-200'
        }
      case 'eczema':
        return {
          dot: 'bg-blue-500',
          badge: 'bg-blue-50 text-blue-700 border-blue-200',
          border: 'border-blue-200'
        }
      case 'herpes':
        return {
          dot: 'bg-amber-500',
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          border: 'border-amber-200'
        }
      default:
        return {
          dot: 'bg-violet-500',
          badge: 'bg-violet-50 text-violet-700 border-violet-200',
          border: 'border-violet-200'
        }
    }
  }

  onMounted(() => {
    fetchDataset()
    fetchOutOfScopeDataset()
  })
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- ═══════════════════════════════════════════════════════════
         PAGE HEADER (Uniform with Admin AI / Appeals / Subscriptions)
         ═══════════════════════════════════════════════════════════ -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-blue-700 uppercase"
          >
            <Icon
              name="lucide:database"
              size="12"
            />
            Clinical Scan Repository
          </span>
        </div>
        <h1 class="mt-2 text-2xl font-black tracking-tight text-gray-950 md:text-3xl">
          Dataset Management
        </h1>
        <p class="mt-1 max-w-2xl text-xs text-gray-500 sm:text-sm">
          Clinical skin scan repository and diagnostic model retraining pipeline.
        </p>
      </div>

      <!-- Header Action Toolbar -->
      <div
        class="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap sm:justify-end sm:gap-2.5"
      >
        <AppButton
          variant="outline"
          size="sm"
          to="/admin/ai"
          class="gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-950"
        >
          <Icon
            name="lucide:brain-circuit"
            size="14"
            class="text-primary"
          />
          AI Models Center
        </AppButton>

        <AppButton
          variant="outline"
          size="sm"
          class="gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-950"
          @click="showDatasetSlideover = true"
        >
          <Icon
            name="lucide:layers"
            size="14"
            class="text-gray-500"
          />
          Repository Browser
        </AppButton>

        <AppButton
          variant="outline"
          size="sm"
          class="gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-950"
          @click="
            openUploadModal(activeCollectionTab === 'out_of_scope' ? 'out_of_scope' : 'priority')
          "
        >
          <Icon
            name="lucide:upload"
            size="14"
            class="text-gray-500"
          />
          Upload Scan
        </AppButton>

        <AppButton
          variant="solid"
          size="sm"
          class="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-xl text-xs font-bold shadow-xs"
          @click="promptSyncDataset"
        >
          <Icon
            name="lucide:refresh-cw"
            size="14"
          />
          Sync to AI Engine
        </AppButton>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         4-METRIC CLINICAL OVERVIEW GRID (Matching MetricCard System)
         ═══════════════════════════════════════════════════════════ -->
    <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      <AdminSideComponentsMetricCard
        label="Priority Retraining Scans"
        :value="totalImagesCount"
        unit="scans"
        detail="Acne, Eczema & Herpes"
        badge="3 Core Classes"
        tone="blue"
        :loading="isLoading"
      />

      <AdminSideComponentsMetricCard
        label="Synced to AI Model"
        :value="syncedPriorityCount"
        :detail="`${syncedPercentage}% mirrored in training storage`"
        :badge="`${syncedPercentage}% Synced`"
        tone="emerald"
        :loading="isLoading"
      />

      <AdminSideComponentsMetricCard
        label="Pending Sync"
        :value="pendingSyncPriorityCount"
        :detail="
          pendingSyncPriorityCount > 0
            ? 'Consented scans awaiting sync'
            : 'All repository scans synced'
        "
        :badge="pendingSyncPriorityCount > 0 ? `${pendingSyncPriorityCount} Needed` : 'All Synced'"
        :tone="pendingSyncPriorityCount > 0 ? 'amber' : 'slate'"
        :loading="isLoading"
      />

      <AdminSideComponentsMetricCard
        label="Research Dataset Pool"
        :value="totalOutOfScopeCount"
        unit="scans"
        detail="OpenCLIP out-of-scope conditions"
        badge="Disease Expansion"
        tone="violet"
        :loading="isLoadingOutOfScope"
      />
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         COLLECTION SWITCHER & TOOLBAR
         ═══════════════════════════════════════════════════════════ -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <!-- Segmented View Tabs (Unified with Subscriptions / Moderation Tabs) -->
      <div
        class="scrollbar-none flex max-w-full shrink-0 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1"
      >
        <button
          type="button"
          class="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition"
          :class="
            activeCollectionTab === 'priority'
              ? 'bg-primary shadow-primary/25 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          "
          @click="activeCollectionTab = 'priority'"
        >
          <Icon
            name="lucide:database"
            class="text-sm"
          />
          Priority Retraining Pool
          <span
            class="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            :class="
              activeCollectionTab === 'priority'
                ? 'bg-white/25 text-white'
                : 'bg-gray-200 text-gray-700'
            "
          >
            {{ totalImagesCount }}
          </span>
        </button>

        <button
          type="button"
          class="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition"
          :class="
            activeCollectionTab === 'out_of_scope'
              ? 'bg-primary shadow-primary/25 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          "
          @click="activeCollectionTab = 'out_of_scope'"
        >
          <Icon
            name="lucide:microscope"
            class="text-sm"
          />
          Out-of-Scope Research (OpenCLIP)
          <span
            class="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            :class="
              activeCollectionTab === 'out_of_scope'
                ? 'bg-white/25 text-white'
                : 'bg-gray-200 text-gray-700'
            "
          >
            {{ totalOutOfScopeCount }}
          </span>
        </button>
      </div>

      <!-- Collection Actions -->
      <div class="flex items-center gap-2">
        <AppButton
          v-if="activeCollectionTab === 'priority'"
          variant="outline"
          size="sm"
          class="gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-950"
          @click="downloadZip()"
        >
          <Icon
            name="lucide:download"
            size="14"
            class="text-gray-500"
          />
          Download Priority Pool (.zip)
        </AppButton>
        <AppButton
          v-else
          variant="outline"
          size="sm"
          class="gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-950"
          @click="downloadOosZip()"
        >
          <Icon
            name="lucide:download"
            size="14"
            class="text-gray-500"
          />
          Download Research Pool (.zip)
        </AppButton>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         SEARCH & SYNC FILTER CONTROLS BAR
         ═══════════════════════════════════════════════════════════ -->
    <div
      class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between"
    >
      <!-- Search Input -->
      <div class="relative w-full sm:max-w-xs">
        <Icon
          name="lucide:search"
          class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-gray-400"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search scans by filename, diagnosis..."
          class="focus:border-primary focus:ring-primary/10 w-full rounded-xl border border-gray-200 bg-gray-50 py-1.5 pr-8 pl-9 text-xs text-gray-900 transition outline-none focus:bg-white focus:ring-2"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute top-1/2 right-2.5 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
          title="Clear search"
          @click="searchQuery = ''"
        >
          <Icon
            name="lucide:x"
            class="h-3.5 w-3.5"
          />
        </button>
      </div>

      <!-- Priority Sync Filters (Only for Priority Tab) -->
      <div
        v-if="activeCollectionTab === 'priority'"
        class="flex flex-wrap items-center gap-2"
      >
        <span class="hidden text-xs font-semibold text-gray-500 md:inline">Sync Filter:</span>
        <div class="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition"
            :class="
              syncFilter === 'all'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            "
            @click="syncFilter = 'all'"
          >
            All Images ({{ totalImagesCount }})
          </button>
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition"
            :class="
              syncFilter === 'synced'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            "
            @click="syncFilter = 'synced'"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Synced ({{ syncedPriorityCount }})
          </button>
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition"
            :class="
              syncFilter === 'pending'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            "
            @click="syncFilter = 'pending'"
          >
            <span
              class="h-1.5 w-1.5 rounded-full bg-amber-500"
              :class="{ 'animate-pulse': pendingSyncPriorityCount > 0 }"
            ></span>
            Pending Sync ({{ pendingSyncPriorityCount }})
          </button>
        </div>
      </div>

      <!-- Out-of-Scope Info Toggle (Only for OOS Tab) -->
      <div
        v-else
        class="flex items-center gap-2 text-xs text-gray-500"
      >
        <span>OpenCLIP Automated Isolation Active</span>
        <button
          type="button"
          class="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition hover:bg-violet-50 hover:text-violet-600"
          :class="showOosInfo ? 'bg-violet-100 text-violet-700' : 'text-gray-400'"
          title="Toggle research info"
          @click="showOosInfo = !showOosInfo"
        >
          <Icon
            name="lucide:info"
            size="14"
          />
        </button>
      </div>
    </div>

    <!-- Out-of-Scope Research Information Banner -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="activeCollectionTab === 'out_of_scope' && showOosInfo"
        class="flex items-start justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 text-xs text-violet-800"
      >
        <div class="flex items-start gap-3">
          <Icon
            name="lucide:info"
            size="16"
            class="mt-0.5 shrink-0 text-violet-600"
          />
          <p class="leading-relaxed">
            <strong>Research only collection.</strong> These images are automatically categorized by
            OpenCLIP when a physician submits a scan of an out-of-scope condition (Psoriasis,
            Ringworm, Vitiligo, Melanoma, Hives, Warts, Lupus, Rosacea). They are
            <strong>strictly isolated</strong> from the baseline Acne/Eczema/Herpes models and will
            never influence current production inference accuracy.
          </p>
        </div>
        <button
          type="button"
          class="cursor-pointer rounded-lg p-1 text-violet-600 hover:bg-violet-100"
          title="Dismiss banner"
          @click="showOosInfo = false"
        >
          <Icon
            name="lucide:x"
            size="14"
          />
        </button>
      </div>
    </Transition>

    <!-- ═══════════════════════════════════════════════════════════
         BULK SELECTION FLOATING TOOLBAR
         ═══════════════════════════════════════════════════════════ -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <!-- Priority Bulk Bar -->
      <div
        v-if="activeCollectionTab === 'priority' && selectedPriorityUrls.size > 0"
        class="border-primary/20 bg-primary/5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 sm:px-6"
      >
        <div class="flex items-center gap-2.5">
          <span
            class="bg-primary inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
          >
            {{ selectedPriorityUrls.size }}
          </span>
          <span class="text-xs font-bold text-gray-900">
            {{ selectedPriorityUrls.size }} scan{{ selectedPriorityUrls.size === 1 ? '' : 's' }}
            selected
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="cursor-pointer px-2.5 py-1 text-xs font-semibold text-gray-500 transition hover:text-gray-900"
            @click="clearPrioritySelection"
          >
            Clear
          </button>
          <AppButton
            variant="solid"
            size="sm"
            class="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-xl font-bold shadow-xs"
            @click="promptBulkTransferPriority"
          >
            <Icon
              name="lucide:arrow-right-left"
              size="14"
            />
            Transfer Category ({{ selectedPriorityUrls.size }})
          </AppButton>
          <AppButton
            variant="destructive"
            size="sm"
            class="gap-1.5 rounded-xl shadow-xs"
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

      <!-- Out-of-Scope Bulk Bar -->
      <div
        v-else-if="activeCollectionTab === 'out_of_scope' && selectedOosUrls.size > 0"
        class="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 sm:px-6"
      >
        <div class="flex items-center gap-2.5">
          <span
            class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-xs"
          >
            {{ selectedOosUrls.size }}
          </span>
          <span class="text-xs font-bold text-gray-900">
            {{ selectedOosUrls.size }} research scan{{ selectedOosUrls.size === 1 ? '' : 's' }}
            selected
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="cursor-pointer px-2.5 py-1 text-xs font-semibold text-gray-500 transition hover:text-gray-900"
            @click="clearOosSelection"
          >
            Clear
          </button>
          <AppButton
            variant="destructive"
            size="sm"
            class="gap-1.5 rounded-xl shadow-xs"
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

    <!-- ═══════════════════════════════════════════════════════════
         TAB 1: PRIORITY RETRAINING DATASET (Acne, Eczema, Herpes)
         ═══════════════════════════════════════════════════════════ -->
    <div
      v-if="activeCollectionTab === 'priority'"
      class="space-y-6"
    >
      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="flex items-center justify-center py-20"
      >
        <div
          class="border-primary h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
        ></div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="datasets.length === 0"
        class="rounded-2xl border border-dashed border-gray-200 bg-white p-8 py-16 text-center shadow-2xs"
      >
        <Icon
          name="lucide:image-off"
          size="44"
          class="mx-auto mb-3 text-gray-400"
        />
        <h3 class="text-base font-bold text-gray-900">No images in priority dataset</h3>
        <p class="mx-auto mt-1 max-w-sm text-xs text-gray-500">
          Upload verified clinical images or synchronize doctor-approved patient scans to populate
          the active retraining collection.
        </p>
        <div class="mt-5 flex justify-center">
          <AppButton
            variant="solid"
            size="sm"
            class="gap-1.5 rounded-xl font-bold"
            @click="openUploadModal('priority')"
          >
            <Icon
              name="lucide:upload"
              size="14"
            />
            Upload First Scan
          </AppButton>
        </div>
      </div>

      <!-- Disease Categories -->
      <div
        v-else
        class="space-y-6"
      >
        <section
          v-for="dataset in datasets"
          :key="dataset.category"
          class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs"
        >
          <!-- Category Card Header -->
          <div
            class="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5"
          >
            <div class="flex items-center gap-2.5">
              <span
                class="h-2.5 w-2.5 rounded-full"
                :class="getCategoryColor(dataset.category).dot"
              ></span>
              <h3 class="text-sm font-black tracking-tight text-gray-950 capitalize">
                {{ dataset.category }}
              </h3>
              <span
                class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide"
                :class="getCategoryColor(dataset.category).badge"
              >
                {{ getCategoryTotalItems(dataset) }} Total Scans
              </span>
            </div>

            <!-- Header Actions -->
            <div class="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <label
                class="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gray-600 select-none hover:text-gray-950"
              >
                <input
                  type="checkbox"
                  :checked="
                    isCategoryAllSelectedPriority(getCategoryItems(dataset).map(i => i.url))
                  "
                  class="text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer rounded border-gray-300"
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
                class="border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground gap-1.5 rounded-xl text-xs font-semibold shadow-2xs transition"
                @click="promptCategorySelectedTransfer(dataset)"
              >
                <Icon
                  name="lucide:arrow-right-left"
                  size="13"
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
                class="gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                @click="downloadZip(dataset.category)"
              >
                <Icon
                  name="lucide:download"
                  size="13"
                  class="text-gray-500"
                />
                Download Category (.zip)
              </AppButton>
            </div>
          </div>

          <!-- Category Grid Container -->
          <div class="relative min-h-[140px] p-4 sm:p-5">
            <!-- Loading Overlay -->
            <div
              v-if="isCategoryLoading(dataset.category)"
              class="absolute inset-0 z-20 flex items-center justify-center bg-white/80"
            >
              <div
                class="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              />
            </div>

            <!-- Empty Filter Match -->
            <div
              v-if="getCategoryItems(dataset).length === 0"
              class="py-12 text-center text-xs text-gray-500"
            >
              No {{ dataset.category }} images match the current search or sync filter.
            </div>

            <!-- Image Grid -->
            <div
              v-else
              class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-3.5 lg:grid-cols-6"
            >
              <div
                v-for="item in getCategoryItems(dataset)"
                :key="item.url"
                class="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 bg-gray-100 transition-all select-none"
                :class="
                  selectedPriorityUrls.has(item.url)
                    ? 'border-primary ring-primary/30 shadow-xs ring-2'
                    : 'border-transparent hover:border-gray-300'
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
                  title="Select scan"
                  @click.stop="toggleSelectPriorityImage(item.url)"
                >
                  <div
                    class="flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-150"
                    :class="
                      selectedPriorityUrls.has(item.url)
                        ? 'bg-primary border-primary text-white shadow-xs ring-2 ring-white/50'
                        : 'border-white/80 bg-black/45 text-transparent opacity-80 shadow-xs group-hover:border-white group-hover:bg-black/70 group-hover:opacity-100'
                    "
                  >
                    <Icon
                      name="lucide:check"
                      size="12"
                      class="stroke-3"
                    />
                  </div>
                </div>

                <!-- Permanent Sync Status Badge (Top Right) -->
                <div class="absolute top-2 right-2 z-10">
                  <div
                    v-if="item.is_synced"
                    class="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs"
                    title="Mirrored in PyTorch local training raw directory"
                  >
                    <Icon
                      name="lucide:check-circle-2"
                      size="11"
                    />
                    <span>Synced</span>
                  </div>
                  <div
                    v-else
                    class="inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs"
                    title="Consultation Scan pending sync to training raw directory"
                  >
                    <Icon
                      name="lucide:clock"
                      size="11"
                    />
                    <span>Pending</span>
                  </div>
                </div>

                <!-- Quick Inspect Button (Center on Hover) -->
                <div
                  class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                >
                  <button
                    type="button"
                    class="pointer-events-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/65 text-white shadow-md backdrop-blur-xs transition hover:scale-110 hover:bg-black/90"
                    title="Inspect Scan in High-Res"
                    @click.stop="openInspectModal(item, dataset.category, false)"
                  >
                    <Icon
                      name="lucide:eye"
                      size="15"
                    />
                  </button>
                </div>

                <!-- Rich Bottom Hover Toolbar -->
                <div
                  class="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                >
                  <div class="flex items-center justify-between gap-1">
                    <div class="min-w-0 flex-1">
                      <span
                        class="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase"
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

                    <div class="flex shrink-0 items-center gap-1">
                      <!-- Verify / Approve Diagnosis Scan for Training -->
                      <button
                        v-if="item.diagnosis_uuid"
                        type="button"
                        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-black/60 text-white/90 transition hover:bg-emerald-600 hover:text-white"
                        title="Authorize for Dataset Retraining"
                        @click.stop="handleApproveDiagnosis(item.diagnosis_uuid)"
                      >
                        <Icon
                          name="lucide:check-circle"
                          size="12"
                        />
                      </button>

                      <!-- Reassign / Transfer Category -->
                      <button
                        type="button"
                        class="hover:bg-primary flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-black/60 text-white/90 transition hover:text-white"
                        title="Transfer Category"
                        @click.stop="promptTransferPriorityImage(item)"
                      >
                        <Icon
                          name="lucide:arrow-right-left"
                          size="12"
                        />
                      </button>

                      <!-- Delete Scan -->
                      <button
                        type="button"
                        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-red-600/80 text-white transition hover:bg-red-600"
                        title="Delete Scan"
                        @click.stop="promptDeleteImage(item.url, false)"
                      >
                        <Icon
                          name="lucide:trash-2"
                          size="12"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Category Pagination Footer -->
          <div
            v-if="getCategoryTotalItems(dataset) > pageSize"
            class="flex flex-col items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:flex-row sm:px-6"
          >
            <span class="text-xs text-gray-500">
              Showing
              <span class="font-semibold text-gray-900">
                {{ (getCategoryCurrentPage(dataset.category, false) - 1) * pageSize + 1 }}
              </span>
              to
              <span class="font-semibold text-gray-900">
                {{
                  Math.min(
                    getCategoryCurrentPage(dataset.category, false) * pageSize,
                    getCategoryTotalItems(dataset)
                  )
                }}
              </span>
              of
              <span class="font-semibold text-gray-900">{{ getCategoryTotalItems(dataset) }}</span>
              scans
            </span>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition"
                :class="
                  getCategoryCurrentPage(dataset.category, false) === p
                    ? 'bg-primary text-white shadow-2xs'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                "
                @click="setCategoryPage(dataset.category, p, false)"
              >
                {{ p }}
              </button>

              <button
                type="button"
                class="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
        </section>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         TAB 2: OUT-OF-SCOPE RESEARCH DATASET (OpenCLIP Categorized)
         ═══════════════════════════════════════════════════════════ -->
    <div
      v-else
      class="space-y-6"
    >
      <!-- Loading State -->
      <div
        v-if="isLoadingOutOfScope"
        class="flex items-center justify-center py-20"
      >
        <div
          class="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent"
        ></div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="outOfScopeDatasets.length === 0"
        class="rounded-2xl border border-dashed border-gray-200 bg-white p-8 py-16 text-center shadow-2xs"
      >
        <Icon
          name="lucide:scan-search"
          size="44"
          class="mx-auto mb-3 text-gray-400"
        />
        <h3 class="text-base font-bold text-gray-900">No out-of-scope scans collected yet</h3>
        <p class="mx-auto mt-1 max-w-sm text-xs text-gray-500">
          When physicians submit scans identified as out-of-scope conditions (with patient consent),
          they will automatically populate here categorized by OpenCLIP for future AI disease
          expansion.
        </p>
        <div class="mt-5 flex justify-center">
          <AppButton
            variant="solid"
            size="sm"
            class="gap-1.5 rounded-xl font-bold"
            @click="openUploadModal('out_of_scope')"
          >
            <Icon
              name="lucide:upload"
              size="14"
            />
            Upload Research Image
          </AppButton>
        </div>
      </div>

      <!-- OOS Categories -->
      <div
        v-else
        class="space-y-6"
      >
        <section
          v-for="dataset in outOfScopeDatasets"
          :key="dataset.category"
          class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs"
        >
          <!-- Header -->
          <div
            class="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5"
          >
            <div class="flex items-center gap-2.5">
              <span class="h-2.5 w-2.5 rounded-full bg-violet-500"></span>
              <h3 class="text-sm font-black tracking-tight text-gray-950 capitalize">
                {{ dataset.category }}
              </h3>
              <span
                class="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-violet-700"
              >
                {{ getCategoryTotalItems(dataset) }} Research Scans
              </span>
            </div>

            <!-- Header Actions -->
            <div class="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <label
                class="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gray-600 select-none hover:text-gray-950"
              >
                <input
                  type="checkbox"
                  :checked="isCategoryAllSelectedOos(getOosCategoryImages(dataset))"
                  class="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  @change="toggleSelectAllCategoryOos(getOosCategoryImages(dataset))"
                />
                <span>Select All</span>
                <span
                  v-if="getCategorySelectedCountOos(getOosCategoryImages(dataset)) > 0"
                  class="font-bold text-violet-600"
                >
                  ({{ getCategorySelectedCountOos(getOosCategoryImages(dataset)) }})
                </span>
              </label>

              <AppButton
                variant="outline"
                size="sm"
                class="gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                @click="downloadOosZip(dataset.category)"
              >
                <Icon
                  name="lucide:download"
                  size="13"
                  class="text-gray-500"
                />
                Download Category (.zip)
              </AppButton>
            </div>
          </div>

          <!-- Body Image Grid -->
          <div class="relative min-h-[140px] p-4 sm:p-5">
            <!-- Loading Overlay -->
            <div
              v-if="isCategoryLoading(dataset.category)"
              class="absolute inset-0 z-20 flex items-center justify-center bg-white/80"
            >
              <div
                class="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent"
              />
            </div>

            <!-- Empty Filter Match -->
            <div
              v-if="getOosCategoryImages(dataset).length === 0"
              class="py-12 text-center text-xs text-gray-500"
            >
              No {{ dataset.category }} images match your search query.
            </div>

            <div
              v-else
              class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-3.5 lg:grid-cols-6"
            >
              <div
                v-for="url in getOosCategoryImages(dataset)"
                :key="url"
                class="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 bg-gray-100 transition-all select-none"
                :class="
                  selectedOosUrls.has(url)
                    ? 'border-violet-600 ring-2 ring-violet-500/30'
                    : 'border-transparent hover:border-gray-300'
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

                <!-- Checkbox -->
                <div
                  class="absolute top-2 left-2 z-10 transition-all"
                  title="Select scan"
                  @click.stop="toggleSelectOosImage(url)"
                >
                  <div
                    class="flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-150"
                    :class="
                      selectedOosUrls.has(url)
                        ? 'border-violet-600 bg-violet-600 text-white shadow-xs ring-2 ring-white/50'
                        : 'border-white/80 bg-black/45 text-transparent opacity-80 shadow-xs group-hover:border-white group-hover:bg-black/70 group-hover:opacity-100'
                    "
                  >
                    <Icon
                      name="lucide:check"
                      size="12"
                      class="stroke-3"
                    />
                  </div>
                </div>

                <!-- Center Inspect Button -->
                <div
                  class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                >
                  <button
                    type="button"
                    class="pointer-events-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/65 text-white shadow-md backdrop-blur-xs transition hover:scale-110 hover:bg-black/90"
                    title="Inspect Scan in High-Res"
                    @click.stop="openInspectModal(url, dataset.category, true)"
                  >
                    <Icon
                      name="lucide:eye"
                      size="15"
                    />
                  </button>
                </div>

                <!-- Bottom Hover Delete Button -->
                <div
                  class="absolute right-2 bottom-2 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                >
                  <button
                    type="button"
                    class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-black/60 text-white shadow-xs transition hover:scale-110 hover:bg-red-600"
                    title="Delete Scan"
                    @click.stop="promptDeleteImage(url, true)"
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

          <!-- Category Pagination Footer -->
          <div
            v-if="getCategoryTotalItems(dataset) > pageSize"
            class="flex flex-col items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:flex-row sm:px-6"
          >
            <span class="text-xs text-gray-500">
              Showing
              <span class="font-semibold text-gray-900">
                {{ (getCategoryCurrentPage(dataset.category, true) - 1) * pageSize + 1 }}
              </span>
              to
              <span class="font-semibold text-gray-900">
                {{
                  Math.min(
                    getCategoryCurrentPage(dataset.category, true) * pageSize,
                    getCategoryTotalItems(dataset)
                  )
                }}
              </span>
              of
              <span class="font-semibold text-gray-900">{{ getCategoryTotalItems(dataset) }}</span>
              scans
            </span>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition"
                :class="
                  getCategoryCurrentPage(dataset.category, true) === p
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                "
                @click="setCategoryPage(dataset.category, p, true)"
              >
                {{ p }}
              </button>

              <button
                type="button"
                class="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
        </section>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         MODALS & DIALOGS
         ═══════════════════════════════════════════════════════════ -->

    <!-- Single Dynamic Upload Image Modal -->
    <AppModal
      v-model="showUploadModal"
      :title="
        uploadMode === 'out_of_scope' ? 'Upload to Research Dataset' : 'Upload to Priority Dataset'
      "
      :description="
        uploadMode === 'out_of_scope'
          ? 'Add scans of out-of-scope conditions to the research collection. Strictly isolated from retraining.'
          : 'Add Acne, Eczema, or Herpes scans to the active AI retraining collection.'
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
          : 'Are you sure you want to remove this image from the active training collection? This action cannot be undone.'
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
          ? `Are you sure you want to permanently delete ${selectedOosUrls.size} selected image(s) from the research dataset? This action cannot be undone.`
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
    <AppModal
      v-model="showTransferModal"
      :title="
        isBulkTransfer ? `Transfer ${selectedPriorityUrls.size} Scans` : 'Transfer Scan Category'
      "
      description="Reassign misclassified scans to their proper clinical disease category."
      size="lg"
      @close="closeTransferModal"
    >
      <div class="space-y-5">
        <!-- Single Preview -->
        <div
          v-if="!isBulkTransfer && itemToTransfer"
          class="flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5"
        >
          <img
            :src="getStorageUrl(itemToTransfer.url)"
            :alt="itemToTransfer.filename"
            class="h-16 w-16 shrink-0 rounded-xl border border-gray-200 object-cover"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate font-mono text-xs font-semibold text-gray-900">
                {{ itemToTransfer.filename || 'scan.jpg' }}
              </span>
            </div>
            <div class="mt-1 flex items-center gap-2 text-xs">
              <span class="text-[11px] text-gray-500">Current Category:</span>
              <span
                class="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-bold text-gray-700 uppercase"
              >
                {{ currentSelectionCategory || 'Acne' }}
              </span>
              <span
                v-if="itemToTransfer.is_synced"
                class="text-[10px] font-medium text-emerald-600"
              >
                · Synced to Local AI
              </span>
              <span
                v-else
                class="text-[10px] font-medium text-amber-600"
              >
                · Pending Sync
              </span>
            </div>
          </div>
        </div>

        <!-- Bulk Preview Strip -->
        <div
          v-else-if="isBulkTransfer"
          class="rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5"
        >
          <div class="mb-2 flex items-center justify-between text-xs">
            <span class="font-semibold text-gray-900">
              Selected Scans ({{ selectedPriorityUrls.size }})
            </span>
            <span
              v-if="currentSelectionCategory"
              class="text-[11px] text-gray-500"
            >
              All from
              <strong class="text-gray-900 capitalize">{{ currentSelectionCategory }}</strong>
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
                class="h-12 w-12 rounded-lg border border-gray-200 object-cover"
              />
            </div>
            <div
              v-if="selectedPriorityUrls.size > 8"
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-[11px] font-bold text-gray-500"
            >
              +{{ selectedPriorityUrls.size - 8 }}
            </div>
          </div>
        </div>

        <!-- Target Destination Category -->
        <div>
          <label class="mb-2.5 block text-xs font-bold tracking-wider text-gray-900 uppercase">
            Select Destination Category
          </label>

          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <button
              v-for="opt in transferTargetOptions"
              :key="opt.id"
              type="button"
              :disabled="opt.id === currentSelectionCategory"
              class="relative flex flex-col items-start rounded-2xl border p-3.5 text-left transition duration-150"
              :class="[
                opt.id === currentSelectionCategory
                  ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-45'
                  : targetTransferCategory === opt.id
                    ? 'border-primary bg-primary/5 ring-primary/20 shadow-2xs ring-2'
                    : 'cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50/70'
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
                  v-if="targetTransferCategory === opt.id && opt.id !== currentSelectionCategory"
                  name="lucide:check-circle-2"
                  size="16"
                  class="text-primary"
                />
                <span
                  v-else-if="opt.id === currentSelectionCategory"
                  class="text-[9px] font-semibold text-gray-400 uppercase"
                >
                  Current
                </span>
              </div>

              <p class="text-[11px] leading-snug text-gray-500">
                {{ opt.desc }}
              </p>
            </button>
          </div>
        </div>

        <!-- Informational Callout -->
        <div
          class="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-800"
        >
          <Icon
            name="lucide:info"
            size="15"
            class="mt-0.5 shrink-0 text-blue-600"
          />
          <p class="text-[11px] leading-relaxed">
            Reassigning updates clinical consultation diagnostic records, relocates physical image
            files in storage, and updates the local AI algorithm training raw directory.
          </p>
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-end gap-2.5 pt-3">
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
            {{ targetTransferCategory.charAt(0).toUpperCase() + targetTransferCategory.slice(1) }}
          </AppButton>
        </div>
      </div>
    </AppModal>

    <!-- ═══════════════════════════════════════════════════════════
         HIGH-RESOLUTION INSPECTION MODAL (Lightbox with Metadata)
         ═══════════════════════════════════════════════════════════ -->
    <AppModal
      :model-value="inspectingImage !== null"
      title="Clinical Scan Inspection"
      description="Inspect high-resolution lesion morphology, source origin, and AI synchronization state."
      size="2xl"
      @update:model-value="
        val => {
          if (!val) inspectingImage = null
        }
      "
      @close="inspectingImage = null"
    >
      <div
        v-if="inspectingImage"
        class="space-y-5"
      >
        <!-- High-Res Image Container -->
        <div
          class="relative flex max-h-[55vh] items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-black/5 p-2"
        >
          <NuxtImg
            :src="getStorageUrl(inspectingImage.url)"
            class="max-h-[50vh] w-auto max-w-full rounded-xl object-contain shadow-xs"
            loading="eager"
          />
        </div>

        <!-- Metadata Strip -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-2.5">
            <span class="text-[10px] font-bold tracking-wider text-gray-500 uppercase"
              >Category</span
            >
            <div class="mt-0.5 flex items-center gap-1.5 font-bold text-gray-900 capitalize">
              <span
                class="h-2 w-2 rounded-full"
                :class="getCategoryColor(inspectingImage.category).dot"
              ></span>
              {{ inspectingImage.category }}
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-2.5">
            <span class="text-[10px] font-bold tracking-wider text-gray-500 uppercase"
              >AI Status</span
            >
            <div class="mt-0.5 flex items-center gap-1 font-bold">
              <span
                v-if="inspectingImage.is_synced"
                class="text-emerald-700"
              >
                Synced to Model
              </span>
              <span
                v-else
                class="text-amber-700"
              >
                Pending Sync
              </span>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-2.5">
            <span class="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Source</span>
            <div class="mt-0.5 truncate font-semibold text-gray-900 capitalize">
              {{ inspectingImage.source === 'diagnosis' ? 'Patient Scan' : 'Uploaded' }}
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-2.5">
            <span class="text-[10px] font-bold tracking-wider text-gray-500 uppercase"
              >Filename</span
            >
            <div
              class="mt-0.5 truncate font-mono text-xs font-semibold text-gray-900"
              :title="inspectingImage.filename"
            >
              {{ inspectingImage.filename }}
            </div>
          </div>
        </div>

        <!-- Inspection Actions Footer -->
        <div
          class="flex flex-wrap items-center justify-between gap-2.5 border-t border-gray-100 pt-3"
        >
          <div class="flex items-center gap-2">
            <AppButton
              v-if="inspectingImage.item"
              variant="outline"
              size="sm"
              class="gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
              @click="promptTransferPriorityImage(inspectingImage.item)"
            >
              <Icon
                name="lucide:arrow-right-left"
                size="13"
              />
              Transfer Category
            </AppButton>

            <AppButton
              v-if="inspectingImage.diagnosis_uuid"
              variant="outline"
              size="sm"
              class="gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              :loading="isApprovingDiagnosis"
              @click="handleApproveDiagnosis(inspectingImage.diagnosis_uuid)"
            >
              <Icon
                name="lucide:check-circle"
                size="13"
              />
              Approve for Dataset
            </AppButton>
          </div>

          <div class="flex items-center gap-2">
            <AppButton
              variant="destructive"
              size="sm"
              class="gap-1.5 rounded-xl text-xs font-semibold"
              @click="promptDeleteImage(inspectingImage.url, Boolean(inspectingImage.isOos))"
            >
              <Icon
                name="lucide:trash-2"
                size="13"
              />
              Delete Image
            </AppButton>

            <AppButton
              variant="ghost"
              size="sm"
              class="rounded-xl text-xs font-semibold"
              @click="inspectingImage = null"
            >
              Close
            </AppButton>
          </div>
        </div>
      </div>
    </AppModal>
  </div>
</template>
