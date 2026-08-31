<script setup lang="ts">
const { appointments } = useAppointments()
const { priorityIds, addToPriority } = usePriorityList()
const { getStorageUrl } = useStorage()
const searchValue = ref('')

const allPatients = computed(() => {
  return appointments.value.map(a => ({
    id: a.id,
    name: a.doctor, // other person's name
    age: 30, // Mocked
    gender: 'N/A', // Mocked
    condition: a.info,
    priority: priorityIds.value.includes(a.id) ? 'High' : 'Low',
    lastVisit: a.date ? new Date(a.date).toLocaleDateString() : 'TBD',
    avatar: a.diagnosis_image ? getStorageUrl(a.diagnosis_image) : null,
    raw: a
  }))
})

const filteredPatients = computed(() => {
  let list = allPatients.value
  if (searchValue.value) {
    const query = searchValue.value.toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(query) || p.condition.toLowerCase().includes(query))
  }
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
})

const patientsPerPage = 8
const patientCurrentPage = ref(1)

const paginatedPatients = computed(() => {
  const start = (patientCurrentPage.value - 1) * patientsPerPage
  return filteredPatients.value.slice(start, start + patientsPerPage)
})

watch(searchValue, () => {
  patientCurrentPage.value = 1
})

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})
</script>

<template>
  <div class="flex flex-col h-full gap-3 pb-8">
    <!-- Priority List Section -->
    <section class="min-w-0">
      <div class="mb-5 flex items-center gap-2">
        <h2 class="text-xl font-bold text-foreground">Priority List</h2>
      </div>

      <div class="flex gap-5 overflow-x-auto pb-6 pt-1 mb-2 snap-x snap-mandatory custom-scrollbar min-h-0">
        <AppPatientCard 
          v-for="patient in priorityPatients" 
          :key="patient.id"
          :patient="patient"
          :isPriorityList="true"
        />
      </div>
    </section>

    <!-- Divider -->
    <div class="h-px w-full bg-border/60 my-2"></div>

    <!-- All Patients Section -->
    <section class="min-w-0">
      <div class="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 class="text-xl font-bold text-foreground">All Patients</h2>
        <div class="relative shrink-0">
          <AppSearch v-model="searchValue" rounded="rounded-full shadow-sm overflow-hidden" text="text-secondary"
            width="w-fit" />
        </div>
      </div>

      <div v-if="filteredPatients.length === 0" class="text-muted-foreground p-10 text-center w-full">
        <Icon name="solar:magnifer-linear" class="mx-auto mb-2 text-4xl opacity-20" />
        <p class="text-sm">No patients found matching "{{ searchValue }}"</p>
      </div>
      <div v-else class="space-y-4">
        <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-2 pt-1">
          <AppPatientCard 
            v-for="patient in paginatedPatients" 
            :key="patient.id"
            :patient="patient"
            @toggle-priority="togglePriority"
          />
        </div>

        <AppPagination
          v-model:currentPage="patientCurrentPage"
          :total-items="filteredPatients.length"
          :per-page="patientsPerPage"
          item-label="patients"
        />
      </div>
    </section>

  </div>
</template>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(150, 150, 150, 0.4) rgba(150, 150, 150, 0.1);
}

.custom-scrollbar::-webkit-scrollbar {
  height: 10px;
  /* Thicker scrollbar to ensure it is visible */
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  /* Visible track line */
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  /* Visible slider */
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.dark .custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  /* Dark mode compatible track */
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
