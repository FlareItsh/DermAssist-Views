<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import { toast } from 'vue-sonner'
  import { getDeviceFingerprint } from '~/utils/deviceFingerprint'
  import { scanQuotaService, type ScanQuota } from '~/api/scanQuota/ScanQuotaService'
  import {
    acquireOptimizedMediaStream,
    captureHighQualityPhoto,
    compressImage,
    validateImageQuality
  } from '~/composables/useCameraQuality'

  definePageMeta({
    ssr: false,
    layout: 'landing-page'
  })

  // Auth Redirect: authenticated users should use their dashboard scanner
  const authToken = useCookie<string | null>('auth_token')
  const userRole = useCookie<string | null>('user_role')

  if (authToken.value) {
    const role = (userRole.value || '').toLowerCase()
    if (role === 'doctor') {
      navigateTo('/Doctor/Scan')
    } else {
      navigateTo('/Patient/Scan')
    }
  }

  // Device & Quota State
  const fingerprint = ref<string>('')
  const isLoadingQuota = ref(true)
  const quota = ref<ScanQuota | null>(null)
  const isScanning = ref(false)
  const errorMessage = ref('')

  // Camera & Image State
  const videoRef = ref<HTMLVideoElement | null>(null)
  const fileInput = ref<HTMLInputElement | null>(null)
  const isCameraOn = ref(false)
  const stream = ref<MediaStream | null>(null)
  const previewImage = ref<string | null>(null)
  const selectedFile = ref<File | null>(null)

  // Result State
  interface GuestScanResult {
    uuid: string
    guest_token: string
    confidence: number
    label: string
    is_teaser: boolean
    clinical_feedback?: string | null
    scan_quota?: ScanQuota
  }
  const scanResult = ref<GuestScanResult | null>(null)
  const guestCookie = useCookie<string | null>('da_guest_token', {
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax'
  })

  // Countdown timer calculation
  const countdownDisplay = computed(() => {
    if (!quota.value?.countdown_seconds || quota.value.countdown_seconds <= 0) return null
    const secs = quota.value.countdown_seconds
    const hours = Math.floor(secs / 3600)
    const mins = Math.floor((secs % 3600) / 60)
    return `${hours}h ${mins}m`
  })

  const loadQuota = async () => {
    isLoadingQuota.value = true
    try {
      if (!fingerprint.value) {
        fingerprint.value = await getDeviceFingerprint()
      }
      const res = await scanQuotaService.getGuestQuota(fingerprint.value)
      if (res?.data) {
        quota.value = res.data
      }
    } catch (e: any) {
      console.error('Failed to fetch guest quota:', e)
    } finally {
      isLoadingQuota.value = false
    }
  }

  // Camera handlers
  const startCamera = async () => {
    errorMessage.value = ''
    try {
      if (stream.value) {
        stream.value.getTracks().forEach(track => track.stop())
      }
      const media = await acquireOptimizedMediaStream({ facingMode: 'environment' })
      stream.value = media
      isCameraOn.value = true
      if (videoRef.value) {
        videoRef.value.srcObject = media
        await videoRef.value.play()
      }
    } catch (err: any) {
      isCameraOn.value = false
      toast.error('Unable to access camera. You can upload a photo instead.')
    }
  }

  const stopCamera = () => {
    if (stream.value) {
      stream.value.getTracks().forEach(track => track.stop())
      stream.value = null
    }
    isCameraOn.value = false
  }

  const capturePhoto = async () => {
    if (!videoRef.value) return
    try {
      if (stream.value) {
        const result = await captureHighQualityPhoto(stream.value, videoRef.value, {
          maxSide: 2048,
          quality: 0.92
        })
        stopCamera()
        await processImageFile(result.file)
        return
      }

      // Fallback direct canvas capture if stream instance missing
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.value.videoWidth || 1280
      canvas.height = videoRef.value.videoHeight || 720
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => {
          if (blob) {
            const file = new File([blob], 'skin-capture.jpg', { type: 'image/jpeg' })
            stopCamera()
            processImageFile(file)
          }
        }, 'image/jpeg', 0.92)
      }
    } catch (err: any) {
      console.warn('High quality capture fallback to direct frame:', err)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = videoRef.value.videoWidth || 1280
        canvas.height = videoRef.value.videoHeight || 720
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)
          canvas.toBlob(blob => {
            if (blob) {
              const file = new File([blob], 'skin-capture.jpg', { type: 'image/jpeg' })
              stopCamera()
              processImageFile(file)
            }
          }, 'image/jpeg', 0.92)
          return
        }
      } catch (fallbackErr) {
        console.error('Direct canvas capture error:', fallbackErr)
      }
      toast.error('Failed to capture photo. You can upload an image instead.')
    }
  }

  const onFileSelected = (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files && target.files[0]) {
      processImageFile(target.files[0])
    }
  }

  const processImageFile = async (file: File) => {
    errorMessage.value = ''
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.85 })
      const validation = await validateImageQuality(compressed)

      if (!validation.isValid && validation.message) {
        toast.warning(validation.message)
      }

      selectedFile.value = compressed
      previewImage.value = URL.createObjectURL(compressed)
    } catch (err) {
      selectedFile.value = file
      previewImage.value = URL.createObjectURL(file)
    }
  }

  const resetScanner = () => {
    stopCamera()
    previewImage.value = null
    selectedFile.value = null
    scanResult.value = null
    errorMessage.value = ''
  }

  const submitGuestScan = async () => {
    if (!selectedFile.value) {
      toast.error('Please capture or upload a skin photo first.')
      return
    }

    if (quota.value && !quota.value.can_scan) {
      toast.error('Daily guest scan limit reached. Please create a free account to continue.')
      return
    }

    isScanning.value = true
    errorMessage.value = ''

    try {
      if (!fingerprint.value) {
        fingerprint.value = await getDeviceFingerprint()
      }

      const formData = new FormData()
      formData.append('image', selectedFile.value)
      formData.append('device_fingerprint', fingerprint.value)

      const config = useRuntimeConfig()
      const apiBase = config.public?.apiBase || '/api'

      const response: any = await $fetch(`${apiBase}/guest/diagnose`, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Device-Fingerprint': fingerprint.value
        }
      })

      if (response?.data) {
        scanResult.value = response.data
        if (response.data.guest_token) {
          guestCookie.value = response.data.guest_token
        }
        if (response.data.scan_quota) {
          quota.value = response.data.scan_quota
        }
        toast.success('Skin analysis preview generated successfully!')
      }
    } catch (err: any) {
      const data = err.data || {}
      if (err.status === 429 || data.code === 'GUEST_SCAN_LIMIT_REACHED') {
        if (data.scan_quota) {
          quota.value = data.scan_quota
        }
        errorMessage.value = 'Daily guest scan limit reached. Sign up for free to continue.'
        toast.error('Daily scan limit reached.')
      } else {
        errorMessage.value = data.message || data.error || 'Failed to analyze skin photo. Please ensure clear lighting.'
        toast.error(errorMessage.value)
      }
    } finally {
      isScanning.value = false
    }
  }

  onMounted(async () => {
    await loadQuota()
  })

  onUnmounted(() => {
    stopCamera()
  })
