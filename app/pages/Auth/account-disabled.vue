<script setup lang="ts">
  definePageMeta({
    layout: 'auth-split-layout'
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
        <div class="bg-red-100 text-red-600 w-16 h-16 rounded-full flex items-center justify-center mt-6">
           <Icon name="material-symbols:block" class="text-3xl" />
        </div>
        <h1 class="text-foreground mt-6 text-3xl font-bold tracking-tight">Account Disabled</h1>
        <p class="text-foreground/60 mt-4 text-sm max-w-sm">
          Your account has been temporarily disabled by your managing doctor. Please contact your doctor for more information or to request account reactivation.
        </p>
      </div>

      <div class="mt-4 w-full max-w-sm">
         <AppButton block variant="outline" class="font-bold border-gray-200" @click="navigateTo('/auth/login')">
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
