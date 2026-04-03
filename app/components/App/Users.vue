<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="bg-card rounded-3xl border border-gray-100 p-4 shadow-xl">
    <div class="mb-4 flex items-center gap-4">
      <div class="h-8 w-1 shrink-0 rounded-full bg-secondary"></div>
      <h1 class="text-foreground text-2xl font-bold">
        {{ title }}
      </h1>
    </div>

    <div class="custom-scrollbar flex flex-row gap-4 overflow-x-auto px-2 pb-6">
      <PatientSideComponentsDoctorsCard v-for="i in 6" :key="i"
        class="shrink-0 transition-transform active:scale-95 cursor-pointer" doctorName="Dr. Sarah Johnson"
        doctorWorkplace="Dermatology Clinic" doctorImage="/images/lp-img.png" />
    </div>
  </div>
</template>
