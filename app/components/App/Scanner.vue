<script setup lang="ts">
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'
  import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
  import { toast } from 'vue-sonner'

  const { isScanning, isScanned, setDiagnosis, clearDiagnosis, qualityError, previewImage, selectedFile, patientUuid } = useDiagnosis()
  const userUuid = useCookie('user_uuid')
  const videoRef = ref<HTMLVideoElement | null>(null)
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const errorMessage = ref('')
  const fileInput = ref<HTMLInputElement | null>(null)
  const isCameraOn = ref(false)
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
  let wasOnBeforeHidden = true

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
    selectedFile.value = file
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

    // Extract src from HTML if HTML snippet was dropped
    const imgMatch = url.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (imgMatch && imgMatch[1]) {
      url = imgMatch[1]
    }

    // Handle base64 Data URLs
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
      // Attempt direct CORS fetch first
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
      // Fallback: load through HTML Image element + Canvas export
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
                toast.error('Could not extract image from link. Please save and drop the image file.')
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

    // 1. Dropped image files from file explorer or browser
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      const file = dataTransfer.files[0]
      if (file.type.startsWith('image/')) {
        processImageFile(file)
        return
      }
    }

    // 2. Dragged HTML elements (e.g. dragging an <img> from a web page)
    const htmlData = dataTransfer.getData('text/html')
    if (htmlData) {
      const match = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i)
      if (match && match[1]) {
        await processImageUrl(match[1])
        return
      }
    }

    // 3. Dragged URI list / links
    const uriData = dataTransfer.getData('text/uri-list')
    if (uriData) {
      const firstUrl = uriData.split('\n')[0].trim()
      if (firstUrl && !firstUrl.startsWith('#')) {
        await processImageUrl(firstUrl)
        return
      }
    }

    // 4. Dragged text/plain (URLs copied or selected from browser address bar)
    const textData = dataTransfer.getData('text/plain')
    if (textData) {
      const trimmed = textData.trim()
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
        await processImageUrl(trimmed)
        return
      }
    }

    // 5. Check transfer items fallback
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

  const triggerFileInput = () => {
    if (fileInput.value) fileInput.value.click()
  }

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files[0]) {
      const file = target.files[0]
      processImageFile(file)
    }
  }

  const resetToCamera = async () => {
    previewImage.value = null
    selectedFile.value = null
    isScanned.value = false
    uploadQualityWarning.value = null
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
    errorMessage.value = ''
    await nextTick() 
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      errorMessage.value = 'Camera API not supported. You must access this app via HTTPS (secure connection) to use the camera.'
      isCameraOn.value = false
      return
    }

    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' } }
        })
      } catch (constraintErr) {
        console.warn('Camera constraints failed, falling back to simple video stream:', constraintErr)
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      if (videoRef.value) {
        videoRef.value.srcObject = stream
        // Explicitly trigger play to bypass iOS autoplay restrictions
        try {
          await videoRef.value.play()
        } catch (playErr) {
          console.warn('Video auto-play blocked, playing manually:', playErr)
        }
      }
      startQualityLoop()
    } catch (err: any) {
      console.error('Camera access error:', err)
      errorMessage.value = `Camera access error: ${err.name} (${err.message})`
      isCameraOn.value = false // Reset state on error to keep UI responsive
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

  /**
   * Analyse quality of an uploaded image (data URL) using an off-screen canvas.
   * Uses the same luminance & variance heuristics as the live camera loop.
   * Sets uploadQualityWarning when an issue is detected, otherwise clears it.
   * This runs client-side only and never modifies the file sent to the API.
   */
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
      if (patientUuid.value) {
        formData.append('patient_uuid', patientUuid.value)
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

  watch(previewImage, (newVal) => {
    if (!newVal && !isScanning.value && !isCameraOn.value) {
      startCamera()
    }
  })

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
      <div class="sm:mx-10 mb-1 flex flex-1 flex-col items-center min-h-0">
        <h1
          id="scanner-heading"
          class="bg-foreground mt-1 w-full max-w-[500px] min-h-[3.5rem] rounded-t-3xl px-4 sm:px-10 py-2 text-center text-2xl font-bold transition-all flex items-center justify-center"
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

        <div
          class="relative flex w-full flex-1 min-h-0 flex-col overflow-hidden rounded-3xl rounded-br-none bg-black transition-all duration-300"
          :class="{ 'ring-4 ring-primary ring-inset': isDraggingOver }"
          @dragenter="handleDragEnter"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        >
          <!-- Drag & Drop Hover Overlay (Active when hovering file/image/link) -->
          <div
            v-if="isDraggingOver && !isScanning"
            class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md border-4 border-dashed border-primary rounded-3xl m-2 animate-in fade-in zoom-in-95 duration-150 transition-all pointer-events-none"
          >
            <div class="relative flex flex-col items-center p-6 text-center max-w-sm">
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
          </div>

          <!-- Quality Warning Overlay for Uploaded Images (Augmented style) -->
          <div
            v-if="uploadQualityWarning && !isScanning"
            class="absolute left-1/2 top-24 z-10 w-[90%] -translate-x-1/2 rounded-2xl border border-amber-500/30 bg-amber-950/80 p-4 text-white shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
          >
            <div class="flex items-start gap-3">
              <Icon
                name="material-symbols:warning-outline-rounded"
                class="text-amber-400 text-2xl shrink-0 mt-0.5"
              />
              <div class="flex-1">
                <h4 class="font-bold text-sm text-amber-200">Quality Warning: {{ uploadQualityWarning }}</h4>
                <p class="text-xs text-amber-100/80 mt-1 leading-relaxed">
                  This image has quality issues which may lead to lower scan accuracy. For best results, we recommend uploading a clearer, well-lit, close-up photo.
                </p>
              </div>
            </div>
          </div>

          <!-- Quality Warning Overlay for Camera (Augmented style) -->
          <div
            v-if="qualityError && isCameraOn && !previewImage && !isScanning"
            class="absolute left-1/2 top-6 z-10 w-[90%] -translate-x-1/2 rounded-2xl border border-red-500/30 bg-red-950/80 p-4 text-white shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
          >
            <div class="flex items-start gap-3">
              <Icon
                name="material-symbols:warning-outline-rounded"
                class="text-red-400 text-2xl shrink-0 mt-0.5"
              />
              <div class="flex-1">
                <h4 class="font-bold text-sm text-red-200">Camera Alert: {{ qualityError }}</h4>
                <p class="text-xs text-red-100/80 mt-1 leading-relaxed">
                  Please adjust your position, distance, or lighting. High-quality inputs ensure 99% better accuracy.
                </p>
              </div>
            </div>
          </div>

          <img v-if="previewImage" :src="previewImage" class="absolute inset-0 h-full w-full rounded-4xl object-contain p-2 bg-black transition-opacity duration-500" :class="{ 'opacity-50': isScanning }" />
          <video v-show="isCameraOn && !previewImage" ref="videoRef" autoplay playsinline muted class="h-full w-full rounded-4xl object-cover p-1 transition-opacity duration-500 -scale-x-100" :class="{ 'opacity-30 pointer-events-none': isScanning }"></video>
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
          
          <div
            v-if="!isScanning"
            class="absolute bottom-3 left-2 z-20 flex items-center pointer-events-auto max-w-[calc(100%-23rem)]"
          >
            <div class="flex items-center gap-2 rounded-2xl border border-white/20 bg-black/40 px-3.5 py-1.5 text-white shadow-2xl backdrop-blur-md">
              <Icon name="lucide:info" class="text-primary h-3.5 w-3.5 shrink-0" />
              <p class="text-[11px] sm:text-xs text-white/90 select-none leading-tight">
                AI results are assistive only.
                <button
                  type="button"
                  class="text-primary font-bold underline underline-offset-2 hover:opacity-85 cursor-pointer ml-0.5"
                  @click.stop="openTermsModal('terms')"
                >
                  Medical Disclaimer
                </button>
                &
                <button
                  type="button"
                  class="text-primary font-bold underline underline-offset-2 hover:opacity-85 cursor-pointer"
                  @click.stop="openTermsModal('privacy')"
                >
                  Privacy Policy
                </button>
              </p>
            </div>
          </div>

          <AppScannerControls
            :is-camera-on="isCameraOn || !!previewImage"
            :is-scanning="isScanning"
            :has-quality-error="!!qualityError"
            @toggle-camera="toggleCamera"
            @trigger-file="triggerFileInput"
            @scan="captureAndScan"
          />
        </div>
      </div>
    </div>

    <!-- Terms & Medical Disclaimer Modal -->
    <AppModalTermsModal
      v-model="showTermsModal"
      :initial-tab="termsInitialTab"
      @accept="agreeToConsent = true"
    />
  </section>
</template>
