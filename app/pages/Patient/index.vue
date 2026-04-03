<script setup lang="ts">
definePageMeta({
  layout: 'dashboard-sidebar-layout'
})
</script>

<template>
  <div class="flex gap-4">
    <div class="flex w-full flex-col gap-4">
      <div class="flex gap-5">
        <PatientSideComponentsPatientCard title="Total Scans Performed">
          <p
            class="bg-card flex h-15 w-15 items-center justify-center rounded-full text-center text-xl font-medium shadow-[inset_0_0_9px_rgba(0,0,0,0.4),0_0_10px_rgba(0,0,0,0.5)]">
            15
          </p>
        </PatientSideComponentsPatientCard>

        <PatientSideComponentsPatientCard title="Appointments" class="flex-1">
          <div
            class="custom-scrollbar bg-card flex h-20 w-full items-center gap-4 overflow-x-auto rounded-2xl p-5 px-5 text-xl font-medium shadow-[inset_0_0_9px_rgba(0,0,0,0.4),0_0_10px_rgba(0,0,0,0.5)]">
            ####
          </div>
        </PatientSideComponentsPatientCard>
      </div>
      <div class="flex items-center gap-3 mt-2">
        <div class="h-8 w-1 shrink-0 rounded-full bg-secondary"></div>
        <h1 class="text-foreground text-2xl font-bold">
          Skin Conditions Information
        </h1>
      </div>
      <div class="flex gap-5">
        <PatientSideComponentsSkinConditionsInfo title="Acne" icon="/images/acne-icon.png">
          <p class="text-gray-700 bg-card max-w-md text-xl leading-relaxed opacity-90">
            Common skin condition involving clogged pores, inflammation, and pimples. Common in adolescence.
          </p>
        </PatientSideComponentsSkinConditionsInfo>
        <PatientSideComponentsSkinConditionsInfo title="Eczema" icon="/images/eczema-icon.png">
          <p class="text-gray-700 bg-card max-w-md text-xl leading-relaxed opacity-90">
            Inflammatory condition causing dry, itchy skin, often linked to genetics and immune triggers.
          </p>
        </PatientSideComponentsSkinConditionsInfo>
        <PatientSideComponentsSkinConditionsInfo title="HSV" icon="/images/hsv-icon.png">
          <p class="text-gray-700 bg-card max-w-md text-xl leading-relaxed opacity-90">
            Viral infection causing cold sores (type 1) or genital sores (type 2). Periods of dormancy.
          </p>
        </PatientSideComponentsSkinConditionsInfo>

      </div>
      <AppUsers title="Doctors" />
    </div>
    <!-- h-[calc(100vh-3rem)] ensures it is exactly the height of your visible viewport minus some padding -->
    <div class="sticky top-0 flex h-[calc(87vh-3rem)] flex-col gap-4">
      <PatientSideComponentsCalendar />
      <PatientSideComponentsSaaSPromotion class="flex-1" />
    </div>
  </div>
</template>
