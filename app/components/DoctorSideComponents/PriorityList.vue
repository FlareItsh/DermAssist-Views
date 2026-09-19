<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { userService } from '~/api/user/UserService'

  interface PriorityPatientItem {
    id: string
    patientUuid?: string
    patientId?: number | string
    name: string
    condition: string
    schedule: string
    avatar: string | null
    initials: string
    conversationUuid?: string
    hasActiveAppointment: boolean
    raw?: any
  }

  const { appointments, fetchAppointments } = useAppointments()
  const { getStorageUrl } = useStorage()
  const { priorityIds, removeFromPriority, isInPriority } = usePriorityList()
  const { searchQuery } = useSearch()

  const registeredPatients = ref<any[]>([])
  const isLoading = ref(false)

  const fetchRegisteredPatients = async () => {
    try {
      isLoading.value = true
      const res = await userService.listDoctorPatients({ per_page: 100 })
      registeredPatients.value = res.data || []
    } catch (e) {
      console.error('Failed to fetch registered patients for priority list:', e)
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    fetchRegisteredPatients()
    if (!appointments.value.length) {
      fetchAppointments()
    }
  })

  const getInitials = (name: string): string => {
    if (!name) return '?'
    const cleanName = name.replace(/^Dr\.\s+/i, '').trim()
    const parts = cleanName.split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Unified priority patients deduplicated by patient UUID / ID
  const priorityPatients = computed<PriorityPatientItem[]>(() => {
    const map = new Map<string, PriorityPatientItem>()

    // 1. Check doctor-registered patients
    for (const p of registeredPatients.value) {
      const pUuid = p.uuid
      const pId = p.id ? String(p.id) : null
      const isPrio = (pUuid && isInPriority(pUuid)) || (pId && isInPriority(pId))

      if (isPrio) {
        const key = pUuid || `reg_${pId}`
        const fullName =
          [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Registered Patient'

        map.set(key, {
          id: key,
          patientUuid: pUuid,
          patientId: p.id,
          name: fullName,
          condition: 'General Patient Care',
          schedule: 'Registered Patient',
          avatar: p.avatar_path ? getStorageUrl(p.avatar_path) : null,
          initials: getInitials(fullName),
          conversationUuid: undefined,
          hasActiveAppointment: false,
          raw: p
        })
      }
    }

    // 2. Check all appointments (accepted, pending, etc.)
    for (const a of appointments.value) {
      const patientObj = a.patient || (a as any).raw?.patient
      const pUuid = a.patient_uuid || patientObj?.uuid
      const pId = a.patient_id || patientObj?.id ? String(a.patient_id || patientObj?.id) : null
      const apptId = a.id

      // Patient is in priority if their UUID, numeric ID, or appointment ID was saved
      const isPrio =
        (pUuid && isInPriority(pUuid)) ||
        (pId && isInPriority(pId)) ||
        (apptId && isInPriority(apptId)) ||
        (a.uuid && isInPriority(a.uuid))

      if (isPrio) {
        const key = pUuid || (pId ? `id_${pId}` : `appt_${apptId}`)
        const fullName = patientObj
          ? [patientObj.first_name, patientObj.last_name].filter(Boolean).join(' ')
          : a.doctor && !a.doctor.startsWith('Dr.')
            ? a.doctor
            : 'Patient'

        const scheduleStr = a.date
          ? `${new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${a.time ? ' • ' + a.time : ''}`
          : 'Schedule TBD'

        const avatarUrl = patientObj?.avatar_path
          ? getStorageUrl(patientObj.avatar_path)
          : a.diagnosis_image
            ? getStorageUrl(a.diagnosis_image)
            : null

        if (map.has(key)) {
          const existing = map.get(key)!
          if (a.conversation_uuid && !existing.conversationUuid) {
            existing.conversationUuid = a.conversation_uuid
          }
          if (a.info && existing.condition === 'General Patient Care') {
            existing.condition = a.info
          }
          if (a.date) {
            existing.schedule = scheduleStr
            existing.hasActiveAppointment = true
          }
          if (avatarUrl && !existing.avatar) {
            existing.avatar = avatarUrl
          }
        } else {
          map.set(key, {
            id: key,
            patientUuid: pUuid,
            patientId: pId || undefined,
            name: fullName,
            condition: a.info || 'General Consultation',
            schedule: scheduleStr,
            avatar: avatarUrl,
            initials: getInitials(fullName),
            conversationUuid: a.conversation_uuid,
            hasActiveAppointment: true,
            raw: a
          })
        }
      }
    }

    return Array.from(map.values())
  })

  const filteredPriority = computed(() => {
    let list = priorityPatients.value
    if (!searchQuery.value) return list
    const query = searchQuery.value.toLowerCase()
    return list.filter(
      p => p.name.toLowerCase().includes(query) || p.condition.toLowerCase().includes(query)
    )
  })

  const dismiss = (patient: PriorityPatientItem) => {
    const pUuid = patient.patientUuid
    const pId = patient.patientId
    if (patient.patientUuid) removeFromPriority(patient.patientUuid)
    if (patient.patientId) removeFromPriority(String(patient.patientId))
    if (patient.id) removeFromPriority(patient.id)

    appointments.value.forEach(a => {
      const aPatientUuid = a.patient_uuid || a.patient?.uuid
      const aPatientId = a.patient_id || a.patient?.id
      if ((pUuid && aPatientUuid === pUuid) || (pId && aPatientId == pId)) {
        if (a.id) removeFromPriority(a.id)
        if (a.uuid) removeFromPriority(a.uuid)
      }
    })
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

  const goToCompleteAppointment = (uuid?: string) => {
    if (uuid) {
      const role = useCookie('user_role').value
      const prefix = role === 'secretary' ? '/secretary' : '/doctor'
      navigateTo(`${prefix}/messages/${uuid}?complete=1`)
    }
  }

  const conditionColor = (condition: string) => {
    const c = condition?.toLowerCase() || ''
    if (c.includes('acne') || c.includes('melanoma') || c.includes('herpes')) {
      return 'text-destructive font-bold'
    }
    return 'text-amber-500 font-semibold'
  }
</script>

<template>
  <div
    class="bg-card flex h-full min-h-0 w-full flex-col rounded-3xl border border-gray-100 p-5 shadow-xs"
  >
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2.5">
        <div class="bg-secondary h-7 w-1 shrink-0 rounded-full" />
        <div class="flex items-center gap-2">
          <h2 class="text-foreground text-xl font-bold">Priority List</h2>
          <span
            v-if="priorityPatients.length > 0"
            class="bg-primary/10 text-primary inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold"
          >
            {{ priorityPatients.length }}
          </span>
        </div>
      </div>

      <NuxtLink
        to="/doctor/patients"
        class="text-primary text-xs font-semibold hover:underline"
      >
        View Directory ›
      </NuxtLink>
    </div>

    <!-- List -->
    <div class="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <div
        v-for="patient in filteredPriority"
        :key="patient.id"
        class="group bg-background/50 hover:border-primary/30 flex items-center gap-3 rounded-2xl border border-gray-100 p-3 transition-all hover:shadow-md"
      >
        <!-- Avatar -->
        <div class="relative h-13 w-13 shrink-0 overflow-hidden rounded-xl border border-gray-200">
          <NuxtImg
            v-if="patient.avatar"
            :src="patient.avatar"
            :alt="patient.name"
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <div
            v-else
            class="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-base font-bold"
          >
            {{ patient.initials }}
          </div>
        </div>

        <!-- Info -->
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <div class="flex items-center justify-between gap-1">
            <p class="text-foreground truncate text-sm font-bold">
              {{ patient.name }}
            </p>
          </div>
          <span :class="['truncate text-xs', conditionColor(patient.condition)]">
            {{ patient.condition }}
          </span>
          <div class="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px] font-medium">
            <Icon
              name="lucide:calendar"
              class="h-3 w-3 shrink-0"
            />
            <span class="truncate">{{ patient.schedule }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex shrink-0 flex-col items-end justify-between gap-1.5">
          <button
            @click="dismiss(patient)"
            title="Remove from Priority"
            class="hover:text-destructive shrink-0 rounded-full p-0.5 text-gray-300 transition-colors hover:bg-gray-100"
          >
            <Icon
              name="lucide:x"
              class="text-sm"
            />
          </button>
          <div class="flex shrink-0 items-center gap-1.5">
            <AppButton
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              @click="goToChat(patient.conversationUuid)"
              title="Open Chat"
              class="hover:bg-primary/10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-gray-100 transition-colors"
            >
              <Icon
                name="mingcute:message-4-line"
                class="text-secondary text-sm"
              />
            </AppButton>
            <AppButton
              v-if="patient.hasActiveAppointment"
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              @click="goToCompleteAppointment(patient.conversationUuid)"
              title="Complete Appointment"
              class="bg-primary hover:bg-primary/80 flex h-7.5 w-7.5 items-center justify-center rounded-full transition-colors"
            >
              <Icon
                name="material-symbols:check-rounded"
                class="text-sm text-white"
              />
            </AppButton>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="filteredPriority.length === 0"
        class="text-muted-foreground flex flex-col items-center justify-center py-12 text-center"
      >
        <div class="bg-primary/5 mb-2 flex h-12 w-12 items-center justify-center rounded-full">
          <Icon
            name="solar:list-check-bold"
            class="text-primary/40 text-2xl"
          />
        </div>
        <p class="text-foreground text-sm font-semibold">No priority patients</p>
        <p class="text-muted-foreground mt-0.5 max-w-[200px] text-xs">
          Click the priority (+) icon on any patient or appointment to pin them here.
        </p>
      </div>
    </div>
  </div>
</template>
