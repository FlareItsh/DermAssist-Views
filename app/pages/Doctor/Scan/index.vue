<script setup lang="ts">
  import { ref } from 'vue'
  const { currentDiagnosis, isScanned, isProceededToResults, resetScanner } = useDiagnosis()

  const showConfirmDiscard = ref(false)

  const discardAndStartNew = () => {
    if (import.meta.client) {
      try {
        localStorage.removeItem('dermassist_active_diagnosis')
        localStorage.removeItem('draft_clinical_note_active')
        localStorage.removeItem('draft_patient_info_active')
        if (currentDiagnosis.value?.uuid) {
          localStorage.removeItem(`draft_clinical_note_diag_${currentDiagnosis.value.uuid}`)
          localStorage.removeItem(`draft_patient_info_${currentDiagnosis.value.uuid}`)
        }
      } catch (e) {
        // silent fail
      }
    }
    resetScanner()
    showConfirmDiscard.value = false
  }

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })
</script>

<template>
  <div class="flex h-full gap-5">
    <div class="min-w-0 flex-1">
      <!-- Active Assessment Pending Card -->
      <div v-if="currentDiagnosis && isScanned && isProceededToResults" class="bg-white rounded-[2.5rem] p-10 border border-amber-200/80 shadow-sm flex flex-col items-center justify-center text-center h-full min-h-[500px] relative overflow-hidden">
        <div class="absolute -top-32 -right-32 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div class="bg-amber-100/80 text-amber-700 h-20 w-20 rounded-3xl flex items-center justify-center mb-6 shadow-xs border border-amber-200/60">
          <Icon name="material-symbols:lock-clock-outline-rounded" class="text-4xl" />
        </div>

        <span class="px-3.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-black uppercase tracking-wider mb-3">
          Assessment Pending
        </span>

        <h2 class="text-2xl font-black text-gray-900 tracking-tight max-w-md">
          Active Diagnosis Assessment In Progress
        </h2>

        <p class="text-sm font-medium text-gray-600 mt-2 max-w-lg leading-relaxed">
          You have an active scan assessment in progress. Please complete the assessment and click <span class="font-bold text-gray-900">"Finish Diagnosis & Save"</span> to finish and unlock the scanner for new scans.
        </p>

        <div class="flex flex-col sm:flex-row items-center gap-3 mt-8">
          <AppButton
            size="lg"
            class="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl active:scale-95 flex items-center gap-2 cursor-pointer"
            @click="navigateTo('/Doctor/Scan/Results')"
          >
            <Icon name="material-symbols:arrow-forward-rounded" class="text-xl" />
            <span>Resume & Finish Diagnosis</span>
          </AppButton>

          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            class="px-6 py-3.5 rounded-2xl font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-200/60 cursor-pointer active:scale-95 text-sm"
            @click="showConfirmDiscard = true"
          >
            Discard Scan & Start Fresh
          </AppButton>
        </div>
      </div>

      <!-- Normal Scanner Component -->
      <AppScanner v-else />
    </div>

    <div class="sticky top-0 w-[450px] shrink-0">
      <AppDiagnosisFindingsSummary role="doctor" />
    </div>

    <!-- Confirm Discard Modal -->
    <AppModal v-model="showConfirmDiscard" title="Discard Active Scan?" description="This will wipe the current scan result and unsaved notes so you can start a new scan." size="sm">
      <div class="py-2 text-sm text-gray-600 font-medium">
        Are you sure you want to discard the active scan and unsaved draft notes? This action cannot be undone.
      </div>
      <template #footer>
        <div class="flex items-center justify-end gap-3 w-full">
          <AppButton variant="ghost" class="rounded-xl px-5 font-bold text-gray-500" @click="showConfirmDiscard = false">
            Cancel
          </AppButton>
          <AppButton variant="solid" class="bg-red-600 hover:bg-red-700 text-white rounded-xl px-5 font-bold" @click="discardAndStartNew">
            Discard & Start New
          </AppButton>
        </div>
      </template>
    </AppModal>
  </div>
</template>
