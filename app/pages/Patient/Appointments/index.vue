<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue'
  import { useRoute, useRouter } from '#app'
  import { toast } from 'vue-sonner'
  import { userService } from '~/api/user/UserService'
  import { conversationService } from '~/api/conversation/ConversationService'
  import { appointmentService } from '~/api/appointment/AppointmentService'
  import { parseAppointmentDateTime, type Appointment } from '~/composables/useAppointments'

  definePageMeta({
    layout: 'dashboard-sidebar-layout',
    alias: ['/patient/appointments', '/Patient/Appointments']
  })

  const route = useRoute()
  const router = useRouter()
  const userUuid = useCookie('user_uuid')
  const { getStorageUrl } = useStorage()

  // ── Appointment Store ────────────────────────────────────────────────────────
  const {
    appointments,
    pendingAppointments,
    completedAppointments,
    declinedAppointments,
    noShowAppointments,
    cancelledAppointments,
    fetchAppointments
  } = useAppointments()

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  const activeTab = ref<'active' | 'history'>('active')

  const activeAppointmentsList = computed(() => {
    return appointments.value.filter(a =>
      ['pending', 'confirmed', 'scheduled', 'checked_in', 'in_consultation'].includes(
        a.status?.toLowerCase()
      )
    )
  })

  const historyAppointmentsList = computed(() => {
    return appointments.value.filter(a =>
      ['completed', 'cancelled', 'no_show', 'declined', 'rejected', 'expired'].includes(
        a.status?.toLowerCase()
      )
    )
  })

  const appointmentSearchQuery = ref('')

  const displayedAppointments = computed(() => {
    const list =
      activeTab.value === 'active' ? activeAppointmentsList.value : historyAppointmentsList.value
    const q = appointmentSearchQuery.value.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      a =>
        a.doctor?.toLowerCase().includes(q) ||
        a.info?.toLowerCase().includes(q) ||
        a.date?.toLowerCase().includes(q) ||
        a.location?.toLowerCase().includes(q)
    )
  })

  // ── Doctor Discovery & Proximity ─────────────────────────────────────────────
  const allDoctors = ref<any[]>([])
  const isLoadingDoctors = ref(true)
  const isDoctorRegistered = ref(false)
  const doctorSearchQuery = ref('')

  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLng = (lng2 - lng1) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const parseCoordinate = (value: unknown): number | null => {
    const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
    return Number.isFinite(parsed) ? parsed : null
  }

  const fetchDoctors = async () => {
    isLoadingDoctors.value = true
    try {
      const patientRes = await userService.show(userUuid.value as string, { t: Date.now() })
      const patient = (patientRes as any)?.data ?? patientRes

      isDoctorRegistered.value = Boolean(patient?.is_doctor_registered)

      if (patient?.is_doctor_registered && patient?.registered_by_doctor) {
        allDoctors.value = [
          {
            ...patient.registered_by_doctor,
            is_attending_doctor: true,
            distance: 0
          }
        ]
        isLoadingDoctors.value = false
        return
      }

      const patLat = parseCoordinate(patient?.latitude)
      const patLng = parseCoordinate(patient?.longitude)

      const doctorsRes = await userService.list({
        role: 'doctor',
        status: 'verified',
        recommended_only: 1,
        per_page: 100
      })
      const doctors: any[] = (doctorsRes as any)?.data ?? []

      if (patLat !== null && patLng !== null) {
        allDoctors.value = doctors
          .filter(d => d.latitude != null && d.longitude != null && d.uuid !== patient?.uuid)
          .map(d => ({
            ...d,
            distance: haversineDistance(
              patLat as number,
              patLng as number,
              parseFloat(d.latitude),
              parseFloat(d.longitude)
            )
          }))
          .sort((a, b) => a.distance - b.distance)
      } else {
        allDoctors.value = doctors.map(d => ({ ...d, distance: 0 }))
      }
    } catch (e) {
      console.error('Failed to load doctors list:', e)
    } finally {
      isLoadingDoctors.value = false
    }
  }

  const filteredDoctors = computed(() => {
    const q = doctorSearchQuery.value.trim().toLowerCase()
    if (!q) return allDoctors.value
    return allDoctors.value.filter(
      d =>
        d.first_name?.toLowerCase().includes(q) ||
        d.last_name?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q) ||
        d.province?.toLowerCase().includes(q) ||
        d.workplace_name?.toLowerCase().includes(q)
    )
  })

  const getDoctorDisplayName = (d: any) => {
    if (d.first_name || d.last_name) {
      return `Dr. ${d.first_name || ''} ${d.last_name || ''}`.trim()
    }
    return d.name || 'Doctor'
  }

  const getDoctorLocation = (d: any) => {
    if (d.city && d.province) {
      return `${d.city}, ${d.province}`
    }
    return d.city || d.province || 'Clinic Practice'
  }

  const getDoctorAvatar = (d: any) => {
    if (d.avatar_path) return getStorageUrl(d.avatar_path)
    if (d.doctor_verification?.id_photo_path) {
      return getStorageUrl(d.doctor_verification.id_photo_path)
    }
    return ''
  }

  // ── Booking Modal & Auto-Open Flow ───────────────────────────────────────────
  const showBookModal = ref(false)
  const selectedDoctorToBook = ref<any | null>(null)
  const selectedDiagnosisToBook = ref<string>('')

  const openBookingForDoctor = (doctor: any, diagnosisUuid?: string) => {
    selectedDoctorToBook.value = doctor
    selectedDiagnosisToBook.value = diagnosisUuid || ''
    showBookModal.value = true
  }

  const handleStartChatWithDoctor = async (doctor: any) => {
    try {
      const res = await conversationService.create({ doctor_id: doctor.id })
      const uuid = res?.data?.id || res?.id || res?.data?.uuid || res?.uuid
      if (uuid) {
        await navigateTo(`/patient/messages/${uuid}`)
      }
    } catch (e) {
      console.error('Failed to start conversation with doctor:', e)
      toast.error('Could not open conversation.')
    }
  }

  const checkAutoOpenFromQuery = async () => {
    const doctorParam = route.query.doctor
    const shouldBook = route.query.book === 'true'
    const diagnosisParam = (route.query.diagnosis_uuid || route.query.diagnosis) as
      | string
      | undefined

    if (doctorParam && shouldBook) {
      // Find doctor in current list
      const doc = allDoctors.value.find(
        d => String(d.id) === String(doctorParam) || d.uuid === doctorParam
      )
      if (doc) {
        openBookingForDoctor(doc, diagnosisParam)
      } else {
        // Fetch doctor directly
        try {
          const res = await userService.show(String(doctorParam))
          const fetchedDoc = (res as any)?.data ?? res
          if (fetchedDoc) {
            openBookingForDoctor(fetchedDoc, diagnosisParam)
          }
        } catch (e) {
          console.warn('Could not auto-open booking for doctor query param:', doctorParam)
        }
      }
    }
  }

  // ── Reschedule & Cancellation Flow ───────────────────────────────────────────
  const rescheduleModalAppt = ref<any | null>(null)
  const isProcessingProposal = ref(false)

  const openRescheduleModal = (appt: any) => {
    rescheduleModalAppt.value = appt
  }

  // Reschedule Proposal response handlers
  const handleAcceptProposal = async (appt: any) => {
    if (!appt.active_reschedule_proposal) return
    isProcessingProposal.value = true
    try {
      await appointmentService.acceptRescheduleProposal(
        appt.id || appt.uuid,
        appt.active_reschedule_proposal.id || appt.active_reschedule_proposal.uuid
      )
      toast.success('Reschedule proposal accepted.')
      await fetchAppointments()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?._data?.message || 'Failed to accept proposal.')
    } finally {
      isProcessingProposal.value = false
    }
  }

  const handleDeclineProposal = async (appt: any) => {
    if (!appt.active_reschedule_proposal) return
    isProcessingProposal.value = true
    try {
      await appointmentService.declineRescheduleProposal(
        appt.id || appt.uuid,
        appt.active_reschedule_proposal.id || appt.active_reschedule_proposal.uuid,
        { reason: 'Declined by patient' }
      )
      toast.success('Reschedule proposal declined.')
      await fetchAppointments()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?._data?.message || 'Failed to decline proposal.')
    } finally {
      isProcessingProposal.value = false
    }
  }

  const handleWithdrawProposal = async (appt: any) => {
    if (!appt.active_reschedule_proposal) return
    isProcessingProposal.value = true
    try {
      await appointmentService.withdrawRescheduleProposal(
        appt.id || appt.uuid,
        appt.active_reschedule_proposal.id || appt.active_reschedule_proposal.uuid
      )
      toast.success('Reschedule proposal withdrawn.')
      await fetchAppointments()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.response?._data?.message || 'Failed to withdraw proposal.')
    } finally {
      isProcessingProposal.value = false
    }
  }

  // Cancellation modal
  const showCancelModal = ref(false)
  const pendingCancelAppt = ref<any | null>(null)
  const isCancelling = ref(false)

  const promptCancelAppointment = (appt: any) => {
    pendingCancelAppt.value = appt
    showCancelModal.value = true
  }

  const confirmCancel = async () => {
    if (!pendingCancelAppt.value) return
    isCancelling.value = true
    try {
      await appointmentService.cancel(pendingCancelAppt.value.id || pendingCancelAppt.value.uuid, {
        cancellation_reason: 'Cancelled by patient'
      })
      toast.success('Appointment cancelled.')
      showCancelModal.value = false
      pendingCancelAppt.value = null
      await fetchAppointments()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.data?.message || 'Failed to cancel appointment.')
    } finally {
      isCancelling.value = false
    }
  }

  const goToChat = async (conversationUuid?: string) => {
    if (conversationUuid) {
      await navigateTo(`/patient/messages/${conversationUuid}`)
    } else {
      await navigateTo('/patient/messages')
    }
  }

  const onAppointmentBooked = async (apptOrRes?: any) => {
    await fetchAppointments()
    const convUuid = apptOrRes?.conversation_uuid || apptOrRes?.appointment?.conversation_uuid
    if (convUuid && selectedDiagnosisToBook.value) {
      await navigateTo(`/patient/messages/${convUuid}`)
    }
  }

  const formatProposalTime = (proposal: any) => {
    if (!proposal?.proposed_start_at) return ''
    const p = parseAppointmentDateTime(proposal.proposed_start_at)
    return `${p.date} at ${p.time}`
  }

  // Helpers for Status Badges
  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase()
    switch (s) {
      case 'confirmed':
      case 'scheduled':
        return { label: 'Confirmed', class: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' }
      case 'pending':
        return { label: 'Pending Review', class: 'bg-amber-50 text-amber-700 ring-amber-600/20' }
      case 'checked_in':
        return { label: 'Checked In', class: 'bg-blue-50 text-blue-700 ring-blue-600/20' }
      case 'in_consultation':
        return {
          label: 'In Consultation',
          class: 'bg-purple-50 text-purple-700 ring-purple-600/20'
        }
      case 'completed':
        return { label: 'Completed', class: 'bg-gray-100 text-gray-700 ring-gray-600/10' }
      case 'cancelled':
        return { label: 'Cancelled', class: 'bg-rose-50 text-rose-700 ring-rose-600/20' }
      case 'no_show':
        return { label: 'No Show', class: 'bg-orange-50 text-orange-700 ring-orange-600/20' }
      case 'rejected':
      case 'declined':
        return { label: 'Declined', class: 'bg-red-50 text-red-700 ring-red-600/20' }
      default:
        return { label: status, class: 'bg-gray-50 text-gray-700 ring-gray-600/20' }
    }
  }

  onMounted(async () => {
    await Promise.all([fetchDoctors(), fetchAppointments()])
    await checkAutoOpenFromQuery()
  })

  watch(
    () => route.query,
    () => {
      checkAutoOpenFromQuery()
    }
  )