</script>

<template>
  <div class="relative min-h-screen bg-background pt-24 pb-16 text-foreground sm:pt-28 sm:pb-24">
    <!-- Ambient soft blue brand glows -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="absolute -top-32 left-1/2 h-[450px] w-[500px] -translate-x-1/2 rounded-full bg-primary/8 blur-[120px]"
      />
      <div
        class="absolute top-1/2 -right-24 h-[350px] w-[350px] rounded-full bg-secondary/6 blur-[100px]"
      />
      <div
        class="absolute bottom-10 -left-20 h-[300px] w-[300px] rounded-full bg-blue-400/6 blur-[90px]"
      />
    </div>

    <div class="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="text-center">
        <div
          class="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary shadow-xs"
        >
          <Icon
            name="lucide:sparkles"
            class="h-3.5 w-3.5 text-primary"
          />
          <span>Free AI Skin Scan Preview</span>
        </div>

        <h1
          class="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl"
        >
          Check Your Skin in Seconds
        </h1>
        <p class="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base leading-relaxed">
          Our advanced AI analyzes your skin photo against dermatological models. Try a free scan with zero login required.
        </p>

        <!-- Quota Status Banner -->
        <div class="mt-5 flex justify-center">
          <div
            v-if="!isLoadingQuota && quota"
            class="inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 text-xs font-medium shadow-xs transition-all"
            :class="
              quota.can_scan
                ? 'border-emerald-500/30 bg-emerald-50 text-emerald-800'
                : 'border-amber-500/30 bg-amber-50 text-amber-800'
            "
          >
            <Icon
              :name="quota.can_scan ? 'lucide:check-circle-2' : 'lucide:clock'"
              class="h-4 w-4 shrink-0"
            />
            <span v-if="quota.can_scan">
              Guest Preview: <strong>{{ quota.remaining }} of {{ quota.limit }}</strong> free scan remaining today
            </span>
            <span v-else>
              Guest limit reached (0 remaining).
              <template v-if="countdownDisplay">
                Resets in {{ countdownDisplay }} or
              </template>
              <NuxtLink
                to="/auth/register"
                class="font-bold text-primary underline hover:text-primary-dark"
                >create an account</NuxtLink
              > for unlimited scans.
            </span>
          </div>
        </div>
      </div>

      <!-- Main Scanning Card -->
      <div class="mt-8 rounded-3xl border border-border/80 bg-card p-5 shadow-xl shadow-slate-200/50 backdrop-blur-xl sm:p-8">
        <!-- Error Banner -->
        <div
          v-if="errorMessage"
          class="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <Icon
            name="lucide:alert-circle"
            class="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          />
          <div class="flex-1">
            <p class="font-semibold">{{ errorMessage }}</p>
            <p
              v-if="quota && !quota.can_scan"
              class="mt-1 text-xs text-destructive/80"
            >
              Unregistered devices are limited to {{ quota.limit }} scan per 24 hours. Sign up for a free patient account to keep scanning.
            </p>
          </div>
        </div>

        <!-- 1. Result View (Teaser State) -->
        <div
          v-if="scanResult"
          class="space-y-6"
        >
          <!-- Teaser Header Card -->
          <div class="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white p-6 shadow-xs">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span class="text-xs font-bold tracking-wider text-emerald-700 uppercase">Analysis Complete</span>
                </div>
                <h2 class="mt-1 text-2xl font-black text-gray-900">
                  Skin Condition Detected
                </h2>
                <p class="mt-1 text-sm text-gray-600">
                  AI detected high visual similarity to:
                  <span class="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-bold text-primary">{{ scanResult.label }}</span>
                </p>
              </div>

              <!-- Confidence pill -->
              <div class="flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-white px-5 py-3 shadow-xs sm:flex-col sm:items-end">
                <span class="text-xs font-semibold text-gray-500">Confidence Score</span>
                <span class="text-2xl font-black text-emerald-600">
                  {{ Math.round((scanResult.confidence || 0.9) * 100) }}%
                </span>
              </div>
            </div>
          </div>

          <!-- Locked Clinical Details with Blurred Glass Overlay -->
          <div class="relative overflow-hidden rounded-2xl border border-border bg-slate-50/70 p-6">
            <!-- Mock Content under the blur -->
            <div class="filter blur-md select-none opacity-40 transition-all">
              <h3 class="text-lg font-bold text-gray-900">Clinical Assessment & Differential Diagnosis</h3>
              <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
                  <span class="text-xs text-gray-500 font-medium">Primary Match</span>
                  <p class="text-lg font-bold text-gray-900">{{ scanResult.label }} (92%)</p>
                </div>
                <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
                  <span class="text-xs text-gray-500 font-medium">Secondary Differential</span>
                  <p class="text-lg font-bold text-gray-900">Contact Dermatitis (5%)</p>
                </div>
                <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
                  <span class="text-xs text-gray-500 font-medium">Normal Skin Probability</span>
                  <p class="text-lg font-bold text-gray-900">Healthy Tissue (3%)</p>
                </div>
              </div>

              <div class="mt-6 space-y-3">
                <h4 class="text-sm font-bold text-gray-900">Prescription & Care Recommendations</h4>
                <p class="text-xs text-gray-600 leading-relaxed">
                  Topical treatments, daily gentle cleansers, and avoidance of comedogenic formulations are strongly recommended. A certified doctor review is needed to authorize clinical prescriptions.
                </p>
              </div>
            </div>

            <!-- Lock CTA Overlay -->
            <div class="absolute inset-0 flex flex-col items-center justify-center bg-white/85 p-6 text-center backdrop-blur-md">
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-lg shadow-primary/10">
                <Icon
                  name="lucide:lock"
                  class="h-7 w-7"
                />
              </div>

              <h3 class="mt-4 text-2xl font-black text-gray-900">
                Unlock Complete Medical Diagnosis
              </h3>
              <p class="mx-auto mt-2 max-w-md text-xs text-gray-600 sm:text-sm leading-relaxed">
                Create a free DermAssist account to see the full breakdown, differential probabilities, treatment guidelines, and connect directly with licensed dermatologists.
              </p>

              <!-- Call to Action Buttons -->
              <div class="mt-6 flex flex-col gap-3 sm:flex-row">
                <NuxtLink
                  :to="`/auth/register?claim_scan=${scanResult.guest_token}`"
                  class="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-full bg-secondary hover:bg-primary px-7 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg active:scale-95"
                >
                  <Icon
                    name="lucide:user-plus"
                    class="h-4 w-4"
                  />
                  <span>Create Free Account to Unlock</span>
                </NuxtLink>

                <NuxtLink
                  :to="`/auth/login?claim_scan=${scanResult.guest_token}`"
                  class="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-7 py-2.5 text-sm font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 active:scale-95"
                >
                  <Icon
                    name="lucide:log-in"
                    class="h-4 w-4"
                  />
                  <span>Log In to Claim Scan</span>
                </NuxtLink>
              </div>

              <button
                type="button"
                @click="resetScanner"
                class="mt-4 cursor-pointer text-xs font-semibold text-gray-500 hover:text-primary transition"
              >
                Scan another photo
              </button>
            </div>
          </div>
        </div>

        <!-- 2. Capture / Preview State -->
        <div
          v-else
          class="space-y-6"
        >
          <!-- Video Stream or Photo Preview Box -->
          <div class="relative flex min-h-[360px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-slate-900/95 p-4 transition">
            <!-- Live Camera -->
            <div
              v-show="isCameraOn"
              class="relative flex h-full w-full items-center justify-center"
            >
              <video
                ref="videoRef"
                autoplay
                playsinline
                muted
                class="max-h-[400px] w-full rounded-xl object-contain"
              />
              <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
                <!-- Focus viewfinder rectangle -->
                <div class="h-48 w-48 rounded-2xl border-2 border-emerald-400/90 shadow-2xl" />
              </div>
            </div>

            <!-- Captured / Selected Preview -->
            <div
              v-if="!isCameraOn && previewImage"
              class="relative flex h-full w-full items-center justify-center"
            >
              <img
                :src="previewImage"
                alt="Selected skin"
                class="max-h-[400px] w-full rounded-xl object-contain shadow-lg"
              />
              <button
                type="button"
                @click="resetScanner"
                class="absolute top-3 right-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-900/80 text-white shadow backdrop-blur transition hover:bg-slate-900"
                title="Remove photo"
              >
                <Icon
                  name="lucide:x"
                  class="h-4 w-4"
                />
              </button>
            </div>

            <!-- Empty State Prompt -->
            <div
              v-if="!isCameraOn && !previewImage"
              class="flex flex-col items-center justify-center text-center py-10 px-4"
            >
              <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner">
                <Icon
                  name="lucide:camera"
                  class="h-8 w-8 text-white"
                />
              </div>
              <h3 class="mt-4 text-base font-bold text-white">
                Take a Photo or Upload Image
              </h3>
              <p class="mt-1 max-w-sm text-xs text-slate-300">
                Ensure good lighting and hold camera 4-6 inches from the skin lesion for best accuracy.
              </p>

              <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  @click="startCamera"
                  class="inline-flex cursor-pointer items-center gap-2 rounded-full bg-secondary hover:bg-primary px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-primary/20 transition active:scale-95"
                >
                  <Icon
                    name="lucide:camera"
                    class="h-4 w-4"
                  />
                  <span>Open Camera</span>
                </button>

                <button
                  type="button"
                  @click="fileInput?.click()"
                  class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 px-6 py-2.5 text-xs font-semibold text-white shadow-xs transition active:scale-95"
                >
                  <Icon
                    name="lucide:upload"
                    class="h-4 w-4"
                  />
                  <span>Upload File</span>
                </button>

                <input
                  ref="fileInput"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="hidden"
                  @change="onFileSelected"
                />
              </div>
            </div>
          </div>

          <!-- Controls Bar when Camera is Active -->
          <div
            v-if="isCameraOn"
            class="flex items-center justify-center gap-4"
          >
            <button
              type="button"
              @click="stopCamera"
              class="cursor-pointer rounded-full border border-gray-200 bg-white hover:bg-gray-50 px-5 py-2.5 text-xs font-semibold text-gray-700 shadow-xs transition"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="capturePhoto"
              class="inline-flex cursor-pointer items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 px-7 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition active:scale-95"
            >
              <Icon
                name="lucide:aperture"
                class="h-4 w-4"
              />
              <span>Capture Photo</span>
            </button>
          </div>

          <!-- Submit Scan Button when Photo is Selected -->
          <div
            v-if="!isCameraOn && previewImage"
            class="flex flex-col items-center gap-3"
          >
            <button
              type="button"
              :disabled="isScanning || (quota !== null && !quota.can_scan)"
              @click="submitGuestScan"
              class="inline-flex min-h-[48px] w-full max-w-sm cursor-pointer items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition-all"
              :class="
                quota && !quota.can_scan
                  ? 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400 shadow-none'
                  : 'bg-secondary hover:bg-primary text-white shadow-lg shadow-primary/25 hover:scale-[1.01] active:scale-[0.98]'
              "
            >
              <Icon
                v-if="isScanning"
                name="svg-spinners:ring-resize"
                class="h-5 w-5"
              />
              <Icon
                v-else-if="quota && !quota.can_scan"
                name="lucide:lock"
                class="h-5 w-5 text-gray-400"
              />
              <Icon
                v-else
                name="lucide:sparkles"
                class="h-5 w-5"
              />
              <span v-if="quota && !quota.can_scan">Daily Free Scan Limit Reached</span>
              <span v-else>{{ isScanning ? 'Analyzing Skin with AI...' : 'Analyze Skin Now' }}</span>
            </button>

            <!-- Prompt when photo captured but quota reached -->
            <div
              v-if="quota && !quota.can_scan"
              class="flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-center shadow-xs"
            >
              <div class="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <Icon
                  name="lucide:lock"
                  class="h-4 w-4 shrink-0 text-amber-600"
                />
                <span>Photo captured! Free scan limit reached.</span>
              </div>
              <p class="text-xs leading-relaxed text-amber-700">
                You've used today's 1 free preview. Create a free account to run AI analysis on this photo.
              </p>
              <NuxtLink
                to="/auth/register"
                class="mt-1 inline-flex items-center gap-1.5 rounded-full bg-secondary px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary hover:shadow active:scale-95"
              >
                <Icon
                  name="lucide:user-plus"
                  class="h-3.5 w-3.5"
                />
                <span>Sign Up to Analyze Photo</span>
              </NuxtLink>
            </div>

            <button
              type="button"
              :disabled="isScanning"
              @click="resetScanner"
              class="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition"
            >
              Retake or pick different image
            </button>
          </div>
        </div>
      </div>

      <!-- Trust Footer features -->
      <div class="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div class="flex items-start gap-3.5 rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:shadow-sm">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <Icon
              name="lucide:shield-check"
              class="h-5 w-5"
            />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">Private & Confidential</h4>
            <p class="mt-1 text-xs text-muted-foreground leading-relaxed">Photos analyzed in encrypted sandboxes with zero tracking or advertising.</p>
          </div>
        </div>

        <div class="flex items-start gap-3.5 rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:shadow-sm">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Icon
              name="lucide:brain"
              class="h-5 w-5"
            />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">Clinical AI Models</h4>
            <p class="mt-1 text-xs text-muted-foreground leading-relaxed">Trained on thousands of certified dermatological cases for top accuracy.</p>
          </div>
        </div>

        <div class="flex items-start gap-3.5 rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:shadow-sm">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-100 bg-purple-50 text-purple-600">
            <Icon
              name="lucide:user-check"
              class="h-5 w-5"
            />
          </div>
          <div>
            <h4 class="text-sm font-bold text-foreground">Direct Doctor Access</h4>
            <p class="mt-1 text-xs text-muted-foreground leading-relaxed">Easily connect with licensed specialists for confirmed treatments.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
