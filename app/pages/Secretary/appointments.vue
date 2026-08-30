<script setup lang="ts">
definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const { appointments, completedAppointments, fetchAppointments } = useAppointments()
const { getStorageUrl } = useStorage()

const { searchQuery } = useSearch()

const showScheduleModal = ref(false)
const activeTab = ref<'upcoming' | 'history'>('upcoming')

const filteredAppointments = computed(() => {
  const sourceList = activeTab.value === 'upcoming' ? appointments.value : completedAppointments.value

  const list = sourceList.map(a => ({
    id: a.id,
    uuid: a.uuid,
    patientName: a.doctor, // other person's name
    condition: a.info,
    time: a.time || 'TBD',
    date: a.date ? new Date(a.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'TBD',
    type: a.purpose ? 'Follow-up' : 'Consultation',
    purpose: a.purpose,
    avatar: a.diagnosis_image ? getStorageUrl(a.diagnosis_image) : null,
    conversation_uuid: a.conversation_uuid
  }))

  if (!searchQuery.value) return list
  const query = searchQuery.value.toLowerCase()
  return list.filter(appt => 
    appt.patientName.toLowerCase().includes(query) || 
    appt.condition.toLowerCase().includes(query)
  )
})

const getInitials = (name: string): string => {
  if (!name) return ''
  const cleanName = name.replace(/^Dr\.\s+/i, '')
  const parts = cleanName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const goToChat = (uuid: string) => {
  if (uuid) navigateTo(`/Secretary/Messages/${uuid}`)
}
</script>

<template>
  <div class="flex flex-col h-full gap-6 p-6 overflow-hidden">
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200/50">
        <button
          @click="activeTab = 'upcoming'"
          class="px-5 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer"
          :class="activeTab === 'upcoming' ? 'bg-white text-indigo-600 shadow-sm border border-gray-200/20' : 'text-gray-500 hover:text-gray-800'"
        >
          Upcoming
        </button>
        <button
          @click="activeTab = 'history'"
          class="px-5 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer"
          :class="activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm border border-gray-200/20' : 'text-gray-500 hover:text-gray-800'"
        >
          History
        </button>
      </div>

      <AppButton variant="soft" rounded="both" @click="showScheduleModal = true">
        <Icon name="lucide:plus" class="mr-2" />
        New Schedule
      </AppButton>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
      <div v-if="filteredAppointments.length === 0" class="text-center py-20 text-muted-foreground italic">
        No appointments found.
      </div>
      <div v-else class="flex flex-col gap-4">
        <div 
          v-for="appt in filteredAppointments" 
          :key="appt.id"
          class="bg-card rounded-3xl border border-gray-100 p-5 flex items-center justify-between hover:shadow-md transition-all group"
        >
          <div class="flex items-center gap-5">
            <!-- Time Badge -->
            <div class="bg-primary/10 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[100px] border border-primary/20">
              <span class="text-primary font-bold text-lg leading-none">{{ appt.time }}</span>
              <span class="text-primary/60 text-[10px] uppercase font-bold mt-1 tracking-wider">{{ appt.type }}</span>
            </div>

            <div class="flex items-center gap-4">
              <div v-if="appt.avatar" class="h-14 w-14 rounded-2xl overflow-hidden border-2 border-primary/20 bg-gray-50 shrink-0">
                <img :src="appt.avatar" class="h-full w-full object-cover" />
              </div>
              <div v-else class="h-14 w-14 flex items-center justify-center rounded-2xl border-2 border-primary/20 bg-primary/5 text-primary font-bold text-base shrink-0">
                {{ getInitials(appt.patientName) }}
              </div>
              <div class="flex flex-col">
                <h3 class="font-bold text-xl">{{ appt.patientName }}</h3>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-destructive font-semibold text-sm">{{ appt.condition }}</span>
                  <span class="text-gray-300">•</span>
                  <span class="text-muted-foreground text-sm font-medium">{{ appt.date }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <AppButton 
              variant="unstyled" size="unstyled" rounded="unstyled"
              @click="goToChat(appt.conversation_uuid)"
              class="h-12 w-12 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-gray-200 transition-colors text-secondary"
            >
              <Icon name="lets-icons:message-light" class="text-2xl" />
            </AppButton>
            <AppButton 
              variant="unstyled" size="unstyled" rounded="unstyled"
              @click="navigateTo(`/Secretary/Appointments/${appt.uuid}`)"
              class="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary hover:bg-primary/80 transition-colors text-white"
            >
              <Icon name="material-symbols:edit-document-outline" class="text-2xl" />
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  </div>

  <AppModalDoctorScheduleNewModal
    v-if="showScheduleModal"
    @close="showScheduleModal = false"
    @scheduled="fetchAppointments"
  />
</template>
