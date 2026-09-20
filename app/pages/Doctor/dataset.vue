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
    link.setAttribute('download', category ? `dataset_${category.toLowerCase()}.zip` : 'dataset_all.zip')
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
  <div class="space-y-8 pb-16">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <h1 class="text-2xl md:text-3xl font-black text-foreground">Clinical Dataset Repository</h1>
          <AppBadge color="primary" size="sm" variant="subtle">Doctor Contributor</AppBadge>
        </div>
        <p class="text-sm text-muted-foreground">
          Contribute verified dermoscopic and smartphone lesion scans to enhance the AI diagnostic models.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <AppButton variant="outline" class="gap-2" @click="downloadZip()">
          <Icon name="lucide:download" size="16" />
          Download All (ZIP)
        </AppButton>

        <AppButton variant="solid" class="gap-2 shadow-sm" @click="showUploadModal = true">
          <Icon name="lucide:image-plus" size="18" />
          Contribute Images
        </AppButton>
      </div>
    </div>

    <!-- Doctor Contribution Banner & Quick Uploader Box -->
    <div class="p-6 md:p-8 rounded-3xl bg-card border border-border shadow-sm space-y-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon name="lucide:sparkles" size="24" />
          </div>
          <div>
            <h3 class="font-bold text-base text-foreground">Direct AI Dataset Contribution</h3>
            <p class="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Upload verified clinical photos from your practice. Your contributions are included in automated model retraining safeguarded by the Validation Guard.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <AppBadge color="gray" size="md">
            {{ totalImagesCount }} images stored
          </AppBadge>
        </div>
      </div>

      <!-- Embedded Multi-Image Uploader Dropzone -->
      <div class="pt-2">
        <DatasetImageUploader inline @uploaded="handleUploadSuccess" />
      </div>
    </div>

    <!-- Dataset Categories List -->
    <div v-if="isLoading" class="flex justify-center items-center py-24">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="datasets.length === 0" class="text-center py-20 p-8 rounded-3xl bg-card border border-border text-muted-foreground">
      <Icon name="lucide:image-off" size="56" class="mx-auto mb-4 opacity-40" />
      <h3 class="text-lg font-bold text-foreground mb-1">No images in dataset yet</h3>
      <p class="text-xs max-w-sm mx-auto mb-6">Contribute your first clinical lesion images using the dropzone above.</p>
    </div>

    <div v-else class="space-y-8">
      <div
        v-for="dataset in datasets"
        :key="dataset.category"
        class="bg-card rounded-3xl shadow-sm border border-border overflow-hidden"
      >
        <div class="bg-muted/40 px-6 py-4 flex justify-between items-center border-b border-border">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-bold text-foreground capitalize">
              {{ dataset.category }}
            </h2>
            <AppBadge color="gray" size="sm">
              {{ dataset.images.length }} images
            </AppBadge>
          </div>

          <AppButton
            variant="outline"
            size="sm"
            class="gap-1.5"
            @click="downloadZip(dataset.category)"
          >
            <Icon name="lucide:download" size="14" />
            Download Category
          </AppButton>
        </div>

        <div class="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div
            v-for="(url, idx) in dataset.images"
            :key="idx"
            class="aspect-square rounded-2xl overflow-hidden bg-muted border border-border group relative"
          >
            <NuxtImg
              :src="getStorageUrl(url)"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
        <DatasetImageUploader @uploaded="handleUploadSuccess" @close="showUploadModal = false" />
      </div>
    </AppModal>
  </div>
</template>
