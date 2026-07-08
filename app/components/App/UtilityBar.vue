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

  const { data: appealsData, refresh: refreshAppeals } = appealService.useList({}, {
    immediate: userRole.value === 'admin',
    key: 'admin-appeals'
  })

  const {
    notifications,
    unreadNotifications,
    dismissedNotifs,
    readNotifs,
    isPatientProfileIncomplete,
    isDoctorProfileIncomplete,
    profileRoute
  } = useAppNotifications()

  const isProfileIncomplete = computed(() => isPatientProfileIncomplete.value || isDoctorProfileIncomplete.value)

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

    // Auto-mark as read on click
    if (typeof notif.id === 'string') {
      const arr = readNotifs.value || []
      if (!arr.includes(notif.id)) {
        arr.push(notif.id)
        readNotifs.value = arr
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
    const arr = readNotifs.value || []
    notifications.value.forEach(n => {
      if (!arr.includes(n.id)) arr.push(n.id)
    })
    readNotifs.value = arr
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
            v-if="unreadNotifications.length > 0"
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
                @click="navigateTo('/notifications'); isNotificationsOpen = false"
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
                <div class="text-primary rounded-xl p-2 transition-colors group-hover:bg-secondary">
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
