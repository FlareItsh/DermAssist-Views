<script setup lang="ts">
  interface Props {
    modelValue?: boolean
    imageSrc: string
    title?: string
    loading?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    title: 'Crop Profile Picture',
    loading: false
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'crop', base64: string): void
    (e: 'cancel'): void
  }>()

  const viewportRef = ref<HTMLDivElement | null>(null)
  const imageElement = ref<HTMLImageElement | null>(null)

  const isImageLoaded = ref(false)
  const naturalWidth = ref(0)
  const naturalHeight = ref(0)

  // Zoom factor: 1x to 3x
  const zoom = ref(1)
  const rotation = ref(0) // 0, 90, 180, 270

  // Pan offsets in pixels
  const panX = ref(0)
  const panY = ref(0)

  // Crop aperture diameter in UI pixels
  const CROP_SIZE = 256
  const OUTPUT_SIZE = 512

  // Dragging state
  const isDragging = ref(false)
  const startPointerX = ref(0)
  const startPointerY = ref(0)
  const initialPanX = ref(0)
  const initialPanY = ref(0)

  // Base scale so that image fully covers the CROP_SIZE aperture
  const baseScale = computed(() => {
    if (!naturalWidth.value || !naturalHeight.value) return 1
    // If rotated 90 or 270 degrees, dimensions are swapped
    const isRotatedSwapped = rotation.value % 180 !== 0
    const w = isRotatedSwapped ? naturalHeight.value : naturalWidth.value
    const h = isRotatedSwapped ? naturalWidth.value : naturalHeight.value
    return Math.max(CROP_SIZE / w, CROP_SIZE / h)
  })

  // Total scale applied to image element
  const totalScale = computed(() => baseScale.value * zoom.value)

  // Max pan constraints so the image never leaves the crop circle empty
  const clampPan = () => {
    if (!naturalWidth.value || !naturalHeight.value) return
    const isRotatedSwapped = rotation.value % 180 !== 0
    const effectiveW =
      (isRotatedSwapped ? naturalHeight.value : naturalWidth.value) * totalScale.value
    const effectiveH =
      (isRotatedSwapped ? naturalWidth.value : naturalHeight.value) * totalScale.value

    const maxPanX = Math.max(0, (effectiveW - CROP_SIZE) / 2)
    const maxPanY = Math.max(0, (effectiveH - CROP_SIZE) / 2)

    panX.value = Math.min(maxPanX, Math.max(-maxPanX, panX.value))
    panY.value = Math.min(maxPanY, Math.max(-maxPanY, panY.value))
  }

  const resetTransform = () => {
    zoom.value = 1
    rotation.value = 0
    panX.value = 0
    panY.value = 0
  }

  const rotateClockwise = () => {
    rotation.value = (rotation.value + 90) % 360
    clampPan()
  }

  const handlePointerDown = (e: PointerEvent) => {
    if (props.loading || !isImageLoaded.value) return
    isDragging.value = true
    startPointerX.value = e.clientX
    startPointerY.value = e.clientY
    initialPanX.value = panX.value
    initialPanY.value = panY.value

    // Capture pointer to track dragging outside bounds smoothly
    ;(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging.value) return
    const deltaX = e.clientX - startPointerX.value
    const deltaY = e.clientY - startPointerY.value

    panX.value = initialPanX.value + deltaX
    panY.value = initialPanY.value + deltaY
    clampPan()
  }

  const handlePointerUp = (e: PointerEvent) => {
    if (!isDragging.value) return
    isDragging.value = false
    try {
      ;(e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId)
    } catch {}
    clampPan()
  }

  const handleWheel = (e: WheelEvent) => {
    if (props.loading || !isImageLoaded.value) return
    e.preventDefault()
    const zoomStep = 0.08
    const newZoom = e.deltaY < 0 ? zoom.value + zoomStep : zoom.value - zoomStep
    zoom.value = Math.min(3, Math.max(1, parseFloat(newZoom.toFixed(2))))
    clampPan()
  }

  watch(zoom, () => {
    clampPan()
  })

  // Load and decode image
  const loadImage = () => {
    if (!props.imageSrc) {
      isImageLoaded.value = false
      return
    }
    isImageLoaded.value = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      naturalWidth.value = img.naturalWidth
      naturalHeight.value = img.naturalHeight
      isImageLoaded.value = true
      resetTransform()
    }
    img.src = props.imageSrc
    imageElement.value = img
  }

  watch(
    () => props.imageSrc,
    () => {
      loadImage()
    },
    { immediate: true }
  )

  watch(
    () => props.modelValue,
    val => {
      if (val) {
        loadImage()
      } else {
        resetTransform()
      }
    }
  )

  const close = () => {
    if (props.loading) return
    emit('update:modelValue', false)
    emit('cancel')
  }

  // Generate cropped base64 from canvas
  const handleCropAndSave = () => {
    if (!imageElement.value || !isImageLoaded.value) return

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Background fill (white in case of any slight transparent corner)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    // Translate to center of output canvas
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2)

    // Scale canvas to match UI aperture to export size ratio
    const outputRatio = OUTPUT_SIZE / CROP_SIZE
    ctx.scale(outputRatio, outputRatio)

    // Apply user pan
    ctx.translate(panX.value, panY.value)

    // Apply rotation
    ctx.rotate((rotation.value * Math.PI) / 180)

    // Apply zoom & base scale
    ctx.scale(totalScale.value, totalScale.value)

    // Draw the source image centered
    const nw = naturalWidth.value
    const nh = naturalHeight.value
    ctx.drawImage(imageElement.value, -nw / 2, -nh / 2, nw, nh)

    // Convert to high-quality JPEG
    const base64Result = canvas.toDataURL('image/jpeg', 0.92)
    emit('crop', base64Result)
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-100 flex items-center justify-center p-4 backdrop-blur-xs sm:p-6"
        @click.self="close"
      >
        <!-- Dark backdrop -->
        <div class="fixed inset-0 bg-black/60 transition-opacity"></div>

        <!-- Modal Dialog -->
        <div
          class="bg-card border-border animate-in fade-in zoom-in-95 relative w-full max-w-md overflow-hidden rounded-[2rem] border p-6 text-center shadow-2xl transition-all sm:p-7"
        >
          <!-- Header -->
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl"
              >
                <Icon
                  name="lucide:crop"
                  class="h-5 w-5"
                />
              </div>
              <div class="text-left">
                <h3 class="text-foreground text-base font-bold sm:text-lg">{{ title }}</h3>
                <p class="text-muted-foreground text-xs">
                  Drag to reposition, scroll or slide to zoom
                </p>
              </div>
            </div>

            <button
              type="button"
              :disabled="loading"
              class="text-muted-foreground hover:text-foreground cursor-pointer rounded-xl p-1 transition"
              @click="close"
            >
              <Icon
                name="lucide:x"
                class="h-5 w-5"
              />
            </button>
          </div>

          <!-- Cropper Viewport -->
          <div
            ref="viewportRef"
            class="relative mx-auto flex h-[300px] w-full max-w-[300px] touch-none items-center justify-center overflow-hidden rounded-2xl bg-neutral-950 select-none"
            :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
            @pointerdown="handlePointerDown"
            @pointermove="handlePointerMove"
            @pointerup="handlePointerUp"
            @pointercancel="handlePointerUp"
            @wheel="handleWheel"
          >
            <!-- Image Surface -->
            <img
              v-if="imageSrc && isImageLoaded"
              :src="imageSrc"
              alt="Avatar preview to crop"
              class="pointer-events-none absolute max-w-none transition-transform duration-75 ease-out select-none"
              :style="{
                transform: `translate(${panX}px, ${panY}px) scale(${totalScale}) rotate(${rotation}deg)`,
                transformOrigin: 'center center'
              }"
            />

            <!-- Circular Crop Mask & Vignette Overlay -->
            <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
              <!-- Center aperture ring with shadow cutoff creating dark mask -->
              <div
                class="border-primary/90 h-[256px] w-[256px] rounded-full border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
              >
                <!-- Subtle grid crosshair guidelines -->
                <div class="relative h-full w-full rounded-full opacity-30">
                  <div class="absolute top-1/3 right-0 left-0 h-px border-b border-white/60"></div>
                  <div class="absolute top-2/3 right-0 left-0 h-px border-b border-white/60"></div>
                  <div class="absolute top-0 bottom-0 left-1/3 w-px border-r border-white/60"></div>
                  <div class="absolute top-0 bottom-0 left-2/3 w-px border-r border-white/60"></div>
                </div>
              </div>
            </div>

            <!-- Loading overlay inside viewport -->
            <div
              v-if="!isImageLoaded"
              class="text-muted-foreground flex flex-col items-center justify-center gap-2 text-xs"
            >
              <Icon
                name="lucide:loader-2"
                class="text-primary h-6 w-6 animate-spin"
              />
              <span>Loading image...</span>
            </div>
          </div>

          <!-- Interactive Controls Toolbar -->
          <div class="mt-5 space-y-3">
            <!-- Zoom Slider & Buttons -->
            <div class="flex items-center gap-3">
              <button
                type="button"
                :disabled="zoom <= 1 || loading"
                class="hover:bg-foreground/5 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-1.5 transition disabled:opacity-40"
                title="Zoom Out"
                @click="zoom = Math.max(1, parseFloat((zoom - 0.2).toFixed(2)))"
              >
                <Icon
                  name="lucide:minus"
                  class="h-4 w-4"
                />
              </button>

              <div class="relative flex-1">
                <input
                  v-model.number="zoom"
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  :disabled="loading || !isImageLoaded"
                  class="accent-primary bg-foreground/10 h-1.5 w-full cursor-pointer appearance-none rounded-lg"
                />
              </div>

              <button
                type="button"
                :disabled="zoom >= 3 || loading"
                class="hover:bg-foreground/5 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-1.5 transition disabled:opacity-40"
                title="Zoom In"
                @click="zoom = Math.min(3, parseFloat((zoom + 0.2).toFixed(2)))"
              >
                <Icon
                  name="lucide:plus"
                  class="h-4 w-4"
                />
              </button>
            </div>

            <!-- Rotation & Reset Toolbar -->
            <div class="flex items-center justify-center gap-2 pt-1 text-xs">
              <button
                type="button"
                :disabled="loading || !isImageLoaded"
                class="border-border hover:bg-foreground/5 text-foreground/80 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-semibold transition"
                @click="rotateClockwise"
              >
                <Icon
                  name="lucide:rotate-cw"
                  class="h-3.5 w-3.5"
                />
                <span>Rotate 90°</span>
              </button>

              <button
                type="button"
                :disabled="loading || !isImageLoaded"
                class="border-border hover:bg-foreground/5 text-foreground/80 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-semibold transition"
                @click="resetTransform"
              >
                <Icon
                  name="lucide:rotate-ccw"
                  class="h-3.5 w-3.5"
                />
                <span>Reset</span>
              </button>
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="border-border/60 mt-6 flex items-center justify-end gap-3 border-t pt-4">
            <AppButton
              type="button"
              variant="outline"
              :disabled="loading"
              @click="close"
            >
              Cancel
            </AppButton>

            <AppButton
              type="button"
              :loading="loading"
              :disabled="!isImageLoaded || loading"
              class="min-w-[130px]"
              @click="handleCropAndSave"
            >
              <Icon
                v-if="!loading"
                name="lucide:check"
                class="mr-1.5 h-4 w-4"
              />
              <span>Crop & Save</span>
            </AppButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
</style>
