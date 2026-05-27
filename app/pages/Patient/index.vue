<script setup lang="ts">
  import { computed } from 'vue'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })
  const { searchQuery } = useSearch()
  const { appointments } = useAppointments()
  const { getStorageUrl } = useStorage()

  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC'
  ]

  const filteredAppointments = computed(() => {
    const list = appointments.value
    const query = searchQuery.value.trim()

    let result = list
    if (query && /^\d+$/.test(query)) {
      result = list.filter(appt => appt.date.toLowerCase().includes(query))
    } else if (query) {
      result = list
    }

    return [...result].sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : Infinity
      const timeB = b.date ? new Date(b.date).getTime() : Infinity
      return timeA - timeB
    })
  })
</script>

<template>
  <div class="flex gap-5 overflow-hidden">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex gap-5">
        <PatientSideComponentsPatientCard
          title="Total Scans Performed"
          class="w-100 shrink-0"
        >
          <p
            class="bg-card flex h-15 w-15 items-center justify-center rounded-full text-center text-xl font-medium shadow-[inset_0_0_9px_rgba(0,0,0,0.4),0_0_10px_rgba(0,0,0,0.5)]"
          >
            15
          </p>
        </PatientSideComponentsPatientCard>

        <PatientSideComponentsPatientCard
          title="Appointments"
          class=""
        >
          <div
            class="custom-scrollbar bg-card flex h-20 w-[446px] items-center gap-6 overflow-x-auto rounded-2xl px-6 font-medium shadow-[inset_0_0_9px_rgba(0,0,0,0.4),0_0_10px_rgba(0,0,0,0.5)]"
          >
            <div
              v-if="filteredAppointments.length > 0"
              class="flex shrink-0 items-center gap-8"
            >
              <div
                v-for="appt in filteredAppointments"
                :key="appt.id"
                class="flex shrink-0 items-center gap-4 border-r border-white/10 pr-8 last:border-0 last:pr-0"
              >
                <div class="flex flex-col items-center leading-none">
                  <span class="text-primary text-[10px] font-bold tracking-tighter uppercase">{{
                    appt.date ? months[parseInt(appt.date.split('-')[1]) - 1] : 'TBD'
                  }}</span>
                  <span class="text-foreground text-xl font-black">{{
                    appt.date ? appt.date.split('-')[2] : '--'
                  }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <img 
                    v-if="appt.diagnosis_image" 
                    :src="getStorageUrl(appt.diagnosis_image)" 
                    class="h-10 w-10 rounded-lg object-cover border border-white/10"
                  />
                  <div class="flex flex-col">
                    <span class="text-foreground text-sm leading-tight font-bold">{{
                      appt.doctor
                    }}</span>
                    <span
                      class="text-foreground/40 text-[10px] leading-none font-black tracking-widest uppercase"
                      >{{ appt.info }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
            <div
              v-else
              class="text-foreground/20 flex items-center gap-2 text-sm italic"
            >
              <Icon
                name="solar:calendar-search-linear"
                class="text-xl"
              />
              <span>No matching appointments...</span>
            </div>
          </div>
        </PatientSideComponentsPatientCard>
      </div>
      <div class="mt-2 flex items-center gap-3">
        <div class="bg-secondary h-8 w-1 shrink-0 rounded-full"></div>
        <h1 class="text-foreground text-2xl font-bold">Skin Conditions Information</h1>
      </div>
      <div class="flex gap-5">
        <PatientSideComponentsSkinConditionsInfo
          title="Acne"
          icon="/images/acne-icon.png"
        >
          <p class="bg-card max-w-md text-xl leading-relaxed text-gray-700 opacity-90">
            Common skin condition involving clogged pores, inflammation, and pimples. Common in
            adolescence.
          </p>
        </PatientSideComponentsSkinConditionsInfo>
        <PatientSideComponentsSkinConditionsInfo
          title="Eczema"
          icon="/images/eczema-icon.png"
        >
          <p class="bg-card max-w-md text-xl leading-relaxed text-gray-700 opacity-90">
            Inflammatory condition causing dry, itchy skin, often linked to genetics and immune
            triggers.
          </p>
        </PatientSideComponentsSkinConditionsInfo>
        <PatientSideComponentsSkinConditionsInfo
          title="HSV"
          icon="/images/hsv-icon.png"
        >
          <p class="bg-card max-w-md text-xl leading-relaxed text-gray-700 opacity-90">
            Viral infection causing cold sores (type 1) or genital sores (type 2). Periods of
            dormancy.
          </p>
        </PatientSideComponentsSkinConditionsInfo>
      </div>
      <AppUsers title="Doctors" role="doctor" status="verified" />
    </div>
    <div class="sticky top-0 flex h-[calc(91vh-3rem)] flex-col gap-4">
      <PatientSideComponentsCalendar />
      <PatientSideComponentsSaaSPromotion class="flex-1" />
    </div>
  </div>
</template>
