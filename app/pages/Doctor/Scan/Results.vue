<script setup lang="ts">
const { currentDiagnosis, isScanned, isHealthyState, chartData, patientUuid } = useDiagnosis()
const { appointments, pendingAppointments } = useAppointments()
const userName = useCookie('user_name')

const patientName = computed(() => {
  if (!patientUuid.value) return 'Unassigned Patient'
  const allAppointments = [...appointments.value, ...pendingAppointments.value]
  const match = allAppointments.find(a => a.patient_uuid === patientUuid.value)
  if (match && match.patient) {
    return `${match.patient.first_name} ${match.patient.last_name}`
  }
  return 'Unknown Patient'
})

const patientAge = computed(() => {
  if (!patientUuid.value) return null
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

// Redirect to scanner if no diagnosis is present
onMounted(() => {
  if (!currentDiagnosis.value || !isScanned.value) {
    navigateTo('/Doctor/Scan')
  }
})
</script>

<template>
  <div class="flex h-[calc(100vh-8rem)] flex-col overflow-hidden bg-white rounded-[2.5rem] shadow-sm border border-gray-100">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-gray-100 px-10 py-4 shrink-0">
      <div class="flex items-center gap-4">
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          @click="navigateTo('/Doctor/Scan')"
          class="group flex items-center gap-2 text-gray-500 hover:text-primary transition-colors">
          <div class="bg-gray-100 group-hover:bg-primary/10 flex h-9 w-9 items-center justify-center rounded-full transition-colors">
             <Icon name="material-symbols:arrow-back-rounded" class="text-lg" />
          </div>
          <span class="font-bold text-sm">Back to Scanner</span>
        </AppButton>
      </div>
      
      <div class="flex items-center gap-6">
        <div class="flex flex-col items-end">
           <span class="text-[10px] font-black uppercase tracking-widest text-gray-400">Diagnosis ID</span>
           <span class="text-xs font-mono font-bold text-gray-600">#{{ currentDiagnosis?.id?.slice(0, 8) || 'PENDING' }}</span>
        </div>
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          class="bg-primary/10 text-primary h-10 w-10 flex items-center justify-center rounded-xl hover:bg-primary/20 transition-colors">
          <Icon name="material-symbols:share-rounded" class="text-xl" />
        </AppButton>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 min-h-0">
      <AppModalDiagnosisFindingsDetailed 
        v-if="currentDiagnosis"
        role="doctor"
        :condition-name="currentDiagnosis?.label === 'None' ? 'None' : (isHealthyState ? 'Clear' : currentDiagnosis?.label)"
        :patient-name="patientName"
        :age="patientAge"
        :appointment-uuid="appointmentUuid"
        :diagnosis-data="chartData"
        :diagnosis-uuid="currentDiagnosis?.id"
        :is-new-scan="true"
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
