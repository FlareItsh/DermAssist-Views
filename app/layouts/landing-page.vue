<template>
  <div class="bg-background flex h-full flex-col">
    <LandingPageNavbar />
    <div class="flex-1">
      <slot />
    </div>
    <LandingPageFooter />
  </div>
</template>
