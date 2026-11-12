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
    <AppCookieBanner />
  </UApp>
</template>

<script setup lang="ts">
  import 'vue-sonner/style.css'
  import { Toaster } from 'vue-sonner'

  useHead({
    link: [
      { rel: 'icon', type: 'image/png', href: '/DALogo.png' },
      { rel: 'apple-touch-icon', href: '/DALogo.png' }
    ]
  })
</script>
