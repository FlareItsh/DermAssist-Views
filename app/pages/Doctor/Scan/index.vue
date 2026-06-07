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
  <div class="flex h-full gap-5">
    <div class="min-w-0 flex-1">
      <AppScanner />
    </div>

    <div class="sticky top-0 w-[450px] shrink-0">
      <AppDiagnosisFindingsSummary role="doctor" />
    </div>
  </div>
</template>
