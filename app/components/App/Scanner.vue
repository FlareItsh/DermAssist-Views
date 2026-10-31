<script setup lang="ts">
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'
  import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
  import { toast } from 'vue-sonner'
  import { useScanQuota } from '~/composables/useScanQuota'
  import { parseScanError, parseCameraError } from '~/utils/scannerErrorHandler'
  import {
    acquireOptimizedMediaStream,
    captureHighQualityPhoto,
    compressImage,
    validateImageQuality
  } from '~/composables/useCameraQuality'

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
    appointmentUuid,
    pendingPatientRegistration,
    isHealthyState,
    isNoneState
  } = useDiagnosis()
  const { isLimitReached, applyQuota, fetchQuota } = useScanQuota()
  const userUuid = useCookie('user_uuid')
  const userRole = useCookie('user_role')
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
  const videoDevices = ref<MediaDeviceInfo[]>([])
  const selectedDeviceId = ref<string>('')
  const currentDeviceIndex = ref(0)
  const isMirrored = ref(false)

  const toggleMirror = () => {
    isMirrored.value = !isMirrored.value
  }

  const isMicroscopeActive = computed(() => {
    if (!selectedDeviceId.value) return false
    const dev = videoDevices.value.find(d => d.deviceId === selectedDeviceId.value)
    return dev
      ? /usb|microscope|uvc|endoscope|analyzer|external|dermatoscope/i.test(dev.label)
      : false
  })

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
    errorMessage.value = ''
    selectedFile.value = file
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
            canvas.toBlob(
              blob => {
                toast.dismiss(toastId)
                if (blob) {
                  const file = new File([blob], 'dropped-image.jpg', { type: 'image/jpeg' })
                  toast.success('Image loaded from link successfully!')
                  processImageFile(file)
                } else {
                  toast.error(
                    'Could not extract image from link. Please save and drop the image file.'
                  )
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
      if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:image/')
      ) {
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
    const diagUuid = (currentDiagnosis.value as any)?.uuid || currentDiagnosis.value?.id
    if (diagUuid) {
      try {
        await diagnosisService.delete(String(diagUuid))
      } catch (e) {
        console.error('Failed to clean up retaken scan', e)
      }
    }
    errorMessage.value = ''
    clearDiagnosis()
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
    } catch (e) {
      console.warn('enumerateDevices error:', e)
    }
  }

  const cycleDevice = async () => {
    if (videoDevices.value.length <= 1) return
    currentDeviceIndex.value = (currentDeviceIndex.value + 1) % videoDevices.value.length
    selectedDeviceId.value = videoDevices.value[currentDeviceIndex.value].deviceId
    await startCamera()
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

  const acquireStream = async () => {
    return await acquireOptimizedMediaStream({
      deviceId: selectedDeviceId.value || undefined,
      facingMode: 'user'
    })
  }

  const startCamera = async () => {
    isCameraOn.value = true
    errorMessage.value = ''
    await nextTick()

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      errorMessage.value =
        'Camera API not supported. You must access this app via HTTPS (secure connection) to use the camera.'
      isCameraOn.value = false
      return
    }

    stopCamera()
    await new Promise(resolve => setTimeout(resolve, 200))

    try {
      stream = await acquireStream()

      if (videoRef.value) {
        videoRef.value.srcObject = stream
        try {
          await videoRef.value.play()
        } catch (playErr) {
          console.warn('Video auto-play blocked, playing manually:', playErr)
        }
      }
      await updateDeviceList()
      startQualityLoop()
    } catch (err: any) {
      console.error('Camera access error:', err)
      const { headerMessage, toastMessage } = parseCameraError(err)
      errorMessage.value = headerMessage
      toast.error(toastMessage)
      isCameraOn.value = false // Reset state on error to keep UI responsive
    }
  }

  const startQualityLoop = () => {
    if (qualityCheckInterval) clearInterval(qualityCheckInterval)
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

  const captureAndScan = async () => {
    if (isScanning.value) return

    if (isLimitReached.value) {
      toast.error('Daily scan limit reached. Please wait for your quota to reset.')
      return
    }

    // Case 1: Scanning a previewed (uploaded or already captured) image
    if (previewImage.value && selectedFile.value) {
      await performDiagnosis(selectedFile.value as File)
      return
    }

    // Case 2: Capturing from live camera
    if (!videoRef.value || qualityError.value || !isCameraOn.value || !stream) return

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

      await performDiagnosis(result.file)
    } catch (err) {
      console.error('High-resolution capture failed:', err)
      toast.error('Failed to capture high resolution photo. Please try again.')
    }
  }

  const performDiagnosis = async (file: File) => {
    if (isLimitReached.value) {
      toast.error('Daily scan limit reached. Please wait for your quota to reset.')
      return
    }

    isScanning.value = true
    errorMessage.value = ''

    try {
      // Compress before sending with high quality (2048px, 0.92)
      const compressedBlob = await compressImage(file, 2048, 0.92)
      const finalFile = new File([compressedBlob], 'scan.jpg', { type: 'image/jpeg' })

      const formData = new FormData()
      formData.append('image', finalFile)
      if (userUuid.value) {
        formData.append('user_uuid', userUuid.value)
      }
      if (
        patientUuid.value &&
        !pendingPatientRegistration.value &&
        patientUuid.value !== 'pending_new_patient'
      ) {
        formData.append('patient_uuid', patientUuid.value)
      }
      if (appointmentUuid.value) {
        formData.append('appointment_uuid', appointmentUuid.value)
      }
      formData.append(
        'scan_type',
        userRole.value === 'doctor' || userRole.value === 'secretary' ? 'in_clinic' : 'home'
      )

      const response = await diagnosisService.create(formData, {
        headers: userUuid.value ? { 'X-User-Uuid': userUuid.value } : {}
      })
      if (response) {
        setDiagnosis(response as any)
        if ((response as any).scan_quota) {
          applyQuota((response as any).scan_quota)
        }
        if (isNoneState.value) {
          errorMessage.value = 'Scan Failed. Please Try Again'
          toast.error(
            (response as any).clinical_feedback ||
              'The uploaded image does not appear to be human skin. Please try again with a clear, close-up photo.'
          )
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

  const stopCamera = () => {
    if (qualityCheckInterval) clearInterval(qualityCheckInterval)
    qualityCheckInterval = null
    qualityError.value = null
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

  watch(previewImage, newVal => {
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

  onMounted(async () => {
    await updateDeviceList()
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    }
    if (!previewImage.value) {
      startCamera()
    } else {
      isCameraOn.value = false
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
</script>

<template>
  <section
    class="relative h-full w-full"
    aria-labelledby="scanner-heading"
  >
    <div
      class="bg-primary flex h-full flex-col overflow-hidden rounded-3xl transition-colors duration-500"
    >
      <div class="mb-1 flex min-h-0 flex-1 flex-col items-center sm:mx-10">
        <h1
          id="scanner-heading"
          class="bg-foreground mt-1 flex min-h-[3.5rem] w-full max-w-[500px] items-center justify-center rounded-t-3xl px-4 py-2 text-center text-2xl font-bold transition-all sm:px-10"
          :class="[
            qualityError || errorMessage || (!isCameraOn && !previewImage)
              ? 'text-destructive'
              : 'text-green-500'
          ]"
        >
          <span
            v-if="isScanning"
            class="text-destructive animate-pulse tracking-widest uppercase"
            >Analyzing Image...</span
          >
          <span
            v-else-if="errorMessage"
            class="text-destructive"
            >{{ errorMessage }}</span
          >
          <span
            v-else-if="previewImage"
            class="text-green-500"
            >Scan Captured</span
          >
          <span
            v-else-if="!isCameraOn"
            class="text-destructive"
            >Camera is Off</span
          >
          <span v-else-if="qualityError">{{ qualityError }}</span>
          <span v-else>Ready for Scan</span>
        </h1>

        <input
          type="file"
          ref="fileInput"
          accept="image/*"
          class="hidden"
          @change="handleFileUpload"
        />
        <canvas
          ref="canvasRef"
          class="hidden"
        ></canvas>

        <div
          class="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl rounded-br-none bg-black transition-all duration-300"
          :class="{ 'ring-primary ring-4 ring-inset': isDraggingOver }"
          @dragenter="handleDragEnter"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        >
          <!-- Floating Scan Quota Indicator -->
          <div class="pointer-events-auto absolute top-3 left-3 z-20">
            <AppScanQuotaIndicator light-theme />
          </div>

          <!-- Drag & Drop Hover Overlay (Active when hovering file/image/link) -->
          <div
            v-if="isDraggingOver && !isScanning"
            class="border-primary animate-in fade-in zoom-in-95 pointer-events-none absolute inset-0 z-30 m-2 flex flex-col items-center justify-center rounded-3xl border-4 border-dashed bg-black/85 transition-all duration-150"
          >
            <div class="relative flex max-w-sm flex-col items-center p-6 text-center">
              <div
                class="bg-primary/20 text-primary ring-primary/10 mb-4 flex h-20 w-20 animate-bounce items-center justify-center rounded-full ring-8"
              >
                <Icon
                  name="material-symbols:add-photo-alternate-rounded"
                  class="text-4xl"
                />
              </div>
              <h3 class="mb-1 text-xl font-black tracking-tight text-white">
                Drop Image or Link Here
              </h3>
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
          </div>

          <!-- Quality Warning Overlay for Uploaded Images (Augmented style) -->
          <div
            v-if="uploadQualityWarning && !isScanning"
            class="animate-in fade-in zoom-in-95 absolute top-24 left-1/2 z-10 w-[90%] -translate-x-1/2 rounded-2xl border border-amber-500/30 bg-amber-950/80 p-4 text-white shadow-2xl duration-200"
          >
            <div class="flex items-start gap-3">
              <Icon
                name="material-symbols:warning-outline-rounded"
                class="mt-0.5 shrink-0 text-2xl text-amber-400"
              />
              <div class="flex-1">
                <h4 class="text-sm font-bold text-amber-200">
                  Quality Warning: {{ uploadQualityWarning }}
                </h4>
                <p class="mt-1 text-xs leading-relaxed text-amber-100/80">
                  This image has quality issues which may lead to lower scan accuracy. For best
                  results, we recommend uploading a clearer, well-lit, close-up photo.
                </p>
              </div>
            </div>
          </div>

          <!-- Quality Warning Overlay for Camera (Augmented style) -->
          <div
            v-if="qualityError && isCameraOn && !previewImage && !isScanning"
            class="animate-in fade-in zoom-in-95 absolute top-6 left-1/2 z-10 w-[90%] -translate-x-1/2 rounded-2xl border border-red-500/30 bg-red-950/80 p-4 text-white shadow-2xl duration-200"
          >
            <div class="flex items-start gap-3">
              <Icon
                name="material-symbols:warning-outline-rounded"
                class="mt-0.5 shrink-0 text-2xl text-red-400"
              />
              <div class="flex-1">
                <h4 class="text-sm font-bold text-red-200">Camera Alert: {{ qualityError }}</h4>
                <p class="mt-1 text-xs leading-relaxed text-red-100/80">
                  Please adjust your position, distance, or lighting. High-quality inputs ensure 99%
                  better accuracy.
                </p>
              </div>
            </div>
          </div>

          <img
            v-if="previewImage"
            :src="previewImage"
            class="absolute inset-0 h-full w-full rounded-4xl bg-black object-contain p-2 transition-opacity duration-500"
            :class="{ 'opacity-50': isScanning }"
          />
          <video
            v-show="isCameraOn && !previewImage"
            ref="videoRef"
            autoplay
            playsinline
            muted
            class="absolute inset-0 h-full w-full rounded-4xl object-cover p-1 transition-all duration-300"
            :class="{
              '-scale-x-100': isMirrored,
              'pointer-events-none opacity-30': isScanning
            }"
          ></video>

          <!-- Camera Controls Overlay (Switch camera & Mirror Toggle) -->
          <div
            v-if="isCameraOn && !previewImage && !isScanning"
            class="absolute top-4 right-4 z-20 flex items-center gap-2"
          >
            <!-- Mirror Toggle -->
            <button
              type="button"
              @click="toggleMirror"
              class="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-bold text-white shadow-lg transition-all hover:bg-black/80 active:scale-95"
              :title="isMirrored ? 'Switch to unmirrored natural view' : 'Switch to mirror view'"
            >
              <Icon
                :name="isMirrored ? 'lucide:flip-horizontal-2' : 'lucide:flip-horizontal'"
                class="text-base"
                :class="{ 'text-primary-400': isMirrored }"
              />
              <span>{{ isMirrored ? 'Mirrored' : 'Natural' }}</span>
            </button>

            <!-- Desktop Camera Switcher (Only visible when 2+ cameras exist, e.g. USB microscope plugged in) -->
            <button
              v-if="videoDevices.length > 1"
              type="button"
              @click="cycleDevice"
              class="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition-all hover:bg-black/80 active:scale-95"
              :title="isMicroscopeActive ? 'Switch to webcam' : 'Switch camera source'"
            >
              <Icon
                :name="
                  isMicroscopeActive ? 'lucide:microscope' : 'material-symbols:videocam-rounded'
                "
                class="text-base"
                :class="{ 'text-emerald-400': isMicroscopeActive }"
              />
              <span>{{ isMicroscopeActive ? 'USB Microscope' : 'Switch Camera' }}</span>
            </button>
          </div>
          <div
            v-if="!isCameraOn && !previewImage"
            class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center text-gray-500"
          >
            <Icon
              name="material-symbols:videocam-off-outline-rounded"
              class="text-6xl opacity-20 sm:text-8xl"
            />
            <p class="text-lg font-normal opacity-50 sm:text-xl">Camera access is paused</p>
          </div>

          <div
            v-if="previewImage && !isScanning"
            class="absolute top-8 left-8"
          >
            <AppButton
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              @click="resetToCamera"
              class="text-primary flex items-center gap-2 rounded-full bg-white/90 px-5 py-2 font-bold shadow-xl transition-all hover:bg-white active:scale-95"
            >
              <Icon
                name="material-symbols:arrow-back-rounded"
                class="text-xl"
              />
              Retake Scan
            </AppButton>
          </div>
          <div
            v-if="isCameraOn && !isScanning && !qualityError && !previewImage"
            class="pointer-events-none absolute inset-0 flex items-center justify-center border-[30px] border-black/20 sm:border-[60px]"
          >
            <div class="h-2/3 w-2/3 rounded-3xl border-2 border-green-500/50"></div>
          </div>
          <div
            v-if="isScanning"
            class="absolute inset-0 flex items-center justify-center"
          >
            <div
              class="h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent"
            ></div>
          </div>

          <div
            v-if="!isScanning"
            class="pointer-events-auto absolute bottom-3 left-2 z-20 hidden max-w-[calc(100%-23rem)] items-center sm:flex"
          >
            <div
              class="flex items-center gap-2 rounded-2xl border border-white/20 bg-black/40 px-3.5 py-1.5 text-white shadow-2xl"
            >
              <Icon
                name="lucide:info"
                class="text-primary h-3.5 w-3.5 shrink-0"
              />
              <p class="text-[11px] leading-tight text-white/90 select-none sm:text-xs">
                AI results are assistive only.
                <button
                  type="button"
                  class="text-primary ml-0.5 cursor-pointer font-bold underline underline-offset-2 hover:opacity-85"
                  @click.stop="openTermsModal('terms')"
                >
                  Medical Disclaimer
                </button>
                &
                <button
                  type="button"
                  class="text-primary cursor-pointer font-bold underline underline-offset-2 hover:opacity-85"
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
            :is-limit-reached="isLimitReached"
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
