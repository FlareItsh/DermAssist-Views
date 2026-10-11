<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import {
    modelTrainingService,
    type TrainingImageItem,
    type TrainingImagesResponse
  } from '~/api/modelTraining/ModelTrainingService'
  import { toast } from 'vue-sonner'

  const { getStorageUrl } = useStorage()

  interface Props {
    modelValue: boolean
    initialCategory?: string | null
    initialSelectedUuids?: string[]
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    initialCategory: null,
    initialSelectedUuids: () => []
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'confirm', selectedUuids: string[]): void
  }>()

  const isOpen = computed({
    get: () => props.modelValue,
    set: val => emit('update:modelValue', val)
  })

  // State
  const isLoading = ref(false)
  const images = ref<TrainingImageItem[]>([])
  const selectedUuids = ref<Set<string>>(new Set())
  const activeCategory = ref<string>('all')
  const activeStatusFilter = ref<'all' | 'tangible' | 'intangible'>('all')
  const searchQuery = ref('')
  const categoryCounts = ref<Record<string, number>>({})
  const tangibleCount = ref(0)
  const intangibleCount = ref(0)

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'acne', label: 'Acne' },
    { id: 'eczema', label: 'Eczema' },
    { id: 'herpes', label: 'Herpes' }
  ]

  const statusFilters = [
    { id: 'all', label: 'All Images' },
    { id: 'tangible', label: 'Ready to Train' },
    { id: 'intangible', label: 'Already in Dataset (Locked)' }
  ]

  const close = () => {
    isOpen.value = false
  }

  const loadImages = async () => {
    isLoading.value = true
    try {
      const res: any = await modelTrainingService.getTrainingImages()
      const rawImages: TrainingImageItem[] = res.images || res.data || []
      images.value = rawImages
      tangibleCount.value = res.tangible_count ?? res.summary?.tangible_count ?? 0
      intangibleCount.value = res.intangible_count ?? res.summary?.intangible_count ?? 0
      categoryCounts.value = res.by_category ?? {
        acne: rawImages.filter(i => i.category.toLowerCase() === 'acne').length,
        eczema: rawImages.filter(i => i.category.toLowerCase() === 'eczema').length,
        herpes: rawImages.filter(i => i.category.toLowerCase() === 'herpes').length
      }

      // Preserve or initialize selections (strictly for tangible images only)
      if (props.initialSelectedUuids && props.initialSelectedUuids.length > 0) {
        const tangibleSet = new Set(
          images.value.filter(img => img.is_tangible).map(img => img.uuid)
        )
        const validSelections = props.initialSelectedUuids.filter(uuid => tangibleSet.has(uuid))
        selectedUuids.value = new Set(validSelections)
      } else {
        // By default, select all tangible scans ready to be trained
        const tangibleUuids = images.value.filter(img => img.is_tangible).map(img => img.uuid)
        selectedUuids.value = new Set(tangibleUuids)
      }
    } catch (err) {
      console.error('Failed to load candidate training images:', err)
      toast.error('Failed to load candidate training images.')
    } finally {
      isLoading.value = false
    }
  }

  watch(
    () => props.modelValue,
    val => {
      if (val) {
        activeCategory.value = props.initialCategory ? props.initialCategory.toLowerCase() : 'all'
        activeStatusFilter.value = 'all'
        searchQuery.value = ''
        loadImages()
      }
    }
  )

  // Filtered dataset
  const filteredImages = computed(() => {
    return images.value.filter(img => {
      // Category filter
      if (
        activeCategory.value !== 'all' &&
        img.category.toLowerCase() !== activeCategory.value.toLowerCase()
      ) {
        return false
      }

      // Status filter
      if (activeStatusFilter.value === 'tangible' && !img.is_tangible) {
        return false
      }
      if (activeStatusFilter.value === 'intangible' && img.is_tangible) {
        return false
      }

      // Search query
      if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase()
        const nameMatch = (img.original_name || img.file_name || '').toLowerCase().includes(query)
        const catMatch = img.category.toLowerCase().includes(query)
        const uuidMatch = img.uuid.toLowerCase().includes(query)
        if (!nameMatch && !catMatch && !uuidMatch) return false
      }

      return true
    })
  })

  // Tangible items within current filtered view
  const tangibleInView = computed(() => filteredImages.value.filter(img => img.is_tangible))

  // Tangible items across entire dataset
  const allTangible = computed(() => images.value.filter(img => img.is_tangible))

  // Are all tangible items in view currently selected?
  const isAllInViewSelected = computed(() => {
    if (tangibleInView.value.length === 0) return false
    return tangibleInView.value.every(img => selectedUuids.value.has(img.uuid))
  })

  // Selected tangible count
  const selectedCount = computed(() => {
    return selectedUuids.value.size
  })

  const toggleImageSelection = (img: TrainingImageItem) => {
    // STRICT TANGIBILITY CONSTRAINT: If intangible (in raw or local storage), refuse selection
    if (!img.is_tangible) {
      toast.info('This image is already stored in the training dataset and cannot be re-added.')
      return
    }

    const next = new Set(selectedUuids.value)
    if (next.has(img.uuid)) {
      next.delete(img.uuid)
    } else {
      next.add(img.uuid)
    }
    selectedUuids.value = next
  }

  const toggleSelectAllTangibleInView = () => {
    const next = new Set(selectedUuids.value)
    if (isAllInViewSelected.value) {
      // Unselect all tangible in view
      tangibleInView.value.forEach(img => next.delete(img.uuid))
    } else {
      // Select all tangible in view (strictly skip intangibles)
      tangibleInView.value.forEach(img => next.add(img.uuid))
    }
    selectedUuids.value = next
  }

  const selectAllTangible = () => {
    const next = new Set<string>()
    allTangible.value.forEach(img => next.add(img.uuid))
    selectedUuids.value = next
    toast.success(`Selected all ${allTangible.value.length} ready scans.`)
  }

  const clearSelection = () => {
    selectedUuids.value = new Set()
  }

  const handleConfirm = () => {
    const chosen = Array.from(selectedUuids.value)
    emit('confirm', chosen)
    emit('update:modelValue', false)
  }

  const formatCategoryBadge = (cat: string) => {
    const lower = (cat || '').toLowerCase()
    if (lower === 'acne') return { label: 'Acne', color: 'primary' as const }
    if (lower === 'eczema') return { label: 'Eczema', color: 'info' as const }
    if (lower === 'herpes') return { label: 'Herpes', color: 'warning' as const }
    return { label: cat, color: 'gray' as const }
  }

  const resolveImageUrl = (img: TrainingImageItem) => {
    if (img.image_url) return img.image_url
    return getStorageUrl(img.file_name)
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-100 flex items-center justify-center p-3 sm:p-6"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"></div>

        <!-- Modal Box -->
        <div
          class="modal-container bg-card border-border relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border shadow-2xl transition-all"
        >
          <!-- Header -->
          <div
            class="border-border bg-card/95 relative z-10 flex shrink-0 items-start justify-between border-b px-6 py-5 backdrop-blur-sm sm:px-8"
          >
            <div>
              <div class="flex items-center gap-2.5">
                <div
                  class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl"
                >
                  <Icon
                    name="lucide:check-square"
                    size="20"
                  />
                </div>
                <div>
                  <h3 class="text-foreground text-lg font-bold sm:text-xl">
                    Select Training Images
                  </h3>
                  <p class="text-muted-foreground mt-0.5 text-xs">
                    Choose candidate clinical scans to ingest into the training dataset.
                  </p>
                </div>
              </div>

              <!-- Tangibility Summary Badges -->
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  <Icon
                    name="lucide:sparkles"
                    size="13"
                  />
                  {{ tangibleCount }} Ready to Train (Tangible)
                </span>
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2.5 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                >
                  <Icon
                    name="lucide:lock"
                    size="13"
                  />
                  {{ intangibleCount }} Already in Dataset (Intangible)
                </span>
                <span
                  v-if="selectedCount > 0"
                  class="bg-primary/10 text-primary border-primary/30 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold"
                >
                  <Icon
                    name="lucide:check"
                    size="13"
                  />
                  {{ selectedCount }} of {{ allTangible.length }} Selected
                </span>
              </div>
            </div>

            <!-- Close Button -->
            <AppButton
              variant="ghost"
              size="icon"
              class="hover:bg-foreground/5 text-muted-foreground hover:text-foreground rounded-full"
              @click="close"
            >
              <Icon
                name="lucide:x"
                class="h-5 w-5"
              />
            </AppButton>
          </div>

          <!-- Controls Bar (Tabs, Filter, Search) -->
          <div class="border-border bg-muted/20 shrink-0 space-y-3 border-b px-6 py-3.5 sm:px-8">
            <!-- Category Tabs & Status Filter Row -->
            <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <!-- Category Tabs -->
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  v-for="cat in categories"
                  :key="cat.id"
                  type="button"
                  class="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
                  :class="
                    activeCategory === cat.id
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-card text-muted-foreground hover:text-foreground border-border border'
                  "
                  @click="activeCategory = cat.id"
                >
                  <span>{{ cat.label }}</span>
                  <span
                    class="py-0.2 rounded-full px-1.5 text-[10px] font-bold"
                    :class="
                      activeCategory === cat.id
                        ? 'bg-white/20 text-white'
                        : 'bg-muted text-muted-foreground'
                    "
                  >
                    {{
                      cat.id === 'all'
                        ? images.length
                        : (categoryCounts[cat.id] ??
                          images.filter(i => i.category.toLowerCase() === cat.id).length)
                    }}
                  </span>
                </button>
              </div>

              <!-- Search Bar -->
              <div class="relative w-full sm:w-64">
                <Icon
                  name="lucide:search"
                  size="14"
                  class="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
                />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search scans..."
                  class="bg-card border-border text-foreground placeholder:text-muted-foreground focus:ring-primary w-full rounded-xl border py-1.5 pr-3 pl-8 text-xs focus:ring-2 focus:outline-none"
                />
                <button
                  v-if="searchQuery"
                  type="button"
                  class="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                  @click="searchQuery = ''"
                >
                  <Icon
                    name="lucide:x"
                    size="12"
                  />
                </button>
              </div>
            </div>

            <!-- Status Filter and Bulk Action Buttons -->
            <div class="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <div class="flex items-center gap-1.5 text-xs">
                <span class="text-muted-foreground font-medium">Filter:</span>
                <button
                  v-for="flt in statusFilters"
                  :key="flt.id"
                  type="button"
                  class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
                  :class="
                    activeStatusFilter === flt.id
                      ? 'bg-foreground/10 text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="activeStatusFilter = flt.id as any"
                >
                  {{ flt.label }}
                </button>
              </div>

              <!-- Quick Tangible Selection Helpers -->
              <div class="flex items-center gap-2">
                <AppButton
                  variant="outline"
                  size="sm"
                  class="h-7 gap-1.5 text-xs"
                  :disabled="tangibleInView.length === 0"
                  @click="toggleSelectAllTangibleInView"
                >
                  <Icon
                    :name="isAllInViewSelected ? 'lucide:check-square' : 'lucide:square'"
                    size="13"
                  />
                  {{
                    isAllInViewSelected
                      ? 'Unselect View'
                      : `Select Ready in View (${tangibleInView.length})`
                  }}
                </AppButton>

                <AppButton
                  v-if="selectedCount > 0"
                  variant="ghost"
                  size="sm"
                  class="text-muted-foreground hover:text-foreground h-7 text-xs"
                  @click="clearSelection"
                >
                  Clear ({{ selectedCount }})
                </AppButton>

                <AppButton
                  v-else
                  variant="ghost"
                  size="sm"
                  class="text-primary h-7 text-xs font-semibold"
                  :disabled="allTangible.length === 0"
                  @click="selectAllTangible"
                >
                  Select All Ready ({{ allTangible.length }})
                </AppButton>
              </div>
            </div>
          </div>

          <!-- Body: Image Gallery Grid -->
          <div class="flex-1 overflow-y-auto p-6 sm:p-8">
            <!-- Loading State -->
            <div
              v-if="isLoading"
              class="flex flex-col items-center justify-center py-16 text-center"
            >
              <Icon
                name="lucide:loader-2"
                size="36"
                class="text-primary animate-spin"
              />
              <p class="text-muted-foreground mt-3 text-sm font-medium">
                Scanning dataset & checking storage tangibility...
              </p>
            </div>

            <!-- Empty State -->
            <div
              v-else-if="filteredImages.length === 0"
              class="flex flex-col items-center justify-center py-16 text-center"
            >
              <div
                class="bg-muted text-muted-foreground flex h-16 w-16 items-center justify-center rounded-3xl"
              >
                <Icon
                  name="lucide:image-off"
                  size="28"
                />
              </div>
              <h4 class="text-foreground mt-4 text-base font-bold">No images found</h4>
              <p class="text-muted-foreground mt-1 max-w-sm text-xs">
                {{
                  searchQuery
                    ? 'No scans match your search query or filter.'
                    : 'No clinical scans available in this category.'
                }}
              </p>
            </div>

            <!-- Image Cards Grid -->
            <div
              v-else
              class="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              <div
                v-for="img in filteredImages"
                :key="img.uuid"
                class="group bg-card border-border relative flex flex-col overflow-hidden rounded-2xl border transition-all select-none"
                :class="{
                  'ring-primary border-primary bg-primary/5 shadow-md ring-2':
                    img.is_tangible && selectedUuids.has(img.uuid),
                  'hover:border-foreground/20 cursor-pointer hover:shadow-xs': img.is_tangible,
                  'bg-muted/40 cursor-not-allowed opacity-50': !img.is_tangible
                }"
                @click="toggleImageSelection(img)"
              >
                <!-- Thumbnail Image Container -->
                <div class="bg-muted relative aspect-square w-full overflow-hidden">
                  <img
                    :src="resolveImageUrl(img)"
                    :alt="img.original_name || img.file_name"
                    class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  <!-- Selection Checkbox (Top Left) -->
                  <div
                    v-if="img.is_tangible"
                    class="absolute top-2 left-2 z-10"
                  >
                    <div
                      class="flex h-6 w-6 items-center justify-center rounded-lg transition-all"
                      :class="
                        selectedUuids.has(img.uuid)
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border border-white/20 bg-black/40 text-white/70 backdrop-blur-xs'
                      "
                    >
                      <Icon
                        v-if="selectedUuids.has(img.uuid)"
                        name="lucide:check"
                        size="14"
                        class="stroke-3"
                      />
                    </div>
                  </div>

                  <!-- Intangible Lock Icon Overlay (Top Left) -->
                  <div
                    v-else
                    class="absolute top-2 left-2 z-10"
                  >
                    <div
                      class="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900/80 text-zinc-300 shadow-sm backdrop-blur-xs"
                      title="Stored in Training Dataset (Locked)"
                    >
                      <Icon
                        name="lucide:lock"
                        size="13"
                      />
                    </div>
                  </div>

                  <!-- Category Badge (Top Right) -->
                  <div class="absolute top-2 right-2 z-10">
                    <AppBadge
                      :color="formatCategoryBadge(img.category).color"
                      size="xs"
                      variant="solid"
                      class="text-[10px] font-bold uppercase shadow-xs backdrop-blur-xs"
                    >
                      {{ formatCategoryBadge(img.category).label }}
                    </AppBadge>
                  </div>

                  <!-- Intangible Dark Overlay Warning -->
                  <div
                    v-if="!img.is_tangible"
                    class="absolute inset-0 flex flex-col items-center justify-center bg-black/45 p-2 text-center backdrop-blur-[1px]"
                  >
                    <Icon
                      name="lucide:shield-check"
                      size="20"
                      class="text-white/80 drop-shadow-sm"
                    />
                    <span class="mt-1 text-[11px] font-bold text-white drop-shadow-sm">
                      {{ img.is_in_raw ? 'In Raw Dataset' : 'In Local Storage' }}
                    </span>
                    <span class="text-[9px] font-medium text-white/75 drop-shadow-sm">
                      Already Ingested
                    </span>
                  </div>
                </div>

                <!-- Footer Card Info -->
                <div class="flex flex-col justify-between p-2.5 text-xs">
                  <div class="flex items-center justify-between gap-1">
                    <span class="text-foreground truncate font-mono text-[11px] font-semibold">
                      {{ img.original_name || img.file_name.substring(0, 14) + '...' }}
                    </span>
                  </div>

                  <div class="mt-1 flex items-center justify-between text-[10px]">
                    <!-- Tangible status -->
                    <span
                      v-if="img.is_tangible"
                      class="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400"
                    >
                      <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      Ready to Train
                    </span>

                    <!-- Intangible status -->
                    <span
                      v-else
                      class="text-muted-foreground inline-flex items-center gap-1 font-mono font-medium"
                    >
                      <Icon
                        name="lucide:lock"
                        size="10"
                      />
                      Locked
                    </span>

                    <span
                      v-if="img.created_at"
                      class="text-muted-foreground font-mono"
                    >
                      {{ new Date(img.created_at).toLocaleDateString() }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Action Bar -->
          <div
            class="border-border bg-card/95 relative z-10 flex shrink-0 flex-col justify-between gap-3 border-t px-6 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:px-8"
          >
            <!-- Summary Info -->
            <div class="text-muted-foreground flex items-center gap-2 text-xs">
              <span class="text-foreground font-bold">
                {{ selectedCount }} of {{ allTangible.length }}
              </span>
              ready scans selected for retraining.
              <span
                v-if="intangibleCount > 0"
                class="hidden sm:inline"
              >
                ({{ intangibleCount }} locked images safely omitted)
              </span>
            </div>

            <!-- Buttons -->
            <div class="flex items-center justify-end gap-2.5">
              <AppButton
                variant="ghost"
                size="md"
                class="rounded-xl font-semibold"
                @click="close"
              >
                Cancel
              </AppButton>
              <AppButton
                variant="solid"
                size="md"
                class="rounded-xl font-bold shadow-md"
                :disabled="selectedCount === 0"
                @click="handleConfirm"
              >
                <Icon
                  name="lucide:sparkles"
                  size="16"
                  class="mr-1.5"
                />
                Confirm Selection ({{ selectedCount }})
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
