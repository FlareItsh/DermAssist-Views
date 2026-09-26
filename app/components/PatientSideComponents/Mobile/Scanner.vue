<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from '#app'
import { toast } from 'vue-sonner'
import { useDiagnosis } from '~/composables/useDiagnosis'
import { diagnosisService } from '~/api/diagnosis/DiagnosisService'

const router = useRouter()
const {
  isScanning,
  isScanned,
  setDiagnosis,
  qualityError,
  previewImage,
  selectedFile,
  patientUuid
} = useDiagnosis()

const userUuid = useCookie('user_uuid')
const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isCameraOn = ref(false)
const errorMessage = ref('')
const uploadQualityWarning = ref<string | null>(null)
const agreeToConsent = ref(false)
const showTermsModal = ref(false)
const termsInitialTab = ref<'terms' | 'privacy'>('terms')

const openTermsModal = (tab: 'terms' | 'privacy' = 'terms') => {
  termsInitialTab.value = tab
  showTermsModal.value = true
}

let stream: MediaStream | null = null
let qualityCheckInterval: any = null
const currentFacingMode = ref<'user' | 'environment'>('environment')

const isDraggingOver = ref(false)
let dragCounter = 0

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  dragCounter++
  if (e.dataTransfer && e.dataTransfer.types.length > 0) {
    isDraggingOver.value = true
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
  isDraggingOver.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDraggingOver.value = false
  }
}

const processImageFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast.error('Please upload or drop a valid image file (JPEG, PNG, WEBP).')
    return
  }
  selectedFile.value = file as File
  isScanned.value = false
  uploadQualityWarning.value = null
  const reader = new FileReader()
  reader.onload = (e) => {
    previewImage.value = e.target?.result as string
    analyzeUploadedImageQuality(previewImage.value)
  }
  reader.readAsDataURL(file)
  stopCamera()
  isCameraOn.value = false
}

const processImageUrl = async (rawUrl: string) => {
  let url = rawUrl.trim()
  if (!url) return

  const imgMatch = url.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch && imgMatch[1]) {
    url = imgMatch[1]
  }

  if (url.startsWith('data:image/')) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const ext = url.substring(url.indexOf('/') + 1, url.indexOf(';')) || 'jpg'
      const file = new File([blob], `dropped-image.${ext}`, { type: blob.type || 'image/jpeg' })
      processImageFile(file)
      toast.success('Dropped image loaded successfully!')
      return
    } catch (e) {
      console.error('Failed to parse dropped data URL:', e)
    }
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    toast.error('Dropped link is not a valid image URL.')
    return
  }

  const toastId = toast.loading('Loading image from link...')
  try {
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    if (!blob.type.startsWith('image/') && !blob.type.includes('octet-stream')) {
      toast.dismiss(toastId)
      toast.error('The link does not point to a recognized image format.')
      return
    }
    const filename = url.split('/').pop()?.split('?')[0] || 'dropped-image.jpg'
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
    toast.dismiss(toastId)
    toast.success('Image loaded from link successfully!')
    processImageFile(file)
  } catch (err) {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width
          canvas.height = img.naturalHeight || img.height
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas context unavailable')
          ctx.drawImage(img, 0, 0)
          canvas.toBlob((blob) => {
            toast.dismiss(toastId)
            if (blob) {
              const file = new File([blob], 'dropped-image.jpg', { type: 'image/jpeg' })
              toast.success('Image loaded from link successfully!')
              processImageFile(file)
            } else {
              toast.error('Could not extract image from link. Please save and drop the file.')
            }
          }, 'image/jpeg', 0.9)
        } catch (canvasErr) {
          toast.dismiss(toastId)
          toast.error('Direct link access is protected by CORS. Please right-click > "Save Image As" and drop the file.')
        }
      }
      img.onerror = () => {
        toast.dismiss(toastId)
        toast.error('Unable to load image from URL. Please save the image and drop the file directly.')
      }
      img.src = url
    } catch (fallbackErr) {
      toast.dismiss(toastId)
      toast.error('Could not load image from URL.')
    }
  }
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  dragCounter = 0
  isDraggingOver.value = false

  const dataTransfer = e.dataTransfer
  if (!dataTransfer) return

  if (dataTransfer.files && dataTransfer.files.length > 0) {
    const file = dataTransfer.files[0]
    if (file.type.startsWith('image/')) {
      processImageFile(file)
      return
    }
  }

  const htmlData = dataTransfer.getData('text/html')
  if (htmlData) {
    const match = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (match && match[1]) {
      await processImageUrl(match[1])
      return
    }
  }

  const uriData = dataTransfer.getData('text/uri-list')
  if (uriData) {
    const firstUrl = uriData.split('\n')[0].trim()
    if (firstUrl && !firstUrl.startsWith('#')) {
      await processImageUrl(firstUrl)
      return
    }
  }

  const textData = dataTransfer.getData('text/plain')
  if (textData) {
    const trimmed = textData.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
      await processImageUrl(trimmed)
      return
    }
  }

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i]
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          processImageFile(file)
          return
        }
      }
    }
  }

  toast.info('No valid image or image link detected in the drop.')
}

