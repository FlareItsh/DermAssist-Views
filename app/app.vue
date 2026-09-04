<template>
  <UApp>
    <Toaster
      position="top-right"
      richColors
      closeButton
    />
    <NuxtLoadingIndicator
      color="#3B82F6"
      :height="4"
      :throttle="0"
    />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
  import 'vue-sonner/style.css'
  import { Toaster } from 'vue-sonner'
</script>
