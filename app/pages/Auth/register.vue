<script setup lang="ts">
  definePageMeta({
    layout: 'auth-split-layout'
  })

  const form = reactive({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-12 py-8">
    <div class="mb-8 flex flex-col items-center text-center">
      <NuxtImg
        src="/DA_Logo.png"
        class="h-25"
      />
      <h1 class="text-foreground text-4xl font-bold tracking-tight">Create an account</h1>
      <p class="text-foreground/80 mt-2">Welcome to DermAssist start by creating your account.</p>
    </div>

    <form
      @submit.prevent
      class="flex w-full max-w-md flex-col gap-4"
    >
      <div class="grid grid-cols-2 gap-4">
        <AuthInput
          id="first-name"
          v-model="form.firstName"
          label="First name"
        />
        <AuthInput
          id="last-name"
          v-model="form.lastName"
          label="Last name"
        />
      </div>
      <AuthInput
        id="email"
        v-model="form.email"
        label="Email"
        type="email"
      />
      <AuthInput
        id="password"
        v-model="form.password"
        label="Password"
        type="password"
      />
      <AuthInput
        id="confirm-password"
        v-model="form.confirmPassword"
        label="Confirm Password"
        type="password"
      />

      <button
        type="submit"
        class="bg-primary text-primary-foreground shadow-primary/20 mt-4 w-full rounded-2xl py-4 font-bold shadow-lg transition-all hover:opacity-90 active:scale-95"
      >
        Create account
      </button>
    </form>

    <div class="mt-8 text-center text-sm">
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