const flipCamera = async () => {
  if (!isCameraOn.value) return
  currentFacingMode.value = currentFacingMode.value === 'user' ? 'environment' : 'user'
  // stopCamera is called inside startCamera so no double-stop
  await startCamera()
}

const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    processImageFile(file)
  }
}

const stopCamera = () => {
  if (qualityCheckInterval) {
    clearInterval(qualityCheckInterval)
  }
  qualityCheckInterval = null
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
}

const toggleCamera = async () => {
  if (isCameraOn.value) {
    stopCamera()
    isCameraOn.value = false
  } else {
    previewImage.value = null
    selectedFile.value = null
    uploadQualityWarning.value = null
    await startCamera()
  }
}

const startCamera = async () => {
  isCameraOn.value = true
  errorMessage.value = ''
  await nextTick()

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    errorMessage.value = 'Camera not available. Open this app over HTTPS.'
    isCameraOn.value = false
    return
  }

  // Stop any lingering stream tracks before requesting new ones
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }

  // Give the OS a moment to release the camera hardware
  await new Promise(resolve => setTimeout(resolve, 200))

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: currentFacingMode.value } }
    })
  } catch (err: any) {
    console.error('Camera error:', err)
    errorMessage.value = `Camera error: ${err.name} — ${err.message}`
    isCameraOn.value = false
    return
  }


  if (videoRef.value) {
    videoRef.value.srcObject = stream
    try {
      await videoRef.value.play()
    } catch (playErr) {
      console.warn('Video play blocked:', playErr)
    }
  }
  startQualityLoop()
}


const startQualityLoop = () => {
  if (qualityCheckInterval) {
    clearInterval(qualityCheckInterval)
  }
  qualityCheckInterval = setInterval(() => {
    if (!videoRef.value || !canvasRef.value || isScanning.value || !isCameraOn.value || previewImage.value) return
    const v = videoRef.value
    const c = canvasRef.value
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    c.width = 160
    c.height = 120
    ctx.drawImage(v, 0, 0, c.width, c.height)
    qualityError.value = validateImageQuality(ctx, c.width, c.height)
  }, 400)
}

const analyzeUploadedImageQuality = (dataUrl: string): void => {
  const img = new Image()
  img.onload = () => {
    const offscreen = document.createElement('canvas')
    offscreen.width = 160
    offscreen.height = 120
    const ctx = offscreen.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height)
    const warning = validateImageQuality(ctx, offscreen.width, offscreen.height)
    uploadQualityWarning.value = warning
  }
  img.src = dataUrl
}

const validateImageQuality = (ctx: CanvasRenderingContext2D, width: number, height: number): string | null => {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  let totalLum = 0
  let variance = 0
  const pixelCount = data.length / 4

  for (let i = 0; i < data.length; i += 4) {
    const r = (data as any)[i]
    const g = (data as any)[i + 1]
    const b = (data as any)[i + 2]
    totalLum += (0.299 * r + 0.587 * g + 0.114 * b)
  }

  const avgLum = totalLum / pixelCount
  
  if (avgLum < 80) return 'Too dark - use more light'
  if (avgLum > 230) return 'Too much glare - avoid direct reflection'

  for (let i = 0; i < data.length; i += 8) {
    const r = (data as any)[i]
    const g = (data as any)[i + 1]
    const b = (data as any)[i + 2]
    const lum = (r + g + b) / 3
    variance += Math.abs(lum - avgLum)
  }

  if (variance / (pixelCount / 2) < 20) return 'Get closer or fix focus...'
  
  return null
}

