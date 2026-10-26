export interface StreamAcquisitionOptions {
  deviceId?: string
  facingMode?: 'user' | 'environment'
  width?: { ideal?: number; min?: number; max?: number }
  height?: { ideal?: number; min?: number; max?: number }
}

export interface CapturePhotoOptions {
  mirror?: boolean
  maxSide?: number
  quality?: number
}

export interface CapturePhotoResult {
  file: File
  dataUrl: string
  width: number
  height: number
  source: 'image-capture' | 'canvas-fallback'
}

/**
 * Inspects device capabilities and applies advanced hardware constraints
 * such as continuous auto-focus, exposure, and white-balance.
 */
export const applyHardwareTrackOptimizations = async (track: MediaStreamTrack): Promise<void> => {
  if (!track || typeof track.getCapabilities !== 'function') return
  try {
    const capabilities = track.getCapabilities() as any
    const advanced: Record<string, any> = {}

    if (capabilities.focusMode && Array.isArray(capabilities.focusMode)) {
      if (capabilities.focusMode.includes('continuous')) {
        advanced.focusMode = 'continuous'
      }
    }
    if (capabilities.exposureMode && Array.isArray(capabilities.exposureMode)) {
      if (capabilities.exposureMode.includes('continuous')) {
        advanced.exposureMode = 'continuous'
      }
    }
    if (capabilities.whiteBalanceMode && Array.isArray(capabilities.whiteBalanceMode)) {
      if (capabilities.whiteBalanceMode.includes('continuous')) {
        advanced.whiteBalanceMode = 'continuous'
      }
    }

    if (Object.keys(advanced).length > 0 && typeof track.applyConstraints === 'function') {
      await track.applyConstraints({ advanced: [advanced] })
    }
  } catch (err) {
    console.warn('Advanced camera constraints could not be applied:', err)
  }
}

/**
 * Acquire media stream prioritizing 4K UHD and 1080p FHD resolutions
 * with graceful fallback ladders down to generic video if hardware fails.
 */
export const acquireOptimizedMediaStream = async (
  options: StreamAcquisitionOptions = {}
): Promise<MediaStream> => {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    throw new Error('Camera API not supported or insecure context (HTTPS required).')
  }

  const { deviceId, facingMode = 'environment' } = options

  // Resolution targets: Ideal 4K UHD (3840x2160), min 1080p FHD (1920x1080)
  const targetWidth = options.width || { ideal: 3840, min: 1920 }
  const targetHeight = options.height || { ideal: 2160, min: 1080 }

  // 1. If explicit deviceId is provided (e.g. external USB microscope or selected lens)
  if (deviceId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: targetWidth,
          height: targetHeight
        }
      })
      const track = stream.getVideoTracks()[0]
      if (track) await applyHardwareTrackOptimizations(track)
      return stream
    } catch (exactErr) {
      console.warn('Exact deviceId 4K/FHD failed, trying fallback resolution:', exactErr)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { ideal: deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        })
        const track = stream.getVideoTracks()[0]
        if (track) await applyHardwareTrackOptimizations(track)
        return stream
      } catch (_) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { ideal: deviceId } }
          })
          const track = stream.getVideoTracks()[0]
          if (track) await applyHardwareTrackOptimizations(track)
          return stream
        } catch (_) {}
      }
    }
  }

  // 2. High-res constraint with preferred facingMode
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: targetWidth,
        height: targetHeight
      }
    })
    const track = stream.getVideoTracks()[0]
    if (track) await applyHardwareTrackOptimizations(track)
    return stream
  } catch (highResErr) {
    console.warn('High-resolution constraint failed, falling back to 1080p ideal:', highResErr)
  }

  // 3. Fallback: 1080p ideal
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    })
    const track = stream.getVideoTracks()[0]
    if (track) await applyHardwareTrackOptimizations(track)
    return stream
  } catch (_) {}

  // 4. Fallback: facingMode only
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode } }
    })
    const track = stream.getVideoTracks()[0]
    if (track) await applyHardwareTrackOptimizations(track)
    return stream
  } catch (_) {}

  // 5. Ultimate fallback: generic video
  const stream = await navigator.mediaDevices.getUserMedia({ video: true })
  const track = stream.getVideoTracks()[0]
  if (track) await applyHardwareTrackOptimizations(track)
  return stream
}

