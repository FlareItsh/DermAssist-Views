<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue'
  import { toast } from 'vue-sonner'
  import { $api } from '~/composables/useApi'

  interface Props {
    modelValue: boolean
    initialPtr?: string | null
    initialTin?: string | null
    initialS2?: string | null
    initialSignatureUrl?: string | null
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    initialPtr: '',
    initialTin: '',
    initialS2: '',
    initialSignatureUrl: null
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', val: boolean): void
    (e: 'saved', data: any): void
  }>()

  const activeTab = ref<'draw' | 'upload'>('draw')
  const ptrNumber = ref('')
  const tinNumber = ref('')
  const s2Number = ref('')
  const isSubmitting = ref(false)

  // Canvas Drawing State
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const isDrawing = ref(false)
  const hasDrawn = ref(false)

  // Uploaded Image State
  const uploadedBase64 = ref<string | null>(null)

  watch(
    () => props.modelValue,
    isOpen => {
      if (isOpen) {
        ptrNumber.value = props.initialPtr || ''
        tinNumber.value = props.initialTin || ''
        s2Number.value = props.initialS2 || ''
        uploadedBase64.value = null
        hasDrawn.value = false
        setTimeout(initCanvas, 50)
      }
    }
  )

  const initCanvas = () => {
    const canvas = canvasRef.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set high-DPI scaling
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#1e1b4b' // Dark Indigo ink
  }

  const getCanvasCoords = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.value
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }
    return { x: 0, y: 0 }
  }

  const startDrawing = (e: MouseEvent | TouchEvent) => {
    isDrawing.value = true
    hasDrawn.value = true
    const canvas = canvasRef.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const coords = getCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing.value) return
    e.preventDefault()
    const canvas = canvasRef.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const coords = getCanvasCoords(e)
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    isDrawing.value = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawn.value = false
  }

  const handleFileUpload = (e: Event) => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, or WebP).')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Signature file must be under 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = ev => {
      uploadedBase64.value = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    let finalSignature: string | null = null

    if (activeTab.value === 'draw' && hasDrawn.value && canvasRef.value) {
      finalSignature = canvasRef.value.toDataURL('image/png')
    } else if (activeTab.value === 'upload' && uploadedBase64.value) {
      finalSignature = uploadedBase64.value
    }

    isSubmitting.value = true
    try {
      const payload: Record<string, any> = {
        ptr_number: ptrNumber.value.trim() || null,
        tin_number: tinNumber.value.trim() || null,
        s2_number: s2Number.value.trim() || null
      }
      if (finalSignature) {
        payload.signature = finalSignature
      }

      const res = await $api<any>('/doctor/prescription-credentials', {
        method: 'POST',
        body: payload
      })

      toast.success('Prescription credentials and signature saved!')
      emit('saved', res?.data ?? payload)
      emit('update:modelValue', false)
    } catch (err: any) {
      console.error('Failed to save prescription credentials:', err)
      toast.error(err?.data?.message || 'Failed to save credentials.')
    } finally {
      isSubmitting.value = false
    }
  }
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
    >
      <div
        class="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4"
        >
          <div class="flex items-center gap-2.5">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
            >
              <Icon
                name="lucide:pen-tool"
                class="text-lg"
              />
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900">
                Prescription Credentials & Signature
              </h3>
              <p class="text-xs text-gray-500">
                Official physician details for compliant Rx printing
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="emit('update:modelValue', false)"
            class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <Icon
              name="lucide:x"
              class="text-base"
            />
          </button>
        </div>

        <!-- Body -->
        <div class="flex max-h-[75vh] flex-col gap-4 overflow-y-auto p-6">
          <!-- Credential Inputs Grid -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-bold tracking-wider text-gray-700 uppercase">
                PTR Number <span class="text-rose-500">*</span>
              </label>
              <input
                v-model="ptrNumber"
                type="text"
                placeholder="e.g. PTR-1234567"
                class="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <span class="text-[10px] text-gray-400">Professional Tax Receipt</span>
            </div>

            <div>
              <label class="mb-1 block text-xs font-bold tracking-wider text-gray-700 uppercase">
                TIN Number
              </label>
              <input
                v-model="tinNumber"
                type="text"
                placeholder="e.g. 123-456-789-000"
                class="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <span class="text-[10px] text-gray-400">Tax Identification Number</span>
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-bold tracking-wider text-gray-700 uppercase">
              PDEA S2 License <span class="font-normal text-gray-400">(Optional)</span>
            </label>
            <input
              v-model="s2Number"
              type="text"
              placeholder="e.g. S2-9876543 (leave blank if none)"
              class="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <!-- Signature Section -->
          <div class="flex flex-col gap-2 border-t border-gray-100 pt-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold tracking-wider text-gray-700 uppercase">
                Digital Signature
              </label>
              <div
                class="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 text-xs font-semibold"
              >
                <button
                  type="button"
                  @click="activeTab = 'draw'"
                  :class="[
                    'rounded-md px-2.5 py-1 transition-all',
                    activeTab === 'draw'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  ]"
                >
                  Draw Canvas
                </button>
                <button
                  type="button"
                  @click="activeTab = 'upload'"
                  :class="[
                    'rounded-md px-2.5 py-1 transition-all',
                    activeTab === 'upload'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  ]"
                >
                  Upload File
                </button>
              </div>
            </div>

            <!-- Draw Pad Tab -->
            <div
              v-show="activeTab === 'draw'"
              class="flex flex-col gap-2"
            >
              <div
                class="relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50"
              >
                <canvas
                  ref="canvasRef"
                  class="h-full w-full"
                  @mousedown="startDrawing"
                  @mousemove="draw"
                  @mouseup="stopDrawing"
                  @mouseleave="stopDrawing"
                  @touchstart.passive="startDrawing"
                  @touchmove="draw"
                  @touchend="stopDrawing"
                ></canvas>
                <div
                  v-if="!hasDrawn"
                  class="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400 select-none"
                >
                  Sign with finger, stylus, or mouse inside this box
                </div>
              </div>
              <div class="flex justify-end">
                <button
                  type="button"
                  @click="clearCanvas"
                  class="flex items-center gap-1 text-xs font-semibold text-gray-500 transition-colors hover:text-rose-600"
                >
                  <Icon
                    name="lucide:rotate-ccw"
                    class="text-xs"
                  />
                  Clear Canvas
                </button>
              </div>
            </div>

            <!-- Upload File Tab -->
            <div
              v-show="activeTab === 'upload'"
              class="flex flex-col gap-2"
            >
              <label
                class="flex h-36 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors hover:border-indigo-400"
              >
                <template v-if="uploadedBase64">
                  <img
                    :src="uploadedBase64"
                    class="max-h-24 max-w-full object-contain"
                    alt="Signature preview"
                  />
                  <span class="mt-1 text-[11px] font-semibold text-indigo-600"
                    >Click to replace</span
                  >
                </template>
                <template v-else-if="initialSignatureUrl">
                  <img
                    :src="initialSignatureUrl"
                    class="max-h-24 max-w-full object-contain"
                    alt="Existing signature"
                  />
                  <span class="mt-1 text-[11px] font-semibold text-gray-500"
                    >Current signature &bull; Click to replace</span
                  >
                </template>
                <template v-else>
                  <Icon
                    name="lucide:upload-cloud"
                    class="mb-1 text-2xl text-gray-400"
                  />
                  <span class="text-xs font-semibold text-gray-700">Upload signature image</span>
                  <span class="text-[10px] text-gray-400"
                    >PNG or JPG with white/transparent background</span
                  >
                </template>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  class="hidden"
                  @change="handleFileUpload"
                />
              </label>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div
          class="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-6 py-4"
        >
          <button
            type="button"
            @click="emit('update:modelValue', false)"
            class="px-4 py-2 text-xs font-bold text-gray-600 transition-colors hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            :disabled="isSubmitting"
            @click="handleSave"
            class="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            <Icon
              v-if="isSubmitting"
              name="lucide:loader-2"
              class="animate-spin text-sm"
            />
            <span>Save Credentials</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
