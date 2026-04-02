<script setup lang="ts">
  definePageMeta({
    layout: 'auth-split-layout'
  })

  const form = reactive({
    email: '',
    password: ''
  })
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-12 py-8">
    <div class="mb-10 flex flex-col items-center text-center">
      <NuxtImg
        src="/DA_Logo.png"
        class="h-25"
      />
      <h1 class="text-foreground text-4xl font-bold tracking-tight">Welcome back!</h1>
      <p class="text-foreground/80 mt-2">Let’s get you sign in.</p>
    </div>

    <form
      @submit.prevent
      class="flex w-full max-w-sm flex-col gap-6"
    >
      <AuthInput
        id="email"
        v-model="form.email"
        label="Email Address"
        type="email"
      />
      <AuthInput
        id="password"
        v-model="form.password"
        label="Password"
        type="password"
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
