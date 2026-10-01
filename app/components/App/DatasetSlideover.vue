<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { datasetService, type DatasetCategory } from '~/api/dataset/DatasetService'
  import {
    outOfScopeDatasetService,
    type OutOfScopeDatasetCategory
  } from '~/api/dataset/OutOfScopeDatasetService'
  import { toast } from 'vue-sonner'

  const { getStorageUrl } = useStorage()

  const props = withDefaults(
    defineProps<{
      modelValue: boolean
      datasetType?: 'standard' | 'out_of_scope'
      initialCategory?: string | null
    }>(),
    {
      datasetType: 'standard',
      initialCategory: null
    }
  )

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    deleted: []
  }>()

  const isOpen = computed({
    get: () => props.modelValue,
    set: v => emit('update:modelValue', v)
  })

  // State
  const isLoading = ref(false)
  const isDeleting = ref(false)
  const dataset = ref<(DatasetCategory | OutOfScopeDatasetCategory)[]>([])
  const selectedUrls = ref<Set<string>>(new Set())
  const activeCategory = ref<string | null>(null)
  const showDeleteConfirm = ref(false)

  const close = () => {
    isOpen.value = false
  }

  const getActiveService = () => {
    return props.datasetType === 'out_of_scope' ? outOfScopeDatasetService : datasetService
  }

  const loadDataset = async () => {
    isLoading.value = true
    selectedUrls.value = new Set()
    try {
      const service = getActiveService()
      const data = await service.getDataset()
      dataset.value = data
      if (dataset.value.length > 0) {
        if (props.initialCategory) {
          const match = dataset.value.find(
            d => d.category.toLowerCase() === props.initialCategory?.toLowerCase()
          )
          activeCategory.value = match ? match.category : dataset.value[0].category
        } else if (!activeCategory.value) {
          activeCategory.value = dataset.value[0].category
        }
      }
    } catch {
      toast.error('Failed to load dataset images.')
    } finally {
      isLoading.value = false
    }
  }

  watch(isOpen, val => {
    if (val) {
      activeCategory.value = props.initialCategory ? props.initialCategory.toLowerCase() : null
      loadDataset()
    } else {
      selectedUrls.value = new Set()
    }
  })

  const activeCategoryData = computed(() =>
    dataset.value.find(d => d.category.toLowerCase() === activeCategory.value?.toLowerCase())
  )

  const totalImages = computed(() => dataset.value.reduce((acc, d) => acc + d.images.length, 0))

  const selectedCount = computed(() => selectedUrls.value.size)

  const isAllSelected = computed(() => {
    const imgs = activeCategoryData.value?.images ?? []
    return imgs.length > 0 && imgs.every(url => selectedUrls.value.has(url))
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
      imgs.forEach(url => next.delete(url))
    } else {
      imgs.forEach(url => next.add(url))
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
      const service = getActiveService()
      const res = await service.deleteImages(urlsToDelete)
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
    psoriasis: 'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20',
    ringworm: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    vitiligo: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
    melanoma: 'bg-red-500/10 text-red-600 border-red-500/20',
    hives: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    warts: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
    lupus: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    rosacea: 'bg-pink-500/10 text-pink-600 border-pink-500/20'
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
        class="bg-card border-border fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l shadow-2xl"
      >
        <!-- Header -->
        <div class="border-border flex shrink-0 items-center justify-between border-b px-6 py-4">
          <div class="flex items-center gap-3">
            <div
              class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl"
            >
              <Icon
                name="lucide:images"
                size="18"
              />
            </div>
            <div>
              <h2 class="text-foreground text-base font-bold">Dataset Browser</h2>
              <p class="text-muted-foreground text-xs">
                {{ totalImages.toLocaleString() }} images across {{ dataset.length }} categories
              </p>
            </div>
          </div>
          <button
            class="hover:bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
            @click="close"
          >
            <Icon
              name="lucide:x"
              size="16"
            />
          </button>
        </div>

        <!-- Category Tabs -->
        <div class="border-border flex shrink-0 gap-2 overflow-x-auto border-b px-6 pt-4 pb-3">
          <button
            v-for="cat in dataset"
            :key="cat.category"
            class="flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all"
            :class="
              activeCategory === cat.category
                ? getCategoryColor(cat.category) + ' ring-1 ring-current'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted border-transparent'
            "
            @click="activeCategory = cat.category"
          >
            {{ cat.category.charAt(0).toUpperCase() + cat.category.slice(1) }}
            <span
              class="bg-background text-foreground inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            >
              {{ cat.images.length }}
            </span>
          </button>
        </div>

        <!-- Action Bar -->
        <div
          v-if="activeCategoryData"
          class="bg-muted/30 border-border flex shrink-0 items-center justify-between gap-3 border-b px-6 py-2.5"
        >
          <div class="flex items-center gap-3">
            <label
              class="text-foreground flex cursor-pointer items-center gap-2 text-xs font-semibold"
            >
              <input
                type="checkbox"
                :checked="isAllSelected"
                class="border-border text-primary focus:ring-primary h-3.5 w-3.5 rounded"
                @change="toggleSelectAll"
              />
              Select All
            </label>

            <Transition name="fade">
              <span
                v-if="selectedCount > 0"
                class="text-muted-foreground text-xs"
              >
                {{ selectedCount }} selected
              </span>
            </Transition>
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="selectedCount > 0"
              class="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
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
              <Icon
                name="lucide:trash-2"
                size="13"
              />
              Delete {{ selectedCount }}
            </AppButton>
          </div>
        </div>

        <!-- Image Grid -->
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <!-- Loading -->
          <div
            v-if="isLoading"
            class="flex h-48 items-center justify-center"
          >
            <div class="flex flex-col items-center gap-3">
              <Icon
                name="lucide:loader-2"
                size="24"
                class="text-primary animate-spin"
              />
              <span class="text-muted-foreground text-sm">Loading dataset...</span>
            </div>
          </div>

          <!-- Empty state -->
          <div
            v-else-if="!activeCategoryData || activeCategoryData.images.length === 0"
            class="flex h-48 flex-col items-center justify-center text-center"
          >
            <div class="bg-muted mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
              <Icon
                name="lucide:image-off"
                size="22"
                class="text-muted-foreground"
              />
            </div>
            <p class="text-foreground text-sm font-semibold">No images found</p>
            <p class="text-muted-foreground mt-1 text-xs">
              This category has no uploaded images yet.
            </p>
          </div>

          <!-- Image grid -->
          <div
            v-else
            class="grid grid-cols-3 gap-3 sm:grid-cols-4"
          >
            <div
              v-for="url in activeCategoryData.images"
              :key="url"
              class="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-150"
              :class="
                selectedUrls.has(url)
                  ? 'border-primary shadow-primary/20 shadow-md'
                  : 'hover:border-border border-transparent'
              "
              @click="toggleImage(url)"
            >
              <NuxtImg
                :src="getStorageUrl(url)"
                :alt="activeCategory ?? 'dataset image'"
                class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy"
              />

              <!-- Selection overlay -->
              <div
                class="absolute inset-0 transition-all duration-150"
                :class="
                  selectedUrls.has(url) ? 'bg-primary/20' : 'bg-black/0 group-hover:bg-black/10'
                "
              />

              <!-- Checkbox tick -->
              <div
                class="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-150"
                :class="
                  selectedUrls.has(url)
                    ? 'bg-primary border-primary scale-110 text-white'
                    : 'border-white/60 bg-white/80 opacity-0 group-hover:opacity-100'
                "
              >
                <Icon
                  v-if="selectedUrls.has(url)"
                  name="lucide:check"
                  size="11"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="border-border bg-muted/20 flex shrink-0 items-center justify-between border-t px-6 py-3.5"
        >
          <span class="text-muted-foreground font-mono text-xs">
            {{ activeCategoryData?.images.length ?? 0 }} images in
            {{ activeCategory ?? '\u2014' }}
          </span>
          <button
            class="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-semibold transition-colors"
            @click="loadDataset"
          >
            <Icon
              name="lucide:refresh-cw"
              size="12"
            />
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