const resetToCamera = async () => {
  previewImage.value = null
  selectedFile.value = null
  isScanned.value = false
  uploadQualityWarning.value = null
  await startCamera()
}

const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height
      const maxSide = 1024

      if (width > height && width > maxSide) {
        height *= maxSide / width
        width = maxSide
      } else if (height > maxSide) {
        width *= maxSide / height
        height = maxSide
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject('Could not get canvas context')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject('Compression failed')
      }, 'image/jpeg', 0.85)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

const captureAndDiagnose = async () => {
  if (isScanning.value) return

  // Case 1: Diagnose already loaded file/preview
  if (previewImage.value && selectedFile.value) {
    await runDiagnosis(selectedFile.value)
    return
  }

  // Case 2: Capture snapshot from active camera stream
  if (!videoRef.value || !canvasRef.value || !isCameraOn.value) {
    errorMessage.value = 'Please upload a photo or turn on the camera'
    return
  }

  const video = videoRef.value
  const canvas = canvasRef.value
  const context = canvas.getContext('2d')
  if (!context) return

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  // Only mirror the captured image when using the front (selfie) camera
  if (currentFacingMode.value === 'user') {
    context.save()
    context.scale(-1, 1)
    context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
    context.restore()
  } else {
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
  }

  previewImage.value = canvas.toDataURL('image/jpeg')
  stopCamera()
  isCameraOn.value = false

  canvas.toBlob(async (blob) => {
    if (blob) {
      const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' })
      selectedFile.value = file
      await runDiagnosis(file)
    }
  }, 'image/jpeg', 0.85)
}

const runDiagnosis = async (file: File) => {
  isScanning.value = true
  errorMessage.value = ''
  try {
    const compressedBlob = await compressImage(file)
    const finalFile = new File([compressedBlob], 'scan.jpg', { type: 'image/jpeg' })

    const formData = new FormData()
    formData.append('image', finalFile)
    if (userUuid.value) {
      formData.append('user_uuid', userUuid.value)
    }
    if (patientUuid.value) {
      formData.append('patient_uuid', patientUuid.value)
    }

    const response = await diagnosisService.create(formData, {
      headers: userUuid.value ? { 'X-User-Uuid': userUuid.value } : {}
    })
    if (response) {
      setDiagnosis(response as any)
      router.push('/Patient/Scan/Results')
    }
  } catch (err: any) {
    errorMessage.value = err.data?.error || err.statusMessage || err.message || 'Scanning error.'
  } finally {
    isScanning.value = false
  }
}

onUnmounted(() => {
  stopCamera()
})

const statusText = computed(() => {
  if (!isCameraOn.value && !previewImage.value) {
    return 'No Image Found'
  }
  if (isCameraOn.value && !previewImage.value && !isScanning.value && qualityError.value) {
    return qualityError.value
  }
  return ''
})
</script>

