<script setup lang="ts">
definePageMeta({
  layout: 'dashboard-sidebar-layout'
})

const appointments = [
  {
    id: 1,
    patientName: 'John Cena',
    condition: 'Herpes',
    time: '09:00 AM',
    date: 'Wednesday, April 15',
    type: 'Follow-up',
    avatar: 'https://i.pravatar.cc/150?u=john'
  },
  {
    id: 2,
    patientName: 'Wally',
    condition: 'Acne',
    time: '11:30 AM',
    date: 'Wednesday, April 15',
    type: 'Consultation',
    avatar: 'https://i.pravatar.cc/150?u=wally'
  },
  {
    id: 3,
    patientName: 'Elena Vance',
    condition: 'Eczema',
    time: '02:00 PM',
    date: 'Thursday, April 16',
    type: 'New Case',
    avatar: 'https://i.pravatar.cc/150?u=elena'
  }
]

const { searchQuery } = useSearch()
const filteredAppointments = computed(() => {
  if (!searchQuery.value) return appointments
  const query = searchQuery.value.toLowerCase()
  const filtered = appointments.filter(appt => 
    appt.patientName.toLowerCase().includes(query) || 
    appt.condition.toLowerCase().includes(query)
  )
  return filtered.length > 0 ? filtered : appointments
})
</script>

<template>
  <div class="flex flex-col h-full gap-6 p-6 overflow-hidden">
    <div class="rounded-3xl border flex justify-end border-gray-100 items-center">
      <AppButton variant="soft" rounded="both">
        <Icon name="lucide:plus" class="mr-2" />
        New Schedule
      </AppButton>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
      <div class="flex flex-col gap-4">
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
              <div class="h-14 w-14 rounded-2xl overflow-hidden border-2 border-primary/20">
                <img :src="appt.avatar" class="h-full w-full object-cover" />
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
              class="h-12 w-12 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-primary/10 transition-colors text-secondary"
            >
              <Icon name="lucide:phone" class="text-xl" />
            </AppButton>
            <AppButton 
              variant="unstyled" size="unstyled" rounded="unstyled"
              class="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary hover:bg-primary/80 transition-colors text-white"
            >
              <Icon name="lets-icons:message-light" class="text-2xl" />
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
