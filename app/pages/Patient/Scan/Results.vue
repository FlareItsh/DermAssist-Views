<script setup lang="ts">
const { currentDiagnosis, isScanned, isHealthyState, chartData } = useDiagnosis()
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
  <div class="flex h-full flex-col overflow-hidden bg-white rounded-[2.5rem] shadow-sm border border-gray-100">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-gray-100 px-10 py-6 shrink-0">
      <div class="flex items-center gap-4">
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          @click="navigateTo('/Patient/Scan')"
          class="group flex items-center gap-2 text-gray-500 hover:text-primary transition-colors">
          <div class="bg-gray-100 group-hover:bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full transition-colors">
             <Icon name="material-symbols:arrow-back-rounded" class="text-xl" />
          </div>
          <span class="font-bold">Back to Scanner</span>
        </AppButton>
      </div>
      
      <div class="flex items-center gap-6">
        <div class="flex flex-col items-end">
           <span class="text-xs font-bold uppercase tracking-widest text-gray-400">Diagnosis ID</span>
           <span class="text-sm font-mono font-bold text-gray-600">#{{ currentDiagnosis?.id?.slice(0, 8) || 'PENDING' }}</span>
        </div>
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          class="bg-primary/10 text-primary h-12 w-12 flex items-center justify-center rounded-2xl hover:bg-primary/20 transition-colors">
          <Icon name="material-symbols:share-outline-rounded" class="text-2xl" />
        </AppButton>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 min-h-0">
      <AppModalDiagnosisFindingsDetailed 
        v-if="currentDiagnosis"
        role="patient"
        :condition-name="currentDiagnosis?.label === 'None' ? 'None' : (isHealthyState ? 'Clear' : currentDiagnosis?.label)"
        :patient-name="userName"
        :diagnosis-data="chartData"
        :diagnosis-uuid="currentDiagnosis?.id"
      />
    </main>
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
</style>
