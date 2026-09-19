<script setup lang="ts">
  definePageMeta({
    middleware: () => navigateTo('/doctor/patients', { redirectCode: 301, replace: true })
  })
</script>

<template>
  <div class="flex items-center justify-center min-h-[50vh]">
    <p class="text-sm text-muted-foreground animate-pulse">Redirecting to patients...</p>
  </div>
</template>
