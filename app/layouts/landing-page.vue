<template>
  <div class="bg-background flex min-h-screen flex-col">
    <!-- Sticky floating navbar -->
    <header class="pointer-events-none fixed top-0 right-0 left-0 z-50">
      <div class="pointer-events-auto w-full">
        <LandingPageNavbar />
      </div>
    </header>

    <div class="flex-1">
      <slot />
    </div>
    <LandingPageFooter />
  </div>
</template>