<template>
  <!-- Fullscreen camera container -->
  <div
    class="fixed inset-0 bg-black overflow-hidden"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Drag & Drop Hover Overlay (Active when hovering file/image/link) -->
    <div
      v-if="isDraggingOver && !isScanning"
      class="absolute inset-4 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md border-4 border-dashed border-primary rounded-3xl animate-in fade-in zoom-in-95 duration-150 transition-all pointer-events-none text-center p-6"
    >
      <div class="h-20 w-20 rounded-full bg-primary/20 text-primary flex items-center justify-center mb-4 ring-8 ring-primary/10 animate-bounce">
        <Icon name="material-symbols:add-photo-alternate-rounded" class="text-4xl" />
      </div>
      <h3 class="text-xl font-black text-white tracking-tight mb-1">
        Drop Image or Link Here
      </h3>
      <p class="text-sm text-gray-300 leading-relaxed mb-4">
        Release your image file or web link to load and analyze instantly
      </p>
      <div class="flex items-center gap-2">
        <span class="text-[11px] font-bold uppercase tracking-wider bg-white/10 text-white/90 px-3 py-1 rounded-full border border-white/15">
          JPG, PNG, WEBP
        </span>
        <span class="text-[11px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-3 py-1 rounded-full border border-primary/30">
          Image URLs & Links
        </span>
      </div>
    </div>

    <!-- === FULLSCREEN VIDEO / PREVIEW === -->
    <video
      v-show="isCameraOn && !previewImage"
      ref="videoRef"
      autoplay
      playsinline
      muted
      class="absolute inset-0 w-full h-full object-cover -scale-x-100"
    ></video>

    <img
      v-if="previewImage"
      :src="previewImage"
      class="absolute inset-0 w-full h-full object-cover"
    />

    <!-- === EMPTY STATE (no camera, no image) === -->
    <div
      v-if="!isCameraOn && !previewImage"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none"
    >
      <Icon name="solar:camera-minimalistic-linear" class="text-white/10 text-8xl" />
      <p class="text-white/25 text-sm font-medium">Tap the camera button or drop an image to start</p>
    </div>

    <!-- === TOP HUD: Status / No-Image / Error bar === -->
    <div class="absolute top-0 left-0 right-0 z-30 flex flex-col items-center pt-24 px-4 gap-2 pointer-events-none">
      <!-- No image found pill -->
      <div
        v-if="!isCameraOn && !previewImage"
        class="bg-black/60 backdrop-blur-md rounded-full px-5 py-2 flex items-center gap-2"
      >
        <Icon name="solar:camera-minimalistic-broken" class="text-white/50" size="16" />
        <span class="text-white/70 text-xs font-semibold tracking-wider uppercase">No Image Found</span>
      </div>

      <!-- Error message pill -->
      <div
        v-if="errorMessage"
        class="bg-red-500/30 border border-red backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-start gap-2 max-w-xs"
      >
        <Icon name="material-symbols:error-outline-rounded" class="text-white shrink-0 mt-0.5" size="16" />
        <span class="text-white text-xs font-semibold leading-snug">{{ errorMessage }}</span>
      </div>
    </div>

    <!-- === AUGMENTED REALITY OVERLAYS (only on live camera) === -->
    <template v-if="isCameraOn && !previewImage && !isScanning">

      <!-- Quality warning AR overlay -->
      <div
        v-if="qualityError"
        class="absolute inset-x-0 top-1/3 flex items-center justify-center z-20 pointer-events-none"
      >
        <div class="bg-black/30 backdrop-blur-sm border border-amber-400/30 rounded-2xl px-5 py-3 flex items-center gap-3 mx-6">
          <Icon name="material-symbols:warning-outline-rounded" class="text-amber-400 shrink-0 text-2xl animate-pulse" />
          <div>
            <p class="text-amber-300 text-xs font-black uppercase tracking-wider">Image Quality Warning</p>
            <p class="text-white/80 text-sm font-semibold mt-0.5">{{ qualityError }}</p>
          </div>
        </div>
      </div>

      <!-- Corner bracket targeting frame -->
      <div v-if="!qualityError" class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div class="relative w-64 h-64">
          <div class="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-white/80 rounded-tl-lg"></div>
          <div class="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-white/80 rounded-tr-lg"></div>
          <div class="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-white/80 rounded-bl-lg"></div>
          <div class="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-white/80 rounded-br-lg"></div>
          <div class="absolute inset-0 flex items-end justify-center pb-3">
            <span class="text-white/40 text-[10px] font-semibold tracking-widest uppercase">Place skin within frame</span>
          </div>
        </div>
      </div>

    </template>

    <!-- === SCANNING OVERLAY === -->
    <div
      v-if="isScanning"
      class="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-40 gap-4"
    >
      <div class="h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-primary"></div>
      <p class="text-white text-base font-black tracking-widest uppercase">Analyzing skin...</p>
      <p class="text-white/50 text-xs font-medium">This takes just a moment</p>
    </div>

    <!-- === FLIP & RETAKE BUTTONS (below hero header) === -->
    <div class="absolute top-28 right-4 z-30 flex flex-col gap-2">
      <!-- Flip camera button (only when camera is live) -->
      <button
        v-if="isCameraOn && !previewImage && !isScanning"
        @click="flipCamera"
        class="h-11 w-11 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-all"
      >
        <Icon name="material-symbols:flip-camera-android-rounded" size="22" />
      </button>

      <!-- Retake button (only when preview is shown) -->
      <button
        v-if="previewImage && !isScanning"
        @click="resetToCamera"
        class="h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/20 px-4 flex items-center gap-2 text-white active:scale-90 transition-all"
      >
        <Icon name="material-symbols:arrow-back-rounded" size="18" />
        <span class="text-xs font-bold">Retake</span>
      </button>
    </div>

    <!-- Upload quality warning AR pill (for uploaded images) -->
    <div
      v-if="uploadQualityWarning && previewImage"
      class="absolute bottom-44 left-0 right-0 flex justify-center z-30 px-6 pointer-events-none"
    >
      <div class="bg-amber-500/40 backdrop-blur-sm border border-amber-400/30 rounded-2xl px-5 py-3 flex items-center gap-3 max-w-xs">
        <Icon name="material-symbols:warning-outline-rounded" class="text-white shrink-0 text-xl animate-pulse" />
        <div>
          <p class="text-white text-xs font-black uppercase tracking-wider">Upload Warning</p>
          <p class="text-white/90 text-sm font-medium mt-0.5">{{ uploadQualityWarning }}</p>
        </div>
      </div>
    </div>

    <!-- AI Disclaimer Banner -->
    <div v-if="!isScanning" class="absolute bottom-48 left-4 right-4 z-30 flex justify-center">
      <div class="flex items-center gap-2 rounded-2xl border border-white/20 bg-black/75 px-3.5 py-1.5 text-white shadow-2xl backdrop-blur-md max-w-sm">
        <Icon name="lucide:info" class="text-primary h-3.5 w-3.5 shrink-0" />
        <p class="text-[10px] text-white/90 select-none leading-tight">
          AI results are assistive only.
          <button
            type="button"
            class="text-primary font-bold underline underline-offset-2 hover:opacity-80"
            @click.stop="openTermsModal('terms')"
          >
            Medical Disclaimer
          </button>
          &
          <button
            type="button"
            class="text-primary font-bold underline underline-offset-2 hover:opacity-80"
            @click.stop="openTermsModal('privacy')"
          >
            Privacy Policy
          </button>
        </p>
      </div>
    </div>

    <!-- === BOTTOM CONTROLS (floating above navbar) === -->
    <div class="absolute bottom-0 left-0 right-0 z-30 pb-24 pt-4 px-8">
      <!-- Gradient fade -->
      <div class="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>

      <div class="relative flex items-center justify-between">
        <!-- Gallery / Upload button -->
        <button
          @click="triggerFileInput"
          class="h-14 w-14 rounded-2xl bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-all"
        >
          <Icon name="famicons:folder-outline" size="28" />
        </button>

        <!-- Main shutter / diagnose button -->
        <button
          @click="captureAndDiagnose"
          :disabled="isScanning || (qualityError !== null && isCameraOn)"
          class="h-20 w-20 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div class="h-16 w-16 rounded-full border-4 border-black/10 flex items-center justify-center">
            <Icon v-if="previewImage" name="solar:arrow-right-bold" size="28" class="text-primary" />
            <Icon v-else name="lucide:aperture" size="28" class="text-black" />
          </div>
        </button>

        <!-- Camera toggle (on/off) button -->
        <button
          @click="toggleCamera"
          class="h-14 w-14 rounded-2xl bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-90 transition-all"
          :class="isCameraOn ? 'text-primary border-primary/40' : 'text-white'"
        >
          <Icon :name="isCameraOn ? 'material-symbols:videocam-rounded' : 'material-symbols:videocam-off-rounded'" size="28" />
        </button>
      </div>
    </div>

    <!-- Hidden inputs -->
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
    <canvas ref="canvasRef" class="hidden"></canvas>

    <!-- Terms & Medical Disclaimer Modal -->
    <AppModalTermsModal
      v-model="showTermsModal"
      :initial-tab="termsInitialTab"
      @accept="agreeToConsent = true"
    />
  </div>
</template>
