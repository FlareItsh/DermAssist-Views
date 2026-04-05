<script setup lang="ts">
  definePageMeta({
    layout: 'auth-split-layout'
  })

  // Types
  type Role = 'patient' | 'doctor'

  // State
  const currentStep = ref(1)
  const role = ref<Role>('patient')
  const isCapturing = ref(false)
  const video = ref<HTMLVideoElement | null>(null)
  const canvas = ref<HTMLCanvasElement | null>(null)
  const stream = ref<MediaStream | null>(null)

  const fileInput = ref<HTMLInputElement | null>(null)

  const form = reactive({
    firstName: '',
    middleName: '', // Added elective middle name
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    prcNumber: '',
    idPhoto: null as string | null // Base64 encoded captured photo
  })

  // Methods
  const nextStep = () => {
    if (currentStep.value === 1) {
      if (role.value === 'doctor') {
        currentStep.value = 2
      } else {
        // Submit for Patient
        handleRegister()
      }
    }
  }

  const prevStep = () => {
    if (currentStep.value > 1) {
      currentStep.value--
      stopCamera()
    }
  }

  const handleRegister = () => {
    console.log('Registration Submitted:', { role: role.value, ...form })
    // In a real app, this would call an API
    navigateTo('/dashboard')
  }

  // Camera Methods
  const startCamera = async () => {
    isCapturing.value = true
    try {
      stream.value = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Prefer back camera on mobile
      })
      if (video.value) {
        video.value.srcObject = stream.value
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      alert('Could not access camera. Please check permissions.')
      isCapturing.value = false
    }
  }

  const stopCamera = () => {
    if (stream.value) {
      stream.value.getTracks().forEach(track => track.stop())
      stream.value = null
    }
    isCapturing.value = false
  }

  const capturePhoto = () => {
    if (video.value && canvas.value) {
      const context = canvas.value.getContext('2d')
      if (context) {
        // Set canvas dimensions to match video
        canvas.value.width = video.value.videoWidth
        canvas.value.height = video.value.videoHeight
        context.drawImage(video.value, 0, 0, canvas.value.width, canvas.value.height)
        form.idPhoto = canvas.value.toDataURL('image/png')
        stopCamera()
      }
    }
  }

  const handleFileUpload = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = e => {
        form.idPhoto = e.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  onUnmounted(() => {
    stopCamera()
  })
</script>

<template>
  <div class="custom-scrollbar flex h-full flex-col overflow-y-auto px-6 py-4">
    <!-- Header/Logo Area -->
    <div class="mb-1 flex flex-col items-center text-center">
      <NuxtLink to="/">
        <NuxtImg
          src="/DA_Logo.png"
          class="h-14"
        />
      </NuxtLink>
    </div>

    <!-- Progress Indicator -->
    <div class="mx-auto mb-2 flex w-full max-w-md items-center justify-between px-4">
      <div
        class="flex items-center gap-2"
        :class="currentStep >= 1 ? 'text-primary' : 'text-foreground/30'"
      >
        <div
          class="flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all"
          :class="currentStep >= 1 ? 'border-primary bg-primary/10' : 'border-foreground/20'"
        >
          1
        </div>
        <span class="text-xs font-semibold">Account Info</span>
      </div>

      <div class="bg-foreground/10 mx-3 h-[2px] flex-1">
        <div
          class="bg-primary h-full transition-all duration-500"
          :style="{ width: currentStep > 1 ? '100%' : '0%' }"
        ></div>
      </div>

      <div
        class="flex items-center gap-2"
        v-if="role === 'doctor'"
        :class="currentStep === 2 ? 'text-primary' : 'text-foreground/30'"
      >
        <div
          class="flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all"
          :class="currentStep === 2 ? 'border-primary bg-primary/10' : 'border-foreground/20'"
        >
          2
        </div>
        <span class="text-xs font-semibold">Verification</span>
      </div>
    </div>

    <!-- Step Transitions -->
    <div class="relative mx-auto w-full max-w-md">
      <transition
        mode="out-in"
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform translate-x-8 opacity-0"
        enter-to-class="transform translate-x-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-x-0 opacity-100"
        leave-to-class="transform -translate-x-8 opacity-0"
      >
        <!-- Step 1: Basic Information -->
        <div
          v-if="currentStep === 1"
          key="step1"
          class="flex w-full flex-col gap-2"
        >
          <div class="mb-1 text-center">
            <h1 class="text-foreground text-2xl font-bold tracking-tight">Create your account</h1>
            <p class="text-foreground/60 mt-1 text-sm">
              Choose your role and fill in your details.
            </p>
          </div>

          <!-- Role Selection -->
          <div class="mb-2 grid grid-cols-2 gap-3">
            <button
              @click="role = 'patient'"
              type="button"
              class="group hover:border-primary/50 relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all"
              :class="
                role === 'patient'
                  ? 'border-primary bg-primary/5 ring-primary/10 ring-4'
                  : 'border-foreground/10 bg-transparent'
              "
            >
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
                :class="
                  role === 'patient'
                    ? 'bg-primary shadow-primary/30 text-white shadow-lg'
                    : 'bg-foreground/5 text-foreground/40 group-hover:bg-foreground/10'
                "
              >
                <Icon
                  name="lucide:user"
                  class="h-5 w-5"
                />
              </div>
              <div class="text-center">
                <p class="text-sm font-bold">Patient</p>
                <p class="text-foreground/50 text-[9px]">Seeking consultation</p>
              </div>
            </button>

            <button
              @click="role = 'doctor'"
              type="button"
              class="group hover:border-primary/50 relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all"
              :class="
                role === 'doctor'
                  ? 'border-primary bg-primary/5 ring-primary/10 ring-4'
                  : 'border-foreground/10 bg-transparent'
              "
            >
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
                :class="
                  role === 'doctor'
                    ? 'bg-primary shadow-primary/30 text-white shadow-lg'
                    : 'bg-foreground/5 text-foreground/40 group-hover:bg-foreground/10'
                "
              >
                <Icon
                  name="lucide:stethoscope"
                  class="h-5 w-5"
                />
              </div>
              <div class="text-center">
                <p class="text-sm font-bold">Doctor</p>
                <p class="text-foreground/50 text-[9px]">Medical Professional</p>
              </div>
            </button>
          </div>

          <!-- Name Grid -->
          <div class="grid grid-cols-3 gap-3">
            <AuthInput
              id="first-name"
              v-model="form.firstName"
              label="First Name"
            />
            <AuthInput
              id="middle-name"
              v-model="form.middleName"
              label="Middle Name (Optional)"
            />
            <AuthInput
              id="last-name"
              v-model="form.lastName"
              label="Last Name"
            />
          </div>

          <AuthInput
            id="email"
            v-model="form.email"
            label="Email Address"
            type="email"
          />

          <div class="grid grid-cols-2 gap-3">
            <AuthInput
              id="password"
              v-model="form.password"
              label="Password"
              type="password"
            />
            <AuthInput
              id="confirm-password"
              v-model="form.confirmPassword"
              label="Confirm"
              type="password"
            />
          </div>

          <AppButton
            @click="nextStep"
            block
            class="mt-2"
          >
            <span>{{ role === 'doctor' ? 'Next: Verification' : 'Create Account' }}</span>
            <template #trailing>
              <Icon
                :name="role === 'doctor' ? 'lucide:chevron-right' : 'lucide:arrow-right'"
                class="h-5 w-5"
              />
            </template>
          </AppButton>

          <div class="mt-4 text-center">
            <AppButton
              variant="link"
              size="sm"
              to="/auth/login"
            >
              <span class="text-foreground/60 mr-1 font-normal">Already have an account?</span>
              Login
            </AppButton>
          </div>
        </div>

        <!-- Step 2: Professional Verification (Doctor Only) -->
        <div
          v-else-if="currentStep === 2"
          key="step2"
          class="flex w-full flex-col gap-2"
        >
          <AppButton
            variant="ghost"
            size="sm"
            @click="prevStep"
            class="mb-1 w-fit px-0!"
          >
            <template #leading>
              <Icon
                name="lucide:arrow-left"
                class="h-3 w-3"
              />
            </template>
            Back
          </AppButton>
          <div class="mb-1 text-center">
            <h1 class="text-foreground text-2xl font-bold tracking-tight">Doctor Verification</h1>
            <p class="text-foreground/60 mt-1 text-sm">
              Please provide your PRC credentials to get verified.
            </p>
          </div>

          <AuthInput
            id="prc-number"
            v-model="form.prcNumber"
            label="PRC Registration Number"
            placeholder="e.g. 1234567"
          />

          <!-- Photo Capture Section -->
          <div class="flex flex-col gap-2">
            <label class="text-foreground/70 ml-1 text-xs font-medium">PRC ID Photo</label>

            <!-- Camera Wrapper -->
            <div
              class="border-foreground/10 bg-foreground/5 relative aspect-video h-60 w-full overflow-hidden rounded-xl border-2 border-dashed"
            >
              <!-- Captured Preview -->
              <img
                v-if="form.idPhoto && !isCapturing"
                :src="form.idPhoto"
                class="h-full w-full object-contain p-2"
              />

              <!-- Live Camera -->
              <video
                v-show="isCapturing"
                ref="video"
                autoplay
                playsinline
                class="h-full w-full object-cover"
              ></video>

              <!-- Placeholder / Empty State -->
              <div
                v-if="!form.idPhoto && !isCapturing"
                class="text-foreground/40 flex h-full flex-col items-center justify-center"
              >
                <Icon
                  name="lucide:image"
                  class="mb-2 h-12 w-12 opacity-50"
                />
                <p class="text-xs">No photo captured yet</p>
              </div>

              <!-- Controls Overlay -->
              <div class="absolute inset-x-0 bottom-4 flex justify-center gap-3">
                <button
                  v-if="!isCapturing"
                  @click="startCamera"
                  type="button"
                  class="bg-foreground/80 text-background hover:bg-foreground flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold backdrop-blur-sm transition-all"
                >
                  <Icon
                    name="lucide:camera"
                    class="h-3 w-3"
                  />
                  <span>{{ form.idPhoto ? 'Retake Photo' : 'Capture ID' }}</span>
                </button>

                <button
                  v-if="isCapturing"
                  @click="capturePhoto"
                  type="button"
                  class="bg-primary flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-90"
                >
                  <div class="h-8 w-8 rounded-full border-4 border-white"></div>
                </button>

                <AppButton
                  v-if="isCapturing"
                  @click="stopCamera"
                  variant="destructive"
                  size="icon"
                  class="h-10 w-10 rounded-full!"
                >
                  <Icon
                    name="lucide:x"
                    class="h-5 w-5"
                  />
                </AppButton>
              </div>
            </div>

            <!-- Upload Fallback -->
            <div class="flex items-center gap-3">
              <div class="bg-foreground/5 h-px flex-1"></div>
              <span class="text-foreground/30 text-[10px] font-bold tracking-widest uppercase"
                >Or upload</span
              >
              <div class="bg-foreground/5 h-px flex-1"></div>
            </div>

            <AppButton
              variant="outline"
              block
              @click="fileInput?.click()"
            >
              <template #leading>
                <Icon
                  name="lucide:upload"
                  class="h-4 w-4 opacity-60"
                />
              </template>
              Browse from Files
            </AppButton>

            <input
              ref="fileInput"
              type="file"
              class="hidden"
              accept="image/*"
              @change="handleFileUpload"
            />
          </div>

          <div class="mt-2 flex flex-col gap-2">
            <AppButton
              @click="handleRegister"
              block
            >
              Complete Registration
            </AppButton>

            <AppButton
              @click="handleRegister"
              variant="ghost"
              size="sm"
              class="text-foreground/60"
            >
              Skip for now
            </AppButton>
          </div>

          <div class="mt-2 text-center">
            <AppButton
              variant="link"
              size="sm"
              to="/auth/login"
            >
              <span class="text-foreground/60 mr-1 font-normal">Already have an account?</span>
              Login
            </AppButton>
          </div>

          <!-- Hidden Canvas for capturing -->
          <canvas
            ref="canvas"
            class="hidden"
          ></canvas>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--foreground), 0.1);
    border-radius: 10px;
  }
</style>
