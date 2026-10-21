<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { datasetService, type DatasetCategory } from '~/api/dataset/DatasetService'
  import { toast } from 'vue-sonner'
  import DatasetImageUploader from '~/components/App/DatasetImageUploader.vue'

  const { getStorageUrl } = useStorage()

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const isLoading = ref(false)
  const isDownloading = ref(false)
  const datasets = ref<DatasetCategory[]>([])
  const showUploadModal = ref(false)

  // ── Per-Category Image Pagination ──────────────────────────────────
  const IMAGES_PER_PAGE = 12 // 2 full rows on 6-col grid, 3 on 4-col, 4 on 3-col
  const categoryPages = ref<Record<string, number>>({})

  const getCategoryCurrentPage = (category: string) => {
    return categoryPages.value[category] || 1
  }

  const setCategoryCurrentPage = (category: string, page: number) => {
    categoryPages.value = {
      ...categoryPages.value,
      [category]: page
    }
  }

  const getTotalCategoryPages = (dataset: DatasetCategory) => {
    return Math.ceil((dataset.images?.length || 0) / IMAGES_PER_PAGE) || 1
  }

  const getPaginatedImages = (dataset: DatasetCategory) => {
    const page = getCategoryCurrentPage(dataset.category)
    const start = (page - 1) * IMAGES_PER_PAGE
    return (dataset.images || []).slice(start, start + IMAGES_PER_PAGE)
  }

  const getPageNumbers = (totalPages: number, currentPage: number) => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const pages: (number | string)[] = [1]
    if (currentPage > 3) pages.push('...')
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  const totalImagesCount = computed(() => {
    return datasets.value.reduce((acc, cat) => acc + (cat.images?.length || 0), 0)
  })

  const formatCategoryName = (category: string) => {
    const norm = (category || '').toLowerCase().replace(/[\s-]+/g, '_')
    if (norm === 'out_of_scope' || norm === 'outofscope') {
      return 'Out of Scope'
    }
    return category.charAt(0).toUpperCase() + category.slice(1)
  }

  const fetchDataset = async () => {
    isLoading.value = true
    try {
      datasets.value = await datasetService.getDataset({ scope: 'doctor' })
    } catch (e) {
      console.error('Failed to fetch dataset', e)
      toast.error('Failed to load dataset gallery.')
    } finally {
      isLoading.value = false
    }
  }

  const downloadZip = async (category?: string) => {
    isDownloading.value = true
    try {
      const blob = await datasetService.downloadDataset(category, { scope: 'doctor' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        category
          ? `doctor_dataset_${category.toLowerCase().replace(/[\s-]+/g, '_')}.zip`
          : 'doctor_scans_all.zip'
      )
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Download started.')
    } catch (e: any) {
      console.error('Failed to download zip', e)
      toast.error(e?.data?.error || 'No scans available to download.')
    } finally {
      isDownloading.value = false
    }
  }

  const handleUploadSuccess = () => {
    showUploadModal.value = false
    fetchDataset()
  }

  onMounted(() => {
    fetchDataset()
  })
</script>

<template>
  <div class="flex flex-col gap-5 pb-8 sm:gap-6">
    <!-- Header -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <div class="mb-1 flex flex-wrap items-center gap-2">
          <h1 class="text-foreground text-2xl font-bold sm:text-3xl">
            Doctor Clinical Scans Repository
          </h1>
        </div>
        <p class="text-muted-foreground text-xs sm:text-sm">
          Manage your verified clinical lesion scans and direct uploads contributed to the AI
          diagnostic retraining pool.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <AppButton
          variant="outline"
          class="flex-1 justify-center gap-2 text-xs font-bold sm:flex-none sm:text-sm"
          :disabled="isDownloading || totalImagesCount === 0"
          @click="downloadZip()"
        >
          <Icon
            name="lucide:download"
            size="16"
          />
          <span>Download All (ZIP)</span>
        </AppButton>

        <AppButton
          variant="solid"
          class="flex-1 justify-center gap-2 text-xs font-bold shadow-sm sm:flex-none sm:text-sm"
          @click="showUploadModal = true"
        >
          <Icon
            name="lucide:image-plus"
            size="18"
          />
          <span>Contribute Images</span>
        </AppButton>
      </div>
    </div>

    <!-- Doctor Contribution Banner & Quick Uploader Box -->
    <div class="bg-card border-border space-y-5 rounded-3xl border p-4 shadow-sm sm:p-6 md:p-8">
      <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div class="flex items-start gap-3 sm:gap-4">
          <div class="bg-secondary mt-0.5 h-8 w-1 shrink-0 rounded-full sm:h-9" />
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-foreground text-base font-bold">Your AI Dataset Contributions</h3>
              <AppBadge
                color="gray"
                size="sm"
                class="md:hidden"
              >
                {{ totalImagesCount }} scans stored
              </AppBadge>
            </div>
            <p class="text-muted-foreground mt-0.5 max-w-xl text-xs">
              Verified clinical photos from your consultations and direct uploads. Scans contributed
              from your practice are included in automated model retraining safeguarded by the
              Validation Guard.
            </p>
          </div>
        </div>

        <div class="hidden shrink-0 items-center gap-2 md:flex">
          <AppBadge
            color="gray"
            size="md"
          >
            {{ totalImagesCount }} scans stored
          </AppBadge>
        </div>
      </div>

      <!-- Embedded Multi-Image Uploader Dropzone -->
      <div class="pt-1">
        <DatasetImageUploader
          inline
          @uploaded="handleUploadSuccess"
        />
      </div>
    </div>

    <!-- Dataset Categories List -->
    <div
      v-if="isLoading"
      class="flex items-center justify-center py-24"
    >
      <div class="border-primary h-12 w-12 animate-spin rounded-full border-b-2"></div>
    </div>

    <div
      v-else-if="datasets.length === 0"
      class="bg-card border-border text-muted-foreground rounded-3xl border p-8 py-20 text-center"
    >
      <Icon
        name="lucide:image-off"
        size="56"
        class="mx-auto mb-4 opacity-40"
      />
      <h3 class="text-foreground mb-1 text-lg font-bold">No scans in your repository yet</h3>
      <p class="mx-auto mb-6 max-w-sm text-xs">
        Perform consultation scans or contribute verified clinical lesion images using the dropzone
        above.
      </p>
    </div>

    <div
      v-else
      class="flex flex-col gap-5 sm:gap-6"
    >
      <div
        v-for="dataset in datasets"
        :key="dataset.category"
        class="bg-card border-border overflow-hidden rounded-3xl border shadow-sm"
      >
        <div
          class="bg-muted/40 border-border flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4"
        >
          <div class="flex items-center gap-2">
            <h2 class="text-foreground text-base font-bold">
              {{ formatCategoryName(dataset.category) }}
            </h2>
            <AppBadge
              color="gray"
              size="sm"
            >
              {{ dataset.images.length }} scans
            </AppBadge>
          </div>

          <AppButton
            variant="outline"
            size="sm"
            class="gap-1.5 text-xs font-semibold"
            :disabled="isDownloading || dataset.images.length === 0"
            @click="downloadZip(dataset.category)"
          >
            <Icon
              name="lucide:download"
              size="14"
            />
            <span class="hidden sm:inline">Download Category</span>
            <span class="sm:hidden">Download</span>
          </AppButton>
        </div>

        <div
          v-if="dataset.images.length > 0"
          class="grid grid-cols-2 gap-3.5 p-4 sm:grid-cols-3 sm:gap-4 sm:p-6 md:grid-cols-4 lg:grid-cols-6"
        >
          <div
            v-for="(url, idx) in getPaginatedImages(dataset)"
            :key="idx"
            class="bg-muted border-border group relative aspect-square overflow-hidden rounded-2xl border"
          >
            <img
              :src="getStorageUrl(url)"
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              alt="Clinical lesion scan"
            />
          </div>
        </div>

        <div
          v-else
          class="text-muted-foreground flex items-center justify-center py-10 text-center text-xs"
        >
          <span
            >No {{ formatCategoryName(dataset.category) }} scans contributed by your account
            yet.</span
          >
        </div>

        <!-- Category Pagination Footer (Shown when category has more than IMAGES_PER_PAGE) -->
        <div
          v-if="dataset.images.length > IMAGES_PER_PAGE"
          class="bg-muted/20 border-border/60 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-6"
        >
          <p class="text-muted-foreground text-xs font-medium">
            Showing
            <span class="text-foreground font-bold">
              {{ (getCategoryCurrentPage(dataset.category) - 1) * IMAGES_PER_PAGE + 1 }}
            </span>
            to
            <span class="text-foreground font-bold">
              {{
                Math.min(
                  getCategoryCurrentPage(dataset.category) * IMAGES_PER_PAGE,
                  dataset.images.length
                )
              }}
            </span>
            of
            <span class="text-foreground font-bold">{{ dataset.images.length }}</span>
            scans
          </p>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              :disabled="getCategoryCurrentPage(dataset.category) <= 1"
              @click="
                setCategoryCurrentPage(
                  dataset.category,
                  getCategoryCurrentPage(dataset.category) - 1
                )
              "
              class="border-border bg-card text-foreground hover:bg-muted/60 disabled:text-muted-foreground/40 disabled:border-border/40 inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-xs font-semibold shadow-2xs transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon
                name="lucide:chevron-left"
                class="h-3.5 w-3.5"
              />
              <span class="hidden sm:inline">Prev</span>
            </button>

            <template
              v-for="(p, pIdx) in getPageNumbers(
                getTotalCategoryPages(dataset),
                getCategoryCurrentPage(dataset.category)
              )"
              :key="pIdx"
            >
              <span
                v-if="p === '...'"
                class="text-muted-foreground px-1 text-xs"
              >
                ...
              </span>
              <button
                v-else
                type="button"
                @click="setCategoryCurrentPage(dataset.category, Number(p))"
                class="inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold shadow-2xs transition"
                :class="
                  getCategoryCurrentPage(dataset.category) === p
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-card text-foreground hover:bg-muted/60 border'
                "
              >
                {{ p }}
              </button>
            </template>

            <button
              type="button"
              :disabled="getCategoryCurrentPage(dataset.category) >= getTotalCategoryPages(dataset)"
              @click="
                setCategoryCurrentPage(
                  dataset.category,
                  getCategoryCurrentPage(dataset.category) + 1
                )
              "
              class="border-border bg-card text-foreground hover:bg-muted/60 disabled:text-muted-foreground/40 disabled:border-border/40 inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-xs font-semibold shadow-2xs transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span class="hidden sm:inline">Next</span>
              <Icon
                name="lucide:chevron-right"
                class="h-3.5 w-3.5"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Form (Alternative trigger) -->
    <AppModal
      v-model="showUploadModal"
      title="Contribute Scan Images to Dataset"
      description="Upload single or multiple verified clinical images directly to a disease category."
      size="2xl"
    >
      <div class="pt-2">
        <DatasetImageUploader
          @uploaded="handleUploadSuccess"
          @close="showUploadModal = false"
        />
      </div>
    </AppModal>
  </div>
</template>
