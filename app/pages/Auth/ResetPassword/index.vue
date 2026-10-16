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

  const handleResetPassword = async () => {
    if (!email.value.trim()) {
      errorMessage.value = 'Email address is required.'
      return
    }
    if (!token.value.trim()) {
      errorMessage.value = 'Password reset token is missing or invalid.'
      return
    }
    if (!newPassword.value) {
      errorMessage.value = 'Please enter your new password.'
      return
    }
    if (newPassword.value.length < 8) {
      errorMessage.value = 'Password must be at least 8 characters long.'
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
        email: email.value.trim(),
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
          Your confidential password has been set. All previous login sessions have been secured.
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
          Create Private Password
        </h2>
        <p class="mt-2 max-w-xs text-center text-xs leading-relaxed text-slate-500 sm:text-sm">
          Choose a secure password for your clinical patient account. Only you will have access.
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
                minlength="8"
                placeholder="Min. 8 characters"
                class="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3.5 pr-10 text-xs font-medium text-slate-900 transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700">Confirm New Password</label>
            <input
              :type="showPassword ? 'text' : 'password'"
              v-model="confirmPassword"
              required
              minlength="8"
              placeholder="Re-enter password"
              class="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-900 transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div class="pt-2">
            <AppButton
              type="submit"
              variant="solid"
              size="lg"
              class="w-full justify-center rounded-2xl bg-indigo-600 font-bold text-white shadow-md hover:bg-indigo-700"
              :loading="isSubmitting"
            >
              <span>Set Private Password</span>
              <Icon
                name="lucide:lock"
                class="ml-1 text-sm"
              />
            </AppButton>
          </div>
        </form>

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
