<script setup lang="ts">
import { userService } from '~/api/user/UserService'

const { appointments } = useAppointments()
const { priorityIds, addToPriority } = usePriorityList()
const { getStorageUrl } = useStorage()
const searchValue = ref('')

const PER_PAGE = 4

const doctorPatients = ref<any[]>([])
const isLoadingPatients = ref(true)
const currentPage = ref(1)
const lastPage = ref(1)
const totalPatients = ref(0)

const fetchDoctorPatients = async (page = 1) => {
  try {
    isLoadingPatients.value = true
    const response = await userService.listDoctorPatients({ page, per_page: PER_PAGE })
    doctorPatients.value = response.data || []
    currentPage.value = response.meta?.current_page ?? 1
    lastPage.value = response.meta?.last_page ?? 1
    totalPatients.value = response.meta?.total ?? 0
  } catch (e) {
    console.error(e)
  } finally {
    isLoadingPatients.value = false
  }
}

const goToPreviousPage = () => {
  if (currentPage.value > 1) {
    fetchDoctorPatients(currentPage.value - 1)
  }
}

const goToNextPage = () => {
  if (currentPage.value < lastPage.value) {
    fetchDoctorPatients(currentPage.value + 1)
  }
}

const handlePatientRefresh = () => {
  fetchDoctorPatients(currentPage.value)
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
    <section class="min-w-0" v-if="doctorPatients.length > 0 || isLoadingPatients || totalPatients > 0">
      <div class="mb-5 flex items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <h2 class="text-xl font-bold text-foreground">My Registered Patients</h2>
          <span
            v-if="totalPatients > 0"
            class="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold"
          >
            {{ totalPatients }}
          </span>
        </div>
      </div>

      <div v-if="isLoadingPatients" class="grid grid-cols-1 md:grid-cols-2 gap-5 pb-6 pt-1 mb-2">
        <div
          v-for="n in 2"
          :key="n"
          class="md:col-span-2 bg-gray-50 rounded-3xl h-32 w-full animate-pulse"
        />
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pb-6 pt-1 mb-2">
        <AppDoctorRegisteredPatientCard
          v-for="patient in doctorPatients"
          :key="patient.uuid"
          :patient="patient"
          class="md:col-span-2 lg:col-span-2"
          @refresh="handlePatientRefresh"
        />
      </div>

      <!-- Bottom Pagination -->
      <div v-if="lastPage > 1" class="flex items-center justify-center gap-3 pb-4">
        <button
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="currentPage <= 1 || isLoadingPatients"
          @click="goToPreviousPage"
        >
          <Icon name="material-symbols:chevron-left-rounded" class="text-base" />
          Previous
        </button>
        <span class="text-xs font-semibold text-muted-foreground px-2">
          {{ currentPage }} / {{ lastPage }}
        </span>
        <button
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="currentPage >= lastPage || isLoadingPatients"
          @click="goToNextPage"
        >
          Next
          <Icon name="material-symbols:chevron-right-rounded" class="text-base" />
        </button>
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
