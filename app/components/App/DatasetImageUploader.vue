<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { datasetService } from '~/api/dataset/DatasetService'
  import {
    outOfScopeDatasetService,
    OUT_OF_SCOPE_CATEGORIES
  } from '~/api/dataset/OutOfScopeDatasetService'
  import { toast } from 'vue-sonner'

  interface Props {
    mode?: 'priority' | 'out_of_scope'
    defaultCategory?: string
    inline?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    mode: 'priority',
    defaultCategory: undefined,
    inline: false
  })

  const emit = defineEmits<{
    (e: 'uploaded', count: number): void
    (e: 'close'): void
  }>()

  const categories = computed(() => {
    return props.mode === 'out_of_scope' ? OUT_OF_SCOPE_CATEGORIES : ['Acne', 'Eczema', 'Herpes']
  })

  const selectedCategory = ref(
    props.defaultCategory || (props.mode === 'out_of_scope' ? 'Psoriasis' : 'Acne')
  )

  watch(
    () => props.mode,
    newMode => {
      if (!props.defaultCategory) {
        selectedCategory.value = newMode === 'out_of_scope' ? 'Psoriasis' : 'Acne'
      }
    }
  )

  watch(
    () => props.defaultCategory,
    newCat => {
      if (newCat) selectedCategory.value = newCat
    }
  )

  const selectedFiles = ref<File[]>([])
  const filePreviews = ref<{ file: File; url: string }[]>([])
  const isDragging = ref(false)
  const isUploading = ref(false)
  const fileInputRef = ref<HTMLInputElement | null>(null)

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
      if (props.mode === 'out_of_scope') {
        if (selectedFiles.value.length === 1) {
          await outOfScopeDatasetService.uploadImage(selectedFiles.value[0], selectedCategory.value)
        } else {
          await outOfScopeDatasetService.uploadImages(selectedFiles.value, selectedCategory.value)
        }
        toast.success(
          `Successfully added ${count} image${count > 1 ? 's' : ''} to ${selectedCategory.value} research dataset.`
        )
      } else {
        if (selectedFiles.value.length === 1) {
          await datasetService.uploadImage(selectedFiles.value[0], selectedCategory.value)
        } else {
          await datasetService.uploadImages(selectedFiles.value, selectedCategory.value)
        }
        toast.success(
          `Successfully added ${count} image${count > 1 ? 's' : ''} to ${selectedCategory.value} dataset.`
        )
      }

      clearAllFiles()
      emit('uploaded', count)
      emit('close')
    } catch (err: any) {
      console.error('Dataset upload failed:', err)
      toast.error(err.data?.message || err.message || 'Failed to upload images.')
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
        {{ mode === 'out_of_scope' ? 'Out-of-Scope Condition' : 'Target Disease Category' }}
      </label>
      <div class="relative">
        <select
          v-model="selectedCategory"
          class="bg-background border-border text-foreground w-full cursor-pointer appearance-none rounded-2xl border px-4 py-3 pr-10 text-sm font-medium focus:outline-none"
          :class="
            mode === 'out_of_scope'
              ? 'focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30'
              : 'focus:ring-primary focus:ring-2'
          "
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

      <!-- Empty dropzone -->
      <div
        v-if="filePreviews.length === 0"
        class="group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all"
        :class="
          isDragging
            ? mode === 'out_of_scope'
              ? 'scale-[0.99] border-violet-500 bg-violet-500/10'
              : 'border-primary bg-primary/10 scale-[0.99]'
            : mode === 'out_of_scope'
              ? 'border-border bg-muted/20 hover:bg-muted/40 hover:border-violet-500/50'
              : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
        "
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <div
          class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border transition-transform group-hover:scale-110"
          :class="
            mode === 'out_of_scope'
              ? 'border-violet-500/20 bg-violet-500/10 text-violet-600'
              : 'border-primary/20 bg-primary/10 text-primary'
          "
        >
          <Icon
            name="lucide:image-plus"
            size="32"
          />
        </div>
        <h4 class="text-foreground text-sm font-bold md:text-base">
          Drop clinical scan photos here, or
          <span
            :class="
              mode === 'out_of_scope'
                ? 'text-violet-600 underline underline-offset-2'
                : 'text-primary underline underline-offset-2'
            "
          >
            browse files
          </span>
        </h4>
        <p class="text-muted-foreground mt-1.5 max-w-xs text-xs">
          {{
            mode === 'out_of_scope'
              ? 'Supports JPG, PNG, WebP. Multiple files allowed. Saves to out-of-scope research dataset.'
              : 'Supports JPG, PNG, WebP. Multiple files allowed. Contributes directly to AI dataset retraining.'
          }}
        </p>
      </div>

      <!-- Dropzone with image previews (click to add more) -->
      <div
        v-else
        class="relative cursor-pointer rounded-3xl border-2 border-dashed p-3 transition-all"
        :class="
          isDragging
            ? mode === 'out_of_scope'
              ? 'scale-[0.99] border-violet-500 bg-violet-500/10'
              : 'border-primary bg-primary/10 scale-[0.99]'
            : mode === 'out_of_scope'
              ? 'border-violet-500/30 bg-violet-500/5 hover:border-violet-500/60'
              : 'border-primary/30 bg-primary/5 hover:border-primary/60'
        "
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <!-- Add more indicator -->
        <div
          class="mb-2 flex items-center gap-2 px-1 text-xs font-medium"
          :class="mode === 'out_of_scope' ? 'text-violet-600' : 'text-primary'"
        >
          <Icon
            name="lucide:plus-circle"
            size="13"
          />
          Click or drop to add more images
        </div>

        <!-- Preview grid -->
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          <div
            v-for="(preview, idx) in filePreviews"
            :key="idx"
            class="group/thumb bg-muted border-border relative aspect-square overflow-hidden rounded-xl border"
            @click.stop
          >
            <img
              :src="preview.url"
              class="h-full w-full object-cover"
            />
            <div
              class="absolute inset-0 flex flex-col justify-between bg-black/60 p-1.5 opacity-0 transition-opacity group-hover/thumb:opacity-100"
            >
              <button
                type="button"
                class="cursor-pointer self-end rounded-full bg-red-500 p-1 text-white transition-transform hover:scale-110"
                title="Remove"
                @click.stop="removeFile(idx)"
              >
                <Icon
                  name="lucide:x"
                  size="12"
                />
              </button>
              <span class="truncate font-mono text-[9px] text-white/90">
                {{ formatFileSize(preview.file.size) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="border-border flex items-center justify-between border-t pt-3">
      <div class="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <Icon
          :name="mode === 'out_of_scope' ? 'lucide:microscope' : 'lucide:shield-check'"
          size="14"
          :class="mode === 'out_of_scope' ? 'text-violet-600' : 'text-emerald-500'"
        />
        <span v-if="filePreviews.length > 0">
          {{ filePreviews.length }} image{{ filePreviews.length > 1 ? 's' : '' }} ready for
          <strong class="text-foreground">{{ selectedCategory }}</strong>
        </span>
        <span v-else>Select images to upload</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="filePreviews.length > 0"
          type="button"
          class="text-destructive cursor-pointer text-[11px] font-medium hover:underline"
          @click="clearAllFiles"
        >
          Clear all
        </button>

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
