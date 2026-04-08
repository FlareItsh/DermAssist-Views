<script setup lang="ts">
definePageMeta({
  layout: 'dashboard-sidebar-layout'
})
</script>

<template>
  <div class="flex flex-col h-full w-full gap-5 overflow-hidden">
    <DoctorSideComponentsAppointmentSchedule />
    <div class="flex min-w-0 flex-1 gap-5 overflow-hidden pb-4">
      <!-- Left Column -->
      <div class="flex flex-1 flex-col gap-5 min-w-0 h-full overflow-y-auto custom-scrollbar pr-2">
        <!-- Patients List -->
        <DoctorSideComponentsPatientsList />
        <!-- Urgent Diagnosis Reports -->
        <DoctorSideComponentsUrgentDiagnosisReports />
      </div>
      <!-- Right Column: Priority List -->
      <div class="flex-1 max-w-[400px] shrink-0 h-full overflow-hidden">
        <DoctorSideComponentsPriorityList />
      </div>
    </div>
  </div>
</template>
