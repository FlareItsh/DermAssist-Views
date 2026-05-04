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



  const messages = [
    {
      id: 1,
      sender: 'Dr. Michael Smith',
      preview: 'We should discuss your latest scan results during the next session.',
      time: '1 hour ago',
      avatar: 'solar:user-circle-bold',
      status: 'online' as const
    },
    {
      id: 2,
      sender: 'Jane Doe',
      preview: 'Thank you for the detailed explanation of my skin condition!',
      time: '3 hours ago',
      avatar: 'solar:user-circle-bold',
      status: 'offline' as const
    },
    {
      id: 3,
      sender: 'Nurse Alen',
      preview: 'Records for the morning shift have been completed.',
      time: 'Yesterday',
      avatar: 'solar:user-circle-bold',
      status: 'online' as const
    }
  ]

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

  const route = useRoute()
  const { getStorageUrl } = useStorage()
  const { searchQuery } = useSearch()
  const userRole = useCookie('user_role')
  const userUuid = useCookie('user_uuid')

  const { data: userProfile, refresh } = await userService.useShow(() => userUuid.value as string, {
    key: `userProfile-${userUuid.value}`
  })

  // Appointments (patient-side notifications)
  const { appointments, declinedAppointments, fetchAppointments } = useAppointments()
  watch(() => route.fullPath, () => { if (userRole.value === 'patient') fetchAppointments() })

  watch(() => route.fullPath, () => {
    refresh()
    if (userRole.value === 'admin') refreshAppeals()
  })

 
  const { data: appealsData, refresh: refreshAppeals } = await appealService.useList({}, {
    immediate: userRole.value === 'admin',
    key: 'admin-appeals'
  })

  const isProfileIncomplete = computed(() => {
    if (!userProfile.value) return false
    const userData = userProfile.value
    return !userData.city || !userData.province || !userData.age || userData.age == 0 || !userData.gender || userData.gender === ''
  })

  const profileRoute = computed(() => {
    if (userRole.value === 'doctor') return '/doctor/profile'
    if (userRole.value === 'patient') return '/patient/profile'
    if (userRole.value === 'admin') return '/admin'
    return '#'
  })

  const dismissedNotifs = useCookie<(string | number)[]>(`dismissed_notifs_${userUuid.value}`, { default: () => [], maxAge: 60 * 60 * 24 * 365 })

  const notifications = computed<AppNotification[]>(() => {
    const list: AppNotification[] = []
    
    if (isProfileIncomplete.value) {
      list.push({
        id: 0,
        title: 'Complete Account Setup',
        description: 'Please provide your location, age and gender to complete your account setup.',
        time: 'Now',
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
        time: 'Just now',
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
        description: reason ? `Reason: ${reason}` : 'Your doctor profile verification was declined. Please review your submisson.',
        time: 'Just now',
        icon: 'heroicons:x-circle-solid',
        color: 'text-red-500',
        to: profileRoute.value
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

    // Patient: scheduled appointment notifications
    if (userRole.value === 'patient' && appointments.value.length > 0) {
      appointments.value.forEach((appt) => {
        list.push({
          id: `appt-scheduled-${appt.id}`,
          title: 'Appointment Scheduled!',
          description: `${appt.doctor} scheduled your appointment on ${appt.date} at ${appt.time}${appt.location ? ' — ' + appt.location : ''}.`,
          time: appt.date || 'Upcoming',
          icon: 'material-symbols:calendar-month-rounded',
          color: 'text-indigo-500',
          to: appt.conversation_uuid ? `/Patient/Messages/${appt.conversation_uuid}` : '/Patient/Messages'
        })
      })
    }

    // Patient: declined appointment notifications
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
    
    if (typeof notif.id === 'string' && (notif.id.startsWith('approved-') || notif.id.startsWith('declined-') || notif.id.startsWith('appt-'))) {
      const arr = dismissedNotifs.value || []
      const idToDismiss = notif.id
      if (!arr.includes(idToDismiss)) {
        arr.push(idToDismiss)
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

  const triggerLogout = () => {
    isProfileOpen.value = false
    isLogoutModalOpen.value = true
  }

  const logout = async () => {
    isLogoutModalOpen.value = false
    try {
      // Call backend logout to invalidate session/token
      await authService.logout()
    } catch (e) {
      console.error('Backend logout failed:', e)
    } finally {
      // Clear all auth cookies regardless of backend success
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

          <span
            v-if="messages.length > 0"
            class="absolute top-2.5 right-2.5 flex h-3 w-3"
          >
            <span
              class="bg-primary-light absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            ></span>
            <span
              class="bg-primary relative inline-flex h-3 w-3 rounded-full border-2 border-white"
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
            v-if="isMessagesOpen"
            class="bg-card/90 absolute right-0 z-50 mt-4 max-h-[500px] w-96 overflow-hidden rounded-3xl border border-white/20 shadow-2xl backdrop-blur-xl"
          >
            <div class="border-border/50 flex items-center justify-between border-b p-5">
              <h3 class="text-xl font-bold">Messages</h3>
              <div class="flex items-center gap-2">
                <span class="bg-primary/10 text-primary rounded-full px-2 py-1 text-xs font-bold"
                  >4 New</span
                >
                <Icon
                  name="solar:pen-new-square-linear"
                  class="text-primary cursor-pointer text-2xl transition-transform hover:scale-110"
                />
              </div>
            </div>

            <div class="custom-scrollbar max-h-[400px] overflow-y-auto">
              <div
                v-if="messages.length === 0"
                class="text-muted-foreground p-10 text-center"
              >
                <Icon
                  name="solar:chat-line-linear"
                  class="mx-auto mb-3 text-5xl opacity-20"
                />
                <p>No messages yet</p>
              </div>
              <ul v-else class="list-none m-0 p-0">
                <li v-for="msg in messages" :key="msg.id">
                  <AppMessagePreview v-bind="msg" />
                </li>
              </ul>
            </div>

            <div class="bg-primary border-border/50 border-t p-3 text-center">
              <AppButton variant="unstyled" size="unstyled" rounded="unstyled"
                class="text-card hover:text-foreground/40 w-full cursor-pointer py-2 text-sm font-bold transition-colors"
              >
                Go to Inbox
              </AppButton>
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
              <span class="text-primary cursor-pointer text-sm font-medium hover:underline"
                >Mark all as read</span
              >
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
