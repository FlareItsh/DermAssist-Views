<script setup lang="ts">
  const {
    currentDiagnosis,
    isScanned,
    isHealthyState,
    isInconclusiveState,
    isOutOfScopeState,
    isNoneState,
    chartData,
    patientUuid,
    isProceededToResults,
    saveActiveDiagnosisState,
    clearDiagnosis,
    resetScanner
  } = useDiagnosis()
  const { appointments, pendingAppointments } = useAppointments()
  const userName = useCookie('user_name')
  import { userService } from '~/api/user/UserService'

  const { data: patientResponse } = userService.useShow(patientUuid.value || '', {
    immediate: !!patientUuid.value
  })
  const assignedPatient = computed(() => patientResponse.value?.data || patientResponse.value)

  const patientName = computed(() => {
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
    if (!patientUuid.value) return null

    if (assignedPatient.value) {
      return assignedPatient.value.age
    }

    const allAppointments = [...appointments.value, ...pendingAppointments.value]
    const match = allAppointments.find(a => a.patient_uuid === patientUuid.value)
    if (match && match.patient) {
      return match.patient.age
    }
    return null
  })

  const appointmentUuid = computed(() => {
    if (!patientUuid.value) return null
    const allAppointments = [...appointments.value, ...pendingAppointments.value]
    const match = allAppointments.find(a => a.patient_uuid === patientUuid.value)
    return match ? match.id : null
  })

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  // Redirect to scanner if no diagnosis is present; set isProceededToResults when on results page
  onMounted(() => {
    if (!currentDiagnosis.value || !isScanned.value) {
      navigateTo('/Doctor/Scan')
    } else {
      isProceededToResults.value = true
      saveActiveDiagnosisState()
    }
  })

  const handleFinished = (payload?: { conversationUuid?: string; followUpScheduled?: boolean }) => {
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
    if (payload?.conversationUuid) {
      navigateTo(`/Doctor/Messages/${payload.conversationUuid}`)
    } else if (payload?.followUpScheduled) {
      navigateTo('/Doctor/Messages')
    } else {
      navigateTo('/Doctor/Scan')
    }
  }
</script>

<template>
  <div
    class="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm"
  >
    <!-- Header -->
    <header class="flex shrink-0 items-center justify-between border-b border-gray-100 px-10 py-4">
      <div class="flex items-center gap-3">
        <div
          class="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 shadow-2xs"
        >
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
          </span>
          <span>Active Assessment in Progress — Complete & Finish Diagnosis to proceed</span>
        </div>
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
        :appointment-uuid="appointmentUuid"
        :diagnosis-data="chartData"
        :diagnosis-uuid="currentDiagnosis?.uuid"
        :is-new-scan="true"
        @finished="handleFinished"
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
