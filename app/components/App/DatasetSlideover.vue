<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { datasetService, type DatasetCategory } from '~/api/dataset/DatasetService'
import { toast } from 'vue-sonner'

const { getStorageUrl } = useStorage()

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'deleted': []
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// State
const isLoading = ref(false)
const isDeleting = ref(false)
const dataset = ref<DatasetCategory[]>([])
const selectedUrls = ref<Set<string>>(new Set())
const activeCategory = ref<string | null>(null)
const showDeleteConfirm = ref(false)

const close = () => {
  isOpen.value = false
}

const loadDataset = async () => {
  isLoading.value = true
  selectedUrls.value = new Set()
  try {
    dataset.value = await datasetService.getDataset()
    if (dataset.value.length > 0 && !activeCategory.value) {
      activeCategory.value = dataset.value[0].category
    }
  } catch {
    toast.error('Failed to load dataset images.')
  } finally {
    isLoading.value = false
  }
}

watch(isOpen, (val) => {
  if (val) {
    activeCategory.value = null
    loadDataset()
  } else {
    selectedUrls.value = new Set()
  }
})

const activeCategoryData = computed(() =>
  dataset.value.find((d) => d.category === activeCategory.value)
)

const totalImages = computed(() =>
  dataset.value.reduce((acc, d) => acc + d.images.length, 0)
)

const selectedCount = computed(() => selectedUrls.value.size)

const isAllSelected = computed(() => {
  const imgs = activeCategoryData.value?.images ?? []
  return imgs.length > 0 && imgs.every((url) => selectedUrls.value.has(url))
})

const toggleImage = (url: string) => {
  const next = new Set(selectedUrls.value)
  if (next.has(url)) {
    next.delete(url)
  } else {
    next.add(url)
  }
  selectedUrls.value = next
}

const toggleSelectAll = () => {
  const imgs = activeCategoryData.value?.images ?? []
  const next = new Set(selectedUrls.value)
  if (isAllSelected.value) {
    imgs.forEach((url) => next.delete(url))
  } else {
    imgs.forEach((url) => next.add(url))
  }
  selectedUrls.value = next
}

const clearSelection = () => {
  selectedUrls.value = new Set()
}

const confirmDelete = () => {
  if (selectedUrls.value.size === 0) {
    return
  }
  showDeleteConfirm.value = true
}

const handleDelete = async () => {
  if (selectedUrls.value.size === 0) {
    return
  }

  isDeleting.value = true
  const urlsToDelete = [...selectedUrls.value]

  try {
    const res = await datasetService.deleteImages(urlsToDelete)
    toast.success(res.message || `${urlsToDelete.length} images deleted.`)
    showDeleteConfirm.value = false
    selectedUrls.value = new Set()
    emit('deleted')
    await loadDataset()
  } catch {
    toast.error('Failed to delete selected images.')
  } finally {
    isDeleting.value = false
  }
}

const categoryColor: Record<string, string> = {
  acne: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  eczema: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  herpes: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
}

