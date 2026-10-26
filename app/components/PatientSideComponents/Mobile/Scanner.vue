<script setup lang="ts">
  import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
  import { useRouter } from '#app'
  import { toast } from 'vue-sonner'
  import { useDiagnosis } from '~/composables/useDiagnosis'
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'
  import { useScanQuota } from '~/composables/useScanQuota'
  import { parseScanError, parseCameraError } from '~/utils/scannerErrorHandler'
  import {
    acquireOptimizedMediaStream,
    captureHighQualityPhoto,
    compressImage,
    validateImageQuality
  } from '~/composables/useCameraQuality'

  const router = useRouter()
  const {
    currentDiagnosis,
    isScanning,
    isScanned,
    setDiagnosis,
    clearDiagnosis,
    qualityError,
    previewImage,
    selectedFile,
    patientUuid,
    isHealthyState,
    isNoneState
  } = useDiagnosis()
  const { isLimitReached, applyQuota, fetchQuota } = useScanQuota()

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
  const isMirrored = ref(false)

  const toggleMirror = () => {
    isMirrored.value = !isMirrored.value
  }
  const videoDevices = ref<MediaDeviceInfo[]>([])
  const currentDeviceIndex = ref(0)
  const selectedDeviceId = ref<string>('')
  const isTorchSupported = ref(false)
  const isTorchOn = ref(false)
  const isMicroscopeActive = ref(false)

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

  const updateDeviceList = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      videoDevices.value = devices.filter(d => d.kind === 'videoinput')
      if (stream) {
        const activeTrack = stream.getVideoTracks()[0]
        const settings = activeTrack?.getSettings?.()
        if (settings?.deviceId) {
          const idx = videoDevices.value.findIndex(d => d.deviceId === settings.deviceId)
          if (idx !== -1) {
            currentDeviceIndex.value = idx
            selectedDeviceId.value = settings.deviceId
          }
        }
      }
      checkMicroscopeState()
    } catch (e) {
      console.warn('enumerateDevices error:', e)
    }
  }

  const checkMicroscopeState = () => {
    if (!selectedDeviceId.value) {
      isMicroscopeActive.value = false
      return
    }
    const currentDev = videoDevices.value.find(d => d.deviceId === selectedDeviceId.value)
    if (currentDev) {
      const label = currentDev.label.toLowerCase()
      isMicroscopeActive.value =
        /usb|microscope|uvc|endoscope|analyzer|external|dermatoscope/i.test(label)
    } else {
      isMicroscopeActive.value = false
    }
  }

  const checkTorchCapability = () => {
    if (!stream) {
      isTorchSupported.value = false
      isTorchOn.value = false
      return
    }
    const track = stream.getVideoTracks()[0]
    if (!track) {
      isTorchSupported.value = false
      isTorchOn.value = false
      return
    }
    const capabilities = (track as any)?.getCapabilities?.() || {}
    isTorchSupported.value = Boolean(capabilities.torch)
    if (!isTorchSupported.value) {
      isTorchOn.value = false
    }
  }

  const toggleTorch = async () => {
    if (!stream || !isTorchSupported.value) return
    const track = stream.getVideoTracks()[0]
    if (!track) return
    try {
      const nextState = !isTorchOn.value
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }]
      })
      isTorchOn.value = nextState
    } catch (e) {
      console.warn('Torch toggle failed:', e)
      isTorchSupported.value = false
      isTorchOn.value = false
    }
  }

  const canCycleCamera = computed(() => {
    return videoDevices.value.length > 1 || (!selectedDeviceId.value && !isMicroscopeActive.value)
  })

  const cycleCamera = async () => {
    if (!isCameraOn.value) return
    if (videoDevices.value.length > 1) {
      currentDeviceIndex.value = (currentDeviceIndex.value + 1) % videoDevices.value.length
      const nextDevice = videoDevices.value[currentDeviceIndex.value]
      selectedDeviceId.value = nextDevice.deviceId
      const label = (nextDevice.label || '').toLowerCase()
      if (/front|user|selfie/i.test(label)) {
        currentFacingMode.value = 'user'
      } else if (/back|rear|environment/i.test(label)) {
        currentFacingMode.value = 'environment'
      }
    } else {
      currentFacingMode.value = currentFacingMode.value === 'user' ? 'environment' : 'user'
      selectedDeviceId.value = ''
    }
    checkMicroscopeState()
    await startCamera()
  }

  const flipCamera = cycleCamera

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

    if (isTorchOn.value && stream) {
      const track = stream.getVideoTracks()[0]
      try {
        ;(track as any)?.applyConstraints?.({ advanced: [{ torch: false }] })
      } catch (_) {}
      isTorchOn.value = false
    }
    isTorchSupported.value = false

    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }

    if (videoRef.value) {
      const existing = videoRef.value.srcObject as MediaStream | null
      if (existing && existing.getTracks) {
        existing.getTracks().forEach(t => t.stop())
      }
      videoRef.value.srcObject = null
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

  const acquireStream = async () => {
    return await acquireOptimizedMediaStream({
      deviceId: selectedDeviceId.value || undefined,
      facingMode: currentFacingMode.value
    })
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

    stopCamera()
    await new Promise(resolve => setTimeout(resolve, 250))

    try {
      stream = await acquireStream()
    } catch (err: any) {
      console.error('Camera error:', err)
      const { headerMessage, toastMessage } = parseCameraError(err)
      errorMessage.value = headerMessage
      toast.error(toastMessage)
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

    checkTorchCapability()
    await updateDeviceList()
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

  const resetToCamera = async () => {
    const diagUuid = (currentDiagnosis.value as any)?.uuid || currentDiagnosis.value?.id
    if (diagUuid) {
      try {
        await diagnosisService.delete(String(diagUuid))
      } catch (e) {
        console.error('Failed to clean up retaken scan', e)
      }
    }
    clearDiagnosis()
    previewImage.value = null
    selectedFile.value = null
    isScanned.value = false
    uploadQualityWarning.value = null
    await startCamera()
  }

  const captureAndDiagnose = async () => {
    if (isScanning.value) return

    if (isLimitReached.value) {
      toast.error('Daily scan limit reached. Please wait for your quota to reset.')
      return
    }

    // Case 1: Diagnose already loaded file/preview
    if (previewImage.value && selectedFile.value) {
      await runDiagnosis(selectedFile.value)
      return
    }

    // Case 2: Capture snapshot from active camera stream
    if (!videoRef.value || !isCameraOn.value || !stream) {
      errorMessage.value = 'Please upload a photo or turn on the camera'
      return
    }

    const video = videoRef.value
    const shouldMirror = isMirrored.value

    try {
      const result = await captureHighQualityPhoto(stream, video, {
        mirror: shouldMirror,
        maxSide: 2048,
        quality: 0.92
      })

      previewImage.value = result.dataUrl
      selectedFile.value = result.file
      stopCamera()
      isCameraOn.value = false

      await runDiagnosis(result.file)
    } catch (err) {
      console.error('High-resolution capture failed:', err)
      toast.error('Failed to capture high resolution photo. Please try again.')
    }
  }

  const runDiagnosis = async (file: File) => {
    if (isLimitReached.value) {
      toast.error('Daily scan limit reached. Please wait for your quota to reset.')
      return
    }

    isScanning.value = true
    errorMessage.value = ''
    try {
      const compressedBlob = await compressImage(file, 2048, 0.92)
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
        if ((response as any).scan_quota) {
          applyQuota((response as any).scan_quota)
        }
        if (isHealthyState.value) {
          errorMessage.value = 'Healthy skin detected. No disease present.'
          toast.info('Healthy skin detected. No disease present.')
        } else if (isNoneState.value) {
          errorMessage.value = 'Scan Failed. Please Try Again'
          toast.error(
            (response as any).clinical_feedback ||
              'The uploaded image does not appear to be human skin. Please try again with a clear, close-up photo.'
          )
        } else {
          try {
            const diagUuid = (response as any)?.uuid || (response as any)?.id
            if (diagUuid) {
              await diagnosisService.update(String(diagUuid), { status: 'completed' })
            }
          } catch (e) {
            console.error('Failed to confirm diagnosis status', e)
          }
          router.push('/Patient/Scan/Results')
        }
      }
    } catch (err: any) {
      await fetchQuota(true)
      const { headerMessage, toastMessage } = parseScanError(err)
      errorMessage.value = headerMessage
      toast.error(toastMessage)
    } finally {
      isScanning.value = false
    }
  }

  let wasCameraActiveBeforeHide = false
  const handleVisibilityChange = async () => {
    if (document.hidden) {
      if (isCameraOn.value) {
        wasCameraActiveBeforeHide = true
        stopCamera()
        isCameraOn.value = false
      }
    } else {
      if (wasCameraActiveBeforeHide && !previewImage.value) {
        wasCameraActiveBeforeHide = false
        await startCamera()
      }
    }
  }

  const handleDeviceChange = async () => {
    const prevCount = videoDevices.value.length
    await updateDeviceList()
    const otgDevice = videoDevices.value.find(d =>
      /usb|microscope|uvc|endoscope|analyzer|external|dermatoscope/i.test(d.label)
    )
    if (otgDevice && videoDevices.value.length > prevCount) {
      toast.success(`External microscope detected: ${otgDevice.label || 'USB Camera'}`)
    }
  }

  onMounted(async () => {
    await updateDeviceList()
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    stopCamera()
    if (navigator.mediaDevices?.removeEventListener) {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange)
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
      class="absolute inset-0 h-full w-full object-cover"
      :class="{ '-scale-x-100': isMirrored }"
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

    <!-- === TOP HUD: Status / Quota / Error bar === -->
    <div
      class="pointer-events-auto absolute top-0 right-0 left-0 z-30 flex flex-col items-center gap-2 px-4 pt-24"
    >
      <!-- Quota Indicator Pill -->
      <AppScanQuotaIndicator
        compact
        light-theme
      />

      <!-- USB Microscope active pill -->
      <div
        v-if="isCameraOn && isMicroscopeActive && !previewImage"
        class="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/80 px-4 py-1.5 text-emerald-200 shadow-lg backdrop-blur-md"
      >
        <Icon
          name="lucide:microscope"
          size="16"
          class="text-emerald-400"
        />
        <span class="text-xs font-bold tracking-wider uppercase"> USB Microscope Active </span>
      </div>

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

    <!-- === FLIP, TORCH & RETAKE BUTTONS (below hero header) === -->
    <div class="absolute top-28 right-4 z-30 flex flex-col gap-2">
      <!-- Mirror / Natural toggle button -->
      <button
        v-if="isCameraOn && !previewImage && !isScanning"
        type="button"
        @click="toggleMirror"
        class="flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition-all active:scale-90"
        :class="
          isMirrored
            ? 'border-primary/80 bg-primary/80 text-white shadow-lg'
            : 'border-white/20 bg-black/50 text-white'
        "
        :title="isMirrored ? 'Switch to unmirrored natural view' : 'Switch to mirror view'"
      >
        <Icon
          :name="isMirrored ? 'lucide:flip-horizontal-2' : 'lucide:flip-horizontal'"
          size="20"
        />
      </button>

      <!-- Flip / cycle camera button (only when camera is live and multiple cameras exist) -->
      <button
        v-if="isCameraOn && !previewImage && !isScanning && canCycleCamera"
        @click="cycleCamera"
        class="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition-all active:scale-90"
        :title="isMicroscopeActive ? 'Switch camera' : 'Flip camera'"
      >
        <Icon
          :name="
            isMicroscopeActive
              ? 'lucide:microscope'
              : 'material-symbols:flip-camera-android-rounded'
          "
          size="22"
        />
      </button>

      <!-- Torch / Flash button (ONLY when torch is supported by current camera hardware) -->
      <button
        v-if="isCameraOn && !previewImage && !isScanning && isTorchSupported"
        @click="toggleTorch"
        class="flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition-all active:scale-90"
        :class="
          isTorchOn
            ? 'border-amber-400/80 bg-amber-500/80 text-white shadow-lg shadow-amber-500/30'
            : 'border-white/20 bg-black/50 text-white'
        "
        :title="isTorchOn ? 'Turn off flash' : 'Turn on flash'"
      >
        <Icon
          :name="
            isTorchOn
              ? 'material-symbols:flashlight-on-rounded'
              : 'material-symbols:flashlight-off-rounded'
          "
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
          :disabled="isScanning || isLimitReached"
          class="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-black/50 text-white backdrop-blur-md transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
          :title="isLimitReached ? 'Daily scan limit reached' : 'Upload Image'"
        >
          <Icon
            name="famicons:folder-outline"
            size="28"
          />
        </button>

        <!-- Main shutter / diagnose button -->
        <button
          @click="captureAndDiagnose"
          :disabled="isScanning || (qualityError !== null && isCameraOn) || isLimitReached"
          class="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-2xl transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
          :title="isLimitReached ? 'Daily scan limit reached' : 'Start Scan'"
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
