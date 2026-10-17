<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import { userService } from '~/api/user/UserService'

  definePageMeta({
    layout: false,
    path: '/auth/reset-password',
    alias: ['/auth/resetpassword', '/auth/ResetPassword']
  })

  const route = useRoute()
  const router = useRouter()

  const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
  const token = ref(typeof route.query.token === 'string' ? route.query.token : '')

  const newPassword = ref('')
  const confirmPassword = ref('')
  const showPassword = ref(false)
  const isSubmitting = ref(false)
  const isSuccess = ref(false)
  const errorMessage = ref('')

  const errors = reactive({
    password: '',
    confirmPassword: ''
  })

  const touched = reactive({
    password: false,
    confirmPassword: false
  })

  const passwordCriteria = computed(() => {
    const p = newPassword.value || ''
    return {
      minLength: p.length >= 8,
      hasUpper: /[A-Z]/.test(p),
      hasLower: /[a-z]/.test(p),
      hasNumber: /[0-9]/.test(p),
      hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p)
    }
  })

  const isPasswordStrong = computed(() => {
    const c = passwordCriteria.value
    return c.minLength && c.hasUpper && c.hasLower && c.hasNumber && c.hasSpecial
  })

  const validateField = (field: 'password' | 'confirmPassword') => {
    if (!touched[field]) return

    if (field === 'password') {
      if (!newPassword.value) {
        errors.password = 'Password is required'
      } else if (newPassword.value.length < 8) {
        errors.password = 'Minimum 8 characters'
      } else if (!isPasswordStrong.value) {
        errors.password = 'Must meet all password criteria below'
      } else {
        errors.password = ''
      }
      if (touched.confirmPassword) {
        validateField('confirmPassword')
      }
    } else if (field === 'confirmPassword') {
      if (!confirmPassword.value) {
        errors.confirmPassword = 'Please confirm your password'
      } else if (confirmPassword.value !== newPassword.value) {
        errors.confirmPassword = 'Passwords do not match'
      } else {
        errors.confirmPassword = ''
      }
    }
  }

  const markTouched = (field: 'password' | 'confirmPassword') => {
    touched[field] = true
    validateField(field)
  }

  watch(newPassword, () => {
    if (touched.password) validateField('password')
  })

  watch(confirmPassword, () => {
    if (touched.confirmPassword) validateField('confirmPassword')
  })

  const handleResetPassword = async () => {
    touched.password = true
    touched.confirmPassword = true
    validateField('password')
    validateField('confirmPassword')

    if (!email.value?.trim()) {
      errorMessage.value = 'Email address is required.'
      return
    }
    if (!token.value?.trim()) {
      errorMessage.value = 'Password reset token is missing or invalid.'
      return
    }
    if (!newPassword.value) {
      errorMessage.value = 'Please enter your new password.'
      return
    }
    if (!isPasswordStrong.value) {
      errorMessage.value = 'Password does not meet all security criteria below.'
      return
    }
    if (newPassword.value !== confirmPassword.value) {
      errorMessage.value = 'Passwords do not match.'
      return
    }

    isSubmitting.value = true
    errorMessage.value = ''

    try {
      const response = await userService.resetPasswordWithToken({
        email: email.value.trim().toLowerCase(),
        token: token.value.trim(),
        password: newPassword.value,
        password_confirmation: confirmPassword.value
      })

      isSuccess.value = true
      toast.success(response?.message || 'Password reset successfully.')
    } catch (err: any) {
      const msg =
        err?.data?.message ||
        err?.response?._data?.message ||
        err?.message ||
        'Failed to reset password. The link may have expired.'
      errorMessage.value = msg
      toast.error(msg)
    } finally {
      isSubmitting.value = false
    }
  }

  const handleGoToLogin = () => {
    router.push('/auth/login')
  }

  const togglePasswordVisibility = () => {
    showPassword.value = !showPassword.value
  }

  const handleGoToForgotPassword = () => {
    router.push('/auth/forgot-password')
  }

  onMounted(() => {
    if (!token.value || !email.value) {
      errorMessage.value =
        'Password reset link is missing a valid security token or email. Please request a new link.'
    }
  })
</script>