</script>

<template>
  <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
    <!-- ═══════════════════════════════════════════════════════════════════════════
         LEFT / MAIN COLUMN (Doctors Directory + Appointments List)
         ═══════════════════════════════════════════════════════════════════════════ -->
    <div class="flex min-w-0 flex-1 flex-col gap-6">
      <!-- ── SECTION 1: DOCTORS DIRECTORY (Choose Doctor) ─────────────────────── -->
      <div class="bg-card rounded-3xl border border-gray-100 p-5 shadow-xs">
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <div class="bg-secondary h-8 w-1 shrink-0 rounded-full"></div>
            <div>
              <h2 class="text-foreground text-xl font-bold">Choose a Dermatologist</h2>
              <p class="text-muted-foreground text-xs">
                Find available specialists near your location and book direct consultations
              </p>
            </div>
          </div>

          <!-- Doctor Search Input -->
          <div class="relative w-full sm:w-64">
            <Icon
              name="solar:magnifer-linear"
              class="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-400"
            />
            <input
              v-model="doctorSearchQuery"
              type="text"
              placeholder="Search doctor or clinic..."
              class="focus:border-primary focus:ring-primary/20 w-full rounded-2xl border border-gray-300 bg-white py-2 pr-3 pl-8 text-xs font-medium text-gray-900 shadow-2xs transition-colors placeholder:text-gray-400 focus:ring-2 focus:outline-none"
            />
          </div>
        </div>

        <!-- Attending Doctor Notice for Doctor-Registered Patients -->
        <div
          v-if="isDoctorRegistered"
          class="mb-4 flex items-center gap-2.5 rounded-2xl border border-blue-200 bg-blue-50/90 p-3 text-xs font-medium text-blue-950 shadow-2xs"
        >
          <Icon
            name="solar:shield-check-bold"
            class="shrink-0 text-base text-blue-600"
          />
          <p>
            You are enrolled with <strong>Your Attending Doctor</strong>. Clinic policy schedules
            consultations directly with your assigned physician.
          </p>
        </div>

        <!-- Loading Skeleton -->
        <div
          v-if="isLoadingDoctors"
          class="flex min-h-[180px] items-center justify-center p-8"
        >
          <div
            class="h-8 w-8 animate-spin rounded-full border-3 border-indigo-200 border-t-indigo-600"
          ></div>
        </div>

        <!-- Doctors Grid / Scroll -->
        <div
          v-else-if="filteredDoctors.length > 0"
          class="custom-scrollbar flex gap-4 overflow-x-auto pt-1 pb-3"
        >
          <div
            v-for="doc in filteredDoctors"
            :key="doc.id"
            class="hover:border-primary/30 dark:bg-card flex w-64 shrink-0 flex-col justify-between rounded-3xl border border-gray-100 bg-white p-4 shadow-xs transition-all hover:shadow-md dark:border-white/10"
          >
            <div>
              <!-- Avatar & Proximity Badge -->
              <div class="flex items-start justify-between gap-3">
                <div
                  class="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-xs dark:border-white/10"
                >
                  <img
                    v-if="getDoctorAvatar(doc)"
                    :src="getDoctorAvatar(doc)"
                    :alt="getDoctorDisplayName(doc)"
                    class="h-full w-full object-cover"
                  />
                  <div
                    v-else
                    class="from-primary/10 to-primary/20 text-primary flex h-full w-full items-center justify-center bg-gradient-to-br"
                  >
                    <Icon
                      name="solar:user-bold-duotone"
                      class="text-2xl"
                    />
                  </div>
                </div>

                <!-- Distance / Attending Doctor Badge -->
                <span
                  v-if="doc.is_attending_doctor"
                  class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-600/20"
                >
                  <Icon
                    name="solar:star-bold"
                    class="text-xs text-indigo-600"
                  />
                  Attending
                </span>
                <span
                  v-else-if="doc.distance > 0"
                  class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/20"
                >
                  <Icon
                    name="solar:map-point-bold"
                    class="text-xs text-emerald-600"
                  />
                  {{ doc.distance.toFixed(1) }} km
                </span>
                <span
                  v-else
                  class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600"
                >
                  Verified
                </span>
              </div>

              <!-- Doctor Name & Location -->
              <div class="mt-3">
                <p class="truncate text-[10px] font-bold tracking-tight text-gray-400 uppercase">
                  {{ getDoctorLocation(doc) }}
                </p>
                <h3 class="text-foreground mt-0.5 truncate text-base font-bold">
                  {{ getDoctorDisplayName(doc) }}
                </h3>
              </div>
            </div>

            <!-- Card Action Buttons -->
            <div
              class="mt-4 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-white/10"
            >
              <button
                type="button"
                @click="openBookingForDoctor(doc)"
                class="bg-primary hover:bg-primary/90 flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white shadow-xs transition-all active:scale-95"
              >
                <Icon
                  name="material-symbols:calendar-add-on-rounded"
                  class="text-sm"
                />
                <span>Book</span>
              </button>
              <button
                type="button"
                @click="handleStartChatWithDoctor(doc)"
                class="hover:bg-primary/10 text-primary border-primary/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95"
                title="Message Doctor"
              >
                <Icon
                  name="mingcute:message-4-line"
                  class="text-base"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- No Doctors Found -->
        <div
          v-else
          class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-10 text-center"
        >
          <Icon
            name="solar:users-group-two-rounded-outline"
            class="mb-2 text-3xl text-gray-300"
          />
          <p class="text-xs font-semibold text-gray-500">No doctors match your search query</p>
        </div>
      </div>

      <!-- ── SECTION 2: MY APPOINTMENTS & HISTORIES ────────────────────────────── -->
      <div class="bg-card rounded-3xl border border-gray-100 p-5 shadow-xs">
        <!-- Header & Tabs -->
        <div
          class="mb-5 flex flex-col gap-4 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"
        >
          <div class="flex items-center gap-3">
            <div class="bg-primary h-8 w-1 shrink-0 rounded-full"></div>
            <div>
              <h2 class="text-foreground text-xl font-bold">My Consultations</h2>
              <p class="text-muted-foreground text-xs">
                Track active schedules, pending approvals, and past consultation history
              </p>
            </div>
          </div>

          <!-- Active vs History Filter Switcher -->
          <div class="flex items-center gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/5">
            <button
              type="button"
              @click="activeTab = 'active'"
              class="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
              :class="[
                activeTab === 'active'
                  ? 'text-primary dark:bg-card bg-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              <span>Upcoming & Active</span>
              <span
                class="py-0.2 rounded-full px-1.5 text-[10px]"
                :class="
                  activeTab === 'active'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-200 text-gray-600'
                "
              >
                {{ activeAppointmentsList.length }}
              </span>
            </button>
            <button
              type="button"
              @click="activeTab = 'history'"
              class="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
              :class="[
                activeTab === 'history'
                  ? 'text-primary dark:bg-card bg-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              <span>Past & History</span>
              <span
                class="py-0.2 rounded-full px-1.5 text-[10px]"
                :class="
                  activeTab === 'history'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-200 text-gray-600'
                "
              >
                {{ historyAppointmentsList.length }}
              </span>
            </button>
          </div>
        </div>

        <!-- Appointment Search -->
        <div class="mb-4">
          <div class="relative w-full sm:w-72">
            <Icon
              name="solar:magnifer-linear"
              class="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-400"
            />
            <input
              v-model="appointmentSearchQuery"
              type="text"
              placeholder="Search consultations by doctor or date..."
              class="focus:border-primary focus:ring-primary/20 w-full rounded-2xl border border-gray-300 bg-white py-2 pr-3 pl-8 text-xs font-medium text-gray-900 shadow-2xs transition-colors placeholder:text-gray-400 focus:ring-2 focus:outline-none"
            />
          </div>
        </div>

        <!-- Appointments List -->
        <div
          v-if="displayedAppointments.length > 0"
          class="space-y-3.5"
        >
          <div
            v-for="appt in displayedAppointments"
            :key="appt.id"
            class="dark:bg-card flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs transition hover:border-gray-200 sm:p-5 dark:border-white/10"
          >
            <!-- Card Top: Doctor, Status, Date -->
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3.5">
                <div
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-xs dark:bg-indigo-950/40"
                >
                  <Icon
                    name="solar:stethoscope-bold"
                    class="text-xl"
                  />
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 class="text-foreground truncate text-base font-bold">{{ appt.doctor }}</h3>
                    <span
                      class="inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-bold ring-1"
                      :class="getStatusBadge(appt.status).class"
                    >
                      {{ getStatusBadge(appt.status).label }}
                    </span>
                  </div>
                  <p class="text-muted-foreground truncate text-xs">
                    {{ appt.info || 'Clinical Consultation' }}
                  </p>
                </div>
              </div>

              <!-- Time & Date Pill -->
              <div
                class="flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-800 sm:self-auto"
              >
                <Icon
                  name="material-symbols:calendar-today-rounded"
                  class="text-primary text-sm"
                />
                <span>{{ appt.date || 'Pending Schedule' }}</span>
                <span
                  v-if="appt.time"
                  class="text-gray-400"
                  >•</span
                >
                <span v-if="appt.time">{{ appt.time }}</span>
              </div>
            </div>

            <!-- Card Meta: Location & Purpose -->
            <div
              v-if="appt.location || appt.purpose"
              class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-gray-50/70 p-2.5 text-xs dark:bg-white/5"
            >
              <div
                v-if="appt.location"
                class="flex items-center gap-1.5"
              >
                <Icon
                  name="solar:map-point-linear"
                  class="text-primary text-sm"
                />
                <span>{{ appt.location }}</span>
              </div>
              <div
                v-if="appt.purpose"
                class="flex items-center gap-1.5"
              >
                <Icon
                  name="solar:notes-linear"
                  class="text-primary text-sm"
                />
                <span class="italic">"{{ appt.purpose }}"</span>
              </div>
            </div>

            <!-- Reschedule Proposal Banner -->
            <div
              v-if="appt.active_reschedule_proposal"
              class="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p class="flex items-center gap-1 font-bold text-amber-900">
                  <Icon
                    name="material-symbols:pending-actions-rounded"
                    class="text-sm text-amber-600"
                  />
                  <span
                    >Reschedule Proposal:
                    {{ formatProposalTime(appt.active_reschedule_proposal) }}</span
                  >
                </p>
                <p
                  v-if="appt.active_reschedule_proposal.reason"
                  class="mt-0.5 text-[11px] text-amber-800 italic"
                >
                  "{{ appt.active_reschedule_proposal.reason }}"
                </p>
              </div>

              <!-- Counterparty Actions -->
              <div
                v-if="appt.active_reschedule_proposal.proposer_party === 'practice'"
                class="flex shrink-0 items-center gap-2"
              >
                <button
                  type="button"
                  @click="handleAcceptProposal(appt)"
                  :disabled="isProcessingProposal"
                  class="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  @click="handleDeclineProposal(appt)"
                  :disabled="isProcessingProposal"
                  class="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
              <div
                v-else
                class="flex shrink-0 items-center gap-2"
              >
                <span class="text-[11px] font-semibold text-amber-800">Pending Doctor Review</span>
                <button
                  type="button"
                  @click="handleWithdrawProposal(appt)"
                  :disabled="isProcessingProposal"
                  class="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  Withdraw
                </button>
              </div>
            </div>

            <!-- Card Bottom Actions -->
            <div class="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                @click="goToChat(appt.conversation_uuid)"
                class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 active:scale-95"
              >
                <Icon
                  name="mingcute:message-4-line"
                  class="text-sm"
                />
                <span>Chat</span>
              </button>

              <button
                v-if="
                  !appt.active_reschedule_proposal &&
                  (appt.status === 'confirmed' || appt.status === 'scheduled')
                "
                type="button"
                @click="openRescheduleModal(appt)"
                class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 text-xs font-bold text-indigo-700 shadow-xs hover:bg-indigo-50 active:scale-95"
              >
                <Icon
                  name="material-symbols:edit-calendar-rounded"
                  class="text-sm"
                />
                <span>Reschedule</span>
              </button>

              <button
                v-if="['pending', 'confirmed', 'scheduled'].includes(appt.status?.toLowerCase())"
                type="button"
                @click="promptCancelAppointment(appt)"
                class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 shadow-xs hover:bg-rose-50 active:scale-95"
              >
                <Icon
                  name="material-symbols:cancel-outline-rounded"
                  class="text-sm"
                />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-else
          class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-center"
        >
          <div
            class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400"
          >
            <Icon
              name="material-symbols:event-busy-rounded"
              class="text-2xl"
            />
          </div>
          <h3 class="text-foreground text-sm font-bold">
            No {{ activeTab === 'active' ? 'active' : 'past' }} appointments found
          </h3>
          <p class="text-muted-foreground mt-0.5 text-xs">
            {{
              activeTab === 'active'
                ? 'Choose a doctor above to request your next consultation schedule.'
                : 'Your previous consultation history will appear here.'
            }}
          </p>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════════
         RIGHT COLUMN (Interactive Calendar Panel)
         ═══════════════════════════════════════════════════════════════════════════ -->
    <div class="w-full shrink-0 lg:w-80 xl:w-[340px]">
      <div class="sticky top-4">
        <PatientSideComponentsCalendar
          :show-appointment-details-panel="true"
          class="w-full"
        />
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════════
         MODALS
         ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- Direct Booking Modal -->
    <PatientSideComponentsBookAppointmentModal
      v-model="showBookModal"
      :doctor="selectedDoctorToBook"
      :diagnosis-uuid="selectedDiagnosisToBook"
      @booked="onAppointmentBooked"
    />

    <!-- Patient Reschedule Modal -->
    <PatientSideComponentsRescheduleModal
      v-if="rescheduleModalAppt"
      :appointment="rescheduleModalAppt"
      :inline="false"
      @close="rescheduleModalAppt = null"
      @requested="fetchAppointments"
    />

    <!-- Cancel Confirmation Modal -->
    <AppModalConfirmation
      v-if="showCancelModal"
      v-model="showCancelModal"
      title="Cancel Consultation?"
      description="Are you sure you want to cancel this appointment request? Your scheduled slot will be released back to the clinic."
      confirm-text="Yes, Cancel Appointment"
      cancel-text="Keep Appointment"
      confirm-variant="destructive"
      icon="material-symbols:cancel-rounded"
      icon-color="danger"
      :loading="isCancelling"
      @confirm="confirmCancel"
      @cancel="showCancelModal = false"
    />
  </div>
</template>
