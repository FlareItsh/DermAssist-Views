<script setup lang="ts">
  const { appointments } = useAppointments()
  const { getStorageUrl } = useStorage()
  const { addToPriority, removeFromPriority, isInPriority } = usePriorityList()

  const getInitials = (firstName: string, lastName: string, fallback: string): string => {
    if (firstName || lastName) {
      return ((firstName.charAt(0) || '') + (lastName.charAt(0) || '')).toUpperCase()
    }
    const clean = fallback.replace(/^Dr\.\s+/i, '').trim()
    const parts = clean.split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const filteredPatients = computed(() => {
    let list = appointments.value

    // Use a map to get unique patients
    const uniquePatientsMap = new Map()

    for (const a of list) {
      const patientObj = a.patient || (a as any).raw?.patient
      const firstName = patientObj?.first_name || ''
      const lastName = patientObj?.last_name || ''
      const resolvedName =
        firstName || lastName
          ? [firstName, lastName].filter(Boolean).join(' ')
          : a.doctor && !a.doctor.startsWith('Dr.')
            ? a.doctor
            : 'Patient'

      const pUuid = a.patient_uuid || patientObj?.uuid
      const pId = a.patient_id || patientObj?.id
      const uniqueKey = pUuid || (pId ? String(pId) : a.id)

      if (!uniquePatientsMap.has(uniqueKey)) {
        uniquePatientsMap.set(uniqueKey, {
          id: uniqueKey,
          patient_uuid: pUuid,
          patient_id: pId,
          name: resolvedName,
          condition: a.info || 'General Patient Care',
          date: a.date
            ? new Date(a.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            : 'TBD',
          avatar: patientObj?.avatar_path ? getStorageUrl(patientObj.avatar_path) : '',
          initials: getInitials(firstName, lastName, resolvedName),
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

  const isPatientInPriority = (patient: any): boolean => {
    const pUuid = patient.patient_uuid || patient.raw?.patient?.uuid
    const pId = patient.patient_id || patient.raw?.patient?.id
    if (pUuid && isInPriority(pUuid)) return true
    if (pId && isInPriority(String(pId))) return true
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
    const key = pUuid || (pId ? String(pId) : patient.id)
    if (!key) return

    const isPrio = isPatientInPriority(patient)

    if (isPrio) {
      if (pUuid) removeFromPriority(pUuid)
      if (pId) removeFromPriority(String(pId))
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
    } else {
      navigateTo('/doctor/patients')
    }
  }

  const openPatientDirectory = (patient: any) => {
    navigateTo(`/doctor/patients?search=${encodeURIComponent(patient.name)}`)
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
        @click="openPatientDirectory(patient)"
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
            class="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-2xl font-bold"
          >
            {{ patient.initials }}
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
