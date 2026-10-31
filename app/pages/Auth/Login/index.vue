<script setup lang="ts">
  import { authService } from '~/api/auth/AuthService'
  import Button from '~/components/App/Button.vue'
  import { resolveApiBase } from '~/utils/resolveApiBase'

  definePageMeta({
    layout: 'auth-split-layout'
  })

  const form = reactive({
    email: '',
    password: ''
  })

  const errors = reactive({
    email: '',
    password: '',
    general: '',
    twoFactor: ''
  })

  const isLoading = ref(false)

  // 2FA Challenge State
  const is2FAStep = ref(false)
  const twoFactorChallenge = ref('')
  const twoFACode = ref('')
  const twoFARecoveryCode = ref('')
  const useRecoveryCode = ref(false)

  const touched = reactive({
    email: false,
    password: false
  })

  const markTouched = (field: keyof typeof touched) => {
    touched[field] = true
  }

  let debounceTimeout: any = null

  const validateField = (field: string) => {
    if (!touched[field as keyof typeof touched]) return

    if (debounceTimeout) clearTimeout(debounceTimeout)

    debounceTimeout = setTimeout(() => {
      switch (field) {
        case 'email':
          if (!form.email) errors.email = 'Email address is required'
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            errors.email = 'Please enter a valid email address'
          else errors.email = ''
          break
        case 'password':
          if (!form.password) errors.password = 'Password is required'
          else errors.password = ''
          break
      }
    }, 500)
  }

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

  const validate = () => {
    if (debounceTimeout) clearTimeout(debounceTimeout)

    touched.email = true
    touched.password = true

    if (!form.email) errors.email = 'Email address is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = 'Please enter a valid email address'
    else errors.email = ''

    if (!form.password) errors.password = 'Password is required'
    else errors.password = ''

    return !errors.email && !errors.password
  }

  const completeLoginSession = async (response: LoginResponse) => {
    if (!response.token) return

    const token = useCookie('auth_token', {
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })
    token.value = response.token

    const userData = (response.user as any)?.data || response.user
    const rawRole = userData?.role?.slug || userData?.role || 'patient'
    const baseRole = String(rawRole).split('/')[0].toLowerCase() || 'patient'

    const role = useCookie('user_role', {
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })
    role.value = baseRole

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

    await navigateTo(`/${baseRole}`)
  }

  const submitForm = async () => {
    if (!validate()) return
    isLoading.value = true

    try {
      const response = await authService.login(form.email, form.password)

      if (response.two_factor_required && response.challenge) {
        twoFactorChallenge.value = response.challenge
        is2FAStep.value = true
        twoFACode.value = ''
        twoFARecoveryCode.value = ''
        useRecoveryCode.value = false
        errors.twoFactor = ''
        return
      }

      if (response.token) {
        await completeLoginSession(response)
      }
    } catch (error: any) {
      const status = error.status || error.statusCode || error.response?.status
      const data = error.data || error.response?._data || {}
      const msg = data.message || error.message || ''

      if (status === 403 || msg.toLowerCase().includes('disabled')) {
        errors.general =
          msg || 'Account Disabled: Your account has been disabled by your attending doctor.'
      } else if (status === 422) {
        const validationErrors = data.errors
        if (validationErrors?.email) errors.email = validationErrors.email[0]
        if (validationErrors?.password) errors.password = validationErrors.password[0]
      } else if (status === 401 || msg.toLowerCase().includes('invalid')) {
        errors.general = msg || 'Invalid credentials'
      } else {
        errors.general = msg || 'An unexpected error occurred. Please try again.'
      }
      console.error('Login failed:', error)
    } finally {
      isLoading.value = false
    }
  }

  const submit2FAChallenge = async () => {
    if (!twoFactorChallenge.value) return

    if (!useRecoveryCode.value && twoFACode.value.length !== 6) {
      errors.twoFactor = 'Please enter a valid 6-digit passcode.'
      return
    }
    if (useRecoveryCode.value && !twoFARecoveryCode.value.trim()) {
      errors.twoFactor = 'Please enter a valid recovery code.'
      return
    }

    isLoading.value = true
    errors.twoFactor = ''

    try {
      const response = await authService.challenge2FA({
        challenge: twoFactorChallenge.value,
        code: useRecoveryCode.value ? undefined : twoFACode.value,
        recovery_code: useRecoveryCode.value ? twoFARecoveryCode.value.trim() : undefined
      })

      if (response.token) {
        await completeLoginSession(response)
      }
    } catch (error: any) {
      const data = error.data || error.response?._data || {}
      errors.twoFactor = data.message || error.message || 'Invalid verification or recovery code.'
    } finally {
      isLoading.value = false
    }
  }

  const handleBackToLogin = () => {
    is2FAStep.value = false
    twoFactorChallenge.value = ''
    twoFACode.value = ''
    twoFARecoveryCode.value = ''
    errors.twoFactor = ''
  }

  const toggleRecoveryCodeMode = () => {
    useRecoveryCode.value = !useRecoveryCode.value
    errors.twoFactor = ''
  }

  const is2FASubmitDisabled = computed(() => {
    if (useRecoveryCode.value) {
      return !twoFARecoveryCode.value.trim()
    }
    return twoFACode.value.length !== 6
  })

  const route = useRoute()
  const config = useRuntimeConfig()

  onMounted(() => {
    const errorParam = route.query.error as string
    if (errorParam) {
      errors.general = errorParam
    }

    const challengeParam = route.query.challenge as string
    if (challengeParam) {
      twoFactorChallenge.value = challengeParam
      is2FAStep.value = true
    }
  })

  const loginWithGoogle = () => {
    const apiBase = resolveApiBase(config.public.apiBase)
    window.location.href = `${apiBase}/auth/google/redirect`
  }

  const handleForgotPassword = () => {
    navigateTo({
      path: '/auth/forgot-password',
      query: form.email?.trim() ? { email: form.email.trim() } : {}
    })
  }
