import { computed } from 'vue'
import { useRoute, useCookie } from '#app'
import { appealService } from '~/api/appeal/AppealService'
import { userService } from '~/api/user/UserService'

export interface AppNotification {
  id: string | number
  title: string
  description: string
  time: string
  icon: string
  color: string
  to?: string
}

export const useAppNotifications = () => {
  const route = useRoute()
  const userRole = useCookie('user_role')
  const userUuid = useCookie('user_uuid')

  const { appointments, pendingAppointments, declinedAppointments, completedAppointments, fetchAppointments } = useAppointments()

  const dismissedNotifs = useCookie<(string | number)[]>(`dismissed_notifs_${userUuid.value}`, { default: () => [], maxAge: 60 * 60 * 24 * 365 })
  const readNotifs = useCookie<(string | number)[]>(`read_notifs_${userUuid.value}`, { default: () => [], maxAge: 60 * 60 * 24 * 365 })

  const { data: userProfile, refresh: refreshProfile } = userService.useShow(() => userUuid.value as string, {
    key: `userProfile-${userUuid.value}`
  })

  const { data: appealsData, refresh: refreshAppeals } = appealService.useList({}, {
    immediate: userRole.value === 'admin',
    key: 'admin-appeals'
  })

  const isPatientProfileIncomplete = computed(() => {
    if (!userProfile.value || userRole.value !== 'patient') return false
    const u = userProfile.value
    return !u.city || !u.province || !u.age || u.age == 0 || !u.gender || u.gender === ''
  })

  const isDoctorProfileIncomplete = computed(() => {
    if (!userProfile.value || userRole.value !== 'doctor') return false
    const u = userProfile.value
    return !u.city || !u.province || !u.age || u.age == 0 || !u.gender || u.gender === '' || !u.affiliation || !u.prc_number
  })

  const profileRoute = computed(() => {
    if (userRole.value === 'doctor') return '/doctor/profile'
    if (userRole.value === 'patient') return '/patient/profile'
    if (userRole.value === 'admin') return '/admin'
    return '#'
  })

  const formatRelativeTime = (isoString: string): string => {
    if (!isoString) return ''
    const now = new Date()
    const date = new Date(isoString)
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSeconds < 60) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const hoursUntilAppointment = (dateStr: string): number => {
    const apptDate = new Date(dateStr)
    const now = new Date()
    return (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60)
  }

  const hoursSinceAppointment = (dateStr: string): number => {
    const apptDate = new Date(dateStr)
    const now = new Date()
    return (now.getTime() - apptDate.getTime()) / (1000 * 60 * 60)
  }

  const baseNotifications = computed<AppNotification[]>(() => {
    const list: AppNotification[] = []

    if (isPatientProfileIncomplete.value) {
      list.push({
        id: 'profile-incomplete-patient',
        title: 'Complete Your Profile',
        description: 'Add your location, age, and gender so doctors can better assist you.',
        time: 'Action needed',
        icon: 'solar:user-id-linear',
        color: 'text-red-500',
        to: profileRoute.value
      })
    }

    if (isDoctorProfileIncomplete.value) {
      list.push({
        id: 'profile-incomplete-doctor',
        title: 'Complete Your Doctor Profile',
        description: 'Your profile is missing required fields (location, age, gender, affiliation, or PRC number). Complete it to appear in patient searches.',
        time: 'Action needed',
        icon: 'solar:user-id-linear',
        color: 'text-red-500',
        to: profileRoute.value
      })
    }

    if (userRole.value === 'doctor' && userProfile.value?.doctor_verification?.status === 'verified') {
      const verif = userProfile.value.doctor_verification
      list.push({
        id: `approved-${verif.uuid}-${verif.updated_at}`,
        title: 'Verification Approved',
        description: 'Your doctor profile has been officially verified!',
        time: 'Verified',
        icon: 'heroicons:shield-check-solid',
        color: 'text-green-500',
        to: profileRoute.value
      })
    }

    if (userRole.value === 'doctor' && userProfile.value?.doctor_verification?.status === 'declined') {
      const verif = userProfile.value.doctor_verification
      const reason = verif.rejection_reason
      list.push({
        id: `declined-${verif.uuid}-${verif.updated_at}`,
        title: 'Verification Declined',
        description: reason ? `Reason: ${reason}` : 'Your doctor profile verification was declined. Please review your submission.',
        time: 'Action needed',
        icon: 'heroicons:x-circle-solid',
        color: 'text-red-500',
        to: profileRoute.value
      })
    }

    if (userRole.value === 'doctor' && pendingAppointments.value.length > 0) {
      pendingAppointments.value.forEach((appt) => {
        list.push({
          id: `doctor-appt-request-${appt.id}`,
          title: 'New Appointment Request',
          description: `${appt.doctor} has sent an appointment request for ${appt.info}.`,
          time: 'Pending',
          icon: 'material-symbols:calendar-add-on-rounded',
          color: 'text-indigo-500',
          to: appt.conversation_uuid ? `/Doctor/Messages/${appt.conversation_uuid}` : '/Doctor/Messages'
        })
      })
    }

    if (userRole.value === 'doctor' && appointments.value.length > 0) {
      appointments.value.forEach((appt) => {
        if (!appt.date) return
        const apptDateTime = appt.date + (appt.time ? `T${appt.time}` : 'T00:00:00')
        const hoursUntil = hoursUntilAppointment(apptDateTime)
        if (hoursUntil >= 0 && hoursUntil <= 24) {
          list.push({
            id: `doctor-appt-upcoming-${appt.id}`,
            title: 'Upcoming Appointment Tomorrow',
            description: `You have an appointment with ${appt.doctor} for ${appt.info} on ${appt.date} at ${appt.time}${appt.location ? ' at ' + appt.location : ''}.`,
            time: `In ${Math.round(hoursUntil)}h`,
            icon: 'material-symbols:alarm-on-rounded',
            color: 'text-amber-500',
            to: appt.conversation_uuid ? `/Doctor/Messages/${appt.conversation_uuid}` : '/Doctor/Messages'
          })
        }
      })
    }

    if (userRole.value === 'doctor' && appointments.value.length > 0) {
      appointments.value.forEach((appt) => {
        if (!appt.date) return
        const apptDateTime = appt.date + (appt.time ? `T${appt.time}` : 'T00:00:00')
        const hoursSince = hoursSinceAppointment(apptDateTime)
        if (hoursSince >= 24) {
          list.push({
            id: `doctor-appt-overdue-${appt.id}`,
            title: 'Appointment Needs Review',
            description: `Your appointment with ${appt.doctor} for ${appt.info} on ${appt.date} has passed. Did it go well? Please mark it as completed.`,
            time: 'Overdue',
            icon: 'material-symbols:assignment-late-rounded',
            color: 'text-orange-500',
            to: appt.conversation_uuid ? `/Doctor/Messages/${appt.conversation_uuid}` : '/Doctor/Messages'
          })
        }
      })
    }

    if (userRole.value === 'patient' && appointments.value.length > 0) {
      appointments.value.forEach((appt) => {
        const purposeText = appt.purpose ? ` Purpose: ${appt.purpose}.` : ''
        list.push({
          id: `appt-scheduled-${appt.id}`,
          title: 'Appointment Confirmed!',
          description: `${appt.doctor} confirmed your appointment on ${appt.date} at ${appt.time}${appt.location ? ' — ' + appt.location : ''}.${purposeText}`,
          time: appt.date || 'Upcoming',
          icon: 'material-symbols:calendar-month-rounded',
          color: 'text-indigo-500',
          to: appt.conversation_uuid ? `/Patient/Messages/${appt.conversation_uuid}` : '/Patient/Messages'
        })
      })
    }

    if (userRole.value === 'patient' && appointments.value.length > 0) {
      appointments.value.forEach((appt) => {
        if (!appt.date) return
        const apptDateTime = appt.date + (appt.time ? `T${appt.time}` : 'T00:00:00')
        const hoursUntil = hoursUntilAppointment(apptDateTime)
        if (hoursUntil >= 0 && hoursUntil <= 24) {
          list.push({
            id: `patient-appt-upcoming-${appt.id}`,
            title: 'Appointment Tomorrow!',
            description: `Don't forget — your appointment with ${appt.doctor} for ${appt.info} is tomorrow at ${appt.time}${appt.location ? ' at ' + appt.location : ''}.`,
            time: `In ${Math.round(hoursUntil)}h`,
            icon: 'material-symbols:alarm-on-rounded',
            color: 'text-amber-500',
            to: appt.conversation_uuid ? `/Patient/Messages/${appt.conversation_uuid}` : '/Patient/Messages'
          })
        }
      })
    }

    if (userRole.value === 'patient' && declinedAppointments.value.length > 0) {
      declinedAppointments.value.forEach((appt) => {
        list.push({
          id: `appt-declined-${appt.id}`,
          title: 'Appointment Declined',
          description: `Your ${appt.info} appointment request was declined. You can send a new referral or message the doctor.`,
          time: 'Recently',
          icon: 'material-symbols:cancel-rounded',
          color: 'text-red-500',
          to: appt.conversation_uuid ? `/Patient/Messages/${appt.conversation_uuid}` : '/Patient/Messages'
        })
      })
    }

    if (userRole.value === 'patient' && completedAppointments.value.length > 0) {
      completedAppointments.value.forEach((appt) => {
        list.push({
          id: `appt-completed-${appt.id}-${appt.completed_at || appt.date}`,
          title: 'Appointment Completed',
          description: `${appt.doctor} marked your ${appt.info} appointment as completed. Your visit summary is now in your records.`,
          time: appt.completed_at ? formatRelativeTime(appt.completed_at) : 'Completed',
          icon: 'material-symbols:check-circle-rounded',
          color: 'text-green-500',
          to: appt.conversation_uuid ? `/Patient/Messages/${appt.conversation_uuid}` : '/Patient/Messages'
        })
      })
    }

    if (userRole.value === 'admin' && appealsData.value?.data) {
      appealsData.value.data.forEach((appeal: any) => {
        list.push({
          id: `appeal-${appeal.uuid}`,
          title: 'New Medical Appeal',
          description: `Dr. ${appeal.user.last_name} suggested "${appeal.suggested_label}" instead of "${appeal.diagnosis_label}". Reason: ${appeal.description}`,
          time: 'New',
          icon: 'material-symbols:report-outline',
          color: 'text-red-500',
          to: '/admin/moderation/verification'
        })
      })
    }
    
    return list
  })
  
  const notifications = computed(() => {
    const arr = dismissedNotifs.value || []
    return baseNotifications.value.filter(n => !arr.includes(n.id))
  })
  
  const unreadNotifications = computed(() => {
    const read = readNotifs.value || []
    return notifications.value.filter(n => !read.includes(n.id))
  })

  return {
    baseNotifications,
    notifications,
    unreadNotifications,
    dismissedNotifs,
    readNotifs,
    userProfile,
    refreshProfile,
    refreshAppeals,
    fetchAppointments,
    isPatientProfileIncomplete,
    isDoctorProfileIncomplete,
    profileRoute
  }
}
