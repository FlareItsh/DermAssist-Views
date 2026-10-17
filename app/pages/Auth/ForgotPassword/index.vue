<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import { authService } from '~/api/auth/AuthService'

  definePageMeta({
    layout: 'auth-split-layout',
    path: '/auth/forgot-password',
    alias: ['/auth/forgotpassword', '/auth/ForgotPassword']
  })

  const route = useRoute()
  const router = useRouter()

  const email = ref(typeof route.query.email === 'string' ? route.query.email.trim() : '')
  const isLoading = ref(false)
  const isSubmitted = ref(false)
  const generalError = ref('')
  const emailTouched = ref(false)

  const errors = reactive({
    email: ''
  })

  const cooldownSeconds = ref(0)
  let cooldownTimer: ReturnType<typeof setInterval> | null = null

  const validateEmail = () => {
    if (!emailTouched.value) return true

    if (!email.value?.trim()) {
      errors.email = 'Email address is required'
      return false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.value.trim())) {
      errors.email = 'Please enter a valid email address'
      return false
    }

    errors.email = ''
    return true
  }

  const markTouched = () => {
    emailTouched.value = true
    validateEmail()
  }

  watch(email, () => {
    if (emailTouched.value) {
      validateEmail()
    }
    generalError.value = ''
  })

  const startCooldown = (seconds = 60) => {
    cooldownSeconds.value = seconds
    if (cooldownTimer) {
      clearInterval(cooldownTimer)
    }
    cooldownTimer = setInterval(() => {
      if (cooldownSeconds.value > 0) {
        cooldownSeconds.value--
      } else {
        if (cooldownTimer) {
          clearInterval(cooldownTimer)
          cooldownTimer = null
        }
      }
    }, 1000)
  }

  const handleSubmit = async () => {
    emailTouched.value = true
    if (!validateEmail()) return

    isLoading.value = true
    generalError.value = ''

    try {
      const response = await authService.forgotPassword(email.value.trim().toLowerCase())
      isSubmitted.value = true
      startCooldown(60)
      toast.success(response?.message || 'Password reset link sent to your email.')
    } catch (err: any) {
      const msg =
        err?.data?.message ||
        err?.response?._data?.message ||
        err?.message ||
        'Unable to process password reset request. Please try again.'
      generalError.value = msg
      toast.error(msg)
    } finally {
      isLoading.value = false
    }
  }

  const handleResend = async () => {
    if (isLoading.value || cooldownSeconds.value > 0) return

    isLoading.value = true
    generalError.value = ''

    try {
      const response = await authService.forgotPassword(email.value.trim().toLowerCase())
      startCooldown(60)
      toast.success(response?.message || 'A new password reset link has been dispatched.')
    } catch (err: any) {
      const msg =
        err?.data?.message ||
        err?.response?._data?.message ||
        err?.message ||
        'Failed to resend reset link. Please try again later.'
      generalError.value = msg
      toast.error(msg)
    } finally {
      isLoading.value = false
    }
  }

  const handleBackToLogin = () => {
    router.push('/auth/login')
  }

  onUnmounted(() => {
    if (cooldownTimer) {
      clearInterval(cooldownTimer)
    }
  })
</script>

<template>
  <div class="custom-scrollbar flex h-full flex-col overflow-y-auto px-6 py-8">
    <div class="my-auto flex flex-col items-center">
      <!-- Back to Sign In Link -->
      <div class="mb-6 flex w-full max-w-sm items-center justify-start">
        <NuxtLink
          to="/auth/login"
          class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
        >
          <Icon
            name="lucide:arrow-left"
            class="size-3.5"
          />
          <span>Back to Sign In</span>
        </NuxtLink>
      </div>

      <!-- Header Section -->
      <div class="mb-8 flex flex-col items-center text-center">
        <NuxtLink to="/">
          <NuxtImg
            src="/DA_Logo.png"
            class="h-16 object-contain"
            alt="DermAssist Logo"
          />
        </NuxtLink>

        <h1 class="text-foreground mt-4 text-3xl font-bold tracking-tight">
          {{ isSubmitted ? 'Check your inbox' : 'Forgot password?' }}
        </h1>
        <p class="text-foreground/60 mt-2 max-w-xs text-sm leading-relaxed">
          {{
            isSubmitted
              ? 'We have sent password reset instructions to your email address.'
              : 'No worries! Enter your account email and we will send you a secure link to reset your password.'
          }}
        </p>
      </div>

      <!-- State 1: Success / Email Dispatched Card -->
      <div
        v-if="isSubmitted"
        class="flex w-full max-w-sm flex-col gap-6"
      >
        <div
          class="border-border/70 bg-card flex flex-col items-center rounded-3xl border p-6 text-center shadow-sm"
        >
          <div
            class="bg-primary/10 text-primary mb-4 flex size-14 items-center justify-center rounded-2xl shadow-xs"
          >
            <Icon
              name="lucide:mail-check"
              class="size-7"
            />
          </div>

          <p class="text-muted-foreground text-xs leading-relaxed">
            A password reset link was dispatched to:
          </p>
          <p class="text-foreground mt-1 text-sm font-bold break-all">
            {{ email }}
          </p>

          <p class="text-muted-foreground/80 mt-4 text-[11px] leading-normal">
            Didn't receive the email? Check your spam folder or request a new link once the cooldown
            expires.
          </p>
        </div>

        <!-- Resend and Navigation Actions -->
        <div class="flex flex-col gap-3">
          <AppButton
            variant="outline"
            block
            :loading="isLoading"
            :disabled="isLoading || cooldownSeconds > 0"
            @click="handleResend"
          >
            <Icon
              name="lucide:refresh-cw"
              class="mr-1.5 size-4"
              :class="{ 'animate-spin': isLoading }"
            />
            <span v-if="cooldownSeconds > 0">Resend email in {{ cooldownSeconds }}s</span>
            <span v-else>Resend reset email</span>
          </AppButton>

          <AppButton
            block
            @click="handleBackToLogin"
          >
            Proceed to Sign In
          </AppButton>
        </div>
      </div>

      <!-- State 2: Request Reset Form -->
      <template v-else>
        <form
          @submit.prevent="handleSubmit"
          class="flex w-full max-w-sm flex-col gap-6"
        >
          <!-- General Error Alert -->
          <div
            v-if="generalError"
            class="flex items-center justify-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-xs font-semibold text-rose-700 transition-all dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
          >
            <Icon
              name="material-symbols:error-rounded"
              class="shrink-0 text-xl"
            />
            <span>{{ generalError }}</span>
          </div>

          <AuthInput
            id="forgot_password_email"
            v-model="email"
            label="Email Address"
            type="email"
            :error="errors.email"
            placeholder="name@example.com"
            @blur="markTouched"
            @input="markTouched"
          />

          <AppButton
            type="submit"
            block
            :loading="isLoading"
            :disabled="isLoading"
          >
            Send Reset Link
          </AppButton>
        </form>

        <div class="mt-3 text-center">
          <NuxtLink
            to="/auth/login"
            class="text-foreground/60 hover:text-primary inline-flex items-center gap-1 text-[11px] transition-colors"
          >
            <span class="font-normal">Remember your credentials?</span>
            <span class="text-primary font-semibold hover:underline">Return to Sign In</span>
          </NuxtLink>
        </div>
      </template>
    </div>
  </div>
</template>
