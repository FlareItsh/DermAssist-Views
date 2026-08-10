<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from '#app'
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

let stream: MediaStream | null = null
let qualityCheckInterval: any = null
const currentFacingMode = ref<'user' | 'environment'>('environment')

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
  <div class="fixed inset-0 bg-black overflow-hidden">

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
      <p class="text-white/25 text-sm font-medium">Tap the camera button to start</p>
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
  </div>
</template>
