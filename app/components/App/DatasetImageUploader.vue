<script setup lang="ts">
import { ref, computed } from 'vue'
import { datasetService } from '~/api/dataset/DatasetService'
import { toast } from 'vue-sonner'

interface Props {
  defaultCategory?: string
  inline?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  defaultCategory: 'Acne',
  inline: false
})

const emit = defineEmits<{
  (e: 'uploaded', count: number): void
  (e: 'close'): void
}>()

const selectedCategory = ref(props.defaultCategory)
const selectedFiles = ref<File[]>([])
const filePreviews = ref<{ file: File; url: string }[]>([])
const isDragging = ref(false)
const isUploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const categories = [
  'Acne',
  'Eczema',
  'Herpes',
]

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const handleFiles = (files: FileList | null) => {
  if (!files || files.length === 0) return

  const validImages: File[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.type.startsWith('image/')) {
      validImages.push(file)
    }
  }

  if (validImages.length === 0) {
    toast.error('Please select valid image files (JPG, PNG, WebP).')
    return
  }

  selectedFiles.value = [...selectedFiles.value, ...validImages]
  
  // Create previews
  validImages.forEach((file) => {
    filePreviews.value.push({
      file,
      url: URL.createObjectURL(file)
    })
  })
}

const handleDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files) {
    handleFiles(e.dataTransfer.files)
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleFileInputChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  handleFiles(target.files)
  if (target) target.value = ''
}

const removeFile = (index: number) => {
  const removed = filePreviews.value.splice(index, 1)[0]
  if (removed?.url) {
    URL.revokeObjectURL(removed.url)
  }
  selectedFiles.value.splice(index, 1)
}

const clearAllFiles = () => {
  filePreviews.value.forEach((p) => URL.revokeObjectURL(p.url))
  filePreviews.value = []
  selectedFiles.value = []
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleUpload = async () => {
  if (selectedFiles.value.length === 0 || !selectedCategory.value) {
    toast.error('Please select a category and at least one image.')
    return
  }

  isUploading.value = true
  const count = selectedFiles.value.length

  try {
    if (selectedFiles.value.length === 1) {
      await datasetService.uploadImage(selectedFiles.value[0], selectedCategory.value)
    } else {
      await datasetService.uploadImages(selectedFiles.value, selectedCategory.value)
    }

    toast.success(`Successfully added ${count} image${count > 1 ? 's' : ''} to ${selectedCategory.value} dataset.`)
    clearAllFiles()
    emit('uploaded', count)
    emit('close')
  } catch (err: any) {
    console.error('Dataset upload failed:', err)
    toast.error(err.data?.message || err.message || 'Failed to upload images to dataset.')
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Category Selection -->
    <div>
      <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Target Disease Category
      </label>
      <div class="relative">
        <select
          v-model="selectedCategory"
          class="w-full px-4 py-3 rounded-2xl bg-background border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer pr-10"
        >
          <option v-for="cat in categories" :key="cat" :value="cat">
            {{ cat }}
          </option>
        </select>
        <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
          <Icon name="lucide:chevron-down" size="18" />
        </div>
      </div>
    </div>

    <!-- Drag and Drop Image Dropzone -->
    <div>
      <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Clinical Scan Images
      </label>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="handleFileInputChange"
      />

      <div
        class="border-2 border-dashed rounded-3xl p-6 md:p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center relative group"
        :class="isDragging ? 'border-primary bg-primary/10 scale-[0.99]' : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40'"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
          <Icon name="lucide:image-plus" size="28" />
        </div>
        <h4 class="font-bold text-foreground text-sm md:text-base">
          Drop clinical scan photos here, or <span class="text-primary underline underline-offset-2">browse</span>
        </h4>
        <p class="text-xs text-muted-foreground mt-1 max-w-sm">
          Supports single or multiple images (JPG, PNG, WebP). Directly contributes to AI dataset retraining.
        </p>
      </div>
    </div>

    <!-- Previews Grid -->
    <div v-if="filePreviews.length > 0" class="space-y-3 pt-2">
      <div class="flex items-center justify-between text-xs">
        <span class="font-semibold text-foreground">
          Selected Images ({{ filePreviews.length }})
        </span>
        <button
          type="button"
          class="text-destructive hover:underline text-[11px] font-medium cursor-pointer"
          @click="clearAllFiles"
        >
          Remove all
        </button>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-56 overflow-y-auto p-1 scrollbar-thin">
        <div
          v-for="(preview, idx) in filePreviews"
          :key="idx"
          class="relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border group"
        >
          <img :src="preview.url" class="w-full h-full object-cover" />
          <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
            <button
              type="button"
              class="self-end bg-destructive text-white p-1 rounded-full hover:scale-110 transition-transform cursor-pointer"
              title="Remove"
              @click.stop="removeFile(idx)"
            >
              <Icon name="lucide:x" size="14" />
            </button>
            <span class="text-[10px] text-white/90 truncate font-mono">
              {{ formatFileSize(preview.file.size) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-between pt-3 border-t border-border">
      <p class="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Icon name="lucide:shield-check" size="14" class="text-emerald-500" />
        Verified images will be stored in {{ selectedCategory }}
      </p>

      <div class="flex items-center gap-2">
        <AppButton v-if="!inline" variant="outline" @click="$emit('close')">
          Cancel
        </AppButton>

        <AppButton
          variant="solid"
          class="gap-2 shadow-sm"
          :disabled="selectedFiles.length === 0 || isUploading"
          :loading="isUploading"
          @click="handleUpload"
        >
          <Icon name="lucide:upload" size="16" />
          Upload {{ selectedFiles.length > 0 ? `${selectedFiles.length} Image${selectedFiles.length > 1 ? 's' : ''}` : 'to Dataset' }}
        </AppButton>
      </div>
    </div>
  </div>
</template>
