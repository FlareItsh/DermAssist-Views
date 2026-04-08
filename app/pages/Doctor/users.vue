<script setup lang="ts">
import { ref, computed } from 'vue'

const searchValue = ref('')

const filteredPatients = computed(() => {
  let list = patients.value
  if (searchValue.value) {
    const query = searchValue.value.toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(query))
  }
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
})

const togglePriority = (patient: any) => {
  patient.priority = patient.priority === 'High' ? 'Medium' : 'High'
}

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const patients = ref([
  { id: 1, name: 'Eleanor Pena', age: 29, gender: 'Female', condition: 'Eczema', priority: 'High', lastVisit: '2 hours ago', avatar: 'https://i.pravatar.cc/150?u=1' },
  { id: 2, name: 'Wade Warren', age: 42, gender: 'Male', condition: 'Herpes', priority: 'High', lastVisit: 'Yesterday', avatar: 'https://i.pravatar.cc/150?u=2' },
  { id: 3, name: 'Esther Howard', age: 34, gender: 'Female', condition: 'Acne', priority: 'Medium', lastVisit: '1 week ago', avatar: 'https://i.pravatar.cc/150?u=3' },
  { id: 4, name: 'Cameron Williamson', age: 55, gender: 'Male', condition: 'Eczema', priority: 'Medium', lastVisit: '2 weeks ago', avatar: 'https://i.pravatar.cc/150?u=4' },
  { id: 5, name: 'Brooklyn Simmons', age: 24, gender: 'Female', condition: 'Acne', priority: 'Low', lastVisit: '1 month ago', avatar: 'https://i.pravatar.cc/150?u=5' },
  { id: 6, name: 'Guy Hawkins', age: 31, gender: 'Male', condition: 'Herpes', priority: 'Low', lastVisit: '2 months ago', avatar: 'https://i.pravatar.cc/150?u=6' },
  { id: 7, name: 'Jenny Wilson', age: 26, gender: 'Female', condition: 'Eczema', priority: 'Medium', lastVisit: '3 months ago', avatar: 'https://i.pravatar.cc/150?u=7' },
  { id: 8, name: 'Robert Fox', age: 49, gender: 'Male', condition: 'Acne', priority: 'Medium', lastVisit: '3 weeks ago', avatar: 'https://i.pravatar.cc/150?u=8' },
  { id: 9, name: 'Jacob Jones', age: 38, gender: 'Male', condition: 'Herpes', priority: 'Low', lastVisit: '4 months ago', avatar: 'https://i.pravatar.cc/150?u=9' }
])

const priorityPatients = computed(() => patients.value.filter(p => p.priority === 'High'))

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
      <div v-else class="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-6 pt-1 mb-2">
        <AppPatientCard 
          v-for="patient in filteredPatients" 
          :key="patient.id"
          :patient="patient"
          @toggle-priority="togglePriority"
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