const loadImageFromBlob = (blob: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = e => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

const renderImageToOutput = (
  img: HTMLImageElement,
  options: { mirror?: boolean; maxSide?: number; quality?: number }
): { file: File; dataUrl: string; width: number; height: number } => {
  const { mirror = false, maxSide = 2048, quality = 0.92 } = options
  const canvas = document.createElement('canvas')
  let width = img.naturalWidth || img.width
  let height = img.naturalHeight || img.height

  if (width > height && width > maxSide) {
    height = Math.round(height * (maxSide / width))
    width = maxSide
  } else if (height > maxSide) {
    width = Math.round(width * (maxSide / height))
    height = maxSide
  }

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (mirror) {
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(img, -width, 0, width, height)
    ctx.restore()
  } else {
    ctx.drawImage(img, 0, 0, width, height)
  }

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const byteString = atob(dataUrl.split(',')[1])
  const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  const blob = new Blob([ab], { type: mimeString })
  const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' })

  return { file, dataUrl, width, height }
}

/**
 * Captures high-resolution photo from the media stream.
 * Prefers the native ImageCapture API to grab raw ISP sensor data,
 * falling back cleanly to high-res canvas rendering from the video element.
 */
export const captureHighQualityPhoto = async (
  stream: MediaStream,
  video: HTMLVideoElement,
  options: CapturePhotoOptions = {}
): Promise<CapturePhotoResult> => {
  const { mirror = false, maxSide = 2048, quality = 0.92 } = options
  const track = stream ? stream.getVideoTracks()[0] : null

  // 1. Attempt ImageCapture API for native camera sensor photo (bypass video stream downscaling)
  if (track && typeof window !== 'undefined' && 'ImageCapture' in window) {
    try {
      const imageCapture = new (window as any).ImageCapture(track)
      const photoBlob: Blob = await imageCapture.takePhoto({
        fillLightMode: 'auto'
      })

      const img = await loadImageFromBlob(photoBlob)
      const { file, dataUrl, width, height } = renderImageToOutput(img, {
        mirror,
        maxSide,
        quality
      })

      return {
        file,
        dataUrl,
        width,
        height,
        source: 'image-capture'
      }
    } catch (captureErr) {
      console.warn('Native ImageCapture.takePhoto failed, falling back to canvas:', captureErr)
    }
  }

  // 2. Canvas Fallback: Draw video frame onto high-resolution canvas
  const canvas = document.createElement('canvas')
  const vWidth = video.videoWidth || 1920
  const vHeight = video.videoHeight || 1080

  let width = vWidth
  let height = vHeight

  if (width > height && width > maxSide) {
    height = Math.round(height * (maxSide / width))
    width = maxSide
  } else if (height > maxSide) {
    width = Math.round(width * (maxSide / height))
    height = maxSide
  }

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (mirror) {
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -width, 0, width, height)
    ctx.restore()
  } else {
    ctx.drawImage(video, 0, 0, width, height)
  }

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Canvas blob generation failed'))),
      'image/jpeg',
      quality
    )
  })

  const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' })

  return {
    file,
    dataUrl,
    width,
    height,
    source: 'canvas-fallback'
  }
}

/**
 * High-fidelity client-side image compressor.
 * Preserves clinical microtexture details with maxSide = 2048 and quality = 0.92.
 */
export const compressImage = (file: File, maxSide = 2048, quality = 0.92): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      if (width > height && width > maxSide) {
        height = Math.round(height * (maxSide / width))
        width = maxSide
      } else if (height > maxSide) {
        width = Math.round(width * (maxSide / height))
        height = maxSide
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(img.src)
        return reject(new Error('Could not get canvas context'))
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        blob => {
          URL.revokeObjectURL(img.src)
          if (blob) resolve(blob)
          else reject(new Error('Compression failed'))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = err => {
      URL.revokeObjectURL(img.src)
      reject(err)
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Validates brightness and measures focus sharpness using a 3x3 Laplacian edge kernel.
 * Matches the OpenCV Laplacian variance formulation in algorithms/src/image_quality.py.
 */
export const validateImageQuality = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): string | null => {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const totalPixels = width * height
  const gray = new Float32Array(totalPixels)

  let totalLum = 0
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    gray[p] = lum
    totalLum += lum
  }

  const avgLum = totalLum / totalPixels

  // Brightness thresholds
  if (avgLum < 80) return 'Too dark - use more light'
  if (avgLum > 230) return 'Too much glare - avoid direct reflection'

  // Discrete Laplacian focus calculation on interior pixels:
  // [ 0,  1,  0 ]
  // [ 1, -4,  1 ]
  // [ 0,  1,  0 ]
  let sumLap = 0
  let sumLapSq = 0
  let count = 0

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width
    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x
      const lap =
        gray[idx - width] + gray[idx + width] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx]

      sumLap += lap
      sumLapSq += lap * lap
      count++
    }
  }

  const mean = count > 0 ? sumLap / count : 0
  const laplacianVariance = count > 0 ? sumLapSq / count - mean * mean : 0

  // Low variance indicates lack of high-frequency edges (out of focus or motion blur)
  if (laplacianVariance < 20) return 'Get closer or fix focus...'

  return null
}

export const useCameraQuality = () => {
  return {
    acquireOptimizedMediaStream,
    applyHardwareTrackOptimizations,
    captureHighQualityPhoto,
    compressImage,
    validateImageQuality
  }
}
