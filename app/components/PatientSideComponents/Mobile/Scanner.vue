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
  await nextTick()
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' } // Back camera for skin scanning
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
    }
    startQualityLoop()
  } catch (err: any) {
    console.error('Camera access error:', err)
    errorMessage.value = 'Could not access the camera.'
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
  
  context.save()
  context.scale(-1, 1)
  context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
  context.restore()

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
  <div class="px-4 flex flex-col mt-3">
    <!-- AI Scan Header -->
    <h2 class="text-foreground text-xl font-bold ">AI Scan</h2>

    <!-- Main Scanner Container -->
    <div class="bg-[#7cb4fc] rounded-[32px] p-2 flex flex-col gap-2 relative overflow-hidden shadow-xs border border-white/10">
      
      <!-- Camera/Upload Viewport Area Wrapper -->
      <div class="flex flex-col items-center w-full">
        
        <!-- Persistent Black Notch/Tab -->
        <div
          class="bg-black w-[60%] h-8 rounded-t-2xl flex items-center justify-center relative z-10 border-t border-x border-white/5 shadow-xs"
        >
          <span
            v-if="statusText"
            class="text-red-500 font-extrabold text-[10px] uppercase tracking-wider px-2 truncate"
          >
            {{ statusText }}
          </span>
        </div>

        <!-- Viewport Box -->
        <div class="relative aspect-[3/3.5] w-full bg-black rounded-[24px] overflow-hidden flex items-center justify-center shadow-lg border border-white/5">
          
          <!-- Live Video Element -->
          <video
            v-show="isCameraOn && !previewImage"
            ref="videoRef"
            autoplay
            playsinline
            class="w-full h-full object-cover transform -scale-x-100"
          ></video>

          <!-- Preview Image Element -->
          <img
            v-if="previewImage"
            :src="previewImage"
            class="w-full h-full object-cover"
          />

          <!-- Scanner Retake overlay action button -->
          <div v-if="previewImage && !isScanning" class="absolute top-4 left-4 z-20">
            <button
              @click="resetToCamera"
              class="bg-white/90 backdrop-blur-xs px-4 py-1.5 rounded-full text-xs font-black shadow-lg flex items-center gap-1.5 hover:bg-white active:scale-95 transition-all text-primary"
            >
              <Icon name="material-symbols:arrow-back-rounded" size="14" />
              Retake
            </button>
          </div>

          <!-- Realtime Green Diagnostic boundary target frame overlay -->
          <div v-if="isCameraOn && !isScanning && !qualityError && !previewImage" class="absolute inset-0 border-[32px] border-black/30 pointer-events-none flex items-center justify-center">
             <div class="w-4/5 h-4/5 border border-green-500/40 rounded-2xl relative">
               <div class="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-green-500"></div>
               <div class="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-green-500"></div>
               <div class="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-green-500"></div>
               <div class="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-green-500"></div>
             </div>
          </div>

          <!-- Scanner Overlay/Indicator -->
          <div
            v-if="isScanning"
            class="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-xs z-30"
          >
            <div class="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
            <span class="text-white text-[10px] font-black mt-3 tracking-widest uppercase">Analyzing skin...</span>
          </div>

          <!-- Fallback empty view when camera is off -->
          <div v-if="!isCameraOn && !previewImage" class="flex flex-col items-center justify-center text-center p-6 select-none">
            <Icon name="solar:camera-minimalistic-linear" class="text-white/10 text-6xl mb-3" />
            <p class="text-white/30 text-[10px] font-medium max-w-[160px]">Select camera or upload photo to diagnose</p>
          </div>
        </div>
      </div>

      <!-- Control Button Row -->
      <div class="flex items-center justify-around px-2 relative z-10">
        <!-- Open Library Folder Button -->
        <button
          @click="triggerFileInput"
          class="text-white hover:opacity-80 active:scale-90 transition-all shrink-0 p-2"
        >
          <Icon name="famicons:folder-outline" size="32" />
        </button>

        <!-- Large Camera Capture/Diagnose Button -->
        <button
          @click="captureAndDiagnose"
          :disabled="isScanning || (qualityError !== null && isCameraOn)"
          class="h-15 w-15 flex items-center justify-center rounded-full bg-white text-black shadow-lg hover:bg-gray-50 active:scale-90 transition-all shrink-0 cursor-pointer disabled:opacity-40 disabled:scale-95 disabled:cursor-not-allowed"
        >
          <Icon name="lucide:aperture" size="30" class="text-black" />
        </button>

        <!-- Video Camera Stream Toggle Button -->
        <button
          @click="toggleCamera"
          class="text-white hover:opacity-80 active:scale-90 transition-all shrink-0 p-2"
        >
          <Icon :name="isCameraOn ? 'material-symbols:videocam-rounded' : 'material-symbols:videocam-off-rounded'" size="32" />
        </button>
      </div>

      <!-- Hidden Input for File Selector -->
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleFileUpload"
      />

      <canvas ref="canvasRef" class="hidden"></canvas>
    </div>

    <!-- Redirect/Diagnosis Link -->
    <div class="flex flex-col items-center justify-center mt-4 mb-6">
      <button
        v-if="previewImage"
        @click="captureAndDiagnose"
        class="text-[#22c55e] font-black text-base hover:underline active:scale-95 transition-all"
      >
        See Diagnosis
      </button>
      <p v-if="uploadQualityWarning" class="text-amber-500 text-xs font-bold mt-2 text-center max-w-xs">
        <Icon name="material-symbols:warning-outline-rounded" class="mr-1" />
        Warning: {{ uploadQualityWarning }}
      </p>
      <p v-if="errorMessage" class="text-red-500 text-xs font-bold mt-2 text-center">{{ errorMessage }}</p>
    </div>
  </div>
</template>
