<script setup lang="ts">
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { parseAppointmentDateTime } from '~/composables/useAppointments'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const {
    appointments,
    completedAppointments,
    rescheduleRequests,
    rescheduleRequestsCount,
    todayAppointments,
    todayAppointmentsCount,
    fetchAppointments
  } = useAppointments()

  const { getStorageUrl } = useStorage()
  const { searchQuery } = useSearch()

  const showScheduleModal = ref(false)
  const activeTab = ref<'today' | 'upcoming' | 'reschedule' | 'history'>('upcoming')
  const viewMode = ref<'list' | 'timetable'>('list')

  // Direct action modals
  const isAccepting = ref(false)
  const showAcceptModal = ref(false)
  const pendingAcceptAppt = ref<any | null>(null)

  const promptAcceptRequest = (appt: any) => {
    pendingAcceptAppt.value = appt
    showAcceptModal.value = true
  }

  const confirmAcceptRequest = async () => {
    if (!pendingAcceptAppt.value) return
    isAccepting.value = true
    try {
      await appointmentService.acceptReschedule(pendingAcceptAppt.value.id, {})
      toast.success('Reschedule request accepted.')
      showAcceptModal.value = false
      pendingAcceptAppt.value = null
      await fetchAppointments()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?._data?.message || 'Failed to accept reschedule.')
    } finally {
      isAccepting.value = false
    }
  }

  const closeAcceptModal = () => {
    showAcceptModal.value = false
    pendingAcceptAppt.value = null
  }

  // Doctor reschedule proposal modal
  const rescheduleModalAppt = ref<any | null>(null)
  const promptProposeDate = (appt: any) => {
    rescheduleModalAppt.value = {
      id: appt.id,
      uuid: appt.id,
      doctor_uuid: appt.doctor_uuid,
      doctor_id: appt.doctor_id,
      doctor: appt.patientName,
      info: appt.condition
    }
  }

  // Timetable quick view modal
  const selectedTimetableAppt = ref<any | null>(null)
  const handleTimetableSelect = (appt: any) => {
    selectedTimetableAppt.value = appt
  }

  const filteredAppointments = computed(() => {
    let sourceList = appointments.value

    if (activeTab.value === 'today') {
      sourceList = todayAppointments.value
    } else if (activeTab.value === 'upcoming') {
      sourceList = appointments.value.filter(a => a.status === 'scheduled')
    } else if (activeTab.value === 'reschedule') {
      sourceList = rescheduleRequests.value
    } else if (activeTab.value === 'history') {
      sourceList = completedAppointments.value
    }

    const list = sourceList.map(a => {
      let endTime = ''
      if (a.raw_scheduled_end_at || a.scheduled_end_at) {
        const pEnd = parseAppointmentDateTime(a.raw_scheduled_end_at || a.scheduled_end_at)
        endTime = pEnd.time
      }

      return {
        id: a.id,
        uuid: a.id,
        doctor_id: a.doctor_id,
        doctor_uuid: a.doctor_uuid,
        patientName: a.doctor, // mapped in useAppointments as patient name for doctor view
        patient: a.patient,
        patient_age: a.patient_age || a.patient?.age,
        patient_gender: a.patient_gender || a.patient?.gender,
        condition: a.info,
        time: a.time || 'TBD',
        endTime,
        date: a.date
          ? new Date(a.date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })
          : 'TBD',
        rawDate: a.date,
        type: a.purpose || 'Consultation',
        purpose: a.purpose,
        clinic_name: a.clinic_name || a.location || 'Cruz Skin Clinic',
        avatar: a.diagnosis_image ? getStorageUrl(a.diagnosis_image) : null,
        diagnosis_image: a.diagnosis_image,
        conversation_uuid: a.conversation_uuid,
        status: a.status,
        requested_reschedule_date: a.requested_reschedule_date
          ? new Date(a.requested_reschedule_date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })
          : null,
        requested_reschedule_time: a.requested_reschedule_time
          ? parseAppointmentDateTime(`2000-01-01T${a.requested_reschedule_time}`).time
          : null
      }
    })

    if (!searchQuery.value) return list
    const query = searchQuery.value.toLowerCase()
    return list.filter(
      appt =>
        appt.patientName.toLowerCase().includes(query) ||
        appt.condition.toLowerCase().includes(query) ||
        appt.clinic_name.toLowerCase().includes(query)
    )
  })

  const appointmentsPerPage = 6
  const appointmentCurrentPage = ref(1)

  const paginatedAppointments = computed(() => {
    const start = (appointmentCurrentPage.value - 1) * appointmentsPerPage
    return filteredAppointments.value.slice(start, start + appointmentsPerPage)
  })

  watch([searchQuery, activeTab], () => {
    appointmentCurrentPage.value = 1
  })

  const getInitials = (name: string): string => {
    if (!name) return ''
    const cleanName = name.replace(/^Dr\.\s+/i, '')
    const parts = cleanName.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const goToChat = (uuid?: string) => {
    if (uuid) navigateTo(`/Doctor/Messages/${uuid}`)
  }

  const goToConsultation = (apptId: string) => {
    if (apptId) navigateTo(`/Doctor/Appointments/${apptId}`)
  }

  const todayLabel = computed(() => {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  })
  const switchToRescheduleTab = () => {
    viewMode.value = 'list'
    activeTab.value = 'reschedule'
  }
</script>

<template>
  <div class="flex h-full flex-col gap-5 overflow-hidden p-4 sm:p-6">
    <!-- Header & Action -->
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">Appointments</h1>
        <p class="text-xs text-gray-500 sm:text-sm">
          Manage clinical consultations, review patient reschedule requests, and track patient care.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Pending Reschedules Reminder Pill (Only in Timetable Mode when there are requests) -->
        <button
          v-if="viewMode === 'timetable' && rescheduleRequestsCount > 0"
          type="button"
          @click="switchToRescheduleTab"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 shadow-2xs transition hover:bg-amber-100"
          title="Switch to List to review pending reschedule requests"
        >
          <Icon
            name="lucide:calendar-clock"
            class="text-sm text-amber-600"
          />
          {{ rescheduleRequestsCount }} Reschedule
          {{ rescheduleRequestsCount > 1 ? 'Requests' : 'Request' }}
        </button>

        <!-- View Switcher -->
        <div
          class="flex items-center gap-1 rounded-2xl border border-gray-200/80 bg-gray-100 p-1 shadow-2xs"
        >
          <button
            type="button"
            @click="viewMode = 'list'"
            class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              viewMode === 'list'
                ? 'border border-gray-200/60 bg-white text-indigo-600 shadow-xs'
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
            type="button"
            @click="viewMode = 'timetable'"
            class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              viewMode === 'timetable'
                ? 'border border-gray-200/60 bg-white text-indigo-600 shadow-xs'
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
    </div>

    <!-- List View Controls & KPI Triage (Only in List Mode) -->
    <template v-if="viewMode === 'list'">
      <!-- Clinical Overview / KPI Triage Cards -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <!-- Card 1: Today's Appointments -->
        <button
          type="button"
          @click="activeTab = 'today'"
          class="group flex cursor-pointer flex-col rounded-2xl border p-4 text-left transition-all hover:shadow-md"
          :class="
            activeTab === 'today'
              ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20'
              : 'border-gray-200/80 bg-white hover:border-gray-300'
          "
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold tracking-wider text-gray-500 uppercase">Today</span>
            <div
              class="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white"
            >
              <Icon
                name="lucide:calendar-check-2"
                class="text-lg"
              />
            </div>
          </div>
          <div class="mt-2 text-2xl font-black text-gray-900">{{ todayAppointmentsCount }}</div>
          <div class="mt-0.5 text-[11px] font-medium text-gray-500">{{ todayLabel }}</div>
        </button>

        <!-- Card 2: Reschedule Requests -->
        <button
          type="button"
          @click="activeTab = 'reschedule'"
          class="group flex cursor-pointer flex-col rounded-2xl border p-4 text-left transition-all hover:shadow-md"
          :class="
            activeTab === 'reschedule'
              ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
              : 'border-gray-200/80 bg-white hover:border-gray-300'
          "
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold tracking-wider text-gray-500 uppercase"
              >Reschedules</span
            >
            <div
              class="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 transition-colors group-hover:bg-amber-500 group-hover:text-white"
            >
              <Icon
                name="lucide:calendar-clock"
                class="text-lg"
              />
            </div>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-2xl font-black text-gray-900">{{ rescheduleRequestsCount }}</span>
            <span
              v-if="rescheduleRequestsCount > 0"
              class="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
            >
              Needs Action
            </span>
          </div>
          <div class="mt-0.5 text-[11px] font-medium text-gray-500">Patient requests</div>
        </button>

        <!-- Card 3: Upcoming Consultations -->
        <button
          type="button"
          @click="activeTab = 'upcoming'"
          class="group flex cursor-pointer flex-col rounded-2xl border p-4 text-left transition-all hover:shadow-md"
          :class="
            activeTab === 'upcoming'
              ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
              : 'border-gray-200/80 bg-white hover:border-gray-300'
          "
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold tracking-wider text-gray-500 uppercase">Upcoming</span>
            <div
              class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white"
            >
              <Icon
                name="lucide:calendar-days"
                class="text-lg"
              />
            </div>
          </div>
          <div class="mt-2 text-2xl font-black text-gray-900">
            {{ appointments.filter(a => a.status === 'scheduled').length }}
          </div>
          <div class="mt-0.5 text-[11px] font-medium text-gray-500">Future bookings</div>
        </button>

        <!-- Card 4: History / Completed -->
        <button
          type="button"
          @click="activeTab = 'history'"
          class="group flex cursor-pointer flex-col rounded-2xl border p-4 text-left transition-all hover:shadow-md"
          :class="
            activeTab === 'history'
              ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
              : 'border-gray-200/80 bg-white hover:border-gray-300'
          "
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold tracking-wider text-gray-500 uppercase">History</span>
            <div
              class="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white"
            >
              <Icon
                name="lucide:check-circle-2"
                class="text-lg"
              />
            </div>
          </div>
          <div class="mt-2 text-2xl font-black text-gray-900">
            {{ completedAppointments.length }}
          </div>
          <div class="mt-0.5 text-[11px] font-medium text-gray-500">Completed consultations</div>
        </button>
      </div>

      <!-- Controls Bar: Tabs & Search Summary -->
      <div
        class="flex flex-col justify-between gap-3 border-b border-gray-200/70 pb-3 md:flex-row md:items-center"
      >
        <!-- Tab Navigation -->
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            @click="activeTab = 'today'"
            class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              activeTab === 'today'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            "
          >
            Today
            <span
              v-if="todayAppointmentsCount > 0"
              class="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black"
              :class="
                activeTab === 'today' ? 'bg-white text-indigo-600' : 'bg-indigo-100 text-indigo-700'
              "
            >
              {{ todayAppointmentsCount }}
            </span>
          </button>

          <button
            type="button"
            @click="activeTab = 'upcoming'"
            class="cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              activeTab === 'upcoming'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            "
          >
            Upcoming
          </button>

          <button
            type="button"
            @click="activeTab = 'reschedule'"
            class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              activeTab === 'reschedule'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            "
          >
            Reschedule Requests
            <span
              v-if="rescheduleRequestsCount > 0"
              class="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black"
              :class="
                activeTab === 'reschedule' ? 'bg-white text-amber-700' : 'bg-amber-500 text-white'
              "
            >
              {{ rescheduleRequestsCount }}
            </span>
          </button>

          <button
            type="button"
            @click="activeTab = 'history'"
            class="cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            "
          >
            History
          </button>
        </div>

        <div class="text-xs font-semibold text-gray-500">
          Showing <span class="font-bold text-gray-800">{{ filteredAppointments.length }}</span>
          {{ filteredAppointments.length === 1 ? 'consultation' : 'consultations' }}
        </div>
      </div>
    </template>

    <!-- Timetable View -->
    <div
      v-if="viewMode === 'timetable'"
      class="min-h-0 flex-1 overflow-hidden"
    >
      <AppWeeklyTimetable @select-appointment="handleTimetableSelect" />
    </div>

    <!-- List View -->
    <div
      v-else
      class="custom-scrollbar flex-1 overflow-y-auto pr-1"
    >
      <!-- Empty State -->
      <div
        v-if="filteredAppointments.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
          <Icon
            name="lucide:calendar-x-2"
            class="text-3xl text-gray-400"
          />
        </div>
        <h3 class="text-base font-bold text-gray-800">No appointments found</h3>
        <p class="mt-1 max-w-sm text-xs text-gray-500">
          <template v-if="activeTab === 'today'">
            You have no consultations scheduled for today.
          </template>
          <template v-else-if="activeTab === 'reschedule'">
            There are no pending patient reschedule requests at this time.
          </template>
          <template v-else-if="activeTab === 'history'">
            No completed consultation records found.
          </template>
          <template v-else> No upcoming appointments found matching your search. </template>
        </p>
        <button
          type="button"
          @click="showScheduleModal = true"
          class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100"
        >
          <Icon
            name="lucide:calendar-plus"
            class="text-sm"
          />
          Book an Appointment
        </button>
      </div>

      <!-- Appointments List -->
      <div
        v-else
        class="flex flex-col gap-3.5"
      >
        <div
          v-for="appt in paginatedAppointments"
          :key="appt.id"
          class="group relative flex flex-col justify-between gap-4 rounded-3xl border border-gray-200/80 bg-white p-4.5 shadow-xs transition-all hover:border-gray-300 hover:shadow-md lg:flex-row lg:items-center"
        >
          <!-- Left & Middle: Time and Clinical Info -->
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <!-- Time Badge -->
            <div
              class="flex shrink-0 flex-row items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 sm:w-32 sm:flex-col sm:justify-center"
            >
              <div class="text-center">
                <span class="text-base font-black text-indigo-900 sm:text-lg">{{ appt.time }}</span>
                <span
                  v-if="appt.endTime"
                  class="hidden text-[10px] font-semibold text-indigo-700/80 sm:block"
                >
                  until {{ appt.endTime }}
                </span>
              </div>
              <span
                class="rounded-lg bg-indigo-200/60 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-indigo-800 uppercase"
              >
                {{ appt.type }}
              </span>
            </div>

            <!-- Patient and Consultation Details -->
            <div class="flex items-start gap-3.5">
              <!-- Avatar -->
              <div
                v-if="appt.avatar"
                class="h-13 w-13 shrink-0 overflow-hidden rounded-2xl border-2 border-indigo-100 bg-gray-50 shadow-2xs"
              >
                <NuxtImg
                  :src="appt.avatar"
                  class="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div
                v-else
                class="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-indigo-50 text-sm font-bold text-indigo-600 shadow-2xs"
              >
                {{ getInitials(appt.patientName) }}
              </div>

              <!-- Main Info Details -->
              <div class="flex flex-col">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-lg font-bold text-gray-900">{{ appt.patientName }}</h3>
                  <span
                    v-if="appt.patient_age || appt.patient_gender"
                    class="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600"
                  >
                    {{ appt.patient_age ? `${appt.patient_age} yrs` : '' }}
                    {{ appt.patient_age && appt.patient_gender ? '•' : '' }}
                    {{ appt.patient_gender || '' }}
                  </span>
                </div>

                <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                  <span
                    class="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700"
                  >
                    <Icon
                      name="lucide:stethoscope"
                      class="text-xs"
                    />
                    {{ appt.condition }}
                  </span>

                  <span class="text-gray-300">•</span>

                  <span class="inline-flex items-center gap-1 font-medium text-gray-700">
                    <Icon
                      name="lucide:calendar"
                      class="text-xs text-gray-400"
                    />
                    {{ appt.date }}
                  </span>

                  <span class="text-gray-300">•</span>

                  <span class="inline-flex items-center gap-1 font-medium text-gray-600">
                    <Icon
                      name="lucide:map-pin"
                      class="text-xs text-indigo-500"
                    />
                    {{ appt.clinic_name }}
                  </span>
                </div>

                <!-- Reschedule Request Banner inside card -->
                <div
                  v-if="appt.status === 'reschedule_requested'"
                  class="mt-2.5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-xs font-bold text-amber-900"
                >
                  <Icon
                    name="material-symbols:edit-calendar-rounded"
                    class="shrink-0 text-base text-amber-600"
                  />
                  <span>
                    Requested Schedule:
                    <strong class="underline">{{
                      appt.requested_reschedule_date || 'New Date'
                    }}</strong>
                    <template v-if="appt.requested_reschedule_time">
                      at <strong>{{ appt.requested_reschedule_time }}</strong>
                    </template>
                  </span>
                </div>

                <!-- Reschedule Proposed by Doctor Banner -->
                <div
                  v-else-if="appt.status === 'reschedule_proposed'"
                  class="mt-2.5 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-bold text-blue-900"
                >
                  <Icon
                    name="material-symbols:hourglass-top-rounded"
                    class="shrink-0 text-base text-blue-600"
                  />
                  <span>Waiting for patient to confirm proposed date</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Direct Clinical Action Buttons -->
          <div class="flex flex-wrap items-center gap-2 lg:shrink-0">
            <!-- Case 1: Reschedule Requested (Needs Decision) -->
            <template v-if="appt.status === 'reschedule_requested'">
              <button
                type="button"
                :disabled="isAccepting"
                @click="promptAcceptRequest(appt)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                <Icon
                  v-if="isAccepting"
                  name="svg-spinners:ring-resize"
                  class="text-sm"
                />
                <Icon
                  v-else
                  name="material-symbols:check-circle-rounded"
                  class="text-sm"
                />
                Accept Request
              </button>

              <button
                type="button"
                @click="promptProposeDate(appt)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 text-xs font-bold text-indigo-700 shadow-xs transition hover:bg-indigo-100 active:scale-95"
              >
                <Icon
                  name="material-symbols:edit-calendar-rounded"
                  class="text-sm"
                />
                Propose Another
              </button>

              <button
                type="button"
                @click="goToChat(appt.conversation_uuid)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50 active:scale-95"
                title="Message Patient"
              >
                <Icon
                  name="lets-icons:message-light"
                  class="text-lg text-gray-600"
                />
                <span class="hidden sm:inline">Message</span>
              </button>
            </template>

            <!-- Case 2: Standard Scheduled or Today (Clinical Consultation) -->
            <template v-else-if="appt.status === 'scheduled'">
              <button
                type="button"
                @click="goToConsultation(appt.id)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 active:scale-95"
              >
                <Icon
                  name="material-symbols:edit-document-outline"
                  class="text-sm"
                />
                Clinical Consultation
              </button>

              <button
                type="button"
                @click="goToChat(appt.conversation_uuid)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50 active:scale-95"
              >
                <Icon
                  name="lets-icons:message-light"
                  class="text-lg text-gray-600"
                />
                <span class="hidden sm:inline">Message</span>
              </button>
            </template>

            <!-- Case 3: Completed Consultations (History) -->
            <template v-else-if="appt.status === 'completed'">
              <button
                type="button"
                @click="goToConsultation(appt.id)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 text-xs font-bold text-gray-800 shadow-xs transition hover:bg-gray-50 active:scale-95"
              >
                <Icon
                  name="lucide:file-text"
                  class="text-sm text-indigo-600"
                />
                View Clinical Note
              </button>

              <button
                type="button"
                @click="goToChat(appt.conversation_uuid)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50 active:scale-95"
              >
                <Icon
                  name="lets-icons:message-light"
                  class="text-lg text-gray-600"
                />
                <span class="hidden sm:inline">Chat</span>
              </button>
            </template>

            <!-- Case 4: Other / Reschedule Proposed -->
            <template v-else>
              <button
                type="button"
                @click="goToChat(appt.conversation_uuid)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 active:scale-95"
              >
                <Icon
                  name="lets-icons:message-light"
                  class="text-base"
                />
                Chat in Consultation
              </button>
            </template>
          </div>
        </div>

        <!-- Pagination -->
        <div class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
          <AppPagination
            v-model:currentPage="appointmentCurrentPage"
            :total-items="filteredAppointments.length"
            :per-page="appointmentsPerPage"
            item-label="appointments"
          />
        </div>
      </div>
    </div>

    <!-- Modals -->

    <!-- 1. Accept Reschedule Confirmation Modal -->
    <AppModalConfirmation
      v-model="showAcceptModal"
      title="Accept Patient Reschedule?"
      description="Are you sure you want to accept the patient's requested date and time? The consultation schedule will be officially updated."
      confirm-text="Yes, Accept Schedule"
      cancel-text="Go Back"
      confirm-variant="solid"
      icon="material-symbols:check-circle-rounded"
      icon-color="primary"
      :loading="isAccepting"
      @confirm="confirmAcceptRequest"
      @cancel="closeAcceptModal"
    />

    <!-- 2. Propose Another Date Modal (Doctor Reschedule) -->
    <PatientSideComponentsRescheduleModal
      v-if="rescheduleModalAppt"
      :appointment="rescheduleModalAppt"
      @close="rescheduleModalAppt = null"
      @requested="
        () => {
          rescheduleModalAppt = null
          fetchAppointments()
        }
      "
    />

    <!-- 3. New Appointment / Follow-up Booking Modal -->
    <AppModalDoctorScheduleNewModal
      v-if="showScheduleModal"
      @close="showScheduleModal = false"
      @scheduled="fetchAppointments"
    />

    <!-- 4. Timetable Quick Detail Dialog -->
    <Transition name="modal">
      <div
        v-if="selectedTimetableAppt"
        class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
        @click.self="selectedTimetableAppt = null"
      >
        <div
          class="w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl"
        >
          <div class="mb-5 flex items-center justify-between">
            <h3 class="text-lg font-black text-gray-900">Appointment Details</h3>
            <button
              type="button"
              @click="selectedTimetableAppt = null"
              class="rounded-xl p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <Icon
                name="lucide:x"
                class="text-lg"
              />
            </button>
          </div>

          <div class="space-y-4 text-sm">
            <div class="flex items-center gap-3">
              <div
                class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-base font-bold text-indigo-700"
              >
                {{ getInitials(selectedTimetableAppt.patientName) }}
              </div>
              <div>
                <h4 class="font-bold text-gray-900">{{ selectedTimetableAppt.patientName }}</h4>
                <p class="text-xs font-semibold text-red-600">
                  {{ selectedTimetableAppt.info || 'Consultation' }}
                </p>
              </div>
            </div>

            <div class="space-y-2 rounded-2xl border border-gray-100 bg-gray-50/80 p-3.5">
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">Scheduled Time:</span>
                <span class="font-bold text-gray-900">
                  {{ selectedTimetableAppt.startTime }} - {{ selectedTimetableAppt.endTime }}
                </span>
              </div>
              <div
                v-if="selectedTimetableAppt.location"
                class="flex justify-between text-xs"
              >
                <span class="text-gray-500">Clinic Branch:</span>
                <span class="font-bold text-gray-900">{{ selectedTimetableAppt.location }}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">Status:</span>
                <span class="font-bold text-indigo-700 capitalize">{{
                  selectedTimetableAppt.status
                }}</span>
              </div>
            </div>

            <div class="flex flex-col gap-2 pt-2">
              <button
                type="button"
                @click="
                  () => {
                    const id = selectedTimetableAppt.id || selectedTimetableAppt.uuid
                    selectedTimetableAppt = null
                    goToConsultation(id)
                  }
                "
                class="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
              >
                <Icon
                  name="material-symbols:edit-document-outline"
                  class="text-base"
                />
                Open Clinical Consultation
              </button>

              <button
                v-if="selectedTimetableAppt.conversation_uuid"
                type="button"
                @click="
                  () => {
                    const conv = selectedTimetableAppt.conversation_uuid
                    selectedTimetableAppt = null
                    goToChat(conv)
                  }
                "
                class="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                <Icon
                  name="lets-icons:message-light"
                  class="text-lg"
                />
                Message Patient
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.08);
    border-radius: 9999px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.15);
  }
</style>
