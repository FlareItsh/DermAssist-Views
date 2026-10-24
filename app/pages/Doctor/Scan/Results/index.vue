<script setup lang="ts">
  import { userService } from '~/api/user/UserService'
  import { diagnosisService } from '~/api/diagnosis/DiagnosisService'
  import { calculateAge } from '~/composables/useFormSanitizer'

  const {
    currentDiagnosis,
    isScanned,
    isHealthyState,
    isInconclusiveState,
    isOutOfScopeState,
    isNoneState,
    chartData,
    patientUuid,
    appointmentUuid: diagnosisAppointmentUuid,
    pendingPatientRegistration,
    walkInPatientInfo,
    pendingPatientName,
    isProceededToResults,
    saveActiveDiagnosisState,
    clearDiagnosis,
    resetScanner
  } = useDiagnosis()
  const { appointments, pendingAppointments, fetchAppointments } = useAppointments()
  const userName = useCookie('user_name')

  const showConfirmDiscardModal = ref(false)
  const isCompleted = ref(false)
  const pendingDestination = ref<string | null>(null)

  const handleBackClick = () => {
    showConfirmDiscardModal.value = true
  }

  const handleConfirmDiscard = async () => {
    showConfirmDiscardModal.value = false
    isCompleted.value = true
    const diagUuid = currentDiagnosis.value?.uuid || (currentDiagnosis.value as any)?.id
    if (diagUuid) {
      try {
        await diagnosisService.delete(String(diagUuid))
      } catch (e) {
        console.error('Failed to clean up discarded scan', e)
      }
    }
    if (import.meta.client) {
      try {
        localStorage.removeItem('dermassist_active_diagnosis')
        localStorage.removeItem('draft_clinical_note_active')
        localStorage.removeItem('draft_patient_info_active')
        if (diagUuid) {
          localStorage.removeItem(`draft_clinical_note_diag_${diagUuid}`)
          localStorage.removeItem(`draft_patient_info_${diagUuid}`)
        }
      } catch (e) {
        // silent fail
      }
    }
    resetScanner()
    const target = pendingDestination.value || '/Doctor/Scan'
    pendingDestination.value = null
    navigateTo(target)
  }

  onBeforeRouteLeave((to, from, next) => {
    if (isCompleted.value || !currentDiagnosis.value) {
      next()
      return
    }
    pendingDestination.value = to.fullPath
    showConfirmDiscardModal.value = true
    next(false)
  })

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!isCompleted.value && currentDiagnosis.value) {
      e.preventDefault()
      e.returnValue = ''
    }
  }

  onUnmounted(() => {
    if (import.meta.client) {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  })

  const isRealPatientUuid = computed(() => {
    return (
      !!patientUuid.value &&
      patientUuid.value !== 'pending_new_patient' &&
      patientUuid.value !== 'walk_in_guest' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientUuid.value)
    )
  })

  const { data: patientResponse } = userService.useShow(patientUuid.value || '', {
    immediate: isRealPatientUuid.value
  })
  const assignedPatient = computed(() => patientResponse.value?.data || patientResponse.value)

  const patientName = computed(() => {
    if (pendingPatientName.value) {
      return pendingPatientName.value
    }
    if (patientUuid.value) {
      if (assignedPatient.value) {
        return `${assignedPatient.value.first_name} ${assignedPatient.value.last_name}`
      }

      const allAppointments = [...appointments.value, ...pendingAppointments.value]
      const match = allAppointments.find(a => a.patient_uuid === patientUuid.value)
      if (match && match.patient) {
        return `${match.patient.first_name} ${match.patient.last_name}`
      }
    }
    return userName.value || 'Unassigned Patient'
  })

  const patientAge = computed(() => {
    if (pendingPatientRegistration.value?.age) {
      return pendingPatientRegistration.value.age
    }
    if (walkInPatientInfo.value?.age) {
      return walkInPatientInfo.value.age
    }
    if (!patientUuid.value) return null

    if (assignedPatient.value) {
      return calculateAge(assignedPatient.value.date_of_birth) ?? assignedPatient.value.age ?? null
    }

    const allAppointments = [...appointments.value, ...pendingAppointments.value]
    const match = allAppointments.find(a => a.patient_uuid === patientUuid.value)
    if (match && match.patient) {
      return calculateAge(match.patient.date_of_birth) ?? match.patient.age ?? null
    }
    return null
  })

  const patientDateOfBirth = computed<string | null>(() => {
    if (pendingPatientRegistration.value?.date_of_birth) {
      return pendingPatientRegistration.value.date_of_birth
    }
    if (walkInPatientInfo.value?.date_of_birth) {
      return walkInPatientInfo.value.date_of_birth
    }
    if (!patientUuid.value) return null

    if (assignedPatient.value) {
      return assignedPatient.value.date_of_birth ?? null
    }

    const allAppointments = [...appointments.value, ...pendingAppointments.value]
    const match = allAppointments.find(a => a.patient_uuid === patientUuid.value)
    if (match && match.patient) {
      return match.patient.date_of_birth ?? null
    }
    return null
  })

  const appointmentUuid = computed(() => {
    if (diagnosisAppointmentUuid.value) return diagnosisAppointmentUuid.value
    if (!patientUuid.value) return null
    const allAppointments = [...appointments.value, ...pendingAppointments.value]
    const match = allAppointments.find(
      a =>
        a.patient_uuid === patientUuid.value &&
        !['completed', 'cancelled', 'declined', 'rejected', 'no_show'].includes(
          a.status?.toLowerCase()
        )
    )
    return match ? match.uuid || match.id : null
  })

  definePageMeta({
    ssr: false,
    layout: 'dashboard-sidebar-layout'
  })

  onMounted(async () => {
    if (import.meta.client) {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }

    if (
      !currentDiagnosis.value ||
      !isScanned.value ||
      isHealthyState.value ||
      isNoneState.value ||
      !patientUuid.value
    ) {
      navigateTo('/Doctor/Scan')
    } else {
      isProceededToResults.value = true
      saveActiveDiagnosisState()
      try {
        await fetchAppointments()
      } catch (e) {
        console.error('Failed to load appointments on results page', e)
      }
    }
  })

  const handleFinished = () => {
    isCompleted.value = true
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
    navigateTo('/Doctor/Scan')
  }
