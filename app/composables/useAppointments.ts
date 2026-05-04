import { appointmentService } from '~/api/appointment/AppointmentService'

export interface Appointment {
  id: string
  date: string // YYYY-MM-DD
  time: string
  doctor: string
  doctor_id: number
  doctor_uuid?: string
  patient_id: number
  info: string
  diagnosis_image?: string
  location?: string
  status: string
}

export const useAppointments = () => {
  const userUuid = useCookie('user_uuid')
  
  // Use a ref for the current user in this instance to detect changes
  const localUserUuid = ref(userUuid.value)

  const appointments = useState<Appointment[]>('shared_appointments_list', () => [])
  const pendingAppointments = useState<Appointment[]>('shared_pending_appointments_list', () => [])
  const declinedAppointments = useState<{ id: string; doctor: string; info: string }[]>('shared_declined_appointments_list', () => [])
  const selectedDate = useState<string | null>('appointments_selected_date', () => null)
  const pending = ref(false)

  const fetchAppointments = async () => {
    if (!userUuid.value) {
      appointments.value = []
      pendingAppointments.value = []
      declinedAppointments.value = []
      selectedDate.value = null
      return
    }
    
    if (pending.value) return
    pending.value = true
    try {
      const res = await appointmentService.list()
      if (res) {
        const role = useCookie('user_role').value

        const mapPerson = (appt: any) => {
          const doctorName = appt.doctor ? `Dr. ${appt.doctor.first_name} ${appt.doctor.last_name}` : 'Unknown Doctor'
          const patientName = appt.patient ? `${appt.patient.first_name} ${appt.patient.last_name}` : 'Unknown Patient'
          return role === 'doctor' ? patientName : doctorName
        }

        const mapAppt = (appt: any) => {
          let date = ''
          let time = ''
          if (appt.scheduled_at) {
            const dateObj = new Date(appt.scheduled_at)
            date = dateObj.toISOString().split('T')[0]
            time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
          return {
            id: appt.uuid,
            date,
            time,
            doctor: mapPerson(appt),
            doctor_id: appt.doctor_id,
            doctor_uuid: appt.doctor?.uuid,
            patient_id: appt.patient_id,
            info: appt.diagnosis?.label || 'General Appointment',
            diagnosis_image: appt.diagnosis?.image_path,
            location: appt.location,
            status: appt.status,
            conversation_uuid: appt.conversation_uuid
          }
        }

        appointments.value = res
          .filter((appt: any) => appt.status === 'scheduled' && appt.scheduled_at)
          .map(mapAppt)

        pendingAppointments.value = res
          .filter((appt: any) => appt.status === 'pending')
          .map(mapAppt)

        declinedAppointments.value = res
          .filter((appt: any) => appt.status === 'declined')
          .map((appt: any) => ({
            id: appt.uuid,
            doctor: mapPerson(appt),
            info: appt.diagnosis?.label || 'General Appointment',
            conversation_uuid: appt.conversation_uuid
          }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      pending.value = false
    }
  }

  // Clear and refetch if user changed since last call
  if (localUserUuid.value !== userUuid.value) {
    appointments.value = []
    pendingAppointments.value = []
    declinedAppointments.value = []
    selectedDate.value = null
    localUserUuid.value = userUuid.value
    fetchAppointments()
  }

  // Watch for user changes globally
  watch(() => userUuid.value, (newUuid, oldUuid) => {
    if (newUuid !== oldUuid) {
      appointments.value = []
      pendingAppointments.value = []
      declinedAppointments.value = []
      selectedDate.value = null
      if (newUuid) fetchAppointments()
    }
  })

  // Fetch immediately and poll every 10 seconds for reactivity
  let polling: any = null
  if (import.meta.client) {
    fetchAppointments()
    polling = setInterval(fetchAppointments, 10000)
    onUnmounted(() => {
      if (polling) clearInterval(polling)
    })
  }

  return {
    appointments,
    pendingAppointments,
    declinedAppointments,
    selectedDate,
    pending,
    fetchAppointments
  }
}
