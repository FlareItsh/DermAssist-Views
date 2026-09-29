<script setup lang="ts">
  const {
    currentDiagnosis,
    isScanned,
    isHealthyState,
    isInconclusiveState,
    isOutOfScopeState,
    isNoneState,
    chartData
  } = useDiagnosis()
  const userName = useCookie('user_name')

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  // Redirect to scanner if no diagnosis is present
  onMounted(() => {
    if (!currentDiagnosis.value || !isScanned.value) {
      navigateTo('/Patient/Scan')
    }
  })
</script>

<template>
  <div>
    <!-- Desktop Layout -->
    <div
      class="desktop-only flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm"
    >
      <!-- Header -->
      <header
        class="flex shrink-0 items-center justify-between border-b border-gray-100 px-10 py-4"
      >
        <div class="flex items-center gap-4">
          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            @click="navigateTo('/Patient/Scan')"
            class="group hover:text-primary flex items-center gap-2 text-gray-500 transition-colors"
          >
            <div
              class="group-hover:bg-primary/10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 transition-colors"
            >
              <Icon
                name="material-symbols:arrow-back-rounded"
                class="text-lg"
              />
            </div>
            <span class="text-sm font-bold">Back to Scanner</span>
          </AppButton>
        </div>

        <div class="flex items-center gap-6">
          <div class="flex flex-col items-end">
            <span class="text-[10px] font-black tracking-widest text-gray-400 uppercase"
              >Diagnosis ID</span
            >
            <span class="font-mono text-xs font-bold text-gray-600"
              >#{{ currentDiagnosis?.uuid?.slice(0, 8) || 'PENDING' }}</span
            >
          </div>
          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            class="bg-primary/10 text-primary hover:bg-primary/20 flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
          >
            <Icon
              name="material-symbols:share-rounded"
              class="text-xl"
            />
          </AppButton>
        </div>
      </header>

      <!-- Main Content -->
      <main class="min-h-0 flex-1">
        <AppModalDiagnosisFindingsDetailed
          v-if="currentDiagnosis"
          role="patient"
          :condition-name="
            isNoneState
              ? 'None'
              : isOutOfScopeState
                ? 'OutOfScope'
                : isInconclusiveState
                  ? 'Inconclusive'
                  : isHealthyState
                    ? 'Clear'
                    : currentDiagnosis?.label
          "
          :patient-name="userName"
          :diagnosis-data="chartData"
          :diagnosis-uuid="currentDiagnosis?.uuid"
        />
      </main>
    </div>

    <!-- Mobile Layout -->
    <div class="mobile-only -mx-5 min-h-screen bg-gray-50 px-5">
      <PatientSideComponentsMobileScanResults />
    </div>
  </div>
</template>

<style scoped>
  /* Ensure the page transition feels smooth */
  .page-enter-active,
  .page-leave-active {
    transition: all 0.3s ease;
  }
  .page-enter-from,
  .page-leave-to {
    opacity: 0;
    transform: translateY(10px);
  }

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