const getCategoryColor = (cat: string) =>
  categoryColor[cat.toLowerCase()] ?? 'bg-primary/10 text-primary border-primary/20'
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
  <Transition name="backdrop">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40 bg-black/40"
      @click="close"
    />
  </Transition>

  <!-- Slideover Panel -->
  <Transition name="slideover">
    <div
      v-if="isOpen"
      class="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-card border-l border-border shadow-2xl"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon name="lucide:images" size="18" />
          </div>
          <div>
            <h2 class="font-bold text-base text-foreground">Dataset Browser</h2>
            <p class="text-xs text-muted-foreground">
              {{ totalImages.toLocaleString() }} images across {{ dataset.length }} categories
            </p>
          </div>
        </div>
        <button
          class="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
          @click="close"
        >
          <Icon name="lucide:x" size="16" />
        </button>
      </div>

      <!-- Category Tabs -->
      <div class="flex gap-2 px-6 pt-4 pb-3 border-b border-border shrink-0 overflow-x-auto">
        <button
          v-for="cat in dataset"
          :key="cat.category"
          class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap"
          :class="
            activeCategory === cat.category
              ? getCategoryColor(cat.category) + ' ring-1 ring-current'
              : 'bg-muted/60 text-muted-foreground border-transparent hover:bg-muted'
          "
          @click="activeCategory = cat.category"
        >
          {{ cat.category.charAt(0).toUpperCase() + cat.category.slice(1) }}
          <span class="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-background text-[10px] font-bold text-foreground">
            {{ cat.images.length }}
          </span>
        </button>
      </div>

      <!-- Action Bar -->
      <div
        v-if="activeCategoryData"
        class="flex items-center justify-between gap-3 px-6 py-2.5 bg-muted/30 border-b border-border shrink-0"
      >
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
            <input
              type="checkbox"
              :checked="isAllSelected"
              class="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
              @change="toggleSelectAll"
            />
            Select All
          </label>

          <Transition name="fade">
            <span v-if="selectedCount > 0" class="text-xs text-muted-foreground">
              {{ selectedCount }} selected
            </span>
          </Transition>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="selectedCount > 0"
            class="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            @click="clearSelection"
          >
            Clear
          </button>
          <AppButton
            v-if="selectedCount > 0"
            variant="destructive"
            size="sm"
            class="gap-1.5"
            @click="confirmDelete"
          >
            <Icon name="lucide:trash-2" size="13" />
            Delete {{ selectedCount }}
          </AppButton>
        </div>
      </div>

      <!-- Image Grid -->
      <div class="flex-1 overflow-y-auto px-6 py-4">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center h-48">
          <div class="flex flex-col items-center gap-3">
            <Icon name="lucide:loader-2" size="24" class="text-primary animate-spin" />
            <span class="text-sm text-muted-foreground">Loading dataset...</span>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="!activeCategoryData || activeCategoryData.images.length === 0"
          class="flex flex-col items-center justify-center h-48 text-center"
        >
          <div class="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Icon name="lucide:image-off" size="22" class="text-muted-foreground" />
          </div>
          <p class="text-sm font-semibold text-foreground">No images found</p>
          <p class="text-xs text-muted-foreground mt-1">This category has no uploaded images yet.</p>
        </div>

        <!-- Image grid -->
        <div
          v-else
          class="grid grid-cols-3 sm:grid-cols-4 gap-3"
        >
          <div
            v-for="url in activeCategoryData.images"
            :key="url"
            class="relative group rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-150 aspect-square"
            :class="selectedUrls.has(url) ? 'border-primary shadow-md shadow-primary/20' : 'border-transparent hover:border-border'"
            @click="toggleImage(url)"
          >
            <NuxtImg
              :src="getStorageUrl(url)"
              :alt="activeCategory ?? 'dataset image'"
              class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />

            <!-- Selection overlay -->
            <div
              class="absolute inset-0 transition-all duration-150"
              :class="selectedUrls.has(url) ? 'bg-primary/20' : 'bg-black/0 group-hover:bg-black/10'"
            />

            <!-- Checkbox tick -->
            <div
              class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150 border-2"
              :class="
                selectedUrls.has(url)
                  ? 'bg-primary border-primary text-white scale-110'
                  : 'bg-white/80 border-white/60 opacity-0 group-hover:opacity-100'
              "
            >
              <Icon v-if="selectedUrls.has(url)" name="lucide:check" size="11" />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3.5 border-t border-border shrink-0 flex items-center justify-between bg-muted/20">
        <span class="text-xs text-muted-foreground font-mono">
          {{ activeCategoryData?.images.length ?? 0 }} images in
          {{ activeCategory ?? '\u2014' }}
        </span>
        <button
          class="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          @click="loadDataset"
        >
          <Icon name="lucide:refresh-cw" size="12" />
          Refresh
        </button>
      </div>
    </div>
  </Transition>
  </Teleport>

  <!-- Delete Confirmation Modal -->
  <AppModalConfirmation
    v-model="showDeleteConfirm"
    title="Delete Selected Images?"
    :description="`You are about to permanently delete ${selectedCount} image${selectedCount === 1 ? '' : 's'} from the dataset. This cannot be undone.`"
    icon="lucide:trash-2"
    icon-color="danger"
    confirm-text="Delete Images"
    cancel-text="Cancel"
    confirm-variant="destructive"
    :loading="isDeleting"
    @confirm="handleDelete"
  />
</template>

<style scoped>
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.25s ease;
}
.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

.slideover-enter-active,
.slideover-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slideover-enter-from,
.slideover-leave-to {
  transform: translateX(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>