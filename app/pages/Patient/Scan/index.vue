<script setup lang="ts">
  import { onMounted } from 'vue'
  const { resetScanner } = useDiagnosis()

  onMounted(() => {
    resetScanner()
  })

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })
</script>

<template>
  <div class="flex h-[calc(100vh-8rem)] gap-5 overflow-hidden">
    <div class="min-w-0 flex-1 h-full">
      <AppScanner />
    </div>

    <div class="w-[450px] shrink-0 h-full">
      <AppDiagnosisFindingsSummary />
    </div>
  </div>
</template>
