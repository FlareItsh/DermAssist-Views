<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'
  const { resetScanner } = useDiagnosis()

  const isMobile = ref<boolean>(import.meta.client ? window.innerWidth < 768 : false)

  const updateViewport = () => {
    isMobile.value = window.innerWidth < 768
  }

  onMounted(() => {
    resetScanner()
    updateViewport()
    window.addEventListener('resize', updateViewport)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateViewport)
  })

  definePageMeta({
    ssr: false,
    layout: 'dashboard-sidebar-layout'
  })
</script>

<template>
  <div class="h-full min-h-0 w-full">
    <!-- Desktop Layout -->
    <div
      v-if="isMobile === false"
      class="desktop-only flex h-full min-h-0 w-full gap-5"
    >
      <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <ClientOnly>
          <AppScanner />
        </ClientOnly>
      </div>

      <div class="flex h-full min-h-0 w-[380px] shrink-0 flex-col xl:w-[440px]">
        <ClientOnly>
          <AppDiagnosisFindingsSummary />
        </ClientOnly>
      </div>
    </div>

    <!-- Mobile Layout - fullscreen, no scroll -->
    <div
      v-else-if="isMobile === true"
      class="mobile-only fixed inset-0 z-40 bg-black"
    >
      <ClientOnly>
        <PatientSideComponentsMobileScanner />
      </ClientOnly>
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
