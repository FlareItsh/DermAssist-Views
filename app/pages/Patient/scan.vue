<script setup lang="ts">
definePageMeta({
  layout: 'dashboard-sidebar-layout'
})
</script>

<template>
  <div class="flex gap-5 h-full">
    <div class="flex-1 min-w-0">
      <AppScanner />
    </div>

    <div class="w-[450px] shrink-0 sticky top-0">
      <AppDiagnosisFindingsSummary />
    </div>
  </div>
</template>
