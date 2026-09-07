import { appointmentService } from '~/api/appointment/AppointmentService'

export interface Appointment {
  id: string
  date: string // YYYY-MM-DD
  time: string
  raw_scheduled_at?: string
  raw_scheduled_end_at?: string
  doctor: string
  doctor_id: number
  doctor_uuid?: string
  patient_id: number
  info: string
  diagnosis_image?: string
  location?: string
  purpose?: string
  status: string
  conversation_uuid?: string
  completed_at?: string
}

export const parseAppointmentDateTime = (dateTimeStr: string): { date: string; time: string; startH: string; startM: string } => {
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
      startM,
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
    startM,
  }
}

// Global shared polling state for appointments
let appointmentPollingTimer: any = null
let isAppointmentListenerBound = false
let activeAppointmentFetch: Promise<void> | null = null

export const useAppointments = () => {
  const userUuid = useCookie('user_uuid')
  const userRole = useCookie('user_role')
  
  // Use a ref for the current user in this instance to detect changes
  const localUserUuid = ref(userUuid.value)

  const appointments = useState<Appointment[]>('shared_appointments_list', () => [])
  const pendingAppointments = useState<Appointment[]>('shared_pending_appointments_list', () => [])
  const declinedAppointments = useState<{ id: string; doctor: string; info: string; conversation_uuid?: string }[]>('shared_declined_appointments_list', () => [])
  const completedAppointments = useState<Appointment[]>('shared_completed_appointments_list', () => [])
  const selectedDate = useState<string | null>('appointments_selected_date', () => {
    return new Date().toISOString().split('T')[0]
  })
  const pending = ref(false)

  const mapPerson = (appt: any) => {
    const doctorName = appt.doctor ? `Dr. ${appt.doctor.first_name} ${appt.doctor.last_name}` : 'Unknown Doctor'
    const patientName = appt.patient ? `${appt.patient.first_name} ${appt.patient.last_name}` : 'Unknown Patient'
    const currentRole = (userRole.value || useCookie('user_role').value || '')?.toString().toLowerCase()
    return currentRole === 'doctor' ? patientName : doctorName
  }

  const mapAppt = (appt: any) => {
    let date = ''
    let time = ''
    if (appt.scheduled_at) {
      const p = parseAppointmentDateTime(appt.scheduled_at)
      date = p.date
      time = p.time
    }
    return {
      id: appt.uuid,
      date,
      time,
      raw_scheduled_at: appt.scheduled_at,
      raw_scheduled_end_at: appt.scheduled_end_at,
      doctor: mapPerson(appt),
      doctor_id: appt.doctor_id,
      doctor_uuid: appt.doctor?.uuid,
      patient_id: appt.patient_id,
      patient_uuid: appt.patient?.uuid,
      patient: appt.patient,
      created_at: appt.created_at,
      info: appt.diagnosis?.label || appt.clinical_note?.diagnosis?.label || 'General Appointment',
      diagnosis_image: appt.diagnosis?.image_path || appt.clinical_note?.diagnosis?.image_path,
      location: appt.location,
      purpose: appt.purpose,
      status: appt.status,
      conversation_uuid: appt.conversation_uuid,
      completed_at: appt.completed_at || appt.updated_at
    }
  }

  const fetchAppointments = async () => {
    if (!userUuid.value) {
      appointments.value = []
      pendingAppointments.value = []
      declinedAppointments.value = []
      completedAppointments.value = []
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
            .filter((appt: any) => (appt.status === 'scheduled' || appt.status === 'reschedule_proposed' || appt.status === 'reschedule_requested') && appt.scheduled_at)
            .map(mapAppt)

          pendingAppointments.value = res
            .filter((appt: any) => appt.status === 'pending')
            .map(mapAppt)

          declinedAppointments.value = res
            .filter((appt: any) => appt.status === 'declined')
            .map((appt: any) => ({
              id: appt.uuid,
              doctor: mapPerson(appt),
              info: appt.diagnosis?.label || appt.clinical_note?.diagnosis?.label || 'General Appointment',
              conversation_uuid: appt.conversation_uuid
            }))

          completedAppointments.value = res
            .filter((appt: any) => appt.status === 'completed')
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

  const fetchAppointmentsForDoctor = async (doctorIdOrUuid: string | number): Promise<Appointment[]> => {
    if (!doctorIdOrUuid) return []
    try {
      const param = typeof doctorIdOrUuid === 'number' || !isNaN(Number(doctorIdOrUuid))
        ? { doctor_id: doctorIdOrUuid }
        : { doctor_uuid: doctorIdOrUuid }
      const res = await appointmentService.list(param)
      if (Array.isArray(res)) {
        return res
          .filter((appt: any) => (appt.status === 'scheduled' || appt.status === 'reschedule_proposed' || appt.status === 'reschedule_requested') && appt.scheduled_at)
          .map(mapAppt)
      }
    } catch (e) {
      console.error('Failed to fetch appointments for doctor:', e)
    }
    return []
  }

  const isApptTimeConflicting = (dateStr: string, startTimeStr: string, endTimeStr?: string, excludeUuid?: string, apptsList?: Appointment[]): boolean => {
    if (!dateStr || !startTimeStr) return false

    // Parse start datetime ms
    const targetStartMs = new Date(`${dateStr}T${startTimeStr}:00`).getTime()
    let targetEndMs = endTimeStr ? new Date(`${dateStr}T${endTimeStr}:00`).getTime() : targetStartMs + 3600000

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
    selectedDate.value = new Date().toISOString().split('T')[0]
    localUserUuid.value = userUuid.value
    fetchAppointments()
  }

  // Watch for user changes globally
  watch(() => userUuid.value, (newUuid, oldUuid) => {
    if (newUuid !== oldUuid) {
      appointments.value = []
      pendingAppointments.value = []
      declinedAppointments.value = []
      completedAppointments.value = []
      selectedDate.value = new Date().toISOString().split('T')[0]
      if (newUuid) fetchAppointments()
    }
  })

  // Singleton Polling: Starts only ONE global interval regardless of how many components call useAppointments()
  if (import.meta.client) {
    if (!appointmentPollingTimer) {
      fetchAppointments()
      appointmentPollingTimer = setInterval(() => {
        // Only poll if tab is visible and user is logged in
        if (document.visibilityState === 'visible' && userUuid.value) {
          fetchAppointments()
        }
      }, 10000)
    }

    if (!isAppointmentListenerBound && typeof document !== 'undefined') {
      isAppointmentListenerBound = true
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && userUuid.value) {
          fetchAppointments()
        }
      })
    }
  }

  return {
    appointments,
    pendingAppointments,
    declinedAppointments,
    completedAppointments,
    selectedDate,
    pending,
    fetchAppointments,
    fetchAppointmentsForDoctor,
    isApptTimeConflicting
  }
}
