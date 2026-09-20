<script setup lang="ts">
  definePageMeta({
    middleware: () => navigateTo('/doctor/patients', { redirectCode: 301, replace: true })
  })
</script>

<template>
  <div class="flex min-h-[50vh] items-center justify-center">
    <p class="text-muted-foreground animate-pulse text-sm">Redirecting to patients...</p>
  </div>
</template>
