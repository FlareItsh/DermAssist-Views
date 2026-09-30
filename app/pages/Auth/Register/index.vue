<script setup lang="ts">
  import { authService } from '~/api/auth/AuthService'
  import { toast } from 'vue-sonner'
  definePageMeta({
    layout: 'auth-split-layout'
  })

  // Types
  type Role = 'patient' | 'doctor'

  // State
  const currentStep = ref(1)
  const role = ref<Role>('patient')
  const verificationMode = ref<'upload' | 'camera'>('upload')
  const isCapturing = ref(false)
  const video = ref<HTMLVideoElement | null>(null)
  const canvas = ref<HTMLCanvasElement | null>(null)
  const stream = ref<MediaStream | null>(null)
  const uploadedFileName = ref<string>('')
  const uploadedFileSize = ref<string>('')
  const isDraggingOver = ref(false)

  const fileInput = ref<HTMLInputElement | null>(null)

  const form = reactive({
    firstName: '',
    middleName: '', // Added elective middle name
    lastName: '',
    email: '',
    password: '',
    password_confirmation: '',
    prcNumber: '',
    idPhoto: null as string | null // Base64 encoded captured photo
  })

  const errors = reactive({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    password_confirmation: '',
    role: '',
    prcNumber: '',
    idPhoto: '',
    general: ''
  })

  const isLoading = ref(false)
  const agreeToTerms = ref(false)
  const consentDataset = ref(false)
  const showTermsModal = ref(false)
  const termsInitialTab = ref<'terms' | 'privacy'>('terms')

  const openTermsModal = (tab: 'terms' | 'privacy') => {
    termsInitialTab.value = tab
    showTermsModal.value = true
  }

  const handleAcceptTerms = () => {
    agreeToTerms.value = true
    showTermsModal.value = false
  }

  const touched = reactive({
    firstName: false,
    middleName: false,
    lastName: false,
    email: false,
    password: false,
    password_confirmation: false,
    role: false,
    prcNumber: false,
    idPhoto: false
  })

  const markTouched = (field: keyof typeof touched) => {
    touched[field] = true
  }

  let debounceTimeout: any = null

  const validateField = (field: string, immediate = false) => {
    if (!touched[field as keyof typeof touched]) return

    const runValidation = () => {
      switch (field) {
        case 'firstName':
          if (!form.firstName) errors.firstName = 'First name is required'
          else if (form.firstName.length > 255) errors.firstName = 'Max 255 characters'
          else errors.firstName = ''
          break
        case 'lastName':
          if (!form.lastName) errors.lastName = 'Last name is required'
          else if (form.lastName.length > 255) errors.lastName = 'Max 255 characters'
          else errors.lastName = ''
          break
        case 'middleName':
          if (form.middleName && form.middleName.length > 255)
            errors.middleName = 'Max 255 characters'
          else errors.middleName = ''
          break
        case 'email':
          if (!form.email) errors.email = 'Email address is required'
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            errors.email = 'Invalid email format'
          else if (form.email.length > 255) errors.email = 'Max 255 characters'
          else errors.email = ''
          break
        case 'password':
          if (!form.password) errors.password = 'Password is required'
          else if (form.password.length < 8) errors.password = 'Minimum 8 characters'
          else errors.password = ''
          if (touched.password_confirmation) validateField('password_confirmation', true)
          break
        case 'password_confirmation':
          if (!form.password_confirmation)
            errors.password_confirmation = 'Please confirm your password'
          else if (form.password_confirmation !== form.password)
            errors.password_confirmation = 'Passwords do not match'
          else errors.password_confirmation = ''
          break
        case 'prcNumber':
          if (role.value === 'doctor') {
            if (!form.prcNumber) errors.prcNumber = 'PRC Number is required'
            else if (form.prcNumber.length < 7) errors.prcNumber = 'Minimum 7 characters'
            else errors.prcNumber = ''
          } else {
            errors.prcNumber = ''
          }
          break
        case 'idPhoto':
          if (role.value === 'doctor' && !form.idPhoto) errors.idPhoto = 'ID Photo is required'
          else errors.idPhoto = ''
          break
      }
    }

    if (immediate) {
      runValidation()
    } else {
      if (debounceTimeout) clearTimeout(debounceTimeout)
      debounceTimeout = setTimeout(runValidation, 500)
    }
  }

  // Watchers for Live Validation
  watch(
    () => form.firstName,
    () => {
      errors.firstName = ''
      validateField('firstName')
    }
  )
  watch(
    () => form.lastName,
    () => {
      errors.lastName = ''
      validateField('lastName')
    }
  )
  watch(
    () => form.middleName,
    () => {
      errors.middleName = ''
      validateField('middleName')
    }
  )
  watch(
    () => form.email,
    () => {
      errors.email = ''
      validateField('email')
    }
  )
  watch(
    () => form.password,
    () => {
      errors.password = ''
      validateField('password')
    }
  )
  watch(
    () => form.password_confirmation,
    () => {
      errors.password_confirmation = ''
      validateField('password_confirmation')
    }
  )
  watch(
    () => form.prcNumber,
    () => {
      errors.prcNumber = ''
      validateField('prcNumber')
    }
  )
  watch(
    () => form.idPhoto,
    () => {
      errors.idPhoto = ''
      validateField('idPhoto')
    }
  )
  watch(role, () => {
    if (role.value === 'doctor') {
      validateField('prcNumber', true)
      validateField('idPhoto', true)
    } else {
      errors.prcNumber = ''
      errors.idPhoto = ''
    }
  })

  // Validation
  const isStep1Valid = computed(() => {
    return (
      agreeToTerms.value &&
      form.firstName &&
      form.lastName &&
      form.email &&
      form.password &&
      form.password === form.password_confirmation &&
      form.password.length >= 8 &&
      !errors.firstName &&
      !errors.lastName &&
      !errors.email &&
      !errors.password &&
      !errors.password_confirmation
    )
  })

  const isStep2Valid = computed(() => {
    return (
      form.prcNumber.length >= 7 && form.idPhoto !== null && !errors.prcNumber && !errors.idPhoto
    )
  })

  // Methods
  const nextStep = () => {
    if (currentStep.value === 1) {
      // Force immediate validation for all Step 1 fields
      Object.keys(touched).forEach(key => {
        if (
          [
            'firstName',
            'middleName',
            'lastName',
            'email',
            'password',
            'password_confirmation'
          ].includes(key)
        ) {
          touched[key as keyof typeof touched] = true
          validateField(key, true)
        }
      })

      if (!agreeToTerms.value) {
        toast.warning('Please review and agree to the Terms and Conditions to proceed.')
        return
      }

      if (!isStep1Valid.value) return

      if (role.value === 'doctor') {
        currentStep.value = 2
      } else {
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

  const handleRegister = async (allowSkip = false) => {
    if (debounceTimeout) clearTimeout(debounceTimeout)

    // Final Validation check
    Object.keys(touched).forEach(key => {
      touched[key as keyof typeof touched] = true
      validateField(key, true)
    })

    if (!agreeToTerms.value) {
      toast.warning('Please agree to the Terms and Conditions and Privacy Policy.')
      return
    }

    if (currentStep.value === 1 && !isStep1Valid.value) return

    if (currentStep.value === 2 && !allowSkip && !isStep2Valid.value) {
      toast.error('Please provide both your PRC Number and ID Photo, or skip for now.')
      return
    }

    // Reset errors from previous attempt
    errors.general = ''
    isLoading.value = true

    try {
      const { deviceId, isAccepted } = useDeviceIdentifier()
      const response = await authService.register({
        role: role.value,
        consent_dataset: role.value === 'patient' ? consentDataset.value : false,
        agree_to_terms: agreeToTerms.value,
        device_token: deviceId.value,
        cookies_accepted: isAccepted.value,
        ...form
      })

      if (response.token) {
        // Set the auth token cookie
        const tokenCookie = useCookie('auth_token', {
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })
        tokenCookie.value = response.token

        const userData = (response.user as any)?.data || response.user
        const rawRole = userData?.role?.slug || userData?.role || role.value || 'patient'
        const baseRole = String(rawRole).split('/')[0].toLowerCase() || 'patient'

        // Set the user role cookie for middleware
        const roleCookie = useCookie('user_role', {
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })
        roleCookie.value = baseRole

        const userName = useCookie('user_name', {
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })
        const authName = useCookie('auth_user_name', {
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })
        const fullName = `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim()
        userName.value = fullName
        authName.value = fullName

        const userUuid = useCookie('user_uuid', {
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })
        userUuid.value = userData?.uuid

        const doctorUuid = useCookie('doctor_uuid', {
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })
        doctorUuid.value = userData?.doctor_uuid || null

        const accountStatusCookie = useCookie('account_status', {
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })
        accountStatusCookie.value = userData?.account_status || 'active'

        const verificationDeadlineCookie = useCookie('verification_deadline', {
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })
        verificationDeadlineCookie.value = userData?.verification_deadline || null

        // Redirect based on role
        await navigateTo(`/${baseRole}`)
      }
    } catch (err: any) {
      console.error('Registration Error:', err)

      if (err.response?.status === 422) {
        const validationErrors = err.response._data.errors
        // Map backend snake_case errors to frontend camelCase keys
        Object.keys(validationErrors).forEach(key => {
          if (key === 'first_name') errors.firstName = validationErrors[key][0]
          else if (key === 'middle_name') errors.middleName = validationErrors[key][0]
          else if (key === 'last_name') errors.lastName = validationErrors[key][0]
          else if (key === 'firstName') errors.firstName = validationErrors[key][0]
          else if (key === 'middleName') errors.middleName = validationErrors[key][0]
          else if (key === 'lastName') errors.lastName = validationErrors[key][0]
          else if (key === 'password_confirmation')
            errors.password_confirmation = validationErrors[key][0]
          else if (key in errors) (errors as any)[key] = validationErrors[key][0]
        })
      } else {
        errors.general = err.data?.message || 'Registration failed. Please try again.'
      }
    } finally {
      isLoading.value = false
    }
  }

  const setVerificationMode = (mode: 'upload' | 'camera') => {
    verificationMode.value = mode
    if (mode === 'camera') {
      startCamera()
    } else {
      stopCamera()
    }
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
      toast.error('Could not access camera. Please check camera permissions in your browser.')
      isCapturing.value = false
      verificationMode.value = 'upload'
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
        uploadedFileName.value = `camera_capture_${Date.now()}.png`
        uploadedFileSize.value = 'Captured via Camera'
        markTouched('idPhoto')
        stopCamera()
      }
    }
  }

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WebP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.')
      return
    }

    uploadedFileName.value = file.name
    const sizeInKb = Math.round(file.size / 1024)
    uploadedFileSize.value =
      sizeInKb > 1024 ? `${(sizeInKb / 1024).toFixed(1)} MB` : `${sizeInKb} KB`

    const reader = new FileReader()
    reader.onload = e => {
      form.idPhoto = e.target?.result as string
      markTouched('idPhoto')
    }
    reader.readAsDataURL(file)
  }

  const handleFileUpload = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleFileDrop = (event: DragEvent) => {
    isDraggingOver.value = false
    const file = event.dataTransfer?.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const removePhoto = () => {
    form.idPhoto = null
    uploadedFileName.value = ''
    uploadedFileSize.value = ''
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    stopCamera()
  }

  onUnmounted(() => {
    stopCamera()
  })
</script>

<template>
  <div
    class="custom-scrollbar flex h-full flex-col overflow-y-auto px-4 py-4 pb-16 sm:px-8 sm:py-6"
  >
    <!-- Header/Logo Area -->
    <div class="mb-3 flex flex-col items-center text-center">
      <NuxtLink to="/">
        <NuxtImg
          src="/DA_Logo.png"
          class="h-12 object-contain sm:h-14"
        />
      </NuxtLink>
    </div>

    <!-- Progress Indicator -->
    <div
      v-if="role === 'doctor'"
      class="mx-auto mb-3 flex w-full max-w-md items-center justify-between px-4 transition-all duration-300"
    >
      <div
        class="flex items-center gap-2"
        :class="currentStep >= 1 ? 'text-primary' : 'text-foreground/30'"
      >
        <div
          class="flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold shadow-xs transition-all"
          :class="
            currentStep >= 1
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-foreground/20 text-foreground/40'
          "
        >
          1
        </div>
        <span class="text-xs font-semibold">Account Info</span>
      </div>

      <div class="bg-foreground/10 mx-3 h-[2px] flex-1 overflow-hidden rounded-full">
        <div
          class="bg-primary h-full rounded-full transition-all duration-500"
          :style="{ width: currentStep > 1 ? '100%' : '0%' }"
        ></div>
      </div>

      <div
        class="flex items-center gap-2"
        :class="currentStep === 2 ? 'text-primary' : 'text-foreground/40'"
      >
        <div
          class="flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold shadow-xs transition-all"
          :class="
            currentStep === 2
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-foreground/20 text-foreground/40'
          "
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
          <div class="mb-2 text-center">
            <h1 class="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              Create your account
            </h1>
            <p class="text-foreground/60 mt-1 text-xs sm:text-sm">
              Choose your role and fill in your details.
            </p>
          </div>

          <!-- General Error -->
          <div
            v-if="errors.general"
            class="bg-destructive/10 text-destructive rounded-xl p-3 text-center text-xs font-medium"
          >
            {{ errors.general }}
          </div>

          <!-- Role Selection -->
          <div class="mb-2 grid grid-cols-2 gap-2.5">
            <AppButton
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              @click="role = 'patient'"
              type="button"
              class="group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-2.5 text-left transition-all duration-200"
              :class="
                role === 'patient'
                  ? 'border-primary bg-primary/5 shadow-primary/10 ring-primary/20 shadow-xs ring-2'
                  : 'border-border/70 hover:border-primary/40 bg-card/50 hover:bg-muted/30'
              "
            >
              <!-- Selected Checkmark Pill -->
              <div
                v-if="role === 'patient'"
                class="bg-primary text-primary-foreground absolute top-2 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full shadow-xs"
              >
                <Icon
                  name="lucide:check"
                  class="h-2 w-2 stroke-[3]"
                />
              </div>

              <div
                class="flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200"
                :class="
                  role === 'patient'
                    ? 'bg-primary shadow-primary/30 scale-105 text-white shadow-xs'
                    : 'bg-muted/80 text-foreground/50 group-hover:bg-primary/10 group-hover:text-primary'
                "
              >
                <Icon
                  name="lucide:user"
                  class="h-4.5 w-4.5"
                />
              </div>
              <div class="text-center">
                <p
                  class="text-xs font-bold transition-colors"
                  :class="role === 'patient' ? 'text-primary' : 'text-foreground'"
                >
                  Patient
                </p>
                <p class="text-foreground/55 text-[9px] font-medium">Seeking consultation</p>
              </div>
            </AppButton>

            <AppButton
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              @click="role = 'doctor'"
              type="button"
              class="group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-2.5 text-left transition-all duration-200"
              :class="
                role === 'doctor'
                  ? 'border-primary bg-primary/5 shadow-primary/10 ring-primary/20 shadow-xs ring-2'
                  : 'border-border/70 hover:border-primary/40 bg-card/50 hover:bg-muted/30'
              "
            >
              <!-- Selected Checkmark Pill -->
              <div
                v-if="role === 'doctor'"
                class="bg-primary text-primary-foreground absolute top-2 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full shadow-xs"
              >
                <Icon
                  name="lucide:check"
                  class="h-2 w-2 stroke-[3]"
                />
              </div>

              <div
                class="flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200"
                :class="
                  role === 'doctor'
                    ? 'bg-primary shadow-primary/30 scale-105 text-white shadow-xs'
                    : 'bg-muted/80 text-foreground/50 group-hover:bg-primary/10 group-hover:text-primary'
                "
              >
                <Icon
                  name="lucide:stethoscope"
                  class="h-4.5 w-4.5"
                />
              </div>
              <div class="text-center">
                <p
                  class="text-xs font-bold transition-colors"
                  :class="role === 'doctor' ? 'text-primary' : 'text-foreground'"
                >
                  Doctor
                </p>
                <p class="text-foreground/55 text-[9px] font-medium">Medical Professional</p>
              </div>
            </AppButton>
          </div>

          <!-- Name Fields: Layout A (First Name 70% + M.I. 30%, Last Name Full-Width) -->
          <div class="grid grid-cols-12 gap-2.5">
            <div class="col-span-8">
              <AuthInput
                id="first-name"
                v-model="form.firstName"
                label="First Name"
                :error="errors.firstName"
                @blur="markTouched('firstName')"
                @input="markTouched('firstName')"
              />
            </div>
            <div class="col-span-4">
              <AuthInput
                id="middle-name"
                v-model="form.middleName"
                label="M.I."
                :optional="true"
                :error="errors.middleName"
                @blur="markTouched('middleName')"
                @input="markTouched('middleName')"
              />
            </div>
          </div>

          <AuthInput
            id="last-name"
            v-model="form.lastName"
            label="Last Name"
            :error="errors.lastName"
            @blur="markTouched('lastName')"
            @input="markTouched('lastName')"
          />

          <AuthInput
            id="email"
            v-model="form.email"
            label="Email Address"
            type="email"
            :error="errors.email"
            @blur="markTouched('email')"
            @input="markTouched('email')"
          />

          <div class="grid grid-cols-2 gap-3">
            <AuthInput
              id="password"
              v-model="form.password"
              label="Password"
              type="password"
              :error="errors.password"
              @blur="markTouched('password')"
              @input="markTouched('password')"
            />
            <AuthInput
              id="confirm-password"
              v-model="form.password_confirmation"
              label="Confirm"
              type="password"
              :error="errors.password_confirmation"
              @blur="markTouched('password_confirmation')"
              @input="markTouched('password_confirmation')"
            />
          </div>

          <!-- Terms and Conditions Agreement Checkbox -->
          <div
            class="border-border/50 bg-muted/20 mt-3 flex items-start gap-2.5 rounded-xl border p-2.5"
          >
            <input
              id="agree-terms"
              v-model="agreeToTerms"
              type="checkbox"
              class="accent-primary border-border mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded"
            />
            <label
              for="agree-terms"
              class="text-foreground/75 cursor-pointer text-[11px] leading-relaxed select-none sm:text-xs"
            >
              I have read and agree to the
              <button
                type="button"
                class="text-primary cursor-pointer font-semibold underline underline-offset-2 hover:opacity-80"
                @click.stop="openTermsModal('terms')"
              >
                Terms and Conditions
              </button>
              and
              <button
                type="button"
                class="text-primary cursor-pointer font-semibold underline underline-offset-2 hover:opacity-80"
                @click.stop="openTermsModal('privacy')"
              >
                Privacy Policy</button
              >.
            </label>
          </div>

          <!-- Optional AI Retraining Dataset Contribution Checkbox (Patients) -->
          <div
            v-if="role === 'patient'"
            class="border-primary/20 bg-primary/5 mt-2.5 flex items-start gap-2.5 rounded-xl border p-2.5"
          >
            <input
              id="agree-dataset"
              v-model="consentDataset"
              type="checkbox"
              class="accent-primary border-primary/30 mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded"
            />
            <label
              for="agree-dataset"
              class="text-foreground/80 cursor-pointer text-[11px] leading-relaxed select-none sm:text-xs"
            >
              <span class="text-foreground block font-medium"
                >Optional: AI Retraining Dataset Contribution</span
              >
              <span class="text-muted-foreground block text-[10px]"
                >I consent to contributing my anonymized clinical scan images to help study and
                improve the DermAssist AI model. You can change this preference anytime in your
                profile.</span
              >
            </label>
          </div>

          <AppButton
            @click="nextStep"
            block
            class="mt-2"
            :disabled="!isStep1Valid"
          >
            <span>{{ role === 'doctor' ? 'Next' : 'Create Account' }}</span>
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
          class="flex w-full flex-col gap-3"
        >
          <!-- Top Step Back Navigation -->
          <div class="flex items-center justify-between">
            <AppButton
              variant="ghost"
              size="sm"
              @click="prevStep"
              class="text-foreground/70 hover:text-foreground -ml-2 w-fit px-2!"
            >
              <template #leading>
                <Icon
                  name="lucide:arrow-left"
                  class="h-4 w-4"
                />
              </template>
              Back to Account Info
            </AppButton>
            <span class="text-foreground/40 text-[11px] font-medium">Step 2 of 2</span>
          </div>

          <div class="text-center">
            <h1 class="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              Doctor Verification
            </h1>
            <p class="text-foreground/60 mt-1 text-xs sm:text-sm">
              Verify your professional medical license to start consultations.
            </p>
          </div>

          <!-- PRC Input with format hint -->
          <div class="flex flex-col gap-1">
            <AuthInput
              id="prc-number"
              v-model="form.prcNumber"
              label="PRC Registration Number"
              placeholder="e.g. 1234567"
              :error="errors.prcNumber"
              @blur="markTouched('prcNumber')"
              @input="markTouched('prcNumber')"
            />
            <p class="text-foreground/45 ml-1 flex items-center gap-1 text-[11px]">
              <Icon
                name="lucide:info"
                class="inline h-3 w-3 shrink-0"
              />
              Standard 7-digit Professional Regulation Commission ID
            </p>
          </div>

          <!-- Photo Verification Card Section -->
          <div class="flex flex-col gap-2.5">
            <div class="flex items-center justify-between px-1">
              <label class="text-foreground/80 text-xs font-semibold"
                >PRC ID Document / Photo</label
              >
              <span
                v-if="form.idPhoto"
                class="text-primary flex items-center gap-1 text-[11px] font-medium"
              >
                <Icon
                  name="lucide:check-circle-2"
                  class="h-3.5 w-3.5"
                />
                Document Attached
              </span>
            </div>

            <!-- Upload vs Camera Mode Switcher -->
            <div class="bg-muted/60 border-border/50 grid grid-cols-2 gap-1 rounded-xl border p-1">
              <button
                type="button"
                @click="setVerificationMode('upload')"
                class="flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
                :class="
                  verificationMode === 'upload'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-foreground/60 hover:text-foreground'
                "
              >
                <Icon
                  name="lucide:upload-cloud"
                  class="h-4 w-4"
                />
                <span>Upload Document</span>
              </button>

              <button
                type="button"
                @click="setVerificationMode('camera')"
                class="flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
                :class="
                  verificationMode === 'camera'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-foreground/60 hover:text-foreground'
                "
              >
                <Icon
                  name="lucide:camera"
                  class="h-4 w-4"
                />
                <span>Take Photo</span>
              </button>
            </div>

            <!-- MODE 1: Upload File Area -->
            <div v-if="verificationMode === 'upload'">
              <!-- Empty State / Dropzone -->
              <div
                v-if="!form.idPhoto"
                @dragover.prevent="isDraggingOver = true"
                @dragleave.prevent="isDraggingOver = false"
                @drop.prevent="handleFileDrop"
                @click="fileInput?.click()"
                class="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200"
                :class="
                  isDraggingOver
                    ? 'border-primary bg-primary/10 scale-[1.01]'
                    : 'border-border/80 hover:border-primary/50 bg-card/40 hover:bg-muted/30'
                "
              >
                <div
                  class="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
                >
                  <Icon
                    name="lucide:upload-cloud"
                    class="h-6 w-6"
                  />
                </div>
                <div>
                  <p class="text-foreground text-sm font-semibold">
                    Click to browse or drag & drop ID photo
                  </p>
                  <p class="text-foreground/50 mt-0.5 text-[11px]">
                    Supports JPG, PNG, WebP (up to 10MB)
                  </p>
                </div>
              </div>

              <!-- Uploaded Preview Card -->
              <div
                v-else
                class="border-border/80 bg-card flex items-center gap-3.5 rounded-2xl border p-3.5 shadow-xs"
              >
                <div
                  class="bg-muted/40 border-border/50 h-16 w-20 shrink-0 overflow-hidden rounded-xl border"
                >
                  <img
                    :src="form.idPhoto"
                    alt="PRC ID Preview"
                    class="h-full w-full object-cover"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-foreground truncate text-xs font-bold">
                    {{ uploadedFileName || 'PRC_ID_Document.png' }}
                  </p>
                  <p class="text-foreground/50 mt-0.5 text-[11px]">
                    {{ uploadedFileSize || 'Ready for verification' }}
                  </p>
                  <div class="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      @click="fileInput?.click()"
                      class="text-primary cursor-pointer text-[11px] font-semibold hover:underline"
                    >
                      Replace File
                    </button>
                    <span class="text-foreground/20 text-xs">•</span>
                    <button
                      type="button"
                      @click="removePhoto"
                      class="text-destructive cursor-pointer text-[11px] font-semibold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- MODE 2: Camera Viewfinder Area -->
            <div v-else-if="verificationMode === 'camera'">
              <div
                class="border-border/80 relative flex aspect-video h-60 w-full items-center justify-center overflow-hidden rounded-2xl border bg-neutral-950 shadow-inner"
              >
                <!-- Live Camera Stream -->
                <video
                  v-show="isCapturing"
                  ref="video"
                  autoplay
                  playsinline
                  class="h-full w-full object-cover"
                ></video>

                <!-- Document ID Framing Overlay (Visible when capturing) -->
                <div
                  v-if="isCapturing"
                  class="pointer-events-none absolute inset-4 flex flex-col justify-between rounded-xl border border-white/30 p-2"
                >
                  <div class="flex justify-between">
                    <div class="h-4 w-4 border-t-2 border-l-2 border-white"></div>
                    <div class="h-4 w-4 border-t-2 border-r-2 border-white"></div>
                  </div>
                  <div class="text-center">
                    <span
                      class="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-xs"
                    >
                      Align PRC ID within frame
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <div class="h-4 w-4 border-b-2 border-l-2 border-white"></div>
                    <div class="h-4 w-4 border-r-2 border-b-2 border-white"></div>
                  </div>
                </div>

                <!-- Captured Preview in Camera Mode -->
                <img
                  v-if="form.idPhoto && !isCapturing"
                  :src="form.idPhoto"
                  alt="Captured ID"
                  class="h-full w-full object-contain p-2"
                />

                <!-- Camera Idle Placeholder -->
                <div
                  v-if="!form.idPhoto && !isCapturing"
                  class="text-foreground/50 flex flex-col items-center justify-center p-4 text-center"
                >
                  <div
                    class="bg-foreground/10 text-foreground/70 mb-2 flex h-12 w-12 items-center justify-center rounded-full"
                  >
                    <Icon
                      name="lucide:camera"
                      class="h-6 w-6"
                    />
                  </div>
                  <p class="text-foreground/80 text-xs font-semibold">Camera is inactive</p>
                  <p class="text-foreground/50 mt-0.5 text-[11px]">
                    Click below to start video stream
                  </p>
                </div>

                <!-- Camera Controls Bar -->
                <div
                  class="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-3 px-4"
                >
                  <AppButton
                    v-if="!isCapturing"
                    @click="startCamera"
                    type="button"
                    size="sm"
                    class="shadow-md"
                  >
                    <template #leading>
                      <Icon
                        name="lucide:camera"
                        class="h-4 w-4"
                      />
                    </template>
                    <span>{{ form.idPhoto ? 'Retake Photo' : 'Activate Camera' }}</span>
                  </AppButton>

                  <template v-if="isCapturing">
                    <!-- Shutter Button -->
                    <button
                      type="button"
                      @click="capturePhoto"
                      title="Take Snapshot"
                      class="group bg-primary relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-4 border-white shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      <Icon
                        name="lucide:camera"
                        class="h-6 w-6 text-white transition-transform group-hover:scale-110"
                      />
                    </button>

                    <AppButton
                      @click="stopCamera"
                      variant="outline"
                      size="sm"
                      class="border-white/30 bg-black/60 text-white backdrop-blur-xs hover:bg-black/80"
                    >
                      Cancel
                    </AppButton>
                  </template>
                </div>
              </div>
            </div>

            <!-- Hidden File Input -->
            <input
              ref="fileInput"
              type="file"
              class="hidden"
              accept="image/png,image/jpeg,image/webp"
              @change="handleFileUpload"
            />
          </div>

          <!-- Main Actions -->
          <div class="mt-2 flex flex-col gap-2.5">
            <AppButton
              block
              size="lg"
              :loading="isLoading"
              :disabled="!isStep2Valid"
              @click="handleRegister(false)"
            >
              <span>Complete Doctor Registration</span>
              <template #trailing>
                <Icon
                  name="lucide:arrow-right"
                  class="h-5 w-5"
                />
              </template>
            </AppButton>

            <!-- Friendly Skip Notice Card -->
            <div
              class="border-border/50 bg-muted/20 hover:bg-muted/40 flex items-start gap-2.5 rounded-xl border p-3 transition-colors"
            >
              <Icon
                name="lucide:shield-check"
                class="text-primary mt-0.5 h-4 w-4 shrink-0"
              />
              <div class="flex-1">
                <p class="text-foreground text-xs font-semibold">
                  Don't have your PRC license on hand?
                </p>
                <p class="text-foreground/60 mt-0.5 text-[11px] leading-relaxed">
                  You can finish account creation now. Your profile will stay pending until you
                  upload your credentials later.
                </p>
                <button
                  type="button"
                  @click="handleRegister(true)"
                  :disabled="isLoading"
                  class="text-primary mt-1.5 inline-flex cursor-pointer items-center gap-1 text-xs font-bold hover:underline"
                >
                  <span>Skip Verification for Now</span>
                  <Icon
                    name="lucide:chevron-right"
                    class="h-3 w-3"
                  />
                </button>
              </div>
            </div>
          </div>

          <div class="mt-2 text-center">
            <span class="text-foreground/60 text-xs">Already have an account?</span>
            <NuxtLink
              to="/auth/login"
              class="text-primary ml-1 text-xs font-semibold hover:underline"
            >
              Login
            </NuxtLink>
          </div>

          <!-- Hidden Canvas for capturing -->
          <canvas
            ref="canvas"
            class="hidden"
          ></canvas>
        </div>
      </transition>
    </div>

    <!-- Terms & Conditions / Privacy Policy Modal -->
    <AppModalTermsModal
      v-model="showTermsModal"
      :initial-tab="termsInitialTab"
      @accept="handleAcceptTerms"
    />
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
