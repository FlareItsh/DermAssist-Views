<script setup lang="ts">
  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })
</script>

<template>
  <div class="flex h-full w-full flex-col gap-5 overflow-hidden">
    <!-- Top: 14-Day Appointment Schedule -->
    <DoctorSideComponentsAppointmentSchedule />

    <!-- Main Content Area -->
    <div class="flex min-w-0 flex-1 gap-5 overflow-hidden pb-4">
      <!-- Left Column: Appointments, Patients Directory, Urgent Diagnosis Reports -->
      <div class="custom-scrollbar flex h-full min-w-0 flex-1 flex-col gap-5 overflow-y-auto pr-2">
        <!-- Appointments List -->
        <DoctorSideComponentsAppointmentsList />
        <!-- Patients List -->
        <DoctorSideComponentsPatientsList />
        <!-- Urgent Diagnosis Reports -->
        <DoctorSideComponentsUrgentDiagnosisReports />
      </div>

      <!-- Right Column: Upgrade Ad & Priority List -->
      <div class="flex h-full max-w-[400px] flex-1 shrink-0 flex-col gap-4 overflow-hidden">
        <!-- Subscription Upgrade Ad (auto-hides on Best Plan) -->
        <DoctorSideComponentsSubscriptionAd />
        <!-- Priority List (synchronized with /doctor/patients) -->
        <DoctorSideComponentsPriorityList class="min-h-0 flex-1" />
      </div>
    </div>
  </div>
</template>
