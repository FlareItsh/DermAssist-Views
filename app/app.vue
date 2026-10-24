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
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com'
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: ''
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800;900&family=Playfair+Display:ital,wght@1,400;1,500;1,600;1,700&display=swap'
      }
    ]
  })
</script>
