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
      stream.value.getTracks().forEach((track) => track.stop())
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
      reader.onload = (e) => {
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
  <div class="flex h-full flex-col px-12 py-8 overflow-y-auto custom-scrollbar">
    <!-- Header/Logo Area -->
    <div class="mb-6 flex flex-col items-center text-center">
      <NuxtLink to="/">
        <NuxtImg
          src="/DA_Logo.png"
          class="h-20"
        />
      </NuxtLink>
    </div>

    <!-- Progress Indicator -->
    <div class="mb-8 flex w-full max-w-md mx-auto items-center justify-between px-4">
      <div
        class="flex items-center gap-3"
        :class="currentStep >= 1 ? 'text-primary' : 'text-foreground/30'"
      >
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-all"
          :class="
            currentStep >= 1
              ? 'border-primary bg-primary/10'
              : 'border-foreground/20'
          "
        >
          1
        </div>
        <span class="text-sm font-semibold">Account Info</span>
      </div>

      <div class="h-[2px] flex-1 mx-4 bg-foreground/10">
        <div
          class="h-full bg-primary transition-all duration-500"
          :style="{ width: currentStep > 1 ? '100%' : '0%' }"
        ></div>
      </div>

      <div
        class="flex items-center gap-3"
        v-if="role === 'doctor'"
        :class="currentStep === 2 ? 'text-primary' : 'text-foreground/30'"
      >
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-all"
          :class="
            currentStep === 2
              ? 'border-primary bg-primary/10'
              : 'border-foreground/20'
          "
        >
          2
        </div>
        <span class="text-sm font-semibold">Verification</span>
      </div>
    </div>

    <!-- Step Transitions -->
    <div class="relative w-full max-w-md mx-auto min-h-[450px]">
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
          class="flex w-full flex-col gap-4"
        >
          <div class="mb-4 text-center">
            <h1 class="text-foreground text-3xl font-bold tracking-tight">Create your account</h1>
            <p class="text-foreground/60 mt-2">Choose your role and fill in your details.</p>
          </div>

          <!-- Role Selection -->
          <div class="mb-6 grid grid-cols-2 gap-4">
            <button
              @click="role = 'patient'"
              type="button"
              class="group relative flex flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all hover:border-primary/50"
              :class="role === 'patient' ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-foreground/10 bg-transparent'"
            >
              <div
                class="flex h-12 w-12 items-center justify-center rounded-xl transition-colors"
                :class="role === 'patient' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-foreground/5 text-foreground/40 group-hover:bg-foreground/10'"
              >
                <Icon
                  name="lucide:user"
                  class="h-6 w-6"
                />
              </div>
              <div class="text-center">
                <p class="font-bold">Patient</p>
                <p class="text-[10px] text-foreground/50">Seeking consultation</p>
              </div>
            </button>

            <button
              @click="role = 'doctor'"
              type="button"
              class="group relative flex flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all hover:border-primary/50"
              :class="role === 'doctor' ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-foreground/10 bg-transparent'"
            >
              <div
                class="flex h-12 w-12 items-center justify-center rounded-xl transition-colors"
                :class="role === 'doctor' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-foreground/5 text-foreground/40 group-hover:bg-foreground/10'"
              >
                <Icon
                  name="lucide:stethoscope"
                  class="h-6 w-6"
                />
              </div>
              <div class="text-center">
                <p class="font-bold">Doctor</p>
                <p class="text-[10px] text-foreground/50">Medical Professional</p>
              </div>
            </button>
          </div>

          <!-- Name Grid -->
          <div class="grid grid-cols-3 gap-3">
            <AuthInput
              id="first-name"
              v-model="form.firstName"
              label="First"
            />
            <AuthInput
              id="middle-name"
              v-model="form.middleName"
              label="Middle (Opt)"
            />
            <AuthInput
              id="last-name"
              v-model="form.lastName"
              label="Last"
            />
          </div>

          <AuthInput
            id="email"
            v-model="form.email"
            label="Email Address"
            type="email"
          />

          <div class="grid grid-cols-2 gap-4">
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

          <button
            @click="nextStep"
            class="bg-primary text-primary-foreground shadow-primary/20 mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold shadow-lg transition-all hover:opacity-90 active:scale-95"
          >
            <span>{{ role === 'doctor' ? 'Next: Verification' : 'Create Account' }}</span>
            <Icon
              :name="role === 'doctor' ? 'lucide:chevron-right' : 'lucide:arrow-right'"
              class="h-5 w-5"
            />
          </button>
        </div>

        <!-- Step 2: Professional Verification (Doctor Only) -->
        <div
          v-else-if="currentStep === 2"
          key="step2"
          class="flex w-full flex-col gap-4"
        >
          <div class="mb-4 text-center">
            <h1 class="text-foreground text-3xl font-bold tracking-tight">Doctor Verification</h1>
            <p class="text-foreground/60 mt-2">Please provide your PRC credentials to get verified.</p>
          </div>

          <AuthInput
            id="prc-number"
            v-model="form.prcNumber"
            label="PRC Registration Number"
            placeholder="e.g. 1234567"
          />

          <!-- Photo Capture Section -->
          <div class="flex flex-col gap-3">
            <label class="text-foreground/70 text-sm font-medium ml-1">PRC ID Photo</label>

            <!-- Camera Wrapper -->
            <div
              class="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-dashed border-foreground/10 bg-foreground/5"
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
                class="flex h-full flex-col items-center justify-center text-foreground/40"
              >
                <Icon
                  name="lucide:image"
                  class="mb-2 h-12 w-12 opacity-50"
                />
                <p class="text-xs">No photo captured yet</p>
              </div>

              <!-- Controls Overlay -->
              <div class="absolute bottom-4 inset-x-0 flex justify-center gap-3">
                <button
                  v-if="!isCapturing"
                  @click="startCamera"
                  type="button"
                  class="bg-foreground/80 text-background flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold backdrop-blur-sm transition-all hover:bg-foreground"
                >
                  <Icon
                    name="lucide:camera"
                    class="h-4 w-4"
                  />
                  <span>{{ form.idPhoto ? 'Retake Photo' : 'Capture ID' }}</span>
                </button>

                <button
                  v-if="isCapturing"
                  @click="capturePhoto"
                  type="button"
                  class="bg-primary text-white flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform active:scale-90"
                >
                  <div class="h-8 w-8 rounded-full border-4 border-white"></div>
                </button>

                <button
                  v-if="isCapturing"
                  @click="stopCamera"
                  type="button"
                  class="bg-destructive text-white flex h-10 w-10 items-center justify-center rounded-full shadow-lg"
                >
                  <Icon
                    name="lucide:x"
                    class="h-5 w-5"
                  />
                </button>
              </div>
            </div>

            <!-- Upload Fallback -->
            <div class="flex items-center gap-3">
              <div class="h-[1px] flex-1 bg-foreground/5"></div>
              <span class="text-foreground/30 text-[10px] font-bold uppercase tracking-widest">Or upload</span>
              <div class="h-[1px] flex-1 bg-foreground/5"></div>
            </div>

            <label class="group cursor-pointer">
              <input
                type="file"
                class="hidden"
                accept="image/*"
                @change="handleFileUpload"
              />
              <div
                class="flex w-full items-center justify-center gap-2 rounded-xl border border-foreground/10 py-3 text-sm font-medium transition-all group-hover:bg-foreground/5"
              >
                <Icon
                  name="lucide:upload"
                  class="h-4 w-4 opacity-60"
                />
                <span>Browse from Files</span>
              </div>
            </label>
          </div>

          <div class="mt-6 flex flex-col gap-3">
            <button
              @click="handleRegister"
              class="bg-primary text-primary-foreground shadow-primary/20 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold shadow-lg transition-all hover:opacity-90 active:scale-95"
            >
              <span>Complete Registration</span>
            </button>

            <button
              @click="handleRegister"
              class="text-foreground/60 hover:text-foreground text-center text-sm font-medium transition-colors"
            >
              Skip for now
            </button>
          </div>

          <!-- Hidden Canvas for capturing -->
          <canvas
            ref="canvas"
            class="hidden"
          ></canvas>

          <button
            @click="prevStep"
            class="text-foreground/40 hover:text-foreground absolute -top-12 left-0 flex items-center gap-1 text-sm font-medium transition-colors"
          >
            <Icon name="lucide:arrow-left" />
            Back
          </button>
        </div>
      </transition>
    </div>

    <div class="mt-8 text-center text-sm" v-if="currentStep === 1">
      <span class="text-foreground/60">Already have an account?</span>
      <NuxtLink
        to="/auth/login"
        class="text-primary ml-1 font-semibold hover:underline"
      >
        Sign in
      </NuxtLink>
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