</script>

<template>
  <div
    class="flex min-h-screen flex-col lg:h-[calc(100vh-8rem)] lg:overflow-hidden lg:rounded-[2.5rem] lg:border lg:border-gray-100 lg:bg-white lg:shadow-sm"
  >
    <!-- Header -->
    <header
      class="mb-4 flex shrink-0 items-center justify-between gap-2 rounded-2xl border border-gray-100/80 bg-white px-3.5 py-2.5 shadow-2xs sm:mb-6 sm:px-6 sm:py-3 lg:mb-0 lg:rounded-none lg:border-0 lg:border-b lg:border-gray-100 lg:bg-transparent lg:px-10 lg:py-4 lg:shadow-none"
    >
      <div class="flex min-w-0 items-center gap-2 sm:gap-3">
        <AppButton
          variant="unstyled"
          size="unstyled"
          rounded="unstyled"
          @click="handleBackClick"
          class="hover:text-primary flex shrink-0 items-center gap-1.5 text-xs font-bold text-gray-500 transition-colors"
        >
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
          >
            <Icon
              name="material-symbols:arrow-back-rounded"
              class="text-base"
            />
          </div>
          <span class="hidden sm:inline">Back</span>
        </AppButton>

        <div
          class="flex items-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 shadow-2xs sm:px-3 sm:py-1.5"
        >
          <span class="relative flex h-2 w-2 shrink-0">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
          </span>
          <span class="hidden md:inline"
            >Active Assessment in Progress — Complete & Finish Diagnosis</span
          >
          <span class="truncate md:hidden">Active Assessment</span>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-3 sm:gap-6">
        <div class="flex flex-col items-end">
          <span class="text-[9px] font-black tracking-widest text-gray-400 uppercase sm:text-[10px]"
            >Diagnosis ID</span
          >
          <span class="font-mono text-[11px] font-bold text-gray-600 sm:text-xs"
            >#{{ currentDiagnosis?.uuid?.slice(0, 8) || 'PENDING' }}</span
          >
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="min-h-0 flex-1">
      <ClientOnly>
        <AppModalDiagnosisFindingsDetailed
          v-if="currentDiagnosis"
          role="doctor"
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
          :patient-name="patientName"
          :age="patientAge"
          :date-of-birth="patientDateOfBirth"
          :appointment-uuid="appointmentUuid"
          :diagnosis-data="chartData"
          :diagnosis-uuid="currentDiagnosis?.uuid"
          :is-new-scan="true"
          @finished="handleFinished"
        />
        <template #fallback>
          <div class="flex h-full w-full items-center justify-center p-8">
            <div class="flex flex-col items-center gap-3">
              <div
                class="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              ></div>
              <span class="text-xs font-semibold text-gray-500"
                >Loading Clinical Assessment...</span
              >
            </div>
          </div>
        </template>
      </ClientOnly>
    </main>

    <!-- Discard / Quit Confirmation Modal -->
    <AppModalConfirmation
      v-model="showConfirmDiscardModal"
      title="Discard Clinical Assessment?"
      description="You have an active assessment in progress. Leaving without finishing will cause the active scan, diagnostic findings, and clinical notes to be lost."
      icon="lucide:trash-2"
      icon-color="danger"
      confirm-text="Discard & Exit"
      cancel-text="Continue Assessment"
      confirm-variant="destructive"
      @confirm="handleConfirmDiscard"
    />
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
