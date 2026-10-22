import { appointmentService } from '~/api/appointment/AppointmentService'

export interface Appointment {
  id: string
  date: string // YYYY-MM-DD
  time: string
  raw_scheduled_at?: string
  raw_scheduled_end_at?: string
  previous_scheduled_at?: string
  previous_scheduled_end_at?: string
  doctor: string
  doctor_id: number
  doctor_uuid?: string
  patient_id: number
  info: string
  diagnosis_image?: string
  diagnosis_id?: number
  diagnosis_uuid?: string
  diagnosis?: any
  in_clinic_diagnosis_id?: number | null
  in_clinic_diagnosis?: any
  scan_exception_reason?: string | null
  scan_exception_category?: string | null
  scan_exception_granted_at?: string | null
  scan_exception_doctor?: any
  has_satisfied_consultation_scan?: boolean
  location?: string
  purpose?: string
  status: string
  requested_reschedule_date?: string
  requested_reschedule_time?: string
  conversation_uuid?: string
  completed_at?: string
  confirmed_at?: string
  accepted_by?: any
  cancelled_at?: string
  cancelled_by?: any
  cancellation_reason?: string
  no_show_at?: string
  no_show_by?: any
  no_show_reason?: string
  checked_in_at?: string
  consultation_started_at?: string
  is_awaiting_attendance_review?: boolean
  active_reschedule_proposal?: any
  reschedule_proposals?: any[]
  events?: any[]
}

export const parseAppointmentDateTime = (
  dateTimeStr: string
): { date: string; time: string; startH: string; startM: string } => {
  if (!dateTimeStr) return { date: '', time: '', startH: '00', startM: '00' }
  const match = dateTimeStr.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/)
  if (match) {
    const date = match[1]
    const startH = match[2]
    const startM = match[3]
    const hNum = parseInt(startH, 10)
    const ampm = hNum >= 12 ? 'PM' : 'AM'
    const h12 = hNum % 12 || 12
    return {
      date,
      time: `${h12}:${startM} ${ampm}`,
      startH,
      startM
    }
  }
  const d = new Date(dateTimeStr)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const startH = String(d.getHours()).padStart(2, '0')
  const startM = String(d.getMinutes()).padStart(2, '0')
  return {
    date: `${year}-${month}-${day}`,
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    startH,
    startM
  }
}

// Global shared polling state for appointments
let appointmentPollingTimer: any = null
let isAppointmentListenerBound = false
let activeAppointmentFetch: Promise<void> | null = null

