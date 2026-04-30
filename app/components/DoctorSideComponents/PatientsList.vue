<script setup lang="ts">
const { appointments, selectedDate } = useAppointments()
const { getStorageUrl } = useStorage()
const { addToPriority, isInPriority } = usePriorityList()

const filteredPatients = computed(() => {
  let list = appointments.value

  // Filter by selected date if one is picked
  if (selectedDate.value) {
    list = list.filter(a => a.date === selectedDate.value)
  }

  const mapped = list.map(a => ({
    id: a.id,
    name: a.doctor, // This field from useAppointments contains the other person's name
    condition: a.info,
    date: a.date ? new Date(a.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD',
    avatar: a.diagnosis_image ? getStorageUrl(a.diagnosis_image) : '',
    isUrgent: false,
    conversation_uuid: a.conversation_uuid,
    raw: a
  }))

  const { searchQuery } = useSearch()
  if (!searchQuery.value) return mapped
  const query = searchQuery.value.toLowerCase()
  return mapped.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.condition.toLowerCase().includes(query)
  )
})

const listTitle = computed(() => {
  if (selectedDate.value) {
    const d = new Date(selectedDate.value)
    return `Patients for ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }
  return 'Patients'
})

const handleAddToPriority = (apptId: string) => {
  addToPriority(apptId)
}

const goToChat = (uuid: string) => {
  if (uuid) navigateTo(`/Doctor/Messages/${uuid}`)
}
</script>

<template>
  <div class="bg-card rounded-3xl border border-gray-100 p-5">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="bg-secondary h-8 w-1 shrink-0 rounded-full"></div>
        <h2 class="text-foreground text-xl font-bold">{{ listTitle }}</h2>
      </div>
      <button class="text-secondary text-sm font-semibold hover:underline transition">See more ›</button>
    </div>

    <!-- Horizontal Scroll Row -->
    <div class="flex gap-4 overflow-x-auto pb-2 custom-scrollbar snap-x snap-mandatory">
      <div
        v-if="filteredPatients.length === 0"
        class="w-full py-10 text-center text-muted-foreground italic text-sm"
      >
        No accepted patients yet.
      </div>
      <div
        v-for="patient in filteredPatients"
        :key="patient.id"
        class="patient-card group flex-shrink-0 snap-start w-[160px] flex flex-col cursor-pointer"
      >
        <!-- Photo -->
        <div class="relative w-full h-[130px] overflow-hidden rounded-2xl bg-gray-100">
          <img
            v-if="patient.avatar"
            :src="patient.avatar"
            :alt="patient.name"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div v-else class="h-full w-full flex items-center justify-center bg-primary/5">
             <Icon name="solar:user-circle-bold" class="text-4xl text-primary/20" />
          </div>
          <!-- Urgent badge -->
          <div
            v-if="patient.isUrgent"
            class="absolute bottom-0 left-0 right-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 py-2"
          >
            <Icon name="solar:danger-triangle-bold" class="text-destructive text-xs shrink-0" />
            <span class="text-[9px] font-bold text-white">{{ patient.urgentLabel }}</span>
          </div>
        </div>

        <span class="mt-1.5 text-[10px] text-muted-foreground font-medium">{{ patient.date }}</span>

        <div class="mt-0.5 flex items-center justify-between gap-1">
          <div class="min-w-0">
            <p class="text-foreground text-sm font-bold truncate">{{ patient.name }}</p>
            <p class="text-destructive text-xs font-semibold truncate">{{ patient.condition }}</p>
          </div>
          <div class="flex gap-1 shrink-0">
            <AppButton
              variant="unstyled" size="unstyled" rounded="unstyled"
              @click.stop="goToChat(patient.conversation_uuid)"
              class="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 hover:bg-primary/10 transition-colors"
            >
              <Icon name="mingcute:message-4-line" class="text-secondary text-sm" />
            </AppButton>
            <AppButton
              variant="unstyled" size="unstyled" rounded="unstyled"
              @click.stop="handleAddToPriority(patient.id)"
              :disabled="isInPriority(patient.id)"
              class="flex h-7 w-7 items-center justify-center rounded-full bg-primary transition-colors hover:bg-primary/80 disabled:opacity-50 disabled:grayscale"
            >
              <Icon :name="isInPriority(patient.id) ? 'material-symbols:check-rounded' : 'fluent:add-12-filled'" class="text-white text-sm" />
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