</script>

<template>
  <div class="custom-scrollbar flex h-full flex-col overflow-y-auto px-6 py-8">
    <div class="my-auto flex flex-col items-center">
      <div
        v-if="!is2FAStep"
        class="mb-8 flex flex-col items-center text-center"
      >
        <NuxtLink to="/">
          <NuxtImg
            src="/DA_Logo.png"
            class="h-16"
          />
        </NuxtLink>
        <h1 class="text-foreground mt-4 text-3xl font-bold tracking-tight">Welcome back!</h1>
        <p class="text-foreground/60 mt-2 text-sm">Let’s get you signed in.</p>
      </div>

      <!-- 2FA Verification Step -->
      <div
        v-if="is2FAStep"
        class="flex w-full max-w-sm flex-col gap-6"
      >
        <div class="mb-2 flex flex-col items-center text-center">
          <div
            class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 shadow-xs"
          >
            <Icon
              name="heroicons:device-phone-mobile-20-solid"
              size="26"
            />
          </div>
          <h2 class="text-foreground text-xl font-bold tracking-tight">
            Two-Factor Authentication
          </h2>
          <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
            {{
              useRecoveryCode
                ? 'Enter one of your emergency recovery codes.'
                : 'Enter the 6-digit passcode generated by your authenticator app.'
            }}
          </p>
        </div>

        <form
          @submit.prevent="submit2FAChallenge"
          class="flex flex-col gap-5"
        >
          <div
            v-if="errors.twoFactor"
            class="flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-center text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
          >
            <Icon
              name="material-symbols:error-rounded"
              class="shrink-0 text-lg"
            />
            <span>{{ errors.twoFactor }}</span>
          </div>

          <div
            v-if="!useRecoveryCode"
            class="space-y-2"
          >
            <label
              for="login_2fa_passcode"
              class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
            >
              6-Digit Security Code
            </label>
            <input
              id="login_2fa_passcode"
              v-model="twoFACode"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="one-time-code"
              maxlength="6"
              class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest transition-all outline-none"
              placeholder="000000"
              autofocus
            />
          </div>

          <div
            v-else
            class="space-y-2"
          >
            <label
              for="login_2fa_recovery_code"
              class="text-foreground/70 cursor-pointer text-xs font-bold tracking-wider uppercase"
            >
              Emergency Recovery Code
            </label>
            <input
              id="login_2fa_recovery_code"
              v-model="twoFARecoveryCode"
              type="text"
              maxlength="25"
              class="bg-foreground/5 border-border focus:border-primary w-full rounded-2xl border px-4 py-3 text-center font-mono text-base font-bold tracking-wider uppercase transition-all outline-none"
              placeholder="ABCDE-12345"
              autofocus
            />
          </div>

          <div class="flex items-center justify-between px-1 text-xs">
            <button
              type="button"
              @click="toggleRecoveryCodeMode"
              class="text-primary cursor-pointer font-medium hover:underline"
            >
              {{ useRecoveryCode ? 'Use authenticator code' : 'Use emergency recovery code' }}
            </button>
          </div>

          <AppButton
            type="submit"
            block
            :loading="isLoading"
            :disabled="is2FASubmitDisabled"
          >
            Verify & Sign In
          </AppButton>

          <button
            type="button"
            @click="handleBackToLogin"
            class="text-muted-foreground hover:text-foreground cursor-pointer pt-1 text-center text-xs font-semibold"
          >
            ← Back to email sign in
          </button>
        </form>
      </div>

      <!-- Standard Password Form -->
      <form
        v-else
        @submit.prevent="submitForm"
        class="flex w-full max-w-sm flex-col gap-6"
      >
        <div
          v-if="errors.general"
          class="flex items-center justify-center gap-2.5 rounded-2xl border p-4 text-center text-sm font-semibold transition-all"
          :class="
            errors.general.toLowerCase().includes('disabled')
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          "
        >
          <Icon
            :name="
              errors.general.toLowerCase().includes('disabled')
                ? 'material-symbols:block-rounded'
                : 'material-symbols:error-rounded'
            "
            class="shrink-0 text-xl"
          />
          <span>{{ errors.general }}</span>
        </div>

        <AuthInput
          id="email"
          v-model="form.email"
          label="Email Address"
          type="email"
          :error="errors.email"
          @blur="markTouched('email')"
          @input="markTouched('email')"
        />
        <AuthInput
          id="password"
          v-model="form.password"
          label="Password"
          type="password"
          :error="errors.password"
          @blur="markTouched('password')"
          @input="markTouched('password')"
        />

        <div class="flex items-center justify-between px-1">
          <label class="text-foreground/60 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="accent-primary border-input h-4 w-4 rounded"
            />
            Remember me
          </label>
          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            type="button"
            class="text-primary cursor-pointer text-sm font-medium hover:underline"
            @click="handleForgotPassword"
          >
            Forgot password?
          </AppButton>
        </div>

        <AppButton
          type="submit"
          block
          :loading="isLoading"
        >
          Sign In
        </AppButton>

        <div class="relative my-1 flex items-center justify-center">
          <div class="border-border/60 absolute inset-0 flex items-center">
            <div class="border-border/60 w-full border-t" />
          </div>
          <span
            class="bg-card text-muted-foreground relative px-3 text-xs tracking-wider uppercase"
          >
            Or continue with
          </span>
        </div>

        <button
          type="button"
          class="border-border/80 bg-background hover:bg-muted/50 text-foreground flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition-all hover:shadow"
          @click="loginWithGoogle"
        >
          <svg
            class="size-4 shrink-0"
            viewBox="0 0 24 24"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>
      </form>

      <div
        v-if="!is2FAStep"
        class="mt-4 text-center"
      >
        <NuxtLink
          to="/auth/register"
          class="text-foreground/70 hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors sm:text-sm"
        >
          <span class="font-normal">Don't have an account?</span>
          <span class="text-primary font-semibold hover:underline">Create one</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--color-foreground, currentColor) 15%, transparent);
    border-radius: 10px;
  }
</style>
