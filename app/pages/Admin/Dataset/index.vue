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
const isUploading = ref(false)
const isDeleting = ref(false)
const datasets = ref<DatasetCategory[]>([])

const showUploadModal = ref(false)
const uploadCategory = ref('')
const uploadFile = ref<File | null>(null)

const showDeleteConfirm = ref(false)
const imageToDelete = ref<string | null>(null)

const categories = [
  'Acne',
  'Eczema',
  'Herpes',
]

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

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    uploadFile.value = target.files[0]
  }
}

const uploadImage = async () => {
  if (!uploadFile.value || !uploadCategory.value) return
  isUploading.value = true
  try {
    await datasetService.uploadImage(uploadFile.value, uploadCategory.value)
    await fetchDataset()
    showUploadModal.value = false
    uploadFile.value = null
    uploadCategory.value = ''
    toast.success('Image successfully added to dataset.')
  } catch (e) {
    console.error('Upload failed', e)
    toast.error('Failed to upload image.')
  } finally {
    isUploading.value = false
  }
}

const promptDeleteImage = (url: string) => {
  imageToDelete.value = url
  showDeleteConfirm.value = true
}

const handleConfirmDelete = async () => {
  if (!imageToDelete.value) return
  isDeleting.value = true
  try {
    await datasetService.deleteImage(imageToDelete.value)
    await fetchDataset()
    toast.success('Image removed from dataset.')
    showDeleteConfirm.value = false
    imageToDelete.value = null
  } catch (e) {
    console.error('Failed to delete image', e)
    toast.error('Failed to delete image.')
  } finally {
    isDeleting.value = false
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
    toast.error('Failed to download zip. It might be empty or unavailable.')
  }
}

onMounted(() => {
  fetchDataset()
})
</script>

<template>
  <div class="space-y-8 pb-12">
    <!-- Page Header Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-black text-foreground">Dataset Gallery</h1>
        <p class="text-sm text-muted-foreground mt-1">
          Clinical skin scan repository and diagnostic model retraining pipeline.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <AppButton variant="outline" class="gap-2" @click="downloadZip()">
          <Icon name="lucide:download" size="16" />
          Download All (ZIP)
        </AppButton>

        <AppButton variant="outline" class="gap-2" @click="showUploadModal = true">
          <Icon name="lucide:upload" size="16" />
          Upload Image
        </AppButton>

        <AppButton variant="solid" to="/admin/ai" class="gap-2 shadow-sm">
          <Icon name="lucide:brain-circuit" size="18" />
          AI Models Center
        </AppButton>
      </div>
    </div>

    <!-- AI Intelligence & Retrain Banner -->
    <div class="p-6 rounded-3xl bg-card border border-border shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative overflow-hidden">
      <div class="flex items-start gap-4">
        <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
          <Icon name="lucide:sparkles" size="28" />
        </div>
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-lg font-bold text-foreground">Continuous Learning & Model Fine-Tuning</h3>
            <AppBadge color="success" size="sm" variant="subtle">Validation Guard Active</AppBadge>
          </div>
          <p class="text-xs md:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            You currently have <span class="font-bold text-foreground">{{ totalImagesCount }} clinical images</span> stored across active categories. Retraining integrates real-world smartphone scans into the baseline AI models while safeguarding existing diagnostic accuracy.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3 shrink-0 w-full lg:w-auto">
        <AppButton variant="solid" size="md" to="/admin/ai" class="gap-2 w-full lg:w-auto">
          <Icon name="lucide:cpu" size="18" />
          Open AI Models Center
        </AppButton>
      </div>
    </div>

    <!-- Gallery Loading State -->
    <div v-if="isLoading" class="flex justify-center items-center py-24">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="datasets.length === 0" class="text-center py-20 p-8 rounded-3xl bg-card border border-border text-muted-foreground">
      <Icon name="lucide:image-off" size="56" class="mx-auto mb-4 opacity-40" />
      <h3 class="text-lg font-bold text-foreground mb-1">No images in the dataset yet</h3>
      <p class="text-xs max-w-sm mx-auto mb-6">Upload clinical images or collect scan photos from completed diagnoses to populate the gallery.</p>
      <AppButton variant="solid" class="gap-2" @click="showUploadModal = true">
        <Icon name="lucide:upload" size="16" />
        Upload First Image
      </AppButton>
    </div>

    <!-- Gallery Categories -->
    <div v-else class="space-y-8">
      <div
        v-for="dataset in datasets"
        :key="dataset.category"
        class="bg-card rounded-2xl shadow-sm border border-border overflow-hidden"
      >
        <div class="bg-muted/40 px-6 py-4 flex justify-between items-center border-b border-border">
          <div class="flex items-center gap-2">
            <h2 class="text-base md:text-lg font-bold text-foreground capitalize">
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
            class="relative group aspect-square rounded-xl overflow-hidden bg-muted border border-border"
          >
            <NuxtImg
              :src="getStorageUrl(url)"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div
              class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
            >
              <button
                type="button"
                class="bg-destructive text-white p-2.5 rounded-full hover:opacity-90 transform hover:scale-110 transition-all shadow-lg cursor-pointer"
                title="Delete Image"
                @click="promptDeleteImage(url)"
              >
                <Icon name="lucide:trash-2" size="18" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Image Modal -->
    <AppModal
      v-model="showUploadModal"
      title="Upload to Dataset"
      description="Add a verified skin scan image to the training collection."
      size="md"
    >
      <div class="space-y-4 pt-2">
        <div>
          <label class="block text-xs font-semibold text-muted-foreground mb-1.5">Disease Category</label>
          <select
            v-model="uploadCategory"
            class="w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground focus:border-primary focus:ring-primary focus:outline-none"
          >
            <option value="" disabled>Select category...</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-muted-foreground mb-1.5">Image File</label>
          <input
            type="file"
            accept="image/*"
            class="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
            @change="handleFileChange"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3 w-full pt-2">
          <AppButton variant="outline" @click="showUploadModal = false">Cancel</AppButton>
          <AppButton
            variant="solid"
            :disabled="!uploadFile || !uploadCategory || isUploading"
            :loading="isUploading"
            @click="uploadImage"
          >
            Upload Image
          </AppButton>
        </div>
      </template>
    </AppModal>

    <!-- Standard Delete Confirmation Dialog -->
    <AppModalConfirmation
      v-model="showDeleteConfirm"
      title="Delete Image from Dataset?"
      description="Are you sure you want to remove this image from the training collection? This action cannot be undone."
      icon="lucide:trash-2"
      icon-color="danger"
      confirm-text="Delete Image"
      cancel-text="Keep Image"
      confirm-variant="destructive"
      :loading="isDeleting"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>
