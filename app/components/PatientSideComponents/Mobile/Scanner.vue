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
    reader.onload = e => {
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
            canvas.toBlob(
              blob => {
                toast.dismiss(toastId)
                if (blob) {
                  const file = new File([blob], 'dropped-image.jpg', { type: 'image/jpeg' })
                  toast.success('Image loaded from link successfully!')
                  processImageFile(file)
                } else {
                  toast.error('Could not extract image from link. Please save and drop the file.')
                }
              },
              'image/jpeg',
              0.9
            )
          } catch (canvasErr) {
            toast.dismiss(toastId)
            toast.error(
              'Direct link access is protected by CORS. Please right-click > "Save Image As" and drop the file.'
            )
          }
        }
        img.onerror = () => {
          toast.dismiss(toastId)
          toast.error(
            'Unable to load image from URL. Please save the image and drop the file directly.'
          )
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
      if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:image/')
      ) {
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
      if (
        !videoRef.value ||
        !canvasRef.value ||
        isScanning.value ||
        !isCameraOn.value ||
        previewImage.value
      )
        return
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

  const validateImageQuality = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): string | null => {
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    let totalLum = 0
    let variance = 0
    const pixelCount = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
      const r = (data as any)[i]
      const g = (data as any)[i + 1]
      const b = (data as any)[i + 2]
      totalLum += 0.299 * r + 0.587 * g + 0.114 * b
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
        canvas.toBlob(
          blob => {
            if (blob) resolve(blob)
            else reject('Compression failed')
          },
          'image/jpeg',
          0.85
        )
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

    canvas.toBlob(
      async blob => {
        if (blob) {
          const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' })
          selectedFile.value = file
          await runDiagnosis(file)
        }
      },
      'image/jpeg',
      0.85
    )
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
    class="fixed inset-0 overflow-hidden bg-black"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Drag & Drop Hover Overlay (Active when hovering file/image/link) -->
    <div
      v-if="isDraggingOver && !isScanning"
      class="border-primary animate-in fade-in zoom-in-95 pointer-events-none absolute inset-4 z-50 flex flex-col items-center justify-center rounded-3xl border-4 border-dashed bg-black/85 p-6 text-center backdrop-blur-md transition-all duration-150"
    >
      <div
        class="bg-primary/20 text-primary ring-primary/10 mb-4 flex h-20 w-20 animate-bounce items-center justify-center rounded-full ring-8"
      >
        <Icon
          name="material-symbols:add-photo-alternate-rounded"
          class="text-4xl"
        />
      </div>
      <h3 class="mb-1 text-xl font-black tracking-tight text-white">Drop Image or Link Here</h3>
      <p class="mb-4 text-sm leading-relaxed text-gray-300">
        Release your image file or web link to load and analyze instantly
      </p>
      <div class="flex items-center gap-2">
        <span
          class="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wider text-white/90 uppercase"
        >
          JPG, PNG, WEBP
        </span>
        <span
          class="bg-primary/20 text-primary border-primary/30 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wider uppercase"
        >
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
      class="absolute inset-0 h-full w-full -scale-x-100 object-cover"
    ></video>

    <img
      v-if="previewImage"
      :src="previewImage"
      class="absolute inset-0 h-full w-full object-cover"
    />

    <!-- === EMPTY STATE (no camera, no image) === -->
    <div
      v-if="!isCameraOn && !previewImage"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none"
    >
      <Icon
        name="solar:camera-minimalistic-linear"
        class="text-8xl text-white/10"
      />
      <p class="text-sm font-medium text-white/25">
        Tap the camera button or drop an image to start
      </p>
    </div>

    <!-- === TOP HUD: Status / No-Image / Error bar === -->
    <div
      class="pointer-events-none absolute top-0 right-0 left-0 z-30 flex flex-col items-center gap-2 px-4 pt-24"
    >
      <!-- No image found pill -->
      <div
        v-if="!isCameraOn && !previewImage"
        class="flex items-center gap-2 rounded-full bg-black/60 px-5 py-2 backdrop-blur-md"
      >
        <Icon
          name="solar:camera-minimalistic-broken"
          class="text-white/50"
          size="16"
        />
        <span class="text-xs font-semibold tracking-wider text-white/70 uppercase"
          >No Image Found</span
        >
      </div>

      <!-- Error message pill -->
      <div
        v-if="errorMessage"
        class="border-red flex max-w-xs items-start gap-2 rounded-2xl border bg-red-500/30 px-4 py-2.5 backdrop-blur-md"
      >
        <Icon
          name="material-symbols:error-outline-rounded"
          class="mt-0.5 shrink-0 text-white"
          size="16"
        />
        <span class="text-xs leading-snug font-semibold text-white">{{ errorMessage }}</span>
      </div>
    </div>

    <!-- === AUGMENTED REALITY OVERLAYS (only on live camera) === -->
    <template v-if="isCameraOn && !previewImage && !isScanning">
      <!-- Quality warning AR overlay -->
      <div
        v-if="qualityError"
        class="pointer-events-none absolute inset-x-0 top-1/3 z-20 flex items-center justify-center"
      >
        <div
          class="mx-6 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-black/30 px-5 py-3 backdrop-blur-sm"
        >
          <Icon
            name="material-symbols:warning-outline-rounded"
            class="shrink-0 animate-pulse text-2xl text-amber-400"
          />
          <div>
            <p class="text-xs font-black tracking-wider text-amber-300 uppercase">
              Image Quality Warning
            </p>
            <p class="mt-0.5 text-sm font-semibold text-white/80">{{ qualityError }}</p>
          </div>
        </div>
      </div>

      <!-- Corner bracket targeting frame -->
      <div
        v-if="!qualityError"
        class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      >
        <div class="relative h-64 w-64">
          <div
            class="absolute top-0 left-0 h-10 w-10 rounded-tl-lg border-t-[3px] border-l-[3px] border-white/80"
          ></div>
          <div
            class="absolute top-0 right-0 h-10 w-10 rounded-tr-lg border-t-[3px] border-r-[3px] border-white/80"
          ></div>
          <div
            class="absolute bottom-0 left-0 h-10 w-10 rounded-bl-lg border-b-[3px] border-l-[3px] border-white/80"
          ></div>
          <div
            class="absolute right-0 bottom-0 h-10 w-10 rounded-br-lg border-r-[3px] border-b-[3px] border-white/80"
          ></div>
          <div class="absolute inset-0 flex items-end justify-center pb-3">
            <span class="text-[10px] font-semibold tracking-widest text-white/40 uppercase"
              >Place skin within frame</span
            >
          </div>
        </div>
      </div>
    </template>

    <!-- === SCANNING OVERLAY === -->
    <div
      v-if="isScanning"
      class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm"
    >
      <div
        class="border-t-primary h-16 w-16 animate-spin rounded-full border-4 border-white/20"
      ></div>
      <p class="text-base font-black tracking-widest text-white uppercase">Analyzing skin...</p>
      <p class="text-xs font-medium text-white/50">This takes just a moment</p>
    </div>

    <!-- === FLIP & RETAKE BUTTONS (below hero header) === -->
    <div class="absolute top-28 right-4 z-30 flex flex-col gap-2">
      <!-- Flip camera button (only when camera is live) -->
      <button
        v-if="isCameraOn && !previewImage && !isScanning"
        @click="flipCamera"
        class="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition-all active:scale-90"
      >
        <Icon
          name="material-symbols:flip-camera-android-rounded"
          size="22"
        />
      </button>

      <!-- Retake button (only when preview is shown) -->
      <button
        v-if="previewImage && !isScanning"
        @click="resetToCamera"
        class="flex h-11 items-center gap-2 rounded-full border border-white/20 bg-black/50 px-4 text-white backdrop-blur-md transition-all active:scale-90"
      >
        <Icon
          name="material-symbols:arrow-back-rounded"
          size="18"
        />
        <span class="text-xs font-bold">Retake</span>
      </button>
    </div>

    <!-- Upload quality warning AR pill (for uploaded images) -->
    <div
      v-if="uploadQualityWarning && previewImage"
      class="pointer-events-none absolute right-0 bottom-44 left-0 z-30 flex justify-center px-6"
    >
      <div
        class="flex max-w-xs items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/40 px-5 py-3 backdrop-blur-sm"
      >
        <Icon
          name="material-symbols:warning-outline-rounded"
          class="shrink-0 animate-pulse text-xl text-white"
        />
        <div>
          <p class="text-xs font-black tracking-wider text-white uppercase">Upload Warning</p>
          <p class="mt-0.5 text-sm font-medium text-white/90">{{ uploadQualityWarning }}</p>
        </div>
      </div>
    </div>

    <!-- AI Disclaimer Banner -->
    <div
      v-if="!isScanning"
      class="absolute right-4 bottom-48 left-4 z-30 flex justify-center"
    >
      <div
        class="flex max-w-sm items-center gap-2 rounded-2xl border border-white/20 bg-black/75 px-3.5 py-1.5 text-white shadow-2xl backdrop-blur-md"
      >
        <Icon
          name="lucide:info"
          class="text-primary h-3.5 w-3.5 shrink-0"
        />
        <p class="text-[10px] leading-tight text-white/90 select-none">
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
    <div class="absolute right-0 bottom-0 left-0 z-30 px-8 pt-4 pb-24">
      <!-- Gradient fade -->
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/60 to-transparent"
      ></div>

      <div class="relative flex items-center justify-between">
        <!-- Gallery / Upload button -->
        <button
          @click="triggerFileInput"
          class="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-black/50 text-white backdrop-blur-md transition-all active:scale-90"
        >
          <Icon
            name="famicons:folder-outline"
            size="28"
          />
        </button>

        <!-- Main shutter / diagnose button -->
        <button
          @click="captureAndDiagnose"
          :disabled="isScanning || (qualityError !== null && isCameraOn)"
          class="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-2xl transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <div
            class="flex h-16 w-16 items-center justify-center rounded-full border-4 border-black/10"
          >
            <Icon
              v-if="previewImage"
              name="solar:arrow-right-bold"
              size="28"
              class="text-primary"
            />
            <Icon
              v-else
              name="lucide:aperture"
              size="28"
              class="text-black"
            />
          </div>
        </button>

        <!-- Camera toggle (on/off) button -->
        <button
          @click="toggleCamera"
          class="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-black/50 backdrop-blur-md transition-all active:scale-90"
          :class="isCameraOn ? 'text-primary border-primary/40' : 'text-white'"
        >
          <Icon
            :name="
              isCameraOn
                ? 'material-symbols:videocam-rounded'
                : 'material-symbols:videocam-off-rounded'
            "
            size="28"
          />
        </button>
      </div>
    </div>

    <!-- Hidden inputs -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileUpload"
    />
    <canvas
      ref="canvasRef"
      class="hidden"
    ></canvas>

    <!-- Terms & Medical Disclaimer Modal -->
    <AppModalTermsModal
      v-model="showTermsModal"
      :initial-tab="termsInitialTab"
      @accept="agreeToConsent = true"
    />
  </div>
</template>