export const useAppointments = () => {
  const { calculateAge } = useFormSanitizer()
  const userUuid = useCookie('user_uuid')
  const userRole = useCookie('user_role')

  // Use a ref for the current user in this instance to detect changes
  const localUserUuid = ref(userUuid.value)

  const appointments = useState<Appointment[]>('shared_appointments_list', () => [])
  const pendingAppointments = useState<Appointment[]>('shared_pending_appointments_list', () => [])
  const declinedAppointments = useState<Appointment[]>(
    'shared_declined_appointments_list',
    () => []
  )
  const completedAppointments = useState<Appointment[]>(
    'shared_completed_appointments_list',
    () => []
  )
  const noShowAppointments = useState<Appointment[]>('shared_no_show_appointments_list', () => [])
  const cancelledAppointments = useState<Appointment[]>(
    'shared_cancelled_appointments_list',
    () => []
  )
  const selectedDate = useState<string | null>('appointments_selected_date', () => {
    return new Date().toISOString().split('T')[0]
  })
  const pending = ref(false)

  const mapPerson = (appt: any) => {
    const doctorName = appt.doctor
      ? `Dr. ${appt.doctor.first_name} ${appt.doctor.last_name}`
      : 'Unknown Doctor'
    const patientName = appt.patient
      ? `${appt.patient.first_name} ${appt.patient.last_name}`
      : 'Unknown Patient'
    const currentRole = (userRole.value || useCookie('user_role').value || '')
      ?.toString()
      .toLowerCase()
    return currentRole === 'doctor' || currentRole === 'secretary' ? patientName : doctorName
  }

  const mapAppt = (appt: any) => {
    let date = ''
    let time = ''
    if (appt.scheduled_at) {
      const p = parseAppointmentDateTime(appt.scheduled_at)
      date = p.date
      time = p.time
    }

    const isAwaitingAttendanceReview = (() => {
      const st = appt.status
      if (st !== 'confirmed' && st !== 'scheduled') return false
      if (appt.checked_in_at) return false
      if (!appt.scheduled_at) return false
      const apptStartMs = new Date(appt.scheduled_at).getTime()
      if (isNaN(apptStartMs)) return false
      const graceMs = 15 * 60 * 1000 // 15 mins default
      return Date.now() >= apptStartMs + graceMs
    })()

    return {
      id: appt.uuid,
      uuid: appt.uuid,
      date,
      time,
      raw_scheduled_at: appt.scheduled_at,
      raw_scheduled_end_at: appt.scheduled_end_at,
      previous_scheduled_at: appt.previous_scheduled_at,
      previous_scheduled_end_at: appt.previous_scheduled_end_at,
      doctor: mapPerson(appt),
      doctor_id: appt.doctor_id,
      doctor_uuid: appt.doctor?.uuid,
      patient_id: appt.patient_id,
      patient_uuid: appt.patient?.uuid,
      patient: appt.patient,
      patient_age: calculateAge(appt.patient?.date_of_birth) ?? appt.patient?.age,
      patient_gender: appt.patient?.gender,
      created_at: appt.created_at,
      info: appt.diagnosis?.label || appt.clinical_note?.diagnosis?.label || 'General Appointment',
      diagnosis_id: appt.diagnosis_id || appt.diagnosis?.id,
      diagnosis_uuid: appt.diagnosis?.uuid,
      diagnosis: appt.diagnosis,
      diagnosis_image: appt.diagnosis?.image_path || appt.clinical_note?.diagnosis?.image_path,
      in_clinic_diagnosis_id:
        appt.in_clinic_diagnosis_id ||
        appt.in_clinic_diagnosis?.id ||
        appt.inClinicDiagnosis?.id ||
        null,
      in_clinic_diagnosis: appt.in_clinic_diagnosis || appt.inClinicDiagnosis || null,
      scan_exception_reason: appt.scan_exception_reason || null,
      scan_exception_category: appt.scan_exception_category || null,
      scan_exception_granted_at: appt.scan_exception_granted_at || null,
      scan_exception_doctor: appt.scan_exception_doctor || appt.scanExceptionDoctor || null,
      has_satisfied_consultation_scan: !!(
        appt.in_clinic_diagnosis_id ||
        appt.in_clinic_diagnosis ||
        appt.inClinicDiagnosis ||
        appt.scan_exception_reason
      ),
      location: appt.clinic?.name || appt.location || 'Cruz Skin Clinic',
      clinic_name: appt.clinic?.name || appt.location || 'Cruz Skin Clinic',
      purpose: appt.purpose || 'Consultation',
      status: appt.status,
      requested_reschedule_date: appt.requested_reschedule_date,
      requested_reschedule_time: appt.requested_reschedule_time,
      conversation_uuid: appt.conversation_uuid,
      completed_at: appt.completed_at || appt.updated_at,
      confirmed_at: appt.confirmed_at,
      accepted_by: appt.accepted_by || appt.acceptedBy,
      cancelled_at: appt.cancelled_at,
      cancelled_by: appt.cancelled_by || appt.cancelledBy,
      cancellation_reason: appt.cancellation_reason,
      no_show_at: appt.no_show_at,
      no_show_by: appt.no_show_by || appt.noShowBy,
      no_show_reason: appt.no_show_reason,
      checked_in_at: appt.checked_in_at,
      consultation_started_at: appt.consultation_started_at,
      is_awaiting_attendance_review: isAwaitingAttendanceReview,
      active_reschedule_proposal: appt.active_reschedule_proposal || appt.activeRescheduleProposal,
      reschedule_proposals: appt.reschedule_proposals || appt.rescheduleProposals || [],
      events: appt.events || []
    }
  }

  const fetchAppointments = async () => {
    if (!userUuid.value) {
      appointments.value = []
      pendingAppointments.value = []
      declinedAppointments.value = []
      completedAppointments.value = []
      noShowAppointments.value = []
      cancelledAppointments.value = []
      selectedDate.value = new Date().toISOString().split('T')[0]
      return
    }

    // Reuse in-flight request if already pending
    if (activeAppointmentFetch) return activeAppointmentFetch

    pending.value = true
    activeAppointmentFetch = (async () => {
      try {
        const res = await appointmentService.list()
        if (res) {
          appointments.value = res
            .filter(
              (appt: any) =>
                appt.status === 'confirmed' ||
                appt.status === 'scheduled' ||
                appt.status === 'checked_in' ||
                appt.status === 'in_consultation' ||
                appt.status === 'reschedule_proposed' ||
                appt.status === 'reschedule_requested'
            )
            .map(mapAppt)

          pendingAppointments.value = res
            .filter((appt: any) => appt.status === 'pending')
            .map(mapAppt)

          declinedAppointments.value = res
            .filter((appt: any) => appt.status === 'declined' || appt.status === 'rejected')
            .map(mapAppt)

          completedAppointments.value = res
            .filter((appt: any) => appt.status === 'completed')
            .map(mapAppt)

          noShowAppointments.value = res
            .filter((appt: any) => appt.status === 'no_show')
            .map(mapAppt)

          cancelledAppointments.value = res
            .filter((appt: any) => appt.status === 'cancelled')
            .map(mapAppt)
        }
      } catch (e) {
        console.error(e)
      } finally {
        pending.value = false
        activeAppointmentFetch = null
      }
    })()

    return activeAppointmentFetch
  }

  const fetchAppointmentsForDoctor = async (
    doctorIdOrUuid: string | number
  ): Promise<Appointment[]> => {
    if (!doctorIdOrUuid) return []
    try {
      const param =
        typeof doctorIdOrUuid === 'number' || !isNaN(Number(doctorIdOrUuid))
          ? { doctor_id: doctorIdOrUuid }
          : { doctor_uuid: doctorIdOrUuid }
      const res = await appointmentService.list(param)
      if (Array.isArray(res)) {
        return res
          .filter(
            (appt: any) =>
              appt.status === 'confirmed' ||
              appt.status === 'scheduled' ||
              appt.status === 'checked_in' ||
              appt.status === 'in_consultation' ||
              appt.status === 'reschedule_proposed' ||
              appt.status === 'reschedule_requested'
          )
          .map(mapAppt)
      }
    } catch (e) {
      console.error('Failed to fetch appointments for doctor:', e)
    }
    return []
  }

  const isApptTimeConflicting = (
    dateStr: string,
    startTimeStr: string,
    endTimeStr?: string,
    excludeUuid?: string,
    apptsList?: Appointment[]
  ): boolean => {
    if (!dateStr || !startTimeStr) return false

    // Parse start datetime ms
    const targetStartMs = new Date(`${dateStr}T${startTimeStr}:00`).getTime()
    let targetEndMs = endTimeStr
      ? new Date(`${dateStr}T${endTimeStr}:00`).getTime()
      : targetStartMs + 3600000

    if (isNaN(targetStartMs) || isNaN(targetEndMs)) return false

    const list = apptsList || appointments.value

    return list.some(appt => {
      if (excludeUuid && appt.id === excludeUuid) return false
      if (!appt.raw_scheduled_at && !appt.scheduled_at) return false

      const pStart = parseAppointmentDateTime(appt.raw_scheduled_at || appt.scheduled_at)
      if (pStart.date !== dateStr) return false

      const apptStartMs = new Date(`${pStart.date}T${pStart.startH}:${pStart.startM}:00`).getTime()
      let apptEndMs = apptStartMs + 3600000
      const rawEnd = appt.raw_scheduled_end_at || appt.scheduled_end_at
      if (rawEnd) {
        const pEnd = parseAppointmentDateTime(rawEnd)
        apptEndMs = new Date(`${pEnd.date}T${pEnd.startH}:${pEnd.startM}:00`).getTime()
      }

      if (isNaN(apptStartMs) || isNaN(apptEndMs)) return false

      // Overlap condition: targetStart < apptEnd AND targetEnd > apptStart
      return targetStartMs < apptEndMs && targetEndMs > apptStartMs
    })
  }

  // Clear and refetch if user changed since last call
  if (localUserUuid.value !== userUuid.value) {
    appointments.value = []
    pendingAppointments.value = []
    declinedAppointments.value = []
    completedAppointments.value = []
    noShowAppointments.value = []
    cancelledAppointments.value = []
    selectedDate.value = new Date().toISOString().split('T')[0]
    localUserUuid.value = userUuid.value
    fetchAppointments()
  }

  // Watch for user changes globally
  watch(
    () => userUuid.value,
    (newUuid, oldUuid) => {
      if (newUuid !== oldUuid) {
        appointments.value = []
        pendingAppointments.value = []
        declinedAppointments.value = []
        completedAppointments.value = []
        noShowAppointments.value = []
        cancelledAppointments.value = []
        selectedDate.value = new Date().toISOString().split('T')[0]
        if (newUuid) fetchAppointments()
      }
    }
  )

  // Singleton Listener: Reverb WebSockets instead of polling
  if (import.meta.client) {
    if (!isAppointmentListenerBound && typeof document !== 'undefined') {
      isAppointmentListenerBound = true
      fetchAppointments()

      const { getEcho } = useEcho()
      if (userUuid.value) {
        const echo = getEcho()
        if (echo) {
          echo.private(`user.${userUuid.value}`).listen('.AppointmentUpdated', () => {
            fetchAppointments()
          })
        }
      }

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && userUuid.value) {
          fetchAppointments()
        }
      })
    }
  }

  const rescheduleRequests = computed(() =>
    appointments.value.filter(
      appt => appt.status === 'reschedule_requested' || appt.status === 'reschedule_proposed'
    )
  )

  const rescheduleRequestsCount = computed(() => rescheduleRequests.value.length)

  const todayStr = computed(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })

  const todayAppointments = computed(() =>
    appointments.value.filter(appt => {
      const p = parseAppointmentDateTime(appt.raw_scheduled_at || appt.scheduled_at || appt.date)
      return p.date === todayStr.value
    })
  )

  const todayAppointmentsCount = computed(() => todayAppointments.value.length)

  return {
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
    selectedDate,
    pending,
    fetchAppointments,
    fetchAppointmentsForDoctor,
    isApptTimeConflicting
  }
}
