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

  const totalImagesCount = computed(() => {
    return datasets.value.reduce((acc, cat) => acc + (cat.images?.length || 0), 0)
  })

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
        category ? `doctor_dataset_${category.toLowerCase()}.zip` : 'doctor_scans_all.zip'
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
            <h2 class="text-foreground text-base font-bold capitalize">
              {{ dataset.category }}
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
            v-for="(url, idx) in dataset.images"
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
          <span>No {{ dataset.category }} scans contributed by your account yet.</span>
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
