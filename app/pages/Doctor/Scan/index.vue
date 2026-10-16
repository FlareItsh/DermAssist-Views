<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  const {
    currentDiagnosis,
    isScanned,
    isProceededToResults,
    pendingPatientRegistration,
    pendingPatientName,
    resetScanner
  } = useDiagnosis()
  const { canExecuteScan, isLoadingSubscription, fetchSubscription } = useDoctorSubscription()

  const showConfirmDiscard = ref(false)

  const discardModalTitle = computed(() => 'Discard Active Scan?')

  const discardModalDescription = computed(() => {
    return 'Are you sure you want to discard the active scan and unsaved notes? This action cannot be undone.'
  })

  const discardModalConfirmText = computed(() => 'Discard & Start New')

  onMounted(async () => {
    await fetchSubscription()
  })

  const discardAndStartNew = () => {
    pendingPatientRegistration.value = null
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
    ssr: false,
    layout: 'dashboard-sidebar-layout'
  })
</script>

<template>
  <div class="h-full min-h-0 w-full">
    <!-- Desktop Layout -->
    <div class="desktop-only flex h-full min-h-0 w-full gap-5">
      <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <!-- Loading Subscription State -->
        <div
          v-if="isLoadingSubscription"
          class="bg-card border-border flex h-full min-h-[500px] flex-col items-center justify-center rounded-[2.5rem] border p-10 text-center shadow-sm"
        >
          <Icon
            name="svg-spinners:ring-resize"
            class="text-primary mb-4 h-10 w-10 animate-spin"
          />
          <p class="text-muted-foreground text-sm font-medium">Checking subscription access...</p>
        </div>

        <!-- Unsubscribed / Feature Disabled Doctor Paywall Card -->
        <div
          v-else-if="!canExecuteScan"
          class="bg-card border-border relative flex h-full min-h-[500px] flex-col items-center justify-center overflow-hidden rounded-[2.5rem] border p-10 text-center shadow-sm"
        >
          <div
            class="bg-primary/10 pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full blur-3xl"
          ></div>

          <div
            class="bg-primary/10 text-primary border-primary/20 mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border shadow-sm"
          >
            <Icon
              name="lucide:lock"
              class="text-4xl"
            />
          </div>

          <AppBadge
            color="primary"
            variant="subtle"
            class="mb-3 px-3 py-1 text-xs font-bold tracking-wider uppercase"
          >
            Feature Upgrade Required
          </AppBadge>

          <h2 class="text-foreground max-w-md text-2xl font-black tracking-tight md:text-3xl">
            Unlock Doctor AI Skin Scanner
          </h2>

          <p class="text-muted-foreground mt-3 max-w-lg text-sm leading-relaxed font-medium">
            Your current subscription plan does not include Full Doctor AI Scan Execution. Upgrade
            your plan to perform live patient scans and instant AI dermatological assessments.
          </p>

          <div class="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <AppButton
              size="lg"
              variant="solid"
              to="/doctor/subscription"
              class="shadow-primary/20 flex items-center gap-2 px-8 py-3.5 shadow-lg"
            >
              <Icon
                name="lucide:sparkles"
                class="text-lg"
              />
              <span>Upgrade Subscription Plan</span>
            </AppButton>
          </div>
        </div>

        <!-- Active Assessment Pending Card -->
        <div
          v-else-if="currentDiagnosis && isScanned && isProceededToResults"
          class="relative flex h-full min-h-[500px] flex-col items-center justify-center overflow-hidden rounded-[2.5rem] border border-amber-200/80 bg-white p-10 text-center shadow-sm"
        >
          <div
            class="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl"
          ></div>

          <div
            class="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-200/60 bg-amber-100/80 text-amber-700 shadow-xs"
          >
            <Icon
              name="material-symbols:lock-clock-outline-rounded"
              class="text-4xl"
            />
          </div>

          <span
            class="mb-3 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-black tracking-wider text-amber-800 uppercase"
          >
            Assessment Pending
          </span>

          <h2 class="max-w-md text-2xl font-black tracking-tight text-gray-900">
            Active Diagnosis Assessment In Progress
          </h2>

          <p class="mt-2 max-w-lg text-sm leading-relaxed font-medium text-gray-600">
            You have an active scan assessment in progress. Please complete the assessment and click
            <span class="font-bold text-gray-900">"Finish Diagnosis & Save"</span> to finish and
            unlock the scanner for new scans.
          </p>

          <div class="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <AppButton
              size="lg"
              class="bg-primary hover:bg-primary/90 shadow-primary/20 flex cursor-pointer items-center gap-2 rounded-2xl px-8 py-3.5 font-bold text-white shadow-lg transition-all hover:shadow-xl active:scale-95"
              @click="navigateTo('/Doctor/Scan/Results')"
            >
              <Icon
                name="material-symbols:arrow-forward-rounded"
                class="text-xl"
              />
              <span>Resume & Finish Diagnosis</span>
            </AppButton>

            <AppButton
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              class="cursor-pointer rounded-2xl border border-transparent px-6 py-3.5 text-sm font-bold text-gray-500 transition-all hover:border-red-200/60 hover:bg-red-50 hover:text-red-600 active:scale-95"
              @click="showConfirmDiscard = true"
            >
              Discard Scan & Start Fresh
            </AppButton>
          </div>
        </div>

        <!-- Normal Scanner Component -->
        <ClientOnly v-else>
          <AppScanner />
        </ClientOnly>
      </div>

      <div class="flex h-full min-h-0 w-[380px] shrink-0 flex-col xl:w-[440px]">
        <ClientOnly>
          <AppDiagnosisFindingsSummary role="doctor" />
        </ClientOnly>
      </div>
    </div>

    <!-- Mobile Layout -->
    <div class="mobile-only fixed inset-0 z-40 bg-black">
      <!-- Loading Subscription State -->
      <div
        v-if="isLoadingSubscription"
        class="bg-card fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center"
      >
        <Icon
          name="svg-spinners:ring-resize"
          class="text-primary mb-4 h-10 w-10 animate-spin"
        />
        <p class="text-muted-foreground text-sm font-medium">Checking subscription access...</p>
      </div>

      <!-- Unsubscribed / Feature Disabled Doctor Paywall Card -->
      <div
        v-else-if="!canExecuteScan"
        class="bg-card fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto p-6 text-center"
      >
        <div
          class="bg-primary/10 text-primary border-primary/20 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm"
        >
          <Icon
            name="lucide:lock"
            class="text-3xl"
          />
        </div>

        <AppBadge
          color="primary"
          variant="subtle"
          class="mb-2 px-3 py-1 text-xs font-bold tracking-wider uppercase"
        >
          Feature Upgrade Required
        </AppBadge>

        <h2 class="text-foreground text-xl font-black tracking-tight">
          Unlock Doctor AI Skin Scanner
        </h2>

        <p class="text-muted-foreground mt-2 max-w-xs text-xs leading-relaxed font-medium">
          Your plan does not include Full Doctor AI Scan Execution. Upgrade to perform live scans
          and instant dermatological assessments.
        </p>

        <div class="mt-6 flex flex-col items-center gap-3">
          <AppButton
            size="md"
            variant="solid"
            to="/doctor/subscription"
            class="shadow-primary/20 flex items-center gap-2 px-6 py-3 font-bold shadow-lg"
          >
            <Icon
              name="lucide:sparkles"
              class="text-base"
            />
            <span>Upgrade Subscription</span>
          </AppButton>
        </div>
      </div>

      <!-- Active Assessment Pending Card -->
      <div
        v-else-if="currentDiagnosis && isScanned && isProceededToResults"
        class="bg-card fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto p-6 text-center"
      >
        <div
          class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/60 bg-amber-100/80 text-amber-700 shadow-xs"
        >
          <Icon
            name="material-symbols:lock-clock-outline-rounded"
            class="text-3xl"
          />
        </div>

        <span
          class="mb-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black tracking-wider text-amber-800 uppercase"
        >
          Assessment Pending
        </span>

        <h2 class="text-xl font-black tracking-tight text-gray-900">
          Active Assessment In Progress
        </h2>

        <p class="mt-2 max-w-xs text-xs leading-relaxed font-medium text-gray-600">
          You have an active scan session. Complete and save the diagnosis to unlock new scans.
        </p>

        <!-- Staged Pending Patient Mobile Advisory Notice -->
        <div
          v-if="pendingPatientRegistration"
          class="mt-3 max-w-xs rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-[11px] text-amber-900"
        >
          <div class="flex items-start gap-2">
            <Icon
              name="lucide:alert-triangle"
              class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
            />
            <div>
              <span class="font-bold">Pending Staged Account:</span>
              <p class="mt-0.5 leading-snug text-amber-800">
                If discarded, the account for
                <span class="font-bold text-amber-950">{{
                  pendingPatientName || 'this patient'
                }}</span>
                will not be saved — only added to the list with no account to be usable unless
                officially created.
              </p>
            </div>
          </div>
        </div>

        <div class="mt-6 flex w-full max-w-xs flex-col gap-2.5">
          <AppButton
            size="md"
            class="bg-primary hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-white shadow-md active:scale-95"
            @click="navigateTo('/Doctor/Scan/Results')"
          >
            <Icon
              name="material-symbols:arrow-forward-rounded"
              class="text-lg"
            />
            <span>Resume & Finish</span>
          </AppButton>

          <AppButton
            variant="unstyled"
            size="unstyled"
            rounded="unstyled"
            class="cursor-pointer rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 active:scale-95"
            @click="showConfirmDiscard = true"
          >
            Discard Scan & Start Fresh
          </AppButton>
        </div>
      </div>

      <!-- Normal Mobile Scanner Component -->
      <ClientOnly v-else>
        <DoctorSideComponentsMobileScanner />
      </ClientOnly>
    </div>

    <!-- Confirm Discard Modal (Root level for Desktop and Mobile) -->
    <AppModalConfirmation
      v-model="showConfirmDiscard"
      :title="discardModalTitle"
      :description="discardModalDescription"
      icon="lucide:trash-2"
      icon-color="danger"
      :confirm-text="discardModalConfirmText"
      cancel-text="Cancel"
      confirm-variant="destructive"
      @confirm="discardAndStartNew"
    />
  </div>
</template>

<style scoped>
  @media (min-width: 1024px) {
    .mobile-only {
      display: none !important;
    }
  }
  @media (max-width: 1023px) {
    .desktop-only {
      display: none !important;
    }
  }
</style>
