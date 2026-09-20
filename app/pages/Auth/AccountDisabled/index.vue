<script setup lang="ts">
  definePageMeta({
    layout: 'auth-split-layout',
    alias: ['/auth/account-disabled']
  })
</script>

<template>
  <div class="custom-scrollbar flex h-full flex-col overflow-y-auto px-6 py-8">
    <div class="my-auto flex flex-col items-center">
      <div class="mb-8 flex flex-col items-center text-center">
        <NuxtLink to="/">
          <NuxtImg
            src="/DA_Logo.png"
            class="h-16 grayscale"
          />
        </NuxtLink>
        <div
          class="mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600"
        >
          <Icon
            name="material-symbols:block"
            class="text-3xl"
          />
        </div>
        <h1 class="text-foreground mt-6 text-3xl font-bold tracking-tight">Account Disabled</h1>
        <p class="text-foreground/60 mt-4 max-w-sm text-sm">
          Your account has been temporarily disabled by your managing doctor. Please contact your
          doctor for more information or to request account reactivation.
        </p>
      </div>

      <div class="mt-4 w-full max-w-sm">
        <AppButton
          block
          variant="outline"
          class="border-gray-200 font-bold"
          @click="navigateTo('/auth/login')"
        >
          Return to Login
        </AppButton>
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
