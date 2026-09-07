<script setup lang="ts">
  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })
</script>

<template>
  <div class="flex h-full w-full flex-col gap-5 overflow-hidden">
    <DoctorSideComponentsAppointmentSchedule />
    <div class="flex min-w-0 flex-1 gap-5 overflow-hidden pb-4">
      <!-- Left Column -->
      <div class="custom-scrollbar flex h-full min-w-0 flex-1 flex-col gap-5 overflow-y-auto pr-2">
        <!-- Appointments List -->
        <DoctorSideComponentsAppointmentsList />
        <!-- Patients List -->
        <DoctorSideComponentsPatientsList />
        <!-- Urgent Diagnosis Reports -->
        <DoctorSideComponentsUrgentDiagnosisReports />
      </div>
      <!-- Right Column: Priority List -->
      <div class="h-full max-w-[400px] flex-1 shrink-0 overflow-hidden">
        <DoctorSideComponentsPriorityList />
      </div>
    </div>
  </div>
</template>