<template>
  <div
    class="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-50 p-4 font-sans select-none sm:p-6"
  >
    <!-- Background Decor -->
    <div
      class="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl"
    ></div>
    <div
      class="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl"
    ></div>

    <div
      class="relative z-10 flex w-full max-w-md flex-col items-center rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-xl backdrop-blur-md sm:p-8"
    >
      <!-- Logo -->
      <NuxtLink
        to="/"
        class="mb-6 block transition-transform hover:scale-105 active:scale-95"
      >
        <NuxtImg
          src="/DA_Logo.png"
          alt="DermAssist Logo"
          class="h-12 object-contain sm:h-14"
        />
      </NuxtLink>

      <!-- Icon State -->
      <div class="relative mb-6 flex items-center justify-center">
        <div
          v-if="isSuccess"
          class="flex size-20 items-center justify-center rounded-3xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 shadow-sm"
        >
          <Icon
            name="lucide:shield-check"
            class="size-10"
          />
        </div>
        <div
          v-else-if="errorMessage && !token"
          class="flex size-20 items-center justify-center rounded-3xl border border-rose-500/30 bg-rose-500/10 text-rose-600 shadow-sm"
        >
          <Icon
            name="lucide:shield-alert"
            class="size-10"
          />
        </div>
        <div
          v-else
          class="flex size-20 items-center justify-center rounded-3xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 shadow-sm"
        >
          <Icon
            name="lucide:key-round"
            class="size-10"
          />
        </div>
      </div>

      <!-- State 1: Password Reset Successful -->
      <template v-if="isSuccess">
        <h2 class="text-center text-xl font-bold tracking-tight text-emerald-600 sm:text-2xl">
          Password Updated!
        </h2>
        <p class="mt-2 max-w-xs text-center text-xs leading-relaxed text-slate-500 sm:text-sm">
          Your new password has been set. All previous login sessions have been secured.
        </p>

        <div class="mt-8 w-full">
          <AppButton
            variant="solid"
            size="lg"
            class="w-full justify-center rounded-2xl bg-indigo-600 font-bold text-white shadow-md hover:bg-indigo-700"
            @click="handleGoToLogin"
          >
            <span>Proceed to Login</span>
            <Icon
              name="lucide:arrow-right"
              class="ml-1 text-base"
            />
          </AppButton>
        </div>
      </template>

      <!-- State 2: Enter New Password Form -->
      <template v-else>
        <h2 class="text-center text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Set New Password
        </h2>
        <p class="mt-2 max-w-xs text-center text-xs leading-relaxed text-slate-500 sm:text-sm">
          Enter a strong, secure new password for your account.
        </p>

        <!-- Error Alert -->
        <div
          v-if="errorMessage"
          class="mt-4 flex w-full items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800"
        >
          <Icon
            name="lucide:alert-circle"
            class="mt-0.5 size-4 shrink-0 text-rose-600"
          />
          <span class="leading-relaxed font-medium">{{ errorMessage }}</span>
        </div>

        <form
          v-if="token && email"
          @submit.prevent="handleResetPassword"
          class="mt-6 w-full space-y-4"
        >
          <div>
            <label class="block text-xs font-bold text-slate-700">Email Address</label>
            <input
              type="email"
              v-model="email"
              required
              readonly
              class="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-slate-100/80 px-3.5 text-xs font-semibold text-slate-600 outline-none"
            />
          </div>

          <div>
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold text-slate-700">New Password</label>
              <button
                type="button"
                @click="togglePasswordVisibility"
                class="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                {{ showPassword ? 'Hide' : 'Show' }}
              </button>
            </div>
            <div class="relative mt-1">
              <input
                :type="showPassword ? 'text' : 'password'"
                v-model="newPassword"
                required
                placeholder="Enter new password"
                @blur="markTouched('password')"
                @input="markTouched('password')"
                class="h-11 w-full rounded-2xl border bg-white px-3.5 pr-10 text-xs font-medium text-slate-900 transition outline-none"
                :class="
                  errors.password
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                    : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                "
              />
              <button
                type="button"
                @click="togglePasswordVisibility"
                class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <Icon
                  :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'"
                  class="size-4"
                />
              </button>
            </div>
            <p
              v-if="errors.password"
              class="mt-1 text-xs font-medium text-rose-500"
            >
              {{ errors.password }}
            </p>

            <!-- Password Requirements Checklist -->
            <div
              v-if="newPassword || touched.password"
              class="mt-2.5 rounded-xl border border-slate-200/60 bg-slate-50/80 p-2.5 transition-all"
            >
              <p class="mb-1.5 text-[11px] font-medium text-slate-600">Password Requirements:</p>
              <div class="grid grid-cols-2 gap-1.5 text-[11px]">
                <div
                  class="flex items-center gap-1.5 transition-colors"
                  :class="
                    passwordCriteria.minLength ? 'font-medium text-emerald-600' : 'text-slate-400'
                  "
                >
                  <Icon
                    :name="passwordCriteria.minLength ? 'lucide:check-circle-2' : 'lucide:circle'"
                    class="h-3.5 w-3.5 shrink-0"
                  />
                  <span>At least 8 characters</span>
                </div>
                <div
                  class="flex items-center gap-1.5 transition-colors"
                  :class="
                    passwordCriteria.hasUpper ? 'font-medium text-emerald-600' : 'text-slate-400'
                  "
                >
                  <Icon
                    :name="passwordCriteria.hasUpper ? 'lucide:check-circle-2' : 'lucide:circle'"
                    class="h-3.5 w-3.5 shrink-0"
                  />
                  <span>One uppercase letter</span>
                </div>
                <div
                  class="flex items-center gap-1.5 transition-colors"
                  :class="
                    passwordCriteria.hasLower ? 'font-medium text-emerald-600' : 'text-slate-400'
                  "
                >
                  <Icon
                    :name="passwordCriteria.hasLower ? 'lucide:check-circle-2' : 'lucide:circle'"
                    class="h-3.5 w-3.5 shrink-0"
                  />
                  <span>One lowercase letter</span>
                </div>
                <div
                  class="flex items-center gap-1.5 transition-colors"
                  :class="
                    passwordCriteria.hasNumber ? 'font-medium text-emerald-600' : 'text-slate-400'
                  "
                >
                  <Icon
                    :name="passwordCriteria.hasNumber ? 'lucide:check-circle-2' : 'lucide:circle'"
                    class="h-3.5 w-3.5 shrink-0"
                  />
                  <span>One number (0-9)</span>
                </div>
                <div
                  class="col-span-2 flex items-center gap-1.5 transition-colors"
                  :class="
                    passwordCriteria.hasSpecial ? 'font-medium text-emerald-600' : 'text-slate-400'
                  "
                >
                  <Icon
                    :name="passwordCriteria.hasSpecial ? 'lucide:check-circle-2' : 'lucide:circle'"
                    class="h-3.5 w-3.5 shrink-0"
                  />
                  <span>One special symbol (!@#$%^&*...)</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700">Confirm New Password</label>
            <input
              :type="showPassword ? 'text' : 'password'"
              v-model="confirmPassword"
              required
              placeholder="Re-enter password"
              @blur="markTouched('confirmPassword')"
              @input="markTouched('confirmPassword')"
              class="mt-1 h-11 w-full rounded-2xl border bg-white px-3.5 text-xs font-medium text-slate-900 transition outline-none"
              :class="
                errors.confirmPassword
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
              "
            />
            <p
              v-if="errors.confirmPassword"
              class="mt-1 text-xs font-medium text-rose-500"
            >
              {{ errors.confirmPassword }}
            </p>
          </div>

          <div class="pt-2">
            <AppButton
              type="submit"
              variant="solid"
              size="lg"
              class="w-full justify-center rounded-2xl bg-indigo-600 font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
              :loading="isSubmitting"
              :disabled="isSubmitting || (touched.password && !isPasswordStrong)"
            >
              <span>Set New Password</span>
              <Icon
                name="lucide:lock"
                class="ml-1 text-sm"
              />
            </AppButton>
          </div>
        </form>

        <div
          v-else
          class="mt-6 w-full"
        >
          <AppButton
            variant="solid"
            size="lg"
            class="w-full justify-center rounded-2xl bg-indigo-600 font-bold text-white shadow-md hover:bg-indigo-700"
            @click="handleGoToForgotPassword"
          >
            <span>Request New Reset Link</span>
            <Icon
              name="lucide:arrow-right"
              class="ml-1 text-base"
            />
          </AppButton>
        </div>

        <div class="mt-6 text-center">
          <NuxtLink
            to="/auth/login"
            class="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
          >
            Remember your credentials? Return to Log In
          </NuxtLink>
        </div>
      </template>
    </div>
  </div>
</template>
