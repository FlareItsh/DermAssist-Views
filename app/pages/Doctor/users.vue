<script setup lang="ts">
import { userService } from '~/api/user/UserService'
const { appointments } = useAppointments()
const { priorityIds, addToPriority } = usePriorityList()
const { getStorageUrl } = useStorage()
const searchValue = ref('')

const doctorPatients = ref<any[]>([])
const isLoadingPatients = ref(true)

const fetchDoctorPatients = async () => {
  try {
    isLoadingPatients.value = true
    const response = await userService.listDoctorPatients()
    doctorPatients.value = response.data || []
  } catch (e) {
    console.error(e)
  } finally {
    isLoadingPatients.value = false
  }
}

onMounted(() => {
  fetchDoctorPatients()
})

const allPatients = computed(() => {
  return appointments.value
    .map(a => {
      const patientObj = a.raw?.patient
      const patientName = patientObj 
        ? `${patientObj.first_name} ${patientObj.last_name}`
        : (a.doctor && !a.doctor.startsWith('Dr.') ? a.doctor : '')

      if (!patientName || patientName.startsWith('Dr.')) return null

      return {
        id: a.id,
        name: patientName,
        age: patientObj?.age || 30,
        gender: patientObj?.gender || 'N/A',
        condition: a.info,
        priority: priorityIds.value.includes(a.id) ? 'High' : 'Low',
        lastVisit: a.date ? new Date(a.date).toLocaleDateString() : 'TBD',
        avatar: patientObj?.avatar_path ? getStorageUrl(patientObj.avatar_path) : (a.diagnosis_image ? getStorageUrl(a.diagnosis_image) : null),
        raw: a
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
})

const filteredPatients = computed(() => {
  let list = allPatients.value
  if (searchValue.value) {
    const query = searchValue.value.toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(query) || p.condition.toLowerCase().includes(query))
  }
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
})

const priorityPatients = computed(() => allPatients.value.filter(p => p.priority === 'High'))

const togglePriority = (patient: any) => {
  addToPriority(patient.id)
}

definePageMeta({
  layout: 'dashboard-sidebar-layout'
})
</script>

<template>
  <div class="flex flex-col h-full gap-3 pb-8">
    <!-- Doctor Registered Patients Section -->
    <section class="min-w-0" v-if="doctorPatients.length > 0 || isLoadingPatients">
      <div class="mb-5 flex items-center gap-2">
        <h2 class="text-xl font-bold text-foreground">My Registered Patients</h2>
      </div>

      <div v-if="isLoadingPatients" class="flex gap-4 mb-2">
         <div class="col-span-1 md:col-span-2 bg-gray-50 rounded-3xl h-32 w-full animate-pulse"></div>
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pb-6 pt-1 mb-2">
         <!-- Card spans 2 columns as requested -->
         <AppDoctorRegisteredPatientCard 
           v-for="patient in doctorPatients" 
           :key="patient.uuid"
           :patient="patient"
           @refresh="fetchDoctorPatients"
           class="md:col-span-2 lg:col-span-2"
         />
      </div>
    </section>

    <!-- Divider -->
    <div class="h-px w-full bg-border/60 my-2" v-if="doctorPatients.length > 0"></div>

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
