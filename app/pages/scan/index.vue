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
      const file = await captureHighQualityPhoto(videoRef.value)
      stopCamera()
      processImageFile(file)
    } catch (err: any) {
      toast.error('Failed to capture photo.')
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
  <div class="relative min-h-screen bg-neutral-950 pt-24 pb-16 text-white sm:pt-28 sm:pb-24">
    <!-- Ambient glowing backgrounds -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[130px]"
      />
      <div
        class="absolute top-1/3 -right-20 h-[400px] w-[400px] rounded-full bg-purple-600/15 blur-[120px]"
      />
      <div
        class="absolute bottom-10 -left-20 h-[350px] w-[350px] rounded-full bg-emerald-600/10 blur-[100px]"
      />
    </div>

    <div class="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="text-center">
        <div
          class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-neutral-300 backdrop-blur-md"
        >
          <Icon
            name="lucide:sparkles"
            class="h-3.5 w-3.5 text-amber-400"
          />
          <span>Free AI Skin Scan Preview</span>
        </div>

        <h1
          class="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl"
        >
          Check Your Skin in Seconds
        </h1>
        <p class="mx-auto mt-3 max-w-xl text-sm text-neutral-400 sm:text-base">
          Our advanced AI analyzes your skin photo against dermatological models. Try a free scan with zero login required.
        </p>

        <!-- Quota Status Banner -->
        <div class="mt-5 flex justify-center">
          <div
            v-if="!isLoadingQuota && quota"
            class="inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2 text-xs font-medium shadow-sm transition-all"
            :class="
              quota.can_scan
                ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
                : 'border-amber-500/30 bg-amber-950/40 text-amber-300'
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
                class="font-bold underline hover:text-white"
                >create an account</NuxtLink
              > for unlimited scans.
            </span>
          </div>
        </div>
      </div>

      <!-- Main Scanning Card -->
      <div class="mt-8 rounded-3xl border border-white/10 bg-neutral-900/80 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <!-- Error Banner -->
        <div
          v-if="errorMessage"
          class="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-300"
        >
          <Icon
            name="lucide:alert-circle"
            class="mt-0.5 h-5 w-5 shrink-0 text-red-400"
          />
          <div class="flex-1">
            <p class="font-semibold">{{ errorMessage }}</p>
            <p
              v-if="quota && !quota.can_scan"
              class="mt-1 text-xs text-red-300/80"
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
          <div class="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-neutral-900/60 to-neutral-900 p-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span class="text-xs font-bold tracking-wider text-emerald-400 uppercase">Analysis Complete</span>
                </div>
                <h2 class="mt-1 text-2xl font-black text-white">
                  Skin Condition Detected
                </h2>
                <p class="mt-1 text-sm text-neutral-300">
                  AI detected high visual similarity to:
                  <span class="rounded bg-white/10 px-2 py-0.5 font-bold text-white">{{ scanResult.label }}</span>
                </p>
              </div>

              <!-- Confidence pill -->
              <div class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 sm:flex-col sm:items-end">
                <span class="text-xs font-semibold text-neutral-400">Confidence Score</span>
                <span class="text-2xl font-black text-emerald-400">
                  {{ Math.round((scanResult.confidence || 0.9) * 100) }}%
                </span>
              </div>
            </div>
          </div>

          <!-- Locked Clinical Details with Blurred Glass Overlay -->
          <div class="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 p-6">
            <!-- Mock Content under the blur -->
            <div class="filter blur-md select-none opacity-40 transition-all">
              <h3 class="text-lg font-bold text-white">Clinical Assessment & Differential Diagnosis</h3>
              <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div class="rounded-xl border border-white/10 bg-white/5 p-4">
                  <span class="text-xs text-neutral-400">Primary Match</span>
                  <p class="text-lg font-bold text-white">{{ scanResult.label }} (92%)</p>
                </div>
                <div class="rounded-xl border border-white/10 bg-white/5 p-4">
                  <span class="text-xs text-neutral-400">Secondary Differential</span>
                  <p class="text-lg font-bold text-white">Contact Dermatitis (5%)</p>
                </div>
                <div class="rounded-xl border border-white/10 bg-white/5 p-4">
                  <span class="text-xs text-neutral-400">Normal Skin Probability</span>
                  <p class="text-lg font-bold text-white">Healthy Tissue (3%)</p>
                </div>
              </div>

              <div class="mt-6 space-y-3">
                <h4 class="text-sm font-bold text-neutral-300">Prescription & Care Recommendations</h4>
                <p class="text-xs text-neutral-400">
                  Topical treatments, daily gentle cleansers, and avoidance of comedogenic formulations are strongly recommended. A certified doctor review is needed to authorize clinical prescriptions.
                </p>
              </div>
            </div>

            <!-- Lock CTA Overlay -->
            <div class="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/75 p-6 text-center backdrop-blur-md">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-500/10">
                <Icon
                  name="lucide:lock"
                  class="h-6 w-6"
                />
              </div>

              <h3 class="mt-3 text-xl font-black text-white">
                Unlock Complete Medical Diagnosis
              </h3>
              <p class="mx-auto mt-2 max-w-md text-xs text-neutral-300 sm:text-sm">
                Create a free DermAssist account to see the full breakdown, differential probabilities, treatment guidelines, and connect directly with licensed dermatologists.
              </p>

              <!-- Call to Action Buttons -->
              <div class="mt-6 flex flex-col gap-3 sm:flex-row">
                <NuxtLink
                  :to="`/auth/register?claim_scan=${scanResult.guest_token}`"
                  class="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-neutral-950 shadow-xl transition hover:bg-neutral-200 active:scale-95"
                >
                  <Icon
                    name="lucide:user-plus"
                    class="h-4 w-4"
                  />
                  <span>Create Free Account to Unlock</span>
                </NuxtLink>

                <NuxtLink
                  :to="`/auth/login?claim_scan=${scanResult.guest_token}`"
                  class="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
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
                class="mt-4 cursor-pointer text-xs font-medium text-neutral-400 transition hover:text-white"
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
          <div class="relative flex min-h-[340px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/15 bg-neutral-950/60 p-4 transition">
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
                <div class="h-48 w-48 rounded-2xl border-2 border-emerald-400/80 shadow-2xl" />
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
                class="absolute top-3 right-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white shadow backdrop-blur transition hover:bg-black"
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
              <div class="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-neutral-400">
                <Icon
                  name="lucide:camera"
                  class="h-8 w-8"
                />
              </div>
              <h3 class="mt-4 text-base font-bold text-white">
                Take a Photo or Upload Image
              </h3>
              <p class="mt-1 max-w-sm text-xs text-neutral-400">
                Ensure good lighting and hold camera 4-6 inches from the skin lesion for best accuracy.
              </p>

              <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  @click="startCamera"
                  class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-neutral-950 shadow transition hover:bg-neutral-200 active:scale-95"
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
                  class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 active:scale-95"
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
              class="cursor-pointer rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="capturePhoto"
              class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 active:scale-95"
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
              class="inline-flex min-h-[48px] w-full max-w-sm cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon
                v-if="isScanning"
                name="svg-spinners:ring-resize"
                class="h-5 w-5"
              />
              <Icon
                v-else
                name="lucide:sparkles"
                class="h-5 w-5"
              />
              <span>{{ isScanning ? 'Analyzing Skin with AI...' : 'Analyze Skin Now' }}</span>
            </button>

            <button
              type="button"
              :disabled="isScanning"
              @click="resetScanner"
              class="cursor-pointer text-xs text-neutral-400 hover:text-white"
            >
              Retake or pick different image
            </button>
          </div>
        </div>
      </div>

      <!-- Trust Footer features -->
      <div class="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3 text-center sm:text-left">
        <div class="flex items-start gap-3.5">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-400">
            <Icon
              name="lucide:shield-check"
              class="h-5 w-5"
            />
          </div>
          <div>
            <h4 class="text-sm font-bold text-white">Private & Confidential</h4>
            <p class="mt-1 text-xs text-neutral-400">Photos analyzed in encrypted sandboxes with zero tracking or advertising.</p>
          </div>
        </div>

        <div class="flex items-start gap-3.5">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-purple-400">
            <Icon
              name="lucide:brain"
              class="h-5 w-5"
            />
          </div>
          <div>
            <h4 class="text-sm font-bold text-white">Clinical AI Models</h4>
            <p class="mt-1 text-xs text-neutral-400">Trained on thousands of certified dermatological cases for top accuracy.</p>
          </div>
        </div>

        <div class="flex items-start gap-3.5">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-amber-400">
            <Icon
              name="lucide:user-check"
              class="h-5 w-5"
            />
          </div>
          <div>
            <h4 class="text-sm font-bold text-white">Direct Doctor Access</h4>
            <p class="mt-1 text-xs text-neutral-400">Easily connect with licensed specialists for confirmed treatments.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
