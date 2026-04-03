<script setup lang="ts">
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

  const validate = () => {
    let isValid = true
    errors.email = ''
    errors.password = ''
    errors.general = ''

    if (!form.email) {
      errors.email = 'Email address is required'
      isValid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Please enter a valid email address'
      isValid = false
    }

    if (!form.password) {
      errors.password = 'Password is required'
      isValid = false
    }

    return isValid
  }

  const submitForm = async () => {
    if (!validate()) return

    try {
      const response = await $api<any>('login', {
        method: 'POST',
        body: form
      })

      if (response.token) {
        const token = useCookie('auth_token', {
          maxAge: 60 * 60 * 24 * 7, // 1 week
          path: '/'
        })
        token.value = response.token

        // Store user role
        const role = useCookie('user_role', {
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })
        role.value = response.user.role
      }

      if (response.user && response.user.role) {
        // Redirect based on role: /admin, /patient, or /doctor
        await navigateTo(`/${response.user.role}`)
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
    }
  }
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-12 py-8">
    <div class="mb-10 flex flex-col items-center text-center">
      <NuxtLink to="/">
        <NuxtImg
          src="/DA_Logo.png"
          class="h-25"
        />
      </NuxtLink>
      <h1 class="text-foreground text-4xl font-bold tracking-tight">Welcome back!</h1>
      <p class="text-foreground/80 mt-2">Let’s get you sign in.</p>
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
      />
      <AuthInput
        id="password"
        v-model="form.password"
        label="Password"
        type="password"
        :error="errors.password"
      />

      <div class="flex items-center justify-between px-1">
        <label class="text-foreground/60 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            class="accent-primary border-input h-4 w-4 rounded"
          />
          Remember me
        </label>
        <button
          type="button"
          class="text-primary text-sm font-medium hover:underline"
        >
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        class="bg-primary text-primary-foreground shadow-primary/20 mt-4 w-full rounded-2xl py-4 font-bold shadow-lg transition-all hover:opacity-90 active:scale-95"
      >
        Sign In
      </button>
    </form>

    <div class="mt-10 text-center text-sm">
      <span class="text-foreground/60">Don't have an account?</span>
      <NuxtLink
        to="/auth/register"
        class="text-primary ml-1 font-semibold hover:underline"
      >
        Create one
      </NuxtLink>
    </div>
  </div>
</template>
