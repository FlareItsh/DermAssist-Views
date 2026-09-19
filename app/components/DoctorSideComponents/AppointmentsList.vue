<script setup lang="ts">
  const { appointments, selectedDate } = useAppointments()
  const { getStorageUrl } = useStorage()
  const { addToPriority, removeFromPriority, isInPriority } = usePriorityList()

  const getInitials = (name: string): string => {
    if (!name) return '?'
    const cleanName = name.replace(/^Dr\.\s+/i, '').trim()
    const parts = cleanName.split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const filteredPatients = computed(() => {
    let list = appointments.value

    // Filter by selected date if one is picked
    if (selectedDate.value) {
      list = list.filter(a => a.date === selectedDate.value)
    }

    const mapped = list.map(a => {
      const patientObj = a.patient || (a as any).raw?.patient
      const patientName = patientObj
        ? [patientObj.first_name, patientObj.last_name].filter(Boolean).join(' ')
        : a.doctor && !a.doctor.startsWith('Dr.')
          ? a.doctor
          : 'Patient'

      const pUuid = a.patient_uuid || patientObj?.uuid
      const pId = a.patient_id || patientObj?.id

      return {
        id: a.id,
        patient_uuid: pUuid,
        patient_id: pId,
        name: patientName,
        condition: a.info || 'General Consultation',
        date: a.date
          ? new Date(a.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })
          : 'TBD',
        avatar: patientObj?.avatar_path
          ? getStorageUrl(patientObj.avatar_path)
          : a.diagnosis_image
            ? getStorageUrl(a.diagnosis_image)
            : '',
        initials: getInitials(patientName),
        isUrgent: false,
        conversation_uuid: a.conversation_uuid,
        raw: a
      }
    })

    const { searchQuery } = useSearch()
    if (!searchQuery.value) return mapped
    const query = searchQuery.value.toLowerCase()
    return mapped.filter(
      p => p.name.toLowerCase().includes(query) || p.condition.toLowerCase().includes(query)
    )
  })

  const listTitle = computed(() => {
    if (selectedDate.value) {
      const d = new Date(selectedDate.value + 'T00:00:00')
      return `Appointments for ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }
    return 'Appointments'
  })

  const isPatientInPriority = (patient: any): boolean => {
    const pUuid = patient.patient_uuid || patient.raw?.patient?.uuid
    const pId = patient.patient_id || patient.raw?.patient?.id
    const apptId = patient.id || patient.raw?.uuid
    if (pUuid && isInPriority(pUuid)) return true
    if (pId && isInPriority(String(pId))) return true
    if (apptId && isInPriority(apptId)) return true
    if (patient.id && isInPriority(patient.id)) return true

    if (pUuid || pId) {
      return appointments.value.some(a => {
        const aPatientUuid = a.patient_uuid || a.patient?.uuid
        const aPatientId = a.patient_id || a.patient?.id
        const matches = (pUuid && aPatientUuid === pUuid) || (pId && aPatientId == pId)
        return matches && ((a.id && isInPriority(a.id)) || (a.uuid && isInPriority(a.uuid)))
      })
    }
    return false
  }

  const handleTogglePriority = (patient: any) => {
    const pUuid = patient.patient_uuid || patient.raw?.patient?.uuid
    const pId = patient.patient_id || patient.raw?.patient?.id
    const apptId = patient.id || patient.raw?.uuid
    const key = pUuid || (pId ? String(pId) : apptId)
    if (!key) return

    const isPrio = isPatientInPriority(patient)

    if (isPrio) {
      if (pUuid) removeFromPriority(pUuid)
      if (pId) removeFromPriority(String(pId))
      if (apptId) removeFromPriority(apptId)
      if (patient.id) removeFromPriority(patient.id)
      appointments.value.forEach(a => {
        const aPatientUuid = a.patient_uuid || a.patient?.uuid
        const aPatientId = a.patient_id || a.patient?.id
        if ((pUuid && aPatientUuid === pUuid) || (pId && aPatientId == pId)) {
          if (a.id) removeFromPriority(a.id)
          if (a.uuid) removeFromPriority(a.uuid)
        }
      })
    } else {
      if (pUuid) addToPriority(pUuid)
      if (pId) addToPriority(String(pId))
      if (apptId) addToPriority(apptId)
      if (patient.id) addToPriority(patient.id)
      appointments.value.forEach(a => {
        const aPatientUuid = a.patient_uuid || a.patient?.uuid
        const aPatientId = a.patient_id || a.patient?.id
        if ((pUuid && aPatientUuid === pUuid) || (pId && aPatientId == pId)) {
          if (a.id) addToPriority(a.id)
          if (a.uuid) addToPriority(a.uuid)
        }
      })
    }
  }

  const goToChat = (uuid?: string) => {
    if (uuid) {
      const role = useCookie('user_role').value
      const prefix = role === 'secretary' ? '/secretary' : '/doctor'
      navigateTo(`${prefix}/messages/${uuid}`)
    }
  }
</script>

<template>
  <div class="bg-card rounded-3xl border border-gray-100 p-5 shadow-xs">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="bg-secondary h-8 w-1 shrink-0 rounded-full"></div>
        <h2 class="text-foreground text-xl font-bold">{{ listTitle }}</h2>
        <span
          v-if="filteredPatients.length > 0"
          class="bg-primary/10 text-primary inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold"
        >
          {{ filteredPatients.length }}
        </span>
      </div>
      <NuxtLink
        to="/doctor/appointments"
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
        No appointments found for this selection.
      </div>
      <div
        v-for="patient in filteredPatients"
        :key="patient.id"
        @click="goToChat(patient.conversation_uuid)"
        class="patient-card group flex w-[160px] flex-shrink-0 cursor-pointer snap-start flex-col transition-transform hover:-translate-y-0.5"
      >
        <!-- Photo -->
        <div
          class="border-border/40 relative h-[130px] w-full overflow-hidden rounded-2xl border bg-gray-100"
        >
          <img
            v-if="patient.avatar"
            :src="patient.avatar"
            :alt="patient.name"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div
            v-else
            class="bg-primary/5 text-primary flex h-full w-full items-center justify-center text-2xl font-bold"
          >
            {{ patient.initials }}
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
              title="Message Patient"
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
              @click.stop="handleTogglePriority(patient)"
              :title="isPatientInPriority(patient) ? 'Remove from Priority' : 'Add to Priority'"
              :class="[
                'flex h-7 w-7 items-center justify-center rounded-full transition-all',
                isPatientInPriority(patient)
                  ? 'bg-amber-500 text-white shadow-xs hover:bg-amber-600'
                  : 'bg-primary hover:bg-primary/80 text-white'
              ]"
            >
              <Icon
                :name="
                  isPatientInPriority(patient)
                    ? 'material-symbols:check-rounded'
                    : 'fluent:add-12-filled'
                "
                class="text-sm"
              />
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
