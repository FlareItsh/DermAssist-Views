<script setup lang="ts">
const { appointments, fetchAppointments } = useAppointments()
const { getStorageUrl } = useStorage()
const { priorityIds, removeFromPriority } = usePriorityList()

const filteredPriority = computed(() => {
  const list = appointments.value
    .filter(a => priorityIds.value.includes(a.id))
    .map(a => ({
      id: a.id,
      name: a.doctor,
      condition: a.info,
      schedule: a.date ? `${new Date(a.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n${a.time}` : 'TBD',
      avatar: a.diagnosis_image ? getStorageUrl(a.diagnosis_image) : '',
      raw: a
    }))

  const { searchQuery } = useSearch()
  if (!searchQuery.value) return list
  const query = searchQuery.value.toLowerCase()
  return list.filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.condition.toLowerCase().includes(query)
  )
})

const isCompleting = ref<string | null>(null)
const accomplish = async (apptId: string) => {
  isCompleting.value = apptId
  try {
    await $api(`appointments/${apptId}`, {
      method: 'PUT',
      body: { status: 'completed' }
    })
    removeFromPriority(apptId)
    await fetchAppointments()
  } catch (e) {
    console.error('Failed to complete appointment:', e)
  } finally {
    isCompleting.value = null
  }
}

const dismiss = (id: string) => {
  removeFromPriority(id)
}

const goToChat = (uuid: string) => {
  if (uuid) navigateTo(`/Doctor/Messages/${uuid}`)
}

const conditionColor = (condition: string) => {
  if (condition?.toLowerCase().includes('acne')) return 'text-destructive'
  if (condition?.toLowerCase().includes('herpes')) return 'text-destructive'
  return 'text-amber-500'
}
</script>

<template>
  <div class="bg-card rounded-3xl border border-gray-100 w-full p-5 flex flex-col h-190">
    <!-- Header -->
    <div class="mb-4 flex items-center gap-3">
      <div class="bg-secondary h-7 w-1 shrink-0 rounded-full" />
      <h2 class="text-foreground text-xl font-bold">Priority List</h2>
    </div>

    <!-- List -->
    <div class="flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 pr-1 min-h-0">
      <div v-for="patient in filteredPriority" :key="patient.id"
        class="group flex items-center gap-3 rounded-2xl border border-gray-100 bg-background/50 p-3 transition-all hover:border-primary/30 hover:shadow-md">
        <!-- Avatar -->
        <div class="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gray-200">
          <img v-if="patient.avatar" :src="patient.avatar" :alt="patient.name" class="h-full w-full object-cover" />
          <div v-else class="h-full w-full flex items-center justify-center bg-primary/5">
            <Icon name="solar:user-circle-bold" class="text-2xl text-primary/20" />
          </div>
        </div>

        <!-- Info -->
        <div class="flex flex-1 min-w-0 flex-col gap-0.5">
          <div class="flex items-start justify-between gap-1">
            <p class="text-foreground text-sm font-bold truncate">{{ patient.name }}</p>
            <!-- Dismiss -->

          </div>
          <span :class="['text-xs font-semibold', conditionColor(patient.condition)]">
            {{ patient.condition }}
          </span>
          <div class="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <Icon name="lucide:calendar" class="h-3 w-3 shrink-0" />
            <span class="whitespace-pre-line">{{ patient.schedule }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end items-end flex-col gap-1.5">
          <button @click="dismiss(patient.id)"
            class="text-gray-300 hover:text-foreground transition-colors shrink-0 opacity-0 group-hover:opacity-100">
            <Icon name="material-symbols:close-rounded" class="text-base" />
          </button>
          <div class="flex items-end flex-row gap-1.5 shrink-0">
            <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
              @click="goToChat(patient.raw.conversation_uuid)"
              class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-primary/10 transition-colors">
              <Icon name="mingcute:message-4-line" class="text-secondary text-sm" />
            </AppButton>
            <AppButton variant="unstyled" size="unstyled" rounded="unstyled" @click="accomplish(patient.id)"
              :disabled="isCompleting === patient.id"
              class="flex h-8 w-8 items-center justify-center rounded-full bg-primary hover:bg-primary/80 transition-colors disabled:opacity-50">
              <Icon v-if="isCompleting === patient.id" name="line-md:loading-twotone-loop" class="text-white text-sm" />
              <Icon v-else name="material-symbols:check-rounded" class="text-white text-sm" />
            </AppButton>
          </div>

        </div>
      </div>

      <!-- Empty state -->
      <div v-if="filteredPriority.length === 0"
        class="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
        <Icon name="solar:list-check-bold" class="mb-2 text-4xl opacity-20" />
        <p class="text-sm">No priority patients</p>
      </div>
    </div>
  </div>
</template>
