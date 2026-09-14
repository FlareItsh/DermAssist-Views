import { computed, watch, ref } from 'vue'
import { useRoute, useCookie } from '#app'
import { appealService } from '~/api/appeal/AppealService'
import { userService } from '~/api/user/UserService'
import { verificationService } from '~/api/verification/VerificationService'
import { subscriptionAdminService } from '~/api/subscription/SubscriptionAdminService'
import { doctorSecretaryService } from '~/api/doctorSecretary/DoctorSecretaryService'
import { recordService, type RecordItem } from '~/api/record/RecordService'
import { useDoctorSubscription } from '~/composables/useDoctorSubscription'
import { useConversations } from '~/composables/useConversations'

export interface AppNotification {
  id: string | number
  type?:
    | 'clinic_invitation'
    | 'clinic_revocation'
    | 'clinic_team'
    | 'appointment'
    | 'profile'
    | 'verification'
    | 'subscription'
    | 'message'
    | 'admin'
    | 'records'
    | 'general'
  title: string
  description: string
  time: string
  icon: string
  color: string
  to?: string
  data?: any
}

// Module-level singleton polling state for notifications
let notificationPollingTimer: any = null
let isNotificationListenerBound = false
let isPollingActive = false

export const useAppNotifications = () => {
  const route = useRoute()
  const userRole = useCookie('user_role')
  const userUuid = useCookie('user_uuid')

  const {
    appointments,
    pendingAppointments,
    declinedAppointments,
    completedAppointments,
    fetchAppointments
  } = useAppointments()

  const {
    clinicDoctors,
    seatUsage,
    isOwner,
    pendingInvitations,
    revokedMemberships,
    fetchClinicDoctors,
    fetchPendingInvitations,
    acknowledgeRevocation
  } = useDoctorClinicDoctors()

  const { currentSubscription, hasPlanUpdate, maxSecretaries, isSubscribed, fetchSubscription } =
    useDoctorSubscription()

  const { conversations, fetchConversations } = useConversations()

  const adminPendingVerifications = ref<number>(0)
  const adminPendingPayments = ref<number>(0)
  const doctorSecretaries = ref<any[]>([])
  const patientRecentRecords = ref<RecordItem[]>([])

  const dismissedNotifs = useCookie<(string | number)[]>(`dismissed_notifs_${userUuid.value}`, {
    default: () => [],
    maxAge: 60 * 60 * 24 * 365
  })
  const readNotifs = useCookie<(string | number)[]>(`read_notifs_${userUuid.value}`, {
    default: () => [],
    maxAge: 60 * 60 * 24 * 365
  })

  const { data: userProfile, refresh: refreshProfile } = userService.useShow(
    () => userUuid.value as string,
    {
      key: `userProfile-${userUuid.value}`
    }
  )

  const { data: appealsData, refresh: refreshAppeals } = appealService.useList(
    {},
    {
      immediate: userRole.value === 'admin',
      key: 'admin-appeals'
    }
  )

  const pollAllNotifications = async () => {
    if (isPollingActive || !userUuid.value) return
    isPollingActive = true
    try {
      const tasks: Promise<any>[] = []

      // 1. Appointments for doctors, secretaries, and patients
      tasks.push(fetchAppointments())

      // 2. Doctor specific: Clinic invitations, revocations, team, subscription, and secretaries
      const currentRole = (userRole.value || useCookie('user_role').value || '')
        ?.toString()
        .toLowerCase()
      if (currentRole === 'doctor') {
        tasks.push(fetchPendingInvitations())
        tasks.push(fetchClinicDoctors())
        tasks.push(fetchSubscription())
        tasks.push(
          doctorSecretaryService
            .list()
            .then(res => {
              doctorSecretaries.value = res?.data ?? (Array.isArray(res) ? res : [])
            })
            .catch(() => {})
        )
      }

      // 3. Patient specific: Medical consultation & diagnostic records
      if (currentRole === 'patient') {
        tasks.push(
          recordService
            .getRecords()
            .then(res => {
              patientRecentRecords.value = (res as any)?.data || (Array.isArray(res) ? res : [])
            })
            .catch(() => {})
        )
      }

      // 4. User profile verification changes
      tasks.push(refreshProfile())

      // 5. Conversations & unread messages for all roles
      tasks.push(fetchConversations())

      // 6. Admin appeals, verifications, and payments
      if (currentRole === 'admin') {
        tasks.push(refreshAppeals())
        tasks.push(
          verificationService
            .list({ status: 'pending' })
            .then(res => {
              adminPendingVerifications.value =
                res?.data?.total || res?.data?.data?.length || res?.data?.length || 0
            })
            .catch(() => {})
        )
        tasks.push(
          subscriptionAdminService
            .getPayments('pending')
            .then(res => {
              adminPendingPayments.value = res?.data?.data?.length || res?.data?.length || 0
            })
            .catch(() => {})
        )
      }

      await Promise.allSettled(tasks)
    } finally {
      isPollingActive = false
    }
  }

  // Singleton Polling: Runs an 8-second interval when browser tab is visible
  if (import.meta.client) {
    if (!notificationPollingTimer) {
      pollAllNotifications()
      notificationPollingTimer = setInterval(() => {
        if (document.visibilityState === 'visible' && userUuid.value) {
          pollAllNotifications()
        }
      }, 8000)
    }

    if (!isNotificationListenerBound && typeof document !== 'undefined') {
      isNotificationListenerBound = true
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && userUuid.value) {
          pollAllNotifications()
        }
      })
    }
  }

  // Watch for session changes
  watch(
    () => userUuid.value,
    newUuid => {
      if (newUuid) {
        pollAllNotifications()
      }
    }
  )

  const missingPatientFields = computed(() => {
    if (!userProfile.value || userRole.value !== 'patient') return []
    const u = userProfile.value
    const fields: string[] = []
    if (!u.city) fields.push('City')
    if (!u.province) fields.push('Province')
    if (!u.age || u.age == 0) fields.push('Age')
    if (!u.gender || u.gender === '') fields.push('Gender')
    return fields
  })

  const missingDoctorFields = computed(() => {
    if (!userProfile.value || userRole.value !== 'doctor') return []
    const u = userProfile.value
    const fields: string[] = []
    if (!u.city) fields.push('City')
    if (!u.province) fields.push('Province')
    if (!u.age || u.age == 0) fields.push('Age')
    if (!u.gender || u.gender === '') fields.push('Gender')
    if (!(u.prc_number || u.prcNumber)) fields.push('PRC Number')
    return fields
  })

  const missingSecretaryFields = computed(() => {
    if (!userProfile.value || userRole.value !== 'secretary') return []
    const u = userProfile.value
    const fields: string[] = []
    if (!u.city) fields.push('City')
    if (!u.province) fields.push('Province')
    if (!u.age || u.age == 0) fields.push('Age')
    if (!u.gender || u.gender === '') fields.push('Gender')
    return fields
  })

  const isPatientProfileIncomplete = computed(() => missingPatientFields.value.length > 0)
  const isDoctorProfileIncomplete = computed(() => missingDoctorFields.value.length > 0)
  const isSecretaryProfileIncomplete = computed(() => missingSecretaryFields.value.length > 0)

  const profileRoute = computed(() => {
    if (userRole.value === 'doctor') return '/doctor/profile'
    if (userRole.value === 'patient') return '/patient/profile'
    if (userRole.value === 'secretary') return '/secretary/profile'
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

    if (
      userRole.value === 'doctor' &&
      pendingInvitations.value &&
      pendingInvitations.value.length > 0
    ) {
      pendingInvitations.value.forEach(invite => {
        const roleLabel =
          (invite.role || 'associate').charAt(0).toUpperCase() +
          (invite.role || 'associate').slice(1)
        list.push({
          id: `clinic-invite-${invite.pivot_id}`,
          type: 'clinic_invitation',
          title: 'Clinic Seat Invitation',
          description: `Dr. ${invite.owner_first_name} ${invite.owner_last_name} invited you to join ${invite.clinic_name} as an ${roleLabel} doctor under their Clinic Group Plan.`,
          time: 'Action needed',
          icon: 'solar:user-plus-bold',
          color: 'text-primary',
          data: invite
        })
      })
    }

    if (
      userRole.value === 'doctor' &&
      revokedMemberships.value &&
      revokedMemberships.value.length > 0
    ) {
      revokedMemberships.value.forEach(rev => {
        list.push({
          id: `clinic-revoked-${rev.pivot_id}`,
          type: 'clinic_revocation',
          title: 'Clinic Seat Revoked',
          description: `Dr. ${rev.owner_first_name} ${rev.owner_last_name} has removed your associate doctor seat from ${rev.clinic_name}. You no longer have access to their Clinic Group Plan.`,
          time: rev.revoked_at ? formatRelativeTime(rev.revoked_at) : 'Recently',
          icon: 'solar:user-cross-bold',
          color: 'text-red-500',
          data: rev
        })
      })
    }

    if (isPatientProfileIncomplete.value) {
      list.push({
        id: 'profile-incomplete-patient',
        type: 'profile',
        title: 'Complete Your Profile',
        description: `Please add your missing profile information: ${missingPatientFields.value.join(', ')} so doctors can better assist you.`,
        time: 'Action needed',
        icon: 'solar:user-id-linear',
        color: 'text-red-500',
        to: profileRoute.value
      })
    }

    if (isDoctorProfileIncomplete.value) {
      list.push({
        id: 'profile-incomplete-doctor',
        type: 'profile',
        title: 'Complete Your Doctor Profile',
        description: `Your profile is missing required fields: ${missingDoctorFields.value.join(', ')}. Complete them to appear in patient searches.`,
        time: 'Action needed',
        icon: 'solar:user-id-linear',
        color: 'text-red-500',
        to: profileRoute.value
      })
    }

    if (isSecretaryProfileIncomplete.value) {
      list.push({
        id: 'profile-incomplete-secretary',
        type: 'profile',
        title: 'Complete Your Secretary Profile',
        description: `Your profile is missing required fields: ${missingSecretaryFields.value.join(', ')}. Complete them to manage clinic appointments effectively.`,
        time: 'Action needed',
        icon: 'solar:user-id-linear',
        color: 'text-red-500',
        to: profileRoute.value
      })
    }

    // Doctor Subscription & Plan Updates
    if (userRole.value === 'doctor' && hasPlanUpdate.value && currentSubscription.value) {
      list.push({
        id: `sub-plan-update-${currentSubscription.value.plan?.uuid || 'curr'}-${currentSubscription.value.latest_plan_version || 'new'}`,
        type: 'subscription',
        title: 'New Plan Features Available',
        description: `Your subscription plan (${currentSubscription.value.plan_snapshot?.name || currentSubscription.value.plan?.name || 'Plan'}) has received new features and quota updates! Upgrade or renew now to unlock the latest benefits.`,
        time: 'Update available',
        icon: 'solar:star-fall-minimalistic-bold',
        color: 'text-amber-500',
        to: '/doctor/subscription'
      })
    }

    if (userRole.value === 'doctor' && currentSubscription.value?.ends_at) {
      const endsAtDate = new Date(currentSubscription.value.ends_at)
      const now = new Date()
      const diffDays = Math.ceil((endsAtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const planTitle =
        currentSubscription.value.plan_snapshot?.name ||
        currentSubscription.value.plan?.name ||
        'Doctor Subscription'

      if (diffDays <= 5 && diffDays >= 0 && currentSubscription.value.status === 'active') {
        list.push({
          id: `sub-expiring-${currentSubscription.value.uuid}`,
          type: 'subscription',
          title:
            diffDays === 0
              ? 'Subscription Expiring Today'
              : `Subscription Expiring in ${diffDays} Day${diffDays > 1 ? 's' : ''}`,
          description: `Your ${planTitle} expires on ${endsAtDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Renew your plan to ensure uninterrupted AI scan execution and recommendations.`,
          time: diffDays === 0 ? 'Today' : `In ${diffDays}d`,
          icon: 'solar:clock-circle-bold',
          color: 'text-amber-500',
          to: '/doctor/subscription'
        })
      } else if (
        diffDays < 0 ||
        currentSubscription.value.status === 'past_due' ||
        currentSubscription.value.status === 'expired'
      ) {
        list.push({
          id: `sub-expired-${currentSubscription.value.uuid}`,
          type: 'subscription',
          title: 'Subscription Expired',
          description: `Your ${planTitle} expired on ${endsAtDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Renew your plan now to restore full clinical features.`,
          time: 'Expired',
          icon: 'solar:danger-triangle-bold',
          color: 'text-red-500',
          to: '/doctor/subscription'
        })
      }
    }

    // Clinic Doctor Seats Limit Notification for Clinic Owners
    if (userRole.value === 'doctor' && seatUsage.value && isOwner.value) {
      if (seatUsage.value.max_seats && seatUsage.value.used_seats >= seatUsage.value.max_seats) {
        list.push({
          id: `clinic-seat-limit-${seatUsage.value.used_seats}`,
          type: 'clinic_team',
          title: 'Clinic Doctor Seats Full',
          description: `All ${seatUsage.value.max_seats} doctor seat(s) in your clinic practice are occupied. Upgrade your plan to delegate seats to more associate doctors.`,
          time: 'Capacity reached',
          icon: 'solar:users-group-rounded-bold',
          color: 'text-indigo-500',
          to: '/doctor/profile?tab=clinics#seats'
        })
      }
    }

    // Doctor Secretary Limit Notification
    if (userRole.value === 'doctor' && maxSecretaries.value !== null && maxSecretaries.value > 0) {
      if (doctorSecretaries.value.length >= maxSecretaries.value) {
        list.push({
          id: `doctor-secretary-limit-${doctorSecretaries.value.length}`,
          type: 'subscription',
          title: 'Secretary Quota Reached',
          description: `You have reached your limit of ${maxSecretaries.value} secretary account${maxSecretaries.value > 1 ? 's' : ''}. Upgrade your subscription plan to add more staff to your practice.`,
          time: 'Limit reached',
          icon: 'solar:user-block-rounded-bold',
          color: 'text-amber-500',
          to: '/doctor/subscription?required=secretary'
        })
      }
    }

    if (
      userRole.value === 'doctor' &&
      userProfile.value?.doctor_verification?.status === 'verified'
    ) {
      const verif = userProfile.value.doctor_verification
      list.push({
        id: `approved-${verif.uuid}-${verif.updated_at}`,
        type: 'verification',
        title: 'Verification Approved',
        description: 'Your doctor profile has been officially verified!',
        time: 'Verified',
        icon: 'heroicons:shield-check-solid',
        color: 'text-green-500',
        to: profileRoute.value
      })
    }

    if (
      userRole.value === 'doctor' &&
      userProfile.value?.doctor_verification?.status === 'declined'
    ) {
      const verif = userProfile.value.doctor_verification
      const reason = verif.rejection_reason
      list.push({
        id: `declined-${verif.uuid}-${verif.updated_at}`,
        type: 'verification',
        title: 'Verification Declined',
        description: reason
          ? `Reason: ${reason}`
          : 'Your doctor profile verification was declined. Please review your submission.',
        time: 'Action needed',
        icon: 'heroicons:x-circle-solid',
        color: 'text-red-500',
        to: profileRoute.value
      })
    }

    const isDoctorOrSecretary = userRole.value === 'doctor' || userRole.value === 'secretary'
    const apptBasePath =
      userRole.value === 'secretary' ? '/Secretary/appointments' : '/Doctor/Messages'

    if (isDoctorOrSecretary && pendingAppointments.value.length > 0) {
      pendingAppointments.value.forEach(appt => {
        list.push({
          id: `doctor-appt-request-${appt.id}`,
          type: 'appointment',
          title: 'New Appointment Request',
          description: `${appt.doctor} has sent an appointment request for ${appt.info}.`,
          time: 'Pending',
          icon: 'material-symbols:calendar-add-on-rounded',
          color: 'text-indigo-500',
          to:
            appt.conversation_uuid && userRole.value === 'doctor'
              ? `/Doctor/Messages/${appt.conversation_uuid}`
              : apptBasePath
        })
      })
    }

    if (isDoctorOrSecretary && appointments.value.length > 0) {
      appointments.value.forEach(appt => {
        if (!appt.date) return
        const apptDateTime = appt.date + (appt.time ? `T${appt.time}` : 'T00:00:00')
        const hoursUntil = hoursUntilAppointment(apptDateTime)
        if (hoursUntil >= 0 && hoursUntil <= 24) {
          list.push({
            id: `doctor-appt-upcoming-${appt.id}`,
            type: 'appointment',
            title: 'Upcoming Appointment Tomorrow',
            description: `You have an appointment with ${appt.doctor} for ${appt.info} on ${appt.date} at ${appt.time}${appt.location ? ' at ' + appt.location : ''}.`,
            time: `In ${Math.round(hoursUntil)}h`,
            icon: 'material-symbols:alarm-on-rounded',
            color: 'text-amber-500',
            to:
              appt.conversation_uuid && userRole.value === 'doctor'
                ? `/Doctor/Messages/${appt.conversation_uuid}`
                : apptBasePath
          })
        }
      })
    }

    if (isDoctorOrSecretary && appointments.value.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0]
      appointments.value.forEach(appt => {
        if (!appt.date) return
        const isPastDate = appt.date < todayStr
        const isPastTime =
          appt.date === todayStr && appt.time && new Date(`${appt.date}T${appt.time}`) < new Date()

        if (isPastDate || isPastTime) {
          list.push({
            id: `doctor-appt-overdue-${appt.id}`,
            type: 'appointment',
            title: 'Overdue Appointment — Action Needed',
            description: `Your appointment with ${appt.doctor} scheduled for ${appt.date} ${appt.time ? 'at ' + appt.time : ''} has passed. Please mark it as Accomplished or Cancelled.`,
            time: 'Overdue',
            icon: 'material-symbols:warning-rounded',
            color: 'text-red-500',
            to:
              appt.conversation_uuid && userRole.value === 'doctor'
                ? `/Doctor/Messages/${appt.conversation_uuid}?resolve=1`
                : apptBasePath
          })
        }
      })
    }

    if (userRole.value === 'patient' && appointments.value.length > 0) {
      appointments.value.forEach(appt => {
        const purposeText = appt.purpose ? ` Purpose: ${appt.purpose}.` : ''
        list.push({
          id: `appt-scheduled-${appt.id}`,
          type: 'appointment',
          title: 'Appointment Confirmed!',
          description: `${appt.doctor} confirmed your appointment on ${appt.date} at ${appt.time}${appt.location ? ' — ' + appt.location : ''}.${purposeText}`,
          time: appt.date || 'Upcoming',
          icon: 'material-symbols:calendar-month-rounded',
          color: 'text-indigo-500',
          to: appt.conversation_uuid
            ? `/Patient/Messages/${appt.conversation_uuid}`
            : '/Patient/Messages'
        })
      })
    }

    if (userRole.value === 'patient' && appointments.value.length > 0) {
      appointments.value.forEach(appt => {
        if (!appt.date) return
        const apptDateTime = appt.date + (appt.time ? `T${appt.time}` : 'T00:00:00')
        const hoursUntil = hoursUntilAppointment(apptDateTime)
        if (hoursUntil >= 0 && hoursUntil <= 24) {
          list.push({
            id: `patient-appt-upcoming-${appt.id}`,
            type: 'appointment',
            title: 'Appointment Tomorrow!',
            description: `Don't forget — your appointment with ${appt.doctor} for ${appt.info} is tomorrow at ${appt.time}${appt.location ? ' at ' + appt.location : ''}.`,
            time: `In ${Math.round(hoursUntil)}h`,
            icon: 'material-symbols:alarm-on-rounded',
            color: 'text-amber-500',
            to: appt.conversation_uuid
              ? `/Patient/Messages/${appt.conversation_uuid}`
              : '/Patient/Messages'
          })
        }
      })
    }

    if (userRole.value === 'patient' && declinedAppointments.value.length > 0) {
      declinedAppointments.value.forEach(appt => {
        list.push({
          id: `appt-declined-${appt.id}`,
          type: 'appointment',
          title: 'Appointment Declined',
          description: `Your ${appt.info} appointment request was declined. You can send a new referral or message the doctor.`,
          time: appt.completed_at ? formatRelativeTime(appt.completed_at) : 'Recently',
          icon: 'material-symbols:cancel-rounded',
          color: 'text-red-500',
          to: appt.conversation_uuid
            ? `/Patient/Messages/${appt.conversation_uuid}`
            : '/Patient/Messages'
        })
      })
    }

    if (userRole.value === 'patient' && completedAppointments.value.length > 0) {
      completedAppointments.value.forEach(appt => {
        list.push({
          id: `appt-completed-${appt.id}-${appt.completed_at || appt.date}`,
          type: 'appointment',
          title: 'Appointment Completed',
          description: `${appt.doctor} marked your ${appt.info} appointment as completed. Your visit summary is now in your records.`,
          time: appt.completed_at ? formatRelativeTime(appt.completed_at) : 'Completed',
          icon: 'material-symbols:check-circle-rounded',
          color: 'text-green-500',
          to: appt.conversation_uuid
            ? `/Patient/Messages/${appt.conversation_uuid}`
            : '/Patient/Messages'
        })
      })
    }

    if (userRole.value === 'patient' && appointments.value.length > 0) {
      appointments.value.forEach(appt => {
        if (appt.status === 'reschedule_proposed') {
          list.push({
            id: `appt-reschedule-${appt.id}`,
            type: 'appointment',
            title: 'Schedule Proposed',
            description: `${appt.doctor} proposed a new schedule for your appointment. Please review and accept or propose another date.`,
            time: 'Action needed',
            icon: 'material-symbols:edit-calendar-rounded',
            color: 'text-amber-500',
            to: appt.conversation_uuid
              ? `/Patient/Messages/${appt.conversation_uuid}`
              : '/Patient/Messages'
          })
        }
      })
    }

    if (isDoctorOrSecretary && appointments.value.length > 0) {
      appointments.value.forEach(appt => {
        if (appt.status === 'reschedule_proposed') {
          list.push({
            id: `appt-reschedule-doctor-${appt.id}`,
            type: 'appointment',
            title: 'Reschedule Proposed',
            description: `The patient proposed a new schedule for an appointment. Please review and accept.`,
            time: 'Action needed',
            icon: 'material-symbols:edit-calendar-rounded',
            color: 'text-amber-500',
            to:
              appt.conversation_uuid && userRole.value === 'doctor'
                ? `/Doctor/Messages/${appt.conversation_uuid}`
                : apptBasePath
          })
        }
      })
    }

    // Patient Medical Records Notification (Scans & Doctor Clinical Diagnoses)
    if (userRole.value === 'patient' && patientRecentRecords.value.length > 0) {
      const recentRecords = [...patientRecentRecords.value]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)

      recentRecords.forEach(rec => {
        const recordTitle = rec.title || rec.label || 'Medical Record'
        const isDiagnosis = rec.type === 'doctor_diagnosis'
        list.push({
          id: `patient-record-${rec.id || rec.uuid}`,
          type: 'records',
          title: isDiagnosis ? 'New Clinical Consultation Record' : 'New Diagnostic Scan Saved',
          description: isDiagnosis
            ? `Dr. ${rec.doctor?.last_name || 'Your doctor'} added a clinical note for "${recordTitle}". Tap to view in your health history.`
            : `AI diagnostic scan "${recordTitle}" has been saved to your health history.`,
          time: rec.created_at ? formatRelativeTime(rec.created_at) : 'Recent',
          icon: isDiagnosis ? 'solar:document-medicine-bold' : 'solar:scanner-bold',
          color: isDiagnosis ? 'text-teal-500' : 'text-primary',
          to: '/patient/records',
          data: rec
        })
      })
    }

    // Unread Chat Messages for all roles
    if (conversations.value && conversations.value.length > 0) {
      conversations.value.forEach(conv => {
        if (conv.unread_count > 0 && conv.latest_message) {
          const partnerName =
            userRole.value === 'patient'
              ? conv.doctor?.name || 'Doctor'
              : conv.patient?.name || 'Patient'
          const roleFolder =
            userRole.value === 'doctor'
              ? 'Doctor'
              : userRole.value === 'secretary'
                ? 'Secretary'
                : 'Patient'

          const cleanSnippet = conv.latest_message.message
            ? conv.latest_message.message.replace(/<[^>]*>?/gm, '').trim()
            : 'Sent an attachment'

          list.push({
            id: `msg-unread-${conv.id}-${conv.latest_message.created_at || 'now'}`,
            type: 'message',
            title: `New Message from ${partnerName}`,
            description: cleanSnippet || 'You have an unread message in this conversation.',
            time: formatRelativeTime(conv.latest_message.created_at) || 'Unread',
            icon: 'solar:chat-round-dots-bold',
            color: 'text-sky-500',
            to: `/${roleFolder}/Messages/${conv.id}`,
            data: conv
          })
        }
      })
    }

    if (userRole.value === 'admin' && appealsData.value?.data) {
      appealsData.value.data.forEach((appeal: any) => {
        list.push({
          id: `appeal-${appeal.uuid}`,
          type: 'admin',
          title: 'New Medical Appeal',
          description: `Dr. ${appeal.user.last_name} suggested "${appeal.suggested_label}" instead of "${appeal.diagnosis_label}". Reason: ${appeal.description}`,
          time: appeal.created_at ? formatRelativeTime(appeal.created_at) : 'New',
          icon: 'material-symbols:report-outline',
          color: 'text-red-500',
          to: '/admin/moderation/verification'
        })
      })
    }

    if (userRole.value === 'admin' && adminPendingVerifications.value > 0) {
      list.push({
        id: `admin-verif-pending-${adminPendingVerifications.value}`,
        type: 'verification',
        title: `${adminPendingVerifications.value} Doctor Verification${adminPendingVerifications.value > 1 ? 's' : ''} Pending`,
        description: `There ${adminPendingVerifications.value > 1 ? 'are' : 'is'} ${adminPendingVerifications.value} doctor registration verification request${adminPendingVerifications.value > 1 ? 's' : ''} awaiting PRC document approval.`,
        time: 'Action required',
        icon: 'heroicons:shield-exclamation-solid',
        color: 'text-amber-500',
        to: '/admin/moderation/verification'
      })
    }

    if (userRole.value === 'admin' && adminPendingPayments.value > 0) {
      list.push({
        id: `admin-payments-pending-${adminPendingPayments.value}`,
        type: 'subscription',
        title: `${adminPendingPayments.value} Payment Settlement${adminPendingPayments.value > 1 ? 's' : ''} Pending`,
        description: `There ${adminPendingPayments.value > 1 ? 'are' : 'is'} ${adminPendingPayments.value} subscription payment invoice${adminPendingPayments.value > 1 ? 's' : ''} awaiting settlement or review.`,
        time: 'Review needed',
        icon: 'solar:card-recive-bold',
        color: 'text-emerald-500',
        to: '/admin/subscriptions/payments'
      })
    }

    return list
  })

  const notifications = computed(() => {
    const arr = dismissedNotifs.value || []
    return baseNotifications.value.filter(n => {
      if (
        n.id === 'profile-incomplete-patient' ||
        n.id === 'profile-incomplete-doctor' ||
        n.id === 'profile-incomplete-secretary'
      )
        return true
      return !arr.includes(n.id)
    })
  })

  const unreadNotifications = computed(() => {
    const read = readNotifs.value || []
    return notifications.value.filter(n => {
      if (
        n.id === 'profile-incomplete-patient' ||
        n.id === 'profile-incomplete-doctor' ||
        n.id === 'profile-incomplete-secretary'
      )
        return true
      return !read.includes(n.id)
    })
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
    isSecretaryProfileIncomplete,
    missingPatientFields,
    missingDoctorFields,
    missingSecretaryFields,
    profileRoute,
    pendingInvitations,
    revokedMemberships,
    fetchPendingInvitations,
    acknowledgeRevocation,
    doctorSecretaries,
    patientRecentRecords,
    pollAllNotifications
  }
}
