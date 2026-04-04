<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isNotificationsOpen = ref(false)
const isMessagesOpen = ref(false)
const notificationRef = ref<HTMLElement | null>(null)
const messageRef = ref<HTMLElement | null>(null)

const toggleNotifications = () => {
  isNotificationsOpen.value = !isNotificationsOpen.value
  if (isNotificationsOpen.value) isMessagesOpen.value = false
}

const toggleMessages = () => {
  isMessagesOpen.value = !isMessagesOpen.value
  if (isMessagesOpen.value) isNotificationsOpen.value = false
}

const notifications = [
  {
    id: 1,
    title: 'New Scan Result',
    description: 'A new scan result for patient Jane Doe is ready to review.',
    time: '2 hours ago',
    icon: 'solar:scanner-2-linear',
    color: 'text-blue-500'
  },
  {
    id: 2,
    title: 'Appointment Reminder',
    description: 'Follow-up appointment with Dr. Smith tomorrow at 10 AM.',
    time: '5 hours ago',
    icon: 'solar:calendar-date-linear',
    color: 'text-green-500'
  },
  {
    id: 3,
    title: 'System Update',
    description: 'The platform will undergo scheduled maintenance at midnight.',
    time: '1 day ago',
    icon: 'solar:settings-linear',
    color: 'text-amber-500'
  }
]

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
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <nav>
    <ul class="flex items-center gap-5">
      <div class="relative w-70">
        <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-foreground/50">
          <Icon name="lets-icons:search-light" class="text-3xl" />
        </div>
        <input type="text" placeholder="Search..."
          class="w-full h-13 bg-card pl-13 p-5 rounded-full outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-primary/30" />
      </div>

      <div class="relative" ref="messageRef">
        <button @click="toggleMessages"
          class="flex items-center justify-center h-13 w-13 p-1 rounded-full cursor-pointer transition-all active:scale-95"
          :class="isMessagesOpen ? 'bg-secondary text-white shadow-lg' : 'bg-card hover:bg-primary'">
          <Icon name="lets-icons:message-light" class="text-4xl" />

          <span v-if="messages.length > 0" class="absolute top-2.5 right-2.5 flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-light opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-primary border-2 border-white"></span>
          </span>
        </button>

        <Transition enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform scale-95 opacity-0 -translate-y-2"
          enter-to-class="transform scale-100 opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform scale-100 opacity-100 translate-y-0"
          leave-to-class="transform scale-95 opacity-0 -translate-y-2">
          <div v-if="isMessagesOpen"
            class="absolute right-0 mt-4 w-96 max-h-[500px] overflow-hidden bg-card/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 z-50">
            <div class="p-5 border-b border-border/50 flex items-center justify-between">
              <h3 class="text-xl font-bold">Messages</h3>
              <div class="flex items-center gap-2">
                <span class="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-bold">4 New</span>
                <Icon name="solar:pen-new-square-linear" class="text-2xl text-primary cursor-pointer hover:scale-110 transition-transform" />
              </div>
            </div>

            <div class="overflow-y-auto max-h-[400px] custom-scrollbar">
              <div v-if="messages.length === 0" class="p-10 text-center text-muted-foreground">
                <Icon name="solar:chat-line-linear" class="text-5xl mx-auto mb-3 opacity-20" />
                <p>No messages yet</p>
              </div>
              <div v-else>
                <AppMessagePreview v-for="msg in messages" :key="msg.id" v-bind="msg" />
              </div>
            </div>

            <div class="p-3 bg-primary border-t border-border/50 text-center">
              <button class="text-sm font-bold text-card hover:text-foreground/40 cursor-pointer transition-colors w-full py-2">
                Go to Inbox
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <div class="relative" ref="notificationRef">
        <button @click="toggleNotifications"
          class="flex items-center justify-center h-13 w-13 p-1 rounded-full cursor-pointer transition-all active:scale-95"
          :class="isNotificationsOpen ? 'bg-secondary text-white shadow-lg' : 'bg-card hover:bg-primary'">
          <Icon name="mynaui:bell" class="text-3xl" />

          <span v-if="notifications.length > 0" class="absolute top-3 right-3 flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
          </span>
        </button>

        <Transition enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform scale-95 opacity-0 -translate-y-2"
          enter-to-class="transform scale-100 opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform scale-100 opacity-100 translate-y-0"
          leave-to-class="transform scale-95 opacity-0 -translate-y-2">
          <div v-if="isNotificationsOpen"
            class="absolute right-0 mt-4 w-96 max-h-[500px] overflow-hidden bg-card/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 z-50">
            <div class="p-5 border-b border-border/50 flex items-center justify-between">
              <h3 class="text-xl font-bold">Notifications</h3>
              <span class="text-sm text-primary font-medium cursor-pointer hover:underline">Mark all as read</span>
            </div>

            <div class="overflow-y-auto max-h-[400px] custom-scrollbar">
              <div v-if="notifications.length === 0" class="p-10 text-center text-muted-foreground">
                <Icon name="solar:bell-bing-linear" class="text-5xl mx-auto mb-3 opacity-20" />
                <p>No new notifications</p>
              </div>
              <div v-else>
                <AppNotificationPreview v-for="notif in notifications" :key="notif.id" v-bind="notif" />
              </div>
            </div>

            <div class="p-3 bg-primary border-t border-border/50 text-center">
              <button class="text-sm font-bold text-card hover:text-foreground/40 cursor-pointer transition-colors w-full py-2">
                View all activity
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <li><a href="/profile"><img src="/images/lp-img.png"
            class="h-14 w-14 rounded-full border-2 border-transparent hover:border-primary/30 transition-all shadow-md"
            alt="Profile"></a></li>
    </ul>
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
