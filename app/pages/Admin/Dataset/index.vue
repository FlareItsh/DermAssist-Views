<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue'
  import { datasetService, type DatasetCategory } from '~/api/dataset/DatasetService'
  import { DISEASE_DATABASE } from '~/composables/useDiagnosis'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const isLoading = ref(false)
  const isUploading = ref(false)
  const datasets = ref<DatasetCategory[]>([])
  
  const showUploadModal = ref(false)
  const uploadCategory = ref('')
  const uploadFile = ref<File | null>(null)
  
  const modalState = ref({
    isOpen: false,
    title: '',
    description: '',
    actionText: '',
    actionVariant: 'solid',
    onConfirm: () => {}
  })

  const categories = Object.keys(DISEASE_DATABASE)

  const fetchDataset = async () => {
    isLoading.value = true
    try {
      datasets.value = await datasetService.getDataset()
    } catch (e) {
      console.error('Failed to fetch dataset', e)
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
    } catch (e) {
      console.error('Upload failed', e)
      modalState.value = {
        isOpen: true,
        title: 'Upload Failed',
        description: 'There was an error uploading the image. Please try again.',
        actionText: 'Close',
        actionVariant: 'solid',
        onConfirm: () => { modalState.value.isOpen = false }
      }
    } finally {
      isUploading.value = false
    }
  }

  const deleteImage = (url: string) => {
    modalState.value = {
      isOpen: true,
      title: 'Delete Image',
      description: 'Are you sure you want to delete this image? This action cannot be undone.',
      actionText: 'Delete',
      actionVariant: 'destructive',
      onConfirm: async () => {
        modalState.value.isOpen = false
        try {
          await datasetService.deleteImage(url)
          await fetchDataset()
        } catch (e) {
          console.error('Failed to delete image', e)
          modalState.value = {
            isOpen: true,
            title: 'Delete Failed',
            description: 'Failed to delete the image.',
            actionText: 'Close',
            actionVariant: 'solid',
            onConfirm: () => { modalState.value.isOpen = false }
          }
        }
      }
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
    } catch (e) {
      console.error('Failed to download zip', e)
      modalState.value = {
        isOpen: true,
        title: 'Download Failed',
        description: 'Failed to download zip. It might be empty or there was a server error.',
        actionText: 'Close',
        actionVariant: 'solid',
        onConfirm: () => { modalState.value.isOpen = false }
      }
    }
  }

  onMounted(() => {
    fetchDataset()
  })
</script>

<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Dataset Gallery</h1>
      <div class="flex gap-4">
        <AppButton @click="downloadZip()" class="flex items-center gap-2">
          <Icon name="material-symbols:download" />
          Download All (ZIP)
        </AppButton>
        <AppButton @click="showUploadModal = true" class="flex items-center gap-2 bg-primary">
          <Icon name="material-symbols:upload" />
          Upload Image
        </AppButton>
      </div>
    </div>

    <div v-if="isLoading" class="flex justify-center items-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="datasets.length === 0" class="text-center py-20 text-gray-500">
      <Icon name="material-symbols:image-not-supported-outline" class="text-6xl mb-4 opacity-50" />
      <p class="text-xl">No images in the dataset yet.</p>
    </div>

    <div v-else class="space-y-12">
      <div v-for="dataset in datasets" :key="dataset.category" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="bg-gray-50 px-6 py-4 flex justify-between items-center border-b border-gray-100">
          <h2 class="text-xl font-semibold text-gray-800 capitalize">{{ dataset.category }} <span class="text-sm font-normal text-gray-500 ml-2">({{ dataset.images.length }} images)</span></h2>
          <AppButton variant="outline" size="sm" @click="downloadZip(dataset.category)" class="flex items-center gap-2">
            <Icon name="material-symbols:download" />
            Download Category
          </AppButton>
        </div>
        
        <div class="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div v-for="(url, idx) in dataset.images" :key="idx" class="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
            <img :src="url" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <button @click="deleteImage(url)" class="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transform hover:scale-110 transition-all shadow-lg">
                <Icon name="material-symbols:delete-outline" class="text-xl" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Modal -->
    <div v-if="showUploadModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div class="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
        <button @click="showUploadModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <Icon name="material-symbols:close" class="text-2xl" />
        </button>
        
        <h2 class="text-2xl font-bold mb-6 text-gray-900">Upload to Dataset</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select v-model="uploadCategory" class="w-full rounded-xl border-gray-300 shadow-sm focus:border-primary focus:ring-primary p-3 border">
              <option value="" disabled>Select disease category...</option>
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Image File</label>
            <input type="file" accept="image/*" @change="handleFileChange" class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
          </div>
        </div>
        
        <div class="mt-8 flex justify-end gap-3">
          <AppButton variant="outline" @click="showUploadModal = false">Cancel</AppButton>
          <AppButton :disabled="!uploadFile || !uploadCategory || isUploading" @click="uploadImage" class="min-w-[100px]">
            <span v-if="isUploading"><Icon name="material-symbols:sync" class="animate-spin" /></span>
            <span v-else>Upload</span>
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Confirmation / Alert Modal -->
    <AppModal
      v-model="modalState.isOpen"
      :title="modalState.title"
      :description="modalState.description"
      size="md"
    >
      <template #footer>
        <AppButton v-if="modalState.actionVariant === 'destructive'" variant="ghost" @click="modalState.isOpen = false">Cancel</AppButton>
        <AppButton :variant="modalState.actionVariant" @click="modalState.onConfirm">{{ modalState.actionText }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>
