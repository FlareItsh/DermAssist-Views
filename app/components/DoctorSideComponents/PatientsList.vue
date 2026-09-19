<script setup lang="ts">
  const { appointments, selectedDate } = useAppointments()
  const { getStorageUrl } = useStorage()

  const filteredPatients = computed(() => {
    let list = appointments.value

    // Use a map to get unique patients
    const uniquePatientsMap = new Map()

    for (const a of list) {
      if (!uniquePatientsMap.has(a.patient_id)) {
        const patientObj = a.raw?.patient || a.patient
        const firstName = patientObj?.first_name || ''
        const lastName = patientObj?.last_name || ''
        const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || '?'

        uniquePatientsMap.set(a.patient_id, {
          id: a.patient_id, // Use patient_id as the unique key
          name: a.doctor, // This field from useAppointments contains the other person's name
          condition: a.info,
          date: a.date
            ? new Date(a.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })
            : 'TBD',
          avatar: patientObj?.avatar_path ? getStorageUrl(patientObj.avatar_path) : '',
          initials: initials,
          isUrgent: false,
          conversation_uuid: a.conversation_uuid,
          raw: a
        })
      }
    }

    const mapped = Array.from(uniquePatientsMap.values())

    const { searchQuery } = useSearch()
    if (!searchQuery.value) return mapped
    const query = searchQuery.value.toLowerCase()
    return mapped.filter(
      p => p.name.toLowerCase().includes(query) || p.condition.toLowerCase().includes(query)
    )
  })

  const listTitle = computed(() => {
    return 'Patients'
  })

  const goToChat = (uuid: string) => {
    if (uuid) {
      const role = useCookie('user_role').value
      const prefix = role === 'secretary' ? '/secretary' : '/doctor'
      navigateTo(`${prefix}/messages/${uuid}`)
    }
  }

  const goToCompleteAppointment = (uuid: string) => {
    if (uuid) {
      const role = useCookie('user_role').value
      const prefix = role === 'secretary' ? '/secretary' : '/doctor'
      navigateTo(`${prefix}/messages/${uuid}?complete=1`)
    }
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
      <NuxtLink
        to="/doctor/patients"
        class="text-secondary text-sm font-semibold transition hover:underline"
      >
        See more ›
      </NuxtLink>
    </div>

    <!-- Horizontal Scroll Row -->
    <div class="custom-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
      <div
        v-if="filteredPatients.length === 0"
        class="text-muted-foreground w-full py-10 text-center text-sm italic"
      >
        No accepted patients yet.
      </div>
      <div
        v-for="patient in filteredPatients"
        :key="patient.id"
        class="patient-card group flex w-[160px] flex-shrink-0 cursor-pointer snap-start flex-col"
      >
        <!-- Photo -->
        <div class="relative h-[130px] w-full overflow-hidden rounded-2xl bg-gray-100">
          <img
            v-if="patient.avatar"
            :src="patient.avatar"
            :alt="patient.name"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div
            v-else
            class="bg-primary/10 flex h-full w-full items-center justify-center"
          >
            <span class="text-primary text-3xl font-bold">{{ patient.initials }}</span>
          </div>
          <!-- Urgent badge -->
          <div
            v-if="patient.isUrgent"
            class="absolute right-0 bottom-0 left-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 py-2"
          >
            <Icon
              name="solar:danger-triangle-bold"
              class="text-destructive shrink-0 text-xs"
            />
            <span class="text-[9px] font-bold text-white">{{ patient.urgentLabel }}</span>
          </div>
        </div>

        <span class="text-muted-foreground mt-1.5 text-[10px] font-medium">{{ patient.date }}</span>

        <div class="mt-0.5 flex items-center justify-between gap-1">
          <div class="min-w-0">
            <p class="text-foreground truncate text-sm font-bold">{{ patient.name }}</p>
            <p class="text-destructive truncate text-xs font-semibold">{{ patient.condition }}</p>
          </div>
          <div class="flex shrink-0 gap-1">
            <AppButton
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              @click.stop="goToChat(patient.conversation_uuid)"
              class="hover:bg-primary/10 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 transition-colors"
            >
              <Icon
                name="mingcute:message-4-line"
                class="text-secondary text-sm"
              />
            </AppButton>
            <AppButton
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              @click.stop="goToCompleteAppointment(patient.conversation_uuid)"
              class="bg-primary hover:bg-primary/80 flex h-7 w-7 items-center justify-center rounded-full transition-colors"
            >
              <Icon
                name="material-symbols:check-rounded"
                class="text-sm text-white"
              />
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
