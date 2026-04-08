export interface Appointment {
  id: number
  date: string // YYYY-MM-DD
  time: string
  doctor: string
  info: string
}

export const useAppointments = () => {
  const appointments = useState<Appointment[]>('patient_appointments', () => [
    {
      id: 1,
      date: '2026-04-10',
      time: '10:00 AM',
      doctor: 'Dr. Sarah Johnson',
      info: 'Eczema Follow-up'
    },
    {
      id: 2,
      date: '2026-04-15',
      time: '02:30 PM',
      doctor: 'Dr. Michael Chen',
      info: 'Acne Consultation'
    },
    {
      id: 3,
      date: '2026-04-10', // Same day as id:1
      time: '11:30 AM',
      doctor: 'Dr. Sarah Johnson',
      info: 'Follow-up'
    },
    {
      id: 4,
      date: '2026-04-22',
      time: '11:15 AM',
      doctor: 'Dr. Aisha Khan',
      info: 'Skin Graft Review'
    },
    {
      id: 4,
      date: '2026-05-5',
      time: '09:00 AM',
      doctor: 'Dr. Robert Brown',
      info: 'Minor Surgery'
    }
  ])

  return {
    appointments
  }
}
