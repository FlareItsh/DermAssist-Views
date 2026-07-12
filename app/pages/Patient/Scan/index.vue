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
  <div>
    <!-- Desktop Layout -->
    <div class="desktop-only flex h-[calc(100vh-8rem)] gap-5 overflow-hidden">
      <div class="min-w-0 flex-1 h-full">
        <AppScanner />
      </div>

      <div class="w-[450px] shrink-0 h-full">
        <AppDiagnosisFindingsSummary />
      </div>
    </div>

    <!-- Mobile Layout -->
    <div class="mobile-only -mx-5">
      <PatientSideComponentsMobileScanner />
    </div>
  </div>
</template>

<style scoped>
@media (min-width: 768px) {
  .mobile-only {
    display: none !important;
  }
}
@media (max-width: 767px) {
  .desktop-only {
    display: none !important;
  }
}
</style>
