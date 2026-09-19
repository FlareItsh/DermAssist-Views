<script setup lang="ts">
  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const {
    appointments,
    completedAppointments,
    rescheduleRequests,
    rescheduleRequestsCount,
    fetchAppointments
  } = useAppointments()
  const { getStorageUrl } = useStorage()

  const { searchQuery } = useSearch()

  const showScheduleModal = ref(false)
  const activeTab = ref<'upcoming' | 'reschedule' | 'history'>('upcoming')
  const viewMode = ref<'list' | 'timetable'>('list')

  const filteredAppointments = computed(() => {
    let sourceList = appointments.value
    if (activeTab.value === 'history') {
      sourceList = completedAppointments.value
    } else if (activeTab.value === 'reschedule') {
      sourceList = rescheduleRequests.value
    }

    const list = sourceList.map(a => ({
      id: a.id,
      uuid: a.id,
      patientName: a.doctor, // other person's name
      condition: a.info,
      time: a.time || 'TBD',
      date: a.date
        ? new Date(a.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })
        : 'TBD',
      type: a.purpose ? 'Follow-up' : 'Consultation',
      purpose: a.purpose,
      avatar: a.diagnosis_image ? getStorageUrl(a.diagnosis_image) : null,
      conversation_uuid: a.conversation_uuid,
      status: a.status,
      requested_reschedule_date: a.requested_reschedule_date,
      requested_reschedule_time: a.requested_reschedule_time
    }))

    if (!searchQuery.value) return list
    const query = searchQuery.value.toLowerCase()
    return list.filter(
      appt =>
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
  <div class="flex h-full flex-col gap-6 overflow-hidden p-6">
    <!-- Top Action Bar -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div class="flex items-center gap-3">
        <!-- View Mode Switcher -->
        <div class="flex items-center gap-1 rounded-2xl border border-gray-200/50 bg-gray-100 p-1">
          <button
            @click="viewMode = 'list'"
            class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              viewMode === 'list'
                ? 'border border-gray-200/30 bg-white text-indigo-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            "
          >
            <Icon
              name="lucide:list"
              class="h-3.5 w-3.5"
            />
            List View
          </button>
          <button
            @click="viewMode = 'timetable'"
            class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              viewMode === 'timetable'
                ? 'border border-gray-200/30 bg-white text-indigo-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            "
          >
            <Icon
              name="lucide:calendar-range"
              class="h-3.5 w-3.5"
            />
            Weekly Timetable
          </button>
        </div>

        <!-- Upcoming / Reschedule Requests / History (Visible in list view) -->
        <div
          v-if="viewMode === 'list'"
          class="flex items-center gap-1 rounded-2xl border border-gray-200/50 bg-gray-100 p-1"
        >
          <button
            @click="activeTab = 'upcoming'"
            class="cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              activeTab === 'upcoming'
                ? 'border border-gray-200/30 bg-white text-indigo-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            "
          >
            Upcoming
          </button>
          <button
            @click="activeTab = 'reschedule'"
            class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              activeTab === 'reschedule'
                ? 'border border-gray-200/30 bg-white text-amber-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            "
          >
            Reschedule Requests
            <span
              v-if="rescheduleRequestsCount > 0"
              class="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white shadow-xs"
            >
              {{ rescheduleRequestsCount }}
            </span>
          </button>
          <button
            @click="activeTab = 'history'"
            class="cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              activeTab === 'history'
                ? 'border border-gray-200/30 bg-white text-indigo-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            "
          >
            History
          </button>
        </div>
      </div>

      <AppButton
        variant="solid"
        rounded="both"
        @click="showScheduleModal = true"
        class="inline-flex cursor-pointer items-center justify-center gap-2 bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
      >
        <Icon
          name="lucide:calendar-plus"
          class="text-base"
        />
        New Appointment
      </AppButton>
    </div>

    <!-- Timetable View -->
    <div
      v-if="viewMode === 'timetable'"
      class="min-h-0 flex-1 overflow-hidden"
    >
      <AppWeeklyTimetable />
    </div>

    <!-- List View -->
    <div
      v-else
      class="custom-scrollbar flex-1 overflow-y-auto pr-2"
    >
      <div
        v-if="filteredAppointments.length === 0"
        class="text-muted-foreground py-20 text-center italic"
      >
        No appointments found.
      </div>
      <div
        v-else
        class="flex flex-col gap-4"
      >
        <div
          v-for="appt in filteredAppointments"
          :key="appt.id"
          class="bg-card group flex items-center justify-between rounded-3xl border border-gray-100 p-5 transition-all hover:shadow-md"
        >
          <div class="flex items-center gap-5">
            <!-- Time Badge -->
            <div
              class="bg-primary/10 border-primary/20 flex min-w-[100px] flex-col items-center justify-center rounded-2xl border p-4"
            >
              <span class="text-primary text-lg leading-none font-bold">{{ appt.time }}</span>
              <span class="text-primary/60 mt-1 text-[10px] font-bold tracking-wider uppercase">{{
                appt.type
              }}</span>
            </div>

            <div class="flex items-center gap-4">
              <div
                v-if="appt.avatar"
                class="border-primary/20 h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 bg-gray-50"
              >
                <NuxtImg
                  :src="appt.avatar"
                  class="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div
                v-else
                class="border-primary/20 bg-primary/5 text-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 text-base font-bold"
              >
                {{ getInitials(appt.patientName) }}
              </div>
              <div class="flex flex-col">
                <h3 class="text-xl font-bold">{{ appt.patientName }}</h3>
                <div class="mt-0.5 flex flex-wrap items-center gap-2">
                  <span class="text-destructive text-sm font-semibold">{{ appt.condition }}</span>
                  <span class="text-gray-300">•</span>
                  <span class="text-muted-foreground text-sm font-medium">{{ appt.date }}</span>
                  <template v-if="appt.status === 'reschedule_requested'">
                    <span class="text-gray-300">•</span>
                    <span
                      class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800"
                    >
                      <Icon
                        name="material-symbols:edit-calendar-rounded"
                        class="text-xs"
                      />
                      Reschedule Requested
                    </span>
                  </template>
                  <template v-else-if="appt.status === 'reschedule_proposed'">
                    <span class="text-gray-300">•</span>
                    <span
                      class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800"
                    >
                      <Icon
                        name="material-symbols:hourglass-top-rounded"
                        class="text-xs"
                      />
                      Reschedule Proposed
                    </span>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <AppButton
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              @click="goToChat(appt.conversation_uuid)"
              class="text-secondary flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 transition-colors hover:bg-gray-200"
            >
              <Icon
                name="lets-icons:message-light"
                class="text-2xl"
              />
            </AppButton>
            <AppButton
              variant="unstyled"
              size="unstyled"
              rounded="unstyled"
              @click="navigateTo(`/Secretary/Appointments/${appt.uuid}`)"
              class="bg-primary hover:bg-primary/80 flex h-12 w-12 items-center justify-center rounded-2xl text-white transition-colors"
            >
              <Icon
                name="material-symbols:edit-document-outline"
                class="text-2xl"
              />
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
