<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'
  import { authService } from '~/api/auth/AuthService'
  import { userService } from '~/api/user/UserService'
  import { appealService } from '~/api/appeal/AppealService'

  const isNotificationsOpen = ref(false)
  const isMessagesOpen = ref(false)
  const isProfileOpen = ref(false)
  const isLogoutModalOpen = ref(false)
  const notificationRef = ref<HTMLElement | null>(null)
  const messageRef = ref<HTMLElement | null>(null)
  const profileRef = ref<HTMLElement | null>(null)

  const toggleNotifications = () => {
    isNotificationsOpen.value = !isNotificationsOpen.value
    if (isNotificationsOpen.value) {
      isMessagesOpen.value = false
      isProfileOpen.value = false
    }
  }

  const toggleMessages = () => {
    isMessagesOpen.value = !isMessagesOpen.value
    if (isMessagesOpen.value) {
      isNotificationsOpen.value = false
      isProfileOpen.value = false
    }
  }

  const toggleProfile = () => {
    isProfileOpen.value = !isProfileOpen.value
    if (isProfileOpen.value) {
      isNotificationsOpen.value = false
      isMessagesOpen.value = false
    }
  }

  interface AppNotification {
    id: string | number
    title: string
    description: string
    time: string
    icon: string
    color: string
    to?: string
  }

  const handleClickOutside = (event: MouseEvent) => {
    if (notificationRef.value && !notificationRef.value.contains(event.target as Node)) {
      isNotificationsOpen.value = false
    }
    if (messageRef.value && !messageRef.value.contains(event.target as Node)) {
      isMessagesOpen.value = false
    }
    if (profileRef.value && !profileRef.value.contains(event.target as Node)) {
      isProfileOpen.value = false
    }
  }

  onMounted(() => {
    document.addEventListener('mousedown', handleClickOutside)
  })

  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside)
  })

  const route = useRoute()
  const { getStorageUrl } = useStorage()
  const { searchQuery } = useSearch()
  const userRole = useCookie('user_role')
  const userUuid = useCookie('user_uuid')

  const { data: userProfile, refresh } = await userService.useShow(() => userUuid.value as string, {
    key: `userProfile-${userUuid.value}`
  })

  // --- Appointments (both doctor and patient) ---
  const { appointments, pendingAppointments, declinedAppointments, completedAppointments, fetchAppointments } = useAppointments()

  // --- Conversations / Messages (real data via composable) ---
  const { conversations, totalUnreadCount } = useConversations()

  // Determine the messages base path based on role
  const messagesBasePath = computed(() => {
    if (userRole.value === 'doctor') return '/Doctor/Messages'
    return '/Patient/Messages'
  })

  /**
   * Format a UTC timestamp into a relative time string
   * e.g. "Just now", "5 min ago", "2 hours ago", "Yesterday", "Jul 1"
   */
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

  /**
   * Strip appointment system tags from a message for preview display.
   */
  const stripSystemTags = (message: string): string => {
    return message
      .replace(/\[(APPOINTMENT_REQUEST|DIAGNOSIS_ONLY|APPOINTMENT_SCHEDULED|APPOINTMENT_DECLINED|APPOINTMENT_COMPLETED):[^\]]+\]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim()
  }

  /**
   * Get the other person's name from a conversation relative to the current user.
   */
  const getConversationPartnerName = (conv: any): string => {
    if (userRole.value === 'doctor') {
      return conv.patient?.name ?? 'Unknown Patient'
    }
    const name = conv.doctor?.name ?? 'Unknown Doctor'
    return name.startsWith('Dr.') ? name : `Dr. ${name}`
  }

  /**
   * Get the other person's avatar from a conversation relative to the current user.
   */
  const getConversationPartnerAvatar = (conv: any): string | null => {
    if (userRole.value === 'doctor') return conv.patient?.avatar ?? null
    return conv.doctor?.avatar ?? null
  }

  /**
   * Compute whether the latest message in a conversation was sent by the current user.
   */
  const isLatestMessageMine = (conv: any): boolean => {
    return conv.latest_message?.sender_id === userUuid.value
  }

  const handleMessageConversationClick = (conv: any) => {
    isMessagesOpen.value = false
    navigateTo(`${messagesBasePath.value}/${conv.id}`)
  }

  // Refresh on route change
  watch(() => route.fullPath, () => {
    refresh()
    if (userRole.value === 'admin') refreshAppeals()
    if (userRole.value === 'doctor' || userRole.value === 'patient') fetchAppointments()
  })

  const { data: appealsData, refresh: refreshAppeals } = await appealService.useList({}, {
    immediate: userRole.value === 'admin',
    key: 'admin-appeals'
  })

  /**
   * Check if a patient profile is considered incomplete (missing critical fields).
   */
  const isPatientProfileIncomplete = computed(() => {
    if (!userProfile.value || userRole.value !== 'patient') return false
    const u = userProfile.value
    return !u.city || !u.province || !u.age || u.age == 0 || !u.gender || u.gender === ''
  })

  /**
   * Check if a doctor profile is considered incomplete (missing critical fields including PRC/affiliation).
   */
  const isDoctorProfileIncomplete = computed(() => {
    if (!userProfile.value || userRole.value !== 'doctor') return false
    const u = userProfile.value
    return !u.city || !u.province || !u.age || u.age == 0 || !u.gender || u.gender === '' || !u.affiliation || !u.prc_number
  })

  const isProfileIncomplete = computed(() => isPatientProfileIncomplete.value || isDoctorProfileIncomplete.value)

  const profileRoute = computed(() => {
    if (userRole.value === 'doctor') return '/doctor/profile'
    if (userRole.value === 'patient') return '/patient/profile'
    if (userRole.value === 'admin') return '/admin'
    return '#'
  })

  const dismissedNotifs = useCookie<(string | number)[]>(`dismissed_notifs_${userUuid.value}`, { default: () => [], maxAge: 60 * 60 * 24 * 365 })

  /**
   * Returns hours until a scheduled appointment.
   */
  const hoursUntilAppointment = (dateStr: string): number => {
    const apptDate = new Date(dateStr)
    const now = new Date()
    return (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60)
  }

  /**
   * Returns hours since an appointment date.
   */
  const hoursSinceAppointment = (dateStr: string): number => {
    const apptDate = new Date(dateStr)
    const now = new Date()
    return (now.getTime() - apptDate.getTime()) / (1000 * 60 * 60)
  }

  const notifications = computed<AppNotification[]>(() => {
    const list: AppNotification[] = []

    // --- Profile incomplete reminder (patient & doctor) ---
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

    // --- Doctor verification status ---
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

    // --- Doctor: pending appointment requests ---
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

    // --- Doctor: upcoming appointments (within 24h) ---
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

    // --- Doctor: overdue scheduled appointments (1+ day past scheduled time, still "scheduled") ---
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

    // --- Patient: appointment scheduled notification ---
    if (userRole.value === 'patient' && appointments.value.length > 0) {
      appointments.value.forEach((appt) => {
        list.push({
          id: `appt-scheduled-${appt.id}`,
          title: 'Appointment Confirmed!',
          description: `${appt.doctor} confirmed your appointment on ${appt.date} at ${appt.time}${appt.location ? ' — ' + appt.location : ''}.`,
          time: appt.date || 'Upcoming',
          icon: 'material-symbols:calendar-month-rounded',
          color: 'text-indigo-500',
          to: appt.conversation_uuid ? `/Patient/Messages/${appt.conversation_uuid}` : '/Patient/Messages'
        })
      })
    }

    // --- Patient: upcoming appointments (within 24h) ---
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

    // --- Patient: declined appointment notifications ---
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

    // --- Patient: completed appointment notifications ---
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

    // --- Admin: pending doctor appeals ---
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

    return list.filter(n => !(dismissedNotifs.value || []).includes(n.id))
  })

  const isSearchVisible = computed(() => {
    if (userRole.value === 'admin') return false
    const visibleRoutes = [
      '/patient/records',
      '/patient',
      '/doctor',
      '/doctor/records',
      '/doctor/appointments'
    ]
    return visibleRoutes.includes(route.path)
  })

  const handleNotificationClick = (notif: AppNotification) => {
    isNotificationsOpen.value = false

    // Auto-dismiss dismissable notifications on click
    if (typeof notif.id === 'string') {
      const arr = dismissedNotifs.value || []
      if (!arr.includes(notif.id)) {
        arr.push(notif.id)
        dismissedNotifs.value = arr
      }
    }

    if (notif.to) {
      navigateTo(notif.to)
    }
  }

  const handleNotificationDelete = (id: string | number) => {
    const arr = dismissedNotifs.value || []
    if (!arr.includes(id)) {
      arr.push(id)
      dismissedNotifs.value = arr
    }
  }

  const markAllNotificationsRead = () => {
    const arr = dismissedNotifs.value || []
    notifications.value.forEach(n => {
      if (!arr.includes(n.id)) arr.push(n.id)
    })
    dismissedNotifs.value = arr
  }

  const triggerLogout = () => {
    isProfileOpen.value = false
    isLogoutModalOpen.value = true
  }

  const logout = async () => {
    isLogoutModalOpen.value = false
    try {
      await authService.logout()
    } catch (e) {
      console.error('Backend logout failed:', e)
    } finally {
      useCookie('auth_token').value = null
      useCookie('user_role').value = null
      useCookie('user_uuid').value = null
      useCookie('user_name').value = null
      useCookie('auth_user_name').value = null

      navigateTo('/auth/login')
    }
  }
