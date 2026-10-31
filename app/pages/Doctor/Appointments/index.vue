<script setup lang="ts">
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { parseAppointmentDateTime } from '~/composables/useAppointments'
  import { toast } from 'vue-sonner'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const {
    appointments,
    pendingAppointments,
    declinedAppointments,
    completedAppointments,
    noShowAppointments,
    cancelledAppointments,
    rescheduleRequests,
    rescheduleRequestsCount,
    todayAppointments,
    todayAppointmentsCount,
    fetchAppointments
  } = useAppointments()

  const { getStorageUrl } = useStorage()
  const { searchQuery } = useSearch()
  const { resetScanner, appointmentUuid, patientUuid, saveActiveDiagnosisState } = useDiagnosis()

  const showScheduleModal = ref(false)
  const rescheduleModalAppt = ref<any | null>(null)
  const openRescheduleModal = (appt: any) => {
    rescheduleModalAppt.value = appt
  }
  const activeTab = ref<'today' | 'upcoming' | 'pending' | 'reschedule' | 'history'>('upcoming')
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

  // Pending Booking Actions (Accept / Reject)
  const isProcessingBooking = ref(false)
  const showBookingModal = ref(false)
  const bookingActionType = ref<'accept' | 'reject'>('accept')
  const pendingBookingAppt = ref<any | null>(null)
  const bookingRejectReason = ref('Slot unavailable')

  const promptAcceptBooking = (appt: any) => {
    pendingBookingAppt.value = appt
    bookingActionType.value = 'accept'
    showBookingModal.value = true
  }

  const promptRejectBooking = (appt: any) => {
    pendingBookingAppt.value = appt
    bookingActionType.value = 'reject'
    bookingRejectReason.value = 'Slot unavailable or schedule conflict'
    showBookingModal.value = true
  }

  const confirmBookingAction = async () => {
    if (!pendingBookingAppt.value) return
    isProcessingBooking.value = true
    try {
      if (bookingActionType.value === 'accept') {
        await appointmentService.accept(pendingBookingAppt.value.id)
        toast.success('Appointment booking confirmed successfully.')
      } else {
        await appointmentService.reject(pendingBookingAppt.value.id, {
          reason: bookingRejectReason.value || 'Booking declined by practice'
        })
        toast.success('Appointment booking request rejected.')
      }
      showBookingModal.value = false
      pendingBookingAppt.value = null
      await fetchAppointments()
    } catch (e: any) {
      console.error(e)
      const msg = e?.response?._data?.message || e?.message || 'Operation failed.'
      if (e?.response?.status === 409 || msg.includes('SLOT_')) {
        toast.error('Slot Conflict: This time slot is no longer available.')
      } else {
        toast.error(msg)
      }
    } finally {
      isProcessingBooking.value = false
    }
  }

  const closeBookingModal = () => {
    showBookingModal.value = false
    pendingBookingAppt.value = null
  }

  // Attendance Controls (Check-in / No-Show)
  const isProcessingAttendance = ref(false)
  const showCheckInModal = ref(false)
  const pendingAttendanceAppt = ref<any | null>(null)

  const promptCheckIn = (appt: any) => {
    pendingAttendanceAppt.value = appt
    showCheckInModal.value = true
  }

  const confirmCheckIn = async () => {
    if (!pendingAttendanceAppt.value) return
    isProcessingAttendance.value = true
    const targetAppt = pendingAttendanceAppt.value
    try {
      await appointmentService.checkIn(targetAppt.id)
      toast.success('Patient attendance checked in.')
      showCheckInModal.value = false
      pendingAttendanceAppt.value = null

      // Prefill scanner with assigned patient & appointment and redirect
      resetScanner()
      appointmentUuid.value = targetAppt.id || targetAppt.uuid
      const pUuid =
        targetAppt.patient_uuid ||
        targetAppt.patient?.uuid ||
        targetAppt.patient?.id ||
        targetAppt.user_id
      if (pUuid) {
        patientUuid.value = pUuid
      }
      saveActiveDiagnosisState()

      await navigateTo({
        path: '/Doctor/Scan',
        query: {
          appointment_uuid: targetAppt.id || targetAppt.uuid,
          ...(pUuid ? { patient_uuid: pUuid } : {})
        }
      })
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?._data?.message || 'Failed to record check-in.')
    } finally {
      isProcessingAttendance.value = false
    }
  }

  const closeCheckInModal = () => {
    showCheckInModal.value = false
    pendingAttendanceAppt.value = null
  }

  // No-Show Modal
  const showNoShowModal = ref(false)
  const pendingNoShowAppt = ref<any | null>(null)
  const noShowReason = ref('patient_not_present')

  const promptMarkNoShow = (appt: any) => {
    pendingNoShowAppt.value = appt
    noShowReason.value = 'patient_not_present'
    showNoShowModal.value = true
  }

  const confirmMarkNoShow = async () => {
    if (!pendingNoShowAppt.value) return
    isProcessingAttendance.value = true
    try {
      await appointmentService.markNoShow(pendingNoShowAppt.value.id, {
        reason: noShowReason.value || 'patient_not_present'
      })
      toast.success('Appointment marked as no-show.')
      showNoShowModal.value = false
      pendingNoShowAppt.value = null
      await fetchAppointments()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?._data?.message || 'Failed to mark no-show.')
    } finally {
      isProcessingAttendance.value = false
    }
  }

  const closeNoShowModal = () => {
    showNoShowModal.value = false
    pendingNoShowAppt.value = null
  }

  // Cancel Appointment Modal
  const isCancelling = ref(false)
  const showCancelModal = ref(false)
  const pendingCancelAppt = ref<any | null>(null)
  const cancelReason = ref('Clinic schedule change')

  const promptCancelAppointment = (appt: any) => {
    pendingCancelAppt.value = appt
    cancelReason.value = 'Clinic schedule change'
    showCancelModal.value = true
  }

  const confirmCancelAppointment = async () => {
    if (!pendingCancelAppt.value) return
    isCancelling.value = true
    try {
      await appointmentService.cancel(pendingCancelAppt.value.id, {
        cancellation_reason: cancelReason.value || 'Cancelled by staff'
      })
      toast.success('Appointment cancelled.')
      showCancelModal.value = false
      pendingCancelAppt.value = null
      await fetchAppointments()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?._data?.message || 'Failed to cancel appointment.')
    } finally {
      isCancelling.value = false
    }
  }

  const closeCancelModal = () => {
    showCancelModal.value = false
    pendingCancelAppt.value = null
  }

  // Reschedule Proposal Decline / Withdraw Modals
  const isProcessingReschedule = ref(false)
  const showDeclineModal = ref(false)
  const pendingDeclineAppt = ref<any | null>(null)
  const declineReason = ref('Schedule conflict with clinic operating hours')

  const promptDeclineProposal = (appt: any) => {
    pendingDeclineAppt.value = appt
    declineReason.value = 'Schedule conflict with clinic operating hours'
    showDeclineModal.value = true
  }

  const confirmDeclineProposal = async () => {
    if (!pendingDeclineAppt.value) return
    isProcessingReschedule.value = true
    try {
      await appointmentService.declineReschedule(pendingDeclineAppt.value.id, {
        reason: declineReason.value
      })
      toast.success('Reschedule proposal declined.')
      showDeclineModal.value = false
      pendingDeclineAppt.value = null
      await fetchAppointments()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?._data?.message || 'Failed to decline proposal.')
    } finally {
      isProcessingReschedule.value = false
    }
  }

  const closeDeclineModal = () => {
    showDeclineModal.value = false
    pendingDeclineAppt.value = null
  }

  const showWithdrawModal = ref(false)
  const pendingWithdrawAppt = ref<any | null>(null)

  const promptWithdrawProposal = (appt: any) => {
    pendingWithdrawAppt.value = appt
    showWithdrawModal.value = true
  }

  const confirmWithdrawProposal = async () => {
    if (!pendingWithdrawAppt.value) return
    isProcessingReschedule.value = true
    try {
      await appointmentService.withdraw(pendingWithdrawAppt.value.id)
      toast.success('Reschedule proposal withdrawn.')
      showWithdrawModal.value = false
      pendingWithdrawAppt.value = null
      await fetchAppointments()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?._data?.message || 'Failed to withdraw proposal.')
    } finally {
      isProcessingReschedule.value = false
    }
  }

  const closeWithdrawModal = () => {
    showWithdrawModal.value = false
    pendingWithdrawAppt.value = null
  }

  // Doctor reschedule proposal modal
  const promptProposeDate = (appt: any) => {
    openRescheduleModal(appt)
  }

  // Timetable quick view modal
  const selectedTimetableAppt = ref<any | null>(null)
  const handleTimetableSelect = (appt: any) => {
    selectedTimetableAppt.value = appt
  }

  const filteredAppointments = computed(() => {
    let sourceList: any[] = []

    if (activeTab.value === 'pending') {
      sourceList = pendingAppointments.value
    } else if (activeTab.value === 'today') {
      sourceList = todayAppointments.value
    } else if (activeTab.value === 'upcoming') {
      sourceList = appointments.value.filter(
        a => a.status === 'confirmed' || a.status === 'scheduled' || a.status === 'checked_in'
      )
    } else if (activeTab.value === 'reschedule') {
      sourceList = rescheduleRequests.value
    } else if (activeTab.value === 'history') {
      sourceList = [
        ...completedAppointments.value,
        ...noShowAppointments.value,
        ...cancelledAppointments.value,
        ...declinedAppointments.value
      ]
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
  <div class="flex h-full flex-col gap-5 pb-8">
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
      <!-- Clinical Overview / KPI Triage Cards -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <DoctorSideComponentsMetricCard
          label="Pending"
          :value="pendingAppointments.length"
          detail="Patient requests"
          :badge="pendingAppointments.length > 0 ? 'Needs Action' : 'None'"
          :badge-tone="pendingAppointments.length > 0 ? 'amber' : 'neutral'"
          :value-tone="pendingAppointments.length > 0 ? 'amber' : 'default'"
          :active="activeTab === 'pending'"
          active-tone="amber"
          @click="activeTab = 'pending'"
        />

        <DoctorSideComponentsMetricCard
          label="Today"
          :value="todayAppointmentsCount"
          :detail="todayLabel"
          :badge="todayAppointmentsCount > 0 ? 'Active' : 'Scheduled'"
          :badge-tone="todayAppointmentsCount > 0 ? 'primary' : 'neutral'"
          :active="activeTab === 'today'"
          @click="activeTab = 'today'"
        />

        <DoctorSideComponentsMetricCard
          label="Upcoming"
          :value="
            appointments.filter(
              a => a.status === 'confirmed' || a.status === 'scheduled' || a.status === 'checked_in'
            ).length
          "
          detail="Future bookings"
          badge="Scheduled"
          badge-tone="neutral"
          :active="activeTab === 'upcoming'"
          @click="activeTab = 'upcoming'"
        />

        <DoctorSideComponentsMetricCard
          label="Reschedules"
          :value="rescheduleRequestsCount"
          detail="Negotiation"
          :badge="rescheduleRequestsCount > 0 ? 'Needs Action' : 'None'"
          :badge-tone="rescheduleRequestsCount > 0 ? 'amber' : 'neutral'"
          :value-tone="rescheduleRequestsCount > 0 ? 'amber' : 'default'"
          :active="activeTab === 'reschedule'"
          active-tone="amber"
          @click="activeTab = 'reschedule'"
        />

        <DoctorSideComponentsMetricCard
          label="History"
          :value="
            completedAppointments.length +
            noShowAppointments.length +
            cancelledAppointments.length +
            declinedAppointments.length
          "
          detail="Past records"
          badge="Done"
          badge-tone="neutral"
          :active="activeTab === 'history'"
          active-tone="emerald"
          @click="activeTab = 'history'"
        />
      </div>

      <!-- Controls Bar: Tabs & Search Summary -->
      <div
        class="flex flex-col justify-between gap-3 border-b border-gray-200/70 pb-3 md:flex-row md:items-center"
      >
        <!-- Tab Navigation -->
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            @click="activeTab = 'pending'"
            class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
            :class="
              activeTab === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            "
          >
            Pending Requests
            <span
              v-if="pendingAppointments.length > 0"
              class="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black"
              :class="
                activeTab === 'pending' ? 'bg-white text-amber-700' : 'bg-amber-600 text-white'
              "
            >
              {{ pendingAppointments.length }}
            </span>
          </button>

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
                activeTab === 'reschedule' ? 'bg-white text-amber-700' : 'bg-amber-600 text-white'
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
          <template v-if="activeTab === 'pending'">
            There are no pending booking requests awaiting practice review.
          </template>
          <template v-else-if="activeTab === 'today'">
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
              class="flex shrink-0 flex-row items-center justify-between gap-3 rounded-2xl border p-3 sm:w-32 sm:flex-col sm:justify-center"
              :class="
                appt.status === 'pending'
                  ? 'border-amber-200 bg-amber-50/70'
                  : appt.status === 'checked_in'
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : appt.status === 'no_show'
                      ? 'border-rose-200 bg-rose-50/70'
                      : 'border-indigo-100 bg-indigo-50/60'
              "
            >
              <div class="text-center">
                <span
                  class="text-base font-black sm:text-lg"
                  :class="
                    appt.status === 'pending'
                      ? 'text-amber-900'
                      : appt.status === 'checked_in'
                        ? 'text-emerald-900'
                        : appt.status === 'no_show'
                          ? 'text-rose-900'
                          : 'text-indigo-900'
                  "
                >
                  {{ appt.time }}
                </span>
                <span
                  v-if="appt.endTime"
                  class="hidden text-[10px] font-semibold sm:block"
                  :class="
                    appt.status === 'pending'
                      ? 'text-amber-700/80'
                      : appt.status === 'checked_in'
                        ? 'text-emerald-700/80'
                        : appt.status === 'no_show'
                          ? 'text-rose-700/80'
                          : 'text-indigo-700/80'
                  "
                >
                  until {{ appt.endTime }}
                </span>
              </div>
              <span
                class="rounded-lg px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase"
                :class="
                  appt.status === 'pending'
                    ? 'bg-amber-200/70 text-amber-900'
                    : appt.status === 'checked_in'
                      ? 'bg-emerald-200/70 text-emerald-900'
                      : appt.status === 'no_show'
                        ? 'bg-rose-200/70 text-rose-900'
                        : 'bg-indigo-200/60 text-indigo-800'
                "
              >
                {{
                  appt.status === 'pending'
                    ? 'Request'
                    : appt.status === 'checked_in'
                      ? 'Checked In'
                      : appt.status === 'no_show'
                        ? 'No-Show'
                        : appt.type
                }}
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

                <!-- Banners inside card -->

                <!-- Case A: Pending Booking Request -->
                <div
                  v-if="appt.status === 'pending'"
                  class="mt-2.5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-xs font-bold text-amber-900"
                >
                  <Icon
                    name="lucide:clock"
                    class="shrink-0 text-base text-amber-600"
                  />
                  <span>
                    Pending Booking Request: Scheduled slot
                    <strong>{{ appt.date }} at {{ appt.time }}</strong> — Slot not reserved until
                    accepted.
                  </span>
                </div>

                <!-- Case B: Awaiting Attendance Review (Grace Period Passed) -->
                <div
                  v-else-if="appt.is_awaiting_attendance_review"
                  class="mt-2.5 flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-900"
                >
                  <Icon
                    name="lucide:alert-circle"
                    class="shrink-0 text-base text-rose-600"
                  />
                  <span>
                    Awaiting Attendance Review: 15-minute grace period elapsed. Review patient
                    attendance.
                  </span>
                </div>

                <!-- Case C: Reschedule Request by Patient -->
                <div
                  v-else-if="appt.status === 'reschedule_requested'"
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
                    <span class="ml-1 font-normal text-gray-500">
                      (Current slot remains: {{ appt.date }} at {{ appt.time }})
                    </span>
                  </span>
                </div>

                <!-- Case D: Reschedule Proposed by Doctor/Staff -->
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

                <!-- Case E: No-Show Confirmed -->
                <div
                  v-else-if="appt.status === 'no_show'"
                  class="mt-2.5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-1.5 text-xs font-medium text-rose-800"
                >
                  <Icon
                    name="lucide:user-x"
                    class="shrink-0 text-base text-rose-600"
                  />
                  <span
                    >No-Show Recorded (Reason:
                    {{ appt.no_show_reason || 'patient_not_present' }})</span
                  >
                </div>

                <!-- Case F: Cancelled -->
                <div
                  v-else-if="appt.status === 'cancelled'"
                  class="mt-2.5 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700"
                >
                  <Icon
                    name="lucide:ban"
                    class="shrink-0 text-base text-gray-500"
                  />
                  <span
                    >Cancelled (Reason:
                    {{ appt.cancellation_reason || 'Cancelled by staff' }})</span
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Direct Clinical Action Buttons -->
          <div class="flex flex-wrap items-center gap-2 lg:shrink-0">
            <!-- Case 1: Pending Booking Requests -->
            <template v-if="appt.status === 'pending'">
              <button
                type="button"
                :disabled="isProcessingBooking"
                @click="promptAcceptBooking(appt)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                <Icon
                  name="material-symbols:check-circle-rounded"
                  class="text-sm"
                />
                Accept Booking
              </button>

              <button
                type="button"
                :disabled="isProcessingBooking"
                @click="promptRejectBooking(appt)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 shadow-xs transition hover:bg-rose-100 active:scale-95 disabled:opacity-50"
              >
                <Icon
                  name="lucide:x-circle"
                  class="text-sm"
                />
                Reject
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

            <!-- Case 2: Reschedule Requested (Patient proposed) -->
            <template
              v-else-if="
                appt.status === 'reschedule_requested' ||
                (appt.status === 'reschedule_proposed' &&
                  (!appt.active_reschedule_proposal ||
                    appt.active_reschedule_proposal.proposer_party === 'patient' ||
                    appt.active_reschedule_proposal.proposer_type === 'patient'))
              "
            >
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
                @click="promptDeclineProposal(appt)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 shadow-xs transition hover:bg-rose-100 active:scale-95"
              >
                <Icon
                  name="lucide:x-circle"
                  class="text-sm"
                />
                Decline
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

            <!-- Case 3: Reschedule Proposed (Waiting for patient) -->
            <template v-else-if="appt.status === 'reschedule_proposed'">
              <button
                type="button"
                @click="promptWithdrawProposal(appt)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 text-xs font-bold text-amber-800 shadow-xs transition hover:bg-amber-100 active:scale-95"
              >
                <Icon
                  name="lucide:undo-2"
                  class="text-sm"
                />
                Withdraw Proposal
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

            <!-- Case 4: Confirmed / Scheduled / Checked-In -->
            <template
              v-else-if="
                appt.status === 'confirmed' ||
                appt.status === 'scheduled' ||
                appt.status === 'checked_in'
              "
            >
              <!-- Attendance Buttons -->
              <template v-if="appt.is_awaiting_attendance_review">
                <button
                  type="button"
                  @click="promptCheckIn(appt)"
                  class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95"
                >
                  <Icon
                    name="lucide:user-check"
                    class="text-sm"
                  />
                  Check In
                </button>

                <button
                  type="button"
                  @click="promptMarkNoShow(appt)"
                  class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 shadow-xs transition hover:bg-rose-100 active:scale-95"
                >
                  <Icon
                    name="lucide:user-x"
                    class="text-sm"
                  />
                  Mark No-Show
                </button>
              </template>

              <template v-else-if="appt.status !== 'checked_in'">
                <button
                  type="button"
                  @click="promptCheckIn(appt)"
                  class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 shadow-xs transition hover:bg-emerald-100 active:scale-95"
                >
                  <Icon
                    name="lucide:user-check"
                    class="text-sm"
                  />
                  Check In
                </button>
              </template>

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
                v-if="
                  !appt.active_reschedule_proposal &&
                  (appt.status === 'confirmed' ||
                    appt.status === 'scheduled' ||
                    appt.status === 'checked_in')
                "
                type="button"
                @click="openRescheduleModal(appt)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 text-xs font-bold text-indigo-700 shadow-xs transition hover:bg-indigo-50 active:scale-95"
              >
                <Icon
                  name="material-symbols:edit-calendar-rounded"
                  class="text-sm"
                />
                <span>Reschedule</span>
              </button>

              <button
                type="button"
                @click="promptCancelAppointment(appt)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-600 shadow-xs transition hover:bg-gray-50 active:scale-95"
                title="Cancel Appointment"
              >
                <Icon
                  name="lucide:x"
                  class="text-sm text-gray-400"
                />
                <span class="hidden sm:inline">Cancel</span>
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

            <!-- Case 5: Completed Consultations (History) -->
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

            <!-- Case 6: Other / Terminal -->
            <template v-else>
              <button
                type="button"
                @click="goToChat(appt.conversation_uuid)"
                class="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50 active:scale-95"
              >
                <Icon
                  name="lets-icons:message-light"
                  class="text-base"
                />
                Chat
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

    <!-- 1b. Accept / Reject Pending Booking Modal -->
    <AppModalConfirmation
      v-model="showBookingModal"
      :title="
        bookingActionType === 'accept' ? 'Accept Booking Request?' : 'Decline Booking Request?'
      "
      :description="
        bookingActionType === 'accept'
          ? pendingBookingAppt?.date && pendingBookingAppt?.time
            ? `Confirm and lock consultation slot for ${pendingBookingAppt?.patientName || 'the patient'} on ${pendingBookingAppt?.date} at ${pendingBookingAppt?.time}.`
            : 'Confirm and lock this consultation slot. Availability will be atomically checked.'
          : pendingBookingAppt?.date && pendingBookingAppt?.time
            ? `Are you sure you want to decline the booking request for ${pendingBookingAppt?.patientName || 'the patient'} on ${pendingBookingAppt?.date} at ${pendingBookingAppt?.time}? The patient will be notified.`
            : 'Are you sure you want to decline this booking request? The patient will be notified.'
      "
      :confirm-text="
        bookingActionType === 'accept' ? 'Yes, Confirm Booking' : 'Yes, Decline Request'
      "
      cancel-text="Go Back"
      confirm-variant="solid"
      :icon="
        bookingActionType === 'accept' ? 'material-symbols:check-circle-rounded' : 'lucide:x-circle'
      "
      :icon-color="bookingActionType === 'accept' ? 'primary' : 'error'"
      :loading="isProcessingBooking"
      @confirm="confirmBookingAction"
      @cancel="closeBookingModal"
    />

    <!-- 1c. Record Check-In Modal -->
    <AppModalConfirmation
      v-model="showCheckInModal"
      title="Record Patient Check-In?"
      description="Confirm that the patient has arrived at the clinic or connected for consultation."
      confirm-text="Yes, Check In"
      cancel-text="Cancel"
      confirm-variant="solid"
      icon="lucide:user-check"
      icon-color="primary"
      :loading="isProcessingAttendance"
      @confirm="confirmCheckIn"
      @cancel="closeCheckInModal"
    />

    <!-- 1d. Mark No-Show Modal -->
    <AppModalConfirmation
      v-model="showNoShowModal"
      title="Confirm Patient No-Show?"
      description="Confirm that the patient was absent after the configured grace period. This records a missed consultation and closes the appointment."
      confirm-text="Confirm No-Show"
      cancel-text="Go Back"
      confirm-variant="solid"
      icon="lucide:user-x"
      icon-color="error"
      :loading="isProcessingAttendance"
      @confirm="confirmMarkNoShow"
      @cancel="closeNoShowModal"
    />

    <!-- 1e. Cancel Appointment Modal -->
    <AppModalConfirmation
      v-model="showCancelModal"
      title="Cancel Consultation?"
      description="Are you sure you want to cancel this scheduled appointment? Any pending proposals will be closed."
      confirm-text="Yes, Cancel Appointment"
      cancel-text="Go Back"
      confirm-variant="solid"
      icon="lucide:ban"
      icon-color="error"
      :loading="isCancelling"
      @confirm="confirmCancelAppointment"
      @cancel="closeCancelModal"
    />

    <!-- 1f. Decline Reschedule Proposal Modal -->
    <AppModalConfirmation
      v-model="showDeclineModal"
      title="Decline Reschedule Proposal?"
      description="Decline the patient's proposed reschedule date. The appointment remains confirmed at its current slot."
      confirm-text="Decline Proposal"
      cancel-text="Go Back"
      confirm-variant="solid"
      icon="lucide:x-circle"
      icon-color="error"
      :loading="isProcessingReschedule"
      @confirm="confirmDeclineProposal"
      @cancel="closeDeclineModal"
    />

    <!-- 1g. Withdraw Reschedule Proposal Modal -->
    <AppModalConfirmation
      v-model="showWithdrawModal"
      title="Withdraw Reschedule Proposal?"
      description="Withdraw the proposed reschedule. The appointment will remain scheduled at its current time."
      confirm-text="Withdraw Proposal"
      cancel-text="Go Back"
      confirm-variant="solid"
      icon="lucide:undo-2"
      icon-color="primary"
      :loading="isProcessingReschedule"
      @confirm="confirmWithdrawProposal"
      @cancel="closeWithdrawModal"
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

              <button
                v-if="
                  ['pending', 'confirmed', 'scheduled'].includes(
                    (selectedTimetableAppt.status || '').toLowerCase()
                  )
                "
                type="button"
                @click="
                  () => {
                    const a = selectedTimetableAppt
                    selectedTimetableAppt = null
                    openRescheduleModal(a)
                  }
                "
                class="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
              >
                <Icon
                  name="material-symbols:edit-calendar-rounded"
                  class="text-base"
                />
                Propose Reschedule
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Doctor Reschedule Proposal Modal -->
    <PatientSideComponentsRescheduleModal
      v-if="rescheduleModalAppt"
      :appointment="rescheduleModalAppt"
      :inline="false"
      @close="rescheduleModalAppt = null"
      @requested="fetchAppointments"
    />
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
