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
  const datasets = ref<DatasetCategory[]>([])
  const showUploadModal = ref(false)

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
      toast.error('Failed to download zip.')
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
            Clinical Dataset Repository
          </h1>
          
        </div>
        <p class="text-muted-foreground text-xs sm:text-sm">
          Contribute verified dermoscopic and smartphone lesion scans to enhance the AI diagnostic
          models.
        </p>        
      </div>

      <div class="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <AppButton
          variant="outline"
          class="flex-1 justify-center gap-2 text-xs font-bold sm:flex-none sm:text-sm"
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
          <div
            class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12"
          >
            <Icon
              name="lucide:sparkles"
              class="text-xl sm:text-2xl"
            />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-foreground text-base font-bold">Direct AI Dataset Contribution</h3>
              <AppBadge
                color="gray"
                size="sm"
                class="md:hidden"
              >
                {{ totalImagesCount }} images stored
              </AppBadge>
            </div>
            <p class="text-muted-foreground mt-0.5 max-w-xl text-xs">
              Upload verified clinical photos from your practice. Your contributions are included in
              automated model retraining safeguarded by the Validation Guard.
            </p>
          </div>
        </div>

        <div class="hidden shrink-0 items-center gap-2 md:flex">
          <AppBadge
            color="gray"
            size="md"
          >
            {{ totalImagesCount }} images stored
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
      <h3 class="text-foreground mb-1 text-lg font-bold">No images in dataset yet</h3>
      <p class="mx-auto mb-6 max-w-sm text-xs">
        Contribute your first clinical lesion images using the dropzone above.
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
            <h2 class="text-foreground text-base font-bold capitalize">
              {{ dataset.category }}
            </h2>
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
            class="gap-1.5 text-xs font-semibold"
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
          class="grid grid-cols-2 gap-3.5 p-4 sm:grid-cols-3 sm:gap-4 sm:p-6 md:grid-cols-4 lg:grid-cols-6"
        >
          <div
            v-for="(url, idx) in dataset.images"
            :key="idx"
            class="bg-muted border-border group relative aspect-square overflow-hidden rounded-2xl border"
          >
            <NuxtImg
              :src="getStorageUrl(url)"
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
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
