<script setup lang="ts">
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'
  import { ref, onMounted, onUnmounted, nextTick } from 'vue'

  const { isScanning, isScanned, setDiagnosis, clearDiagnosis, qualityError, previewImage, selectedFile } = useDiagnosis()
  const userUuid = useCookie('user_uuid')
  const videoRef = ref<HTMLVideoElement | null>(null)
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const errorMessage = ref('')
  const fileInput = ref<HTMLInputElement | null>(null)
  const isCameraOn = ref(false)
  
  let stream: MediaStream | null = null
  let qualityCheckInterval: any = null
  let wasOnBeforeHidden = true

  const triggerFileInput = () => {
    if (fileInput.value) fileInput.value.click()
  }

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files[0]) {
      const file = target.files[0]
      // Explicitly cast to File to resolve the "redline" type issue
      selectedFile.value = file as File
      isScanned.value = false
      const reader = new FileReader()
      reader.onload = (e) => {
        previewImage.value = e.target?.result as string
      }
      reader.readAsDataURL(file)
      stopCamera()
      isCameraOn.value = false
    }
  }

  const resetToCamera = async () => {
    previewImage.value = null
    selectedFile.value = null
    isScanned.value = false
    await startCamera()
  }

  const toggleCamera = async () => {
    if (isCameraOn.value) {
      wasOnBeforeHidden = false
      stopCamera()
      isCameraOn.value = false
      selectedFile.value = null
    } else {
      wasOnBeforeHidden = true
      previewImage.value = null
      await startCamera()
    }
  }

  const startCamera = async () => {
    isCameraOn.value = true
    await nextTick() 
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      })
      if (videoRef.value) videoRef.value.srcObject = stream
      startQualityLoop()
    } catch (err: any) {
      console.error('Camera access error:', err)
      errorMessage.value = 'Could not access the camera.'
    }
  }

  const startQualityLoop = () => {
    if (qualityCheckInterval) clearInterval(qualityCheckInterval)
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
    
    // STRICTER BRIGHTNESS: From 30 -> 80
    if (avgLum < 80) return 'Too dark - use more light'
    // STRICTER GLARE: From 245 -> 230
    if (avgLum > 230) return 'Too much glare - avoid direct reflection'

    for (let i = 0; i < data.length; i += 8) {
      const r = (data as any)[i]
      const g = (data as any)[i + 1]
      const b = (data as any)[i + 2]
      const lum = (r + g + b) / 3
      variance += Math.abs(lum - avgLum)
    }

    // STRICTER DETAIL: From 10 -> 20 (Ensures texture is visible)
    if (variance / (pixelCount / 2) < 20) return 'Get closer or fix focus...'
    
    return null
  }

  const captureAndScan = async () => {
    if (isScanning.value) return

    // Case 1: Scanning a previewed (uploaded or already captured) image
    if (previewImage.value && selectedFile.value) {
      await performDiagnosis(selectedFile.value as File)
      return
    }

    // Case 2: Capturing from live camera
    if (!videoRef.value || !canvasRef.value || qualityError.value || !isCameraOn.value) return
    
    const video = videoRef.value
    const canvas = canvasRef.value
    const context = canvas.getContext('2d', { willReadFrequently: true })
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
        await performDiagnosis(file)
      }
    }, 'image/jpeg', 0.85)
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

  const performDiagnosis = async (file: File) => {
    isScanning.value = true
    errorMessage.value = ''
    
    try {
      // Compress before sending
      const compressedBlob = await compressImage(file)
      const finalFile = new File([compressedBlob], 'scan.jpg', { type: 'image/jpeg' })

      const formData = new FormData()
      formData.append('image', finalFile)
      if (userUuid.value) {
        formData.append('user_uuid', userUuid.value)
      }

      const response = await diagnosisService.create(formData, {
        headers: userUuid.value ? { 'X-User-Uuid': userUuid.value } : {}
      })
      if (response) setDiagnosis(response as any)
    } catch (err: any) {
      errorMessage.value = err.data?.error || err.statusMessage || err.message || 'Scanning error.'
    } finally {
      isScanning.value = false
    }
  }

  const stopCamera = () => {
    if (qualityCheckInterval) clearInterval(qualityCheckInterval)
    qualityCheckInterval = null
    qualityError.value = null
    if (stream) stream.getTracks().forEach(track => track.stop())
    stream = null
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (isCameraOn.value) {
        wasOnBeforeHidden = true
        stopCamera()
        isCameraOn.value = false
      } else {
        wasOnBeforeHidden = false
      }
    } else {
      // Returning to tab: Resume if it was on before
      if (wasOnBeforeHidden && !previewImage.value) {
        startCamera()
      }
    }
  }

  onMounted(() => { 
    if (!previewImage.value) {
      startCamera()
    } else {
      isCameraOn.value = false
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })
  onUnmounted(() => { 
    stopCamera()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })
</script>

<template>
  <section class="relative w-full h-full" aria-labelledby="scanner-heading">
    <div class="bg-primary flex h-full flex-col overflow-hidden rounded-3xl transition-colors duration-500">
      <div class="sm:mx-10 mb-4 sm:mb-5 flex flex-1 flex-col items-center">
        <h1
          id="scanner-heading"
          class="bg-foreground mt-3.5 w-full max-w-[500px] min-h-[4rem] rounded-t-3xl px-4 sm:px-10 py-3 text-center text-3xl font-bold transition-all flex items-center justify-center"
          :class="[qualityError || errorMessage || (!isCameraOn && !previewImage) ? 'text-destructive' : 'text-green-500']"
        >
          <span v-if="isScanning" class="text-destructive uppercase tracking-widest animate-pulse">Analyzing Image...</span>
          <span v-else-if="errorMessage" class="text-destructive">{{ errorMessage }}</span>
          <span v-else-if="previewImage" class="text-green-500">Scan Captured</span>
          <span v-else-if="!isCameraOn" class="text-destructive">Camera is Off</span>
          <span v-else-if="qualityError">{{ qualityError }}</span>
          <span v-else>Ready for Scan</span>
        </h1>

        <input type="file" ref="fileInput" accept="image/*" class="hidden" @change="handleFileUpload" />
        <canvas ref="canvasRef" class="hidden"></canvas>

        <div class="relative flex w-full flex-1 min-h-0 flex-col overflow-hidden rounded-3xl rounded-br-none bg-black">
          <img v-if="previewImage" :src="previewImage" class="absolute inset-0 h-full w-full rounded-4xl object-contain p-2 sm:p-4 bg-black transition-opacity duration-500" :class="{ 'opacity-50': isScanning }" />
          <video v-show="isCameraOn && !previewImage" ref="videoRef" autoplay playsinline class="h-full w-full rounded-4xl object-cover p-3 sm:p-5 transition-opacity duration-500 -scale-x-100" :class="{ 'opacity-30 pointer-events-none': isScanning }"></video>
          <div v-if="!isCameraOn && !previewImage" class="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4 p-4 text-center">
             <Icon name="material-symbols:videocam-off-outline-rounded" class="text-6xl sm:text-8xl opacity-20" />
             <p class="text-lg sm:text-xl font-normal opacity-50">Camera access is paused</p>
          </div>
          <div v-if="previewImage && !isScanning" class="absolute top-8 left-8">
            <AppButton variant="unstyled" size="unstyled" rounded="unstyled" @click="resetToCamera" class="bg-white/90 backdrop-blur px-5 py-2 rounded-full font-bold shadow-xl flex items-center gap-2 hover:bg-white active:scale-95 transition-all text-primary">
              <Icon name="material-symbols:arrow-back-rounded" class="text-xl" />
              Retake Scan
            </AppButton>
          </div>
          <div v-if="isCameraOn && !isScanning && !qualityError && !previewImage" class="absolute inset-0 border-[30px] sm:border-[60px] border-black/20 pointer-events-none flex items-center justify-center">
             <div class="w-2/3 h-2/3 border-2 border-green-500/50 rounded-3xl"></div>
          </div>
          <div v-if="isScanning" class="absolute inset-0 flex items-center justify-center">
             <div class="h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
          </div>
          <AppScannerControls :is-camera-on="isCameraOn || !!previewImage" :is-scanning="isScanning" :has-quality-error="!!qualityError" @toggle-camera="toggleCamera" @trigger-file="triggerFileInput" @scan="captureAndScan" />
        </div>
      </div>
    </div>
  </section>
</template>