</script>

<template>
  <nav aria-label="Quick Actions">
    <ul class="flex items-center gap-5 list-none m-0 p-0">
      <li v-if="isSearchVisible">
        <AppSearch
          v-model="searchQuery"
          class="w-70"
          size="text-3xl"
          text="text-foreground/50"
          width="w-9"
        />
      </li>

      <li
        class="relative"
        ref="messageRef"
      >
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          @click="toggleMessages"
          class="flex h-13 w-13 cursor-pointer items-center justify-center rounded-full p-1 transition-all active:scale-95"
          :class="isMessagesOpen ? 'bg-secondary text-white shadow-lg' : 'bg-card hover:bg-primary'"
        >
          <Icon
            name="lets-icons:message-light"
            class="text-4xl"
          />

          <!-- Unread badge — pulses only when there are actually unread messages -->
          <span
            v-if="totalUnreadCount > 0"
            class="absolute top-2 right-2 flex h-4 w-4 items-center justify-center"
          >
            <span class="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
            <span class="bg-primary relative inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white text-[8px] font-black text-white">
              {{ totalUnreadCount > 9 ? '9+' : totalUnreadCount }}
            </span>
          </span>
        </AppButton>

        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform scale-95 opacity-0 -translate-y-2"
          enter-to-class="transform scale-100 opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform scale-100 opacity-100 translate-y-0"
          leave-to-class="transform scale-95 opacity-0 -translate-y-2"
        >
          <div
            v-if="isMessagesOpen"
            class="bg-card/90 absolute right-0 z-50 mt-4 max-h-[500px] w-96 overflow-hidden rounded-3xl border border-white/20 shadow-2xl backdrop-blur-xl"
          >
            <div class="border-border/50 flex items-center justify-between border-b p-5">
              <h3 class="text-xl font-bold">Messages</h3>
              <div class="flex items-center gap-2">
                <span
                  v-if="totalUnreadCount > 0"
                  class="bg-primary/10 text-primary rounded-full px-2 py-1 text-xs font-bold"
                >{{ totalUnreadCount }} Unread</span>
                <NuxtLink
                  :to="messagesBasePath"
                  @click="isMessagesOpen = false"
                  title="Compose new message"
                >
                  <Icon
                    name="solar:pen-new-square-linear"
                    class="text-primary cursor-pointer text-2xl transition-transform hover:scale-110"
                  />
                </NuxtLink>
              </div>
            </div>

            <div class="custom-scrollbar max-h-[400px] overflow-y-auto">
              <div
                v-if="conversations.length === 0"
                class="text-muted-foreground p-10 text-center"
              >
                <Icon
                  name="solar:chat-line-linear"
                  class="mx-auto mb-3 text-5xl opacity-20"
                />
                <p>No conversations yet</p>
              </div>
              <ul v-else class="list-none m-0 p-0">
                <li v-for="conv in conversations" :key="conv.id">
                  <button
                    class="hover:bg-foreground/10 border-border/30 group flex w-full cursor-pointer gap-4 border-b p-4 text-left transition-colors last:border-0"
                    :class="conv.unread_count > 0 ? 'bg-primary/5' : ''"
                    @click="handleMessageConversationClick(conv)"
                  >
                    <!-- Avatar -->
                    <div class="relative shrink-0">
                      <div class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full ring-2 ring-transparent transition-all group-hover:ring-primary/30">
                        <img
                          v-if="getConversationPartnerAvatar(conv)"
                          :src="getConversationPartnerAvatar(conv)!"
                          :alt="getConversationPartnerName(conv)"
                          class="h-full w-full object-cover"
                        />
                        <div
                          v-else
                          class="bg-primary/10 text-primary flex h-full w-full items-center justify-center text-base font-black uppercase"
                        >
                          {{ (getConversationPartnerName(conv) || '?').charAt(0) }}
                        </div>
                      </div>
                      <!-- Unread indicator dot -->
                      <span
                        v-if="conv.unread_count > 0"
                        class="bg-primary absolute right-0 bottom-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white text-[7px] font-black text-white"
                      >{{ conv.unread_count > 9 ? '9+' : conv.unread_count }}</span>
                    </div>
                    <!-- Content -->
                    <div class="min-w-0 flex-1">
                      <div class="mb-0.5 flex items-start justify-between">
                        <h4
                          class="text-foreground truncate pr-2 text-sm"
                          :class="conv.unread_count > 0 ? 'font-black' : 'font-semibold'"
                        >{{ getConversationPartnerName(conv) }}</h4>
                        <span class="text-muted-foreground shrink-0 text-[10px] font-semibold uppercase tracking-wider">
                          {{ conv.latest_message ? formatRelativeTime(conv.latest_message.created_at) : '' }}
                        </span>
                      </div>
                      <p
                        class="line-clamp-1 text-xs leading-relaxed"
                        :class="conv.unread_count > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'"
                      >
                        <span v-if="isLatestMessageMine(conv)" class="mr-1 text-foreground/40">You:</span>
                        {{ conv.latest_message ? (stripSystemTags(conv.latest_message.message) || '📎 Attachment') : 'Start a conversation' }}
                      </p>
                    </div>
                  </button>
                </li>
              </ul>
            </div>

            <div class="bg-primary border-border/50 border-t p-3 text-center">
              <NuxtLink
                :to="messagesBasePath"
                @click="isMessagesOpen = false"
                class="text-card hover:text-card/70 block w-full cursor-pointer py-2 text-sm font-bold transition-colors"
              >
                Go to Inbox
              </NuxtLink>
            </div>
          </div>
        </Transition>
      </li>

      <li
        class="relative"
        ref="notificationRef"
      >
        <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
          @click="toggleNotifications"
          class="flex h-13 w-13 cursor-pointer items-center justify-center rounded-full p-1 transition-all active:scale-95"
          :class="
            isNotificationsOpen ? 'bg-secondary text-white shadow-lg' : 'bg-card hover:bg-primary'
          "
        >
          <Icon
            name="mynaui:bell"
            class="text-3xl"
          />

          <span
            v-if="notifications.length > 0"
            class="absolute top-3 right-3 flex h-3 w-3"
          >
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
            ></span>
            <span
              class="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-red-500"
            ></span>
          </span>
        </AppButton>

        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform scale-95 opacity-0 -translate-y-2"
          enter-to-class="transform scale-100 opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform scale-100 opacity-100 translate-y-0"
          leave-to-class="transform scale-95 opacity-0 -translate-y-2"
        >
          <div
            v-if="isNotificationsOpen"
            class="bg-card/90 absolute right-0 z-50 mt-4 max-h-[500px] w-96 overflow-hidden rounded-3xl border border-white/20 shadow-2xl backdrop-blur-xl"
          >
            <div class="border-border/50 flex items-center justify-between border-b p-5">
              <h3 class="text-xl font-bold">Notifications</h3>
              <button
                class="text-primary cursor-pointer text-sm font-medium hover:underline"
                @click="markAllNotificationsRead"
              >Mark all as read</button>
            </div>

            <div class="custom-scrollbar max-h-[400px] overflow-y-auto">
              <div
                v-if="notifications.length === 0"
                class="text-muted-foreground p-10 text-center"
              >
                <Icon
                  name="solar:bell-bing-linear"
                  class="mx-auto mb-3 text-5xl opacity-20"
                />
                <p>No new notifications</p>
              </div>
              <ul v-else class="list-none m-0 p-0">
                <li v-for="notif in notifications" :key="notif.id">
                  <AppNotificationPreview
                    v-bind="notif"
                    @click="handleNotificationClick(notif)"
                    @delete="handleNotificationDelete(notif.id)"
                  />
                </li>
              </ul>
            </div>

            <div class="bg-primary border-border/50 border-t p-3 text-center">
              <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
                class="text-card hover:text-foreground/40 w-full cursor-pointer py-2 text-sm font-bold transition-colors"
              >
                View all activity
              </AppButton>
            </div>
          </div>
        </Transition>
      </li>

      <li v-if="userRole !== 'admin'" class="relative" ref="profileRef">
        <button 
          @click="toggleProfile"
          class="block h-14 w-14 overflow-hidden rounded-full border-2 transition-all shadow-md active:scale-95 cursor-pointer"
          :class="isProfileOpen ? 'border-primary ring-4 ring-primary/10' : 'border-transparent hover:border-primary/30 hover:scale-105'"
        >
          <NuxtImg
            :src="getStorageUrl(userProfile?.avatar_path) || '/images/lp-img.png'"
            class="h-full w-full object-cover"
            alt="Profile"
            placeholder
          />
        </button>
        <!-- Profile incomplete dot -->
        <span
          v-if="isProfileIncomplete"
          class="pointer-events-none absolute top-0 right-0 flex h-4 w-4"
        >
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
          <span class="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-red-500"></span>
        </span>

        <!-- Profile Dropdown -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform scale-95 opacity-0 -translate-y-2"
          enter-to-class="transform scale-100 opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform scale-100 opacity-100 translate-y-0"
          leave-to-class="transform scale-95 opacity-0 -translate-y-2"
        >
          <div
            v-if="isProfileOpen"
            class="bg-card/95 absolute right-0 z-50 mt-4 w-64 overflow-hidden rounded-3xl border border-white/20 shadow-2xl backdrop-blur-xl"
          >
            <div class="border-border/10 border-b p-4 pb-3">
              <p class="text-foreground/40 text-[10px] font-bold uppercase">Logged in as</p>
              <p class="text-sm font-bold truncate">{{ userProfile?.first_name }} {{ userProfile?.last_name }}</p>
              <p class="text-muted-foreground text-xs truncate">{{ userProfile?.email }}</p>
            </div>

            <div class="p-2">
              <NuxtLink 
                :to="profileRoute" 
                @click="isProfileOpen = false"
                class="hover:bg-primary/10 group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors"
              >
                <div class="text-primary rounded-xl p-2 transition-colors group-hover:secondary">
                  <Icon name="material-symbols:settings-outline" size="20" />
                </div>
                Profile Settings
              </NuxtLink>

              <button 
                @click="triggerLogout"
                class="hover:bg-destructive/5 group flex w-full items-center gap-3 rounded-2xl group-hover:text-destructive/50 px-4 py-3 text-sm font-medium transition-colors text-destructive"
              >
                <div class="text-destructive rounded-xl p-2 transition-colors">
                  <Icon name="ic:round-log-out" size="20" />
                </div>
                Log Out
              </button>
            </div>
          </div>
        </Transition>
      </li>
    </ul>

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="isLogoutModalOpen"
          class="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-foreground/40"
          @click.self="isLogoutModalOpen = false"
        >
          <AppModalLogoutConfirmation 
            @close="isLogoutModalOpen = false" 
            @confirm="logout" 
          />
        </div>
      </Transition>
    </Teleport>
  </nav>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--primary), 0.1);
    border-radius: 10px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(var(--primary), 0.2);
  }
</style>
