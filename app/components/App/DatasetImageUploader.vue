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

  const categories = ['Acne', 'Eczema', 'Herpes']

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
    validImages.forEach(file => {
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
    filePreviews.value.forEach(p => URL.revokeObjectURL(p.url))
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

      toast.success(
        `Successfully added ${count} image${count > 1 ? 's' : ''} to ${selectedCategory.value} dataset.`
      )
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
      <label
        class="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase"
      >
        Target Disease Category
      </label>
      <div class="relative">
        <select
          v-model="selectedCategory"
          class="bg-background border-border text-foreground focus:ring-primary w-full cursor-pointer appearance-none rounded-2xl border px-4 py-3 pr-10 text-sm font-medium focus:ring-2 focus:outline-none"
        >
          <option
            v-for="cat in categories"
            :key="cat"
            :value="cat"
          >
            {{ cat }}
          </option>
        </select>
        <div
          class="text-muted-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
        >
          <Icon
            name="lucide:chevron-down"
            size="18"
          />
        </div>
      </div>
    </div>

    <!-- Drag and Drop Image Dropzone -->
    <div>
      <label
        class="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase"
      >
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
        class="group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition-all md:p-8"
        :class="
          isDragging
            ? 'border-primary bg-primary/10 scale-[0.99]'
            : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
        "
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <div
          class="bg-primary/10 text-primary mb-3 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
        >
          <Icon
            name="lucide:image-plus"
            size="28"
          />
        </div>
        <h4 class="text-foreground text-sm font-bold md:text-base">
          Drop clinical scan photos here, or
          <span class="text-primary underline underline-offset-2">browse</span>
        </h4>
        <p class="text-muted-foreground mt-1 max-w-sm text-xs">
          Supports single or multiple images (JPG, PNG, WebP). Directly contributes to AI dataset
          retraining.
        </p>
      </div>
    </div>

    <!-- Previews Grid -->
    <div
      v-if="filePreviews.length > 0"
      class="space-y-3 pt-2"
    >
      <div class="flex items-center justify-between text-xs">
        <span class="text-foreground font-semibold">
          Selected Images ({{ filePreviews.length }})
        </span>
        <button
          type="button"
          class="text-destructive cursor-pointer text-[11px] font-medium hover:underline"
          @click="clearAllFiles"
        >
          Remove all
        </button>
      </div>

      <div
        class="scrollbar-thin grid max-h-56 grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4"
      >
        <div
          v-for="(preview, idx) in filePreviews"
          :key="idx"
          class="bg-muted border-border group relative aspect-square overflow-hidden rounded-2xl border"
        >
          <img
            :src="preview.url"
            class="h-full w-full object-cover"
          />
          <div
            class="absolute inset-0 flex flex-col justify-between bg-black/60 p-2 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <button
              type="button"
              class="bg-destructive cursor-pointer self-end rounded-full p-1 text-white transition-transform hover:scale-110"
              title="Remove"
              @click.stop="removeFile(idx)"
            >
              <Icon
                name="lucide:x"
                size="14"
              />
            </button>
            <span class="truncate font-mono text-[10px] text-white/90">
              {{ formatFileSize(preview.file.size) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="border-border flex items-center justify-between border-t pt-3">
      <p class="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <Icon
          name="lucide:shield-check"
          size="14"
          class="text-emerald-500"
        />
        Verified images will be stored in {{ selectedCategory }}
      </p>

      <div class="flex items-center gap-2">
        <AppButton
          v-if="!inline"
          variant="outline"
          @click="$emit('close')"
        >
          Cancel
        </AppButton>

        <AppButton
          variant="solid"
          class="gap-2 shadow-sm"
          :disabled="selectedFiles.length === 0 || isUploading"
          :loading="isUploading"
          @click="handleUpload"
        >
          <Icon
            name="lucide:upload"
            size="16"
          />
          Upload
          {{
            selectedFiles.length > 0
              ? `${selectedFiles.length} Image${selectedFiles.length > 1 ? 's' : ''}`
              : 'to Dataset'
          }}
        </AppButton>
      </div>
    </div>
  </div>
</template>
