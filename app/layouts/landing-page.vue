<template>
  <div class="flex flex-col h-full bg-background">
    <LandingPageNavbar />
    <div class="flex-1">
      <slot />
    </div>
    <LandingPageFooter />
  </div>
</template>
