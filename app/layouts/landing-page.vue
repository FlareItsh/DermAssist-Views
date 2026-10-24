<template>
  <div
    class="from-primary via-secondary md:bg-background selection:text-secondary flex min-h-screen flex-col bg-gradient-to-b to-white selection:bg-white md:bg-none"
  >
    <LandingPageNavbar />
    <div class="flex-1">
      <slot />
    </div>
    <LandingPageFooter />
  </div>
</template>

<script setup lang="ts">
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
