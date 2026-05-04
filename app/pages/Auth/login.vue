<script setup lang="ts">
  import { authService } from '~/api/auth/AuthService'
  import Button from '~/components/App/Button.vue'

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
    general: ''
  })

  const isLoading = ref(false)

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
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Please enter a valid email address'
          else errors.email = ''
          break
        case 'password':
          if (!form.password) errors.password = 'Password is required'
          else errors.password = ''
          break
      }
    }, 500) // 500ms delay
  }

  watch(() => form.email, () => {
    errors.email = ''
    validateField('email')
  })
  watch(() => form.password, () => {
    errors.password = ''
    validateField('password')
  })

  const validate = () => {
    // Clear any pending debounce
    if (debounceTimeout) clearTimeout(debounceTimeout)

    // Mark all as touched on submit to show errors immediately
    touched.email = true
    touched.password = true

    // Immediate validation for submission
    if (!form.email) errors.email = 'Email address is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Please enter a valid email address'
    else errors.email = ''

    if (!form.password) errors.password = 'Password is required'
    else errors.password = ''

    return !errors.email && !errors.password
  }

  const submitForm = async () => {
    if (!validate()) return
    isLoading.value = true

    isLoading.value = true
    try {
      const response = await authService.login(form.email, form.password)

      if (response.token) {
        const token = useCookie('auth_token', {
          maxAge: 60 * 60 * 24 * 7, // 1 week
          path: '/'
        })
        token.value = response.token

        const userData = response.user.data || response.user
        const baseRole = userData?.role?.split('/')[0] || 'patient'

        // Store user role
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
        userName.value = `${userData.first_name} ${userData.last_name}`
        authName.value = `${userData.first_name} ${userData.last_name}`

        const userUuid = useCookie('user_uuid', {
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })
        userUuid.value = userData.uuid
      }

      if (response.user && response.user.role) {
        const baseRole = response.user.role?.split('/')[0] || 'patient'
        // Redirect based on role: /admin, /patient, or /doctor
        await navigateTo(`/${baseRole}`)
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        const validationErrors = error.response._data.errors
        if (validationErrors.email) errors.email = validationErrors.email[0]
        if (validationErrors.password) errors.password = validationErrors.password[0]
      } else if (error.response?.status === 401) {
        errors.general = error.response._data.message || 'Invalid credentials'
      } else {
        errors.general = 'An unexpected error occurred. Please try again.'
      }
      console.error('Login failed:', error)
    } finally {
      isLoading.value = false
    }
  }
</script>

<template>
  <div class="custom-scrollbar flex h-full flex-col overflow-y-auto px-6 py-8">
    <div class="my-auto flex flex-col items-center">
      <div class="mb-8 flex flex-col items-center text-center">
        <NuxtLink to="/">
          <NuxtImg
            src="/DA_Logo.png"
            class="h-16"
          />
        </NuxtLink>
        <h1 class="text-foreground mt-4 text-3xl font-bold tracking-tight">Welcome back!</h1>
        <p class="text-foreground/60 mt-2 text-sm">Let’s get you signed in.</p>
      </div>

      <form
        @submit.prevent="submitForm"
        class="flex w-full max-w-sm flex-col gap-6"
      >
        <div
          v-if="errors.general"
          class="bg-destructive/10 text-destructive rounded-xl p-4 text-center text-sm font-medium"
        >
          {{ errors.general }}
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
          <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
            type="button"
            class="text-primary text-sm font-medium hover:underline"
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
      </form>

      <div class="mt-8 text-center text-sm">
        <span class="text-foreground/60">Don't have an account?</span>
        <NuxtLink
          to="/auth/register"
          class="text-primary ml-1 font-semibold hover:underline"
        >
          Create one
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
    background: rgba(var(--foreground), 0.1);
    border-radius: 10px;
  }
</style>
