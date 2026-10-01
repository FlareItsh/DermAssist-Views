<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { datasetService, type DatasetCategory } from '~/api/dataset/DatasetService'
  import {
    outOfScopeDatasetService,
    type OutOfScopeDatasetCategory,
    OUT_OF_SCOPE_CATEGORIES
  } from '~/api/dataset/OutOfScopeDatasetService'
  import { toast } from 'vue-sonner'

  const { getStorageUrl } = useStorage()

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  // ── Modals & Action State ────────────────────────────────────────────
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

  // ── Standard Dataset ─────────────────────────────────────────────────
  const isLoading = ref(false)
  const isDeleting = ref(false)
  const datasets = ref<DatasetCategory[]>([])

  const totalImagesCount = computed(() => {
    return datasets.value.reduce((acc, cat) => acc + (cat.images?.length || 0), 0)
  })

  const fetchDataset = async () => {
    isLoading.value = true
    try {
      datasets.value = await datasetService.getDataset()
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
    return outOfScopeDatasets.value.reduce((acc, cat) => acc + (cat.images?.length || 0), 0)
  })

  const fetchOutOfScopeDataset = async () => {
    isLoadingOutOfScope.value = true
    try {
      outOfScopeDatasets.value = await outOfScopeDatasetService.getDataset()
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
    <div class="space-y-4">
      <div class="flex w-full flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div class="flex items-center gap-3">
          <div
            class="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          >
            <Icon
              name="lucide:database"
              size="18"
            />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-foreground text-base font-bold">Priority Retraining Dataset</h2>
              <AppBadge
                color="primary"
                size="sm"
                variant="subtle"
                >{{ totalImagesCount }} images</AppBadge
              >
            </div>
            <p class="text-muted-foreground text-xs">
              Acne, Eczema & Herpes — feeds directly into ensemble model retraining
            </p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2 sm:gap-3">
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
        class="bg-card border-border text-muted-foreground rounded-3xl border border-dashed p-8 py-20 text-center"
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
        <div
          v-for="dataset in datasets"
          :key="dataset.category"
          class="bg-card border-border overflow-hidden rounded-2xl border shadow-sm"
        >
          <div
            class="bg-muted/40 border-border flex items-center justify-between border-b px-6 py-4"
          >
            <div class="flex items-center gap-2">
              <div class="bg-primary h-2 w-2 rounded-full"></div>
              <h3 class="text-foreground text-sm font-bold capitalize">{{ dataset.category }}</h3>
              <AppBadge
                color="gray"
                size="sm"
                >{{ dataset.images.length }} images</AppBadge
              >
            </div>
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

          <div class="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            <div
              v-for="(url, idx) in dataset.images"
              :key="idx"
              class="group bg-muted border-border relative aspect-square overflow-hidden rounded-xl border"
            >
              <NuxtImg
                :src="getStorageUrl(url)"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div
                class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              >
                <button
                  type="button"
                  class="bg-destructive transform cursor-pointer rounded-full p-2.5 text-white shadow-lg transition-all hover:scale-110 hover:opacity-90"
                  title="Delete Image"
                  @click="promptDeleteImage(url, false)"
                >
                  <Icon
                    name="lucide:trash-2"
                    size="18"
                  />
                </button>
              </div>
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
        class="bg-card border-border text-muted-foreground rounded-3xl border border-dashed p-8 py-20 text-center"
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
        <div
          v-for="dataset in outOfScopeDatasets"
          :key="dataset.category"
          class="bg-card overflow-hidden rounded-2xl border border-violet-500/20 shadow-sm"
        >
          <div
            class="flex items-center justify-between border-b border-violet-500/10 bg-violet-500/5 px-6 py-4"
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
                {{ dataset.images.length }} images
              </AppBadge>
            </div>

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

          <div class="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            <div
              v-for="(url, idx) in dataset.images"
              :key="idx"
              class="group bg-muted border-border relative aspect-square overflow-hidden rounded-xl border"
            >
              <NuxtImg
                :src="getStorageUrl(url)"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div
                class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              >
                <button
                  type="button"
                  class="bg-destructive transform cursor-pointer rounded-full p-2.5 text-white shadow-lg transition-all hover:scale-110 hover:opacity-90"
                  title="Delete Image"
                  @click="promptDeleteImage(url, true)"
                >
                  <Icon
                    name="lucide:trash-2"
                    size="18"
                  />
                </button>
              </div>
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
  </div>
</template>
