<script setup lang="ts">
  import { ref, computed } from 'vue'

  definePageMeta({
    layout: 'dashboard-sidebar-layout'
  })

  const { baseNotifications, notifications, unreadNotifications, dismissedNotifs, readNotifs } =
    useAppNotifications()

  const selectedNotification = ref<any>(null)
  const isModalOpen = ref(false)

  const closeModal = () => {
    isModalOpen.value = false
    setTimeout(() => {
      selectedNotification.value = null
    }, 200)
  }

  const currentFilter = ref('all') // 'all', 'unread', 'read'

  const filteredNotifications = computed(() => {
    let list = notifications.value

    if (currentFilter.value === 'unread') {
      list = unreadNotifications.value
    } else if (currentFilter.value === 'read') {
      const read = readNotifs.value || []
      list = notifications.value.filter(n => read.includes(n.id))
    }

    return list
  })

  const markAllRead = () => {
    const arr = [...(readNotifs.value || [])]
    notifications.value.forEach(n => {
      if (!arr.includes(n.id)) arr.push(n.id)
    })
    readNotifs.value = arr
  }

  const clearAll = () => {
    const arr = [...(dismissedNotifs.value || [])]
    notifications.value.forEach(n => {
      if (!arr.includes(n.id)) arr.push(n.id)
    })
    dismissedNotifs.value = arr
  }

  const handleNotificationClick = (notif: any) => {
    if (notif.id !== undefined && notif.id !== null) {
      const arr = [...(readNotifs.value || [])]
      if (!arr.includes(notif.id)) {
        arr.push(notif.id)
        readNotifs.value = arr
      }
    }
    selectedNotification.value = notif
    isModalOpen.value = true
  }

  const handleNotificationDelete = (id: string | number) => {
    const arr = [...(dismissedNotifs.value || [])]
    if (!arr.includes(id)) {
      arr.push(id)
      dismissedNotifs.value = arr
    }
  }
</script>

<template>
  <div class="flex h-full w-full flex-col gap-6 overflow-hidden pr-2">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-3xl font-bold">Notifications</h1>
      <div class="flex items-center gap-3">
        <AppButton
          @click="markAllRead"
          variant="outline"
          size="sm"
          class="border-border/50 text-foreground hover:bg-secondary/20 rounded-xl font-semibold"
          >Mark all as read</AppButton
        >
        <AppButton
          @click="clearAll"
          variant="destructive"
          size="sm"
          class="rounded-xl font-semibold"
          >Clear all</AppButton
        >
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="border-border/30 flex items-center gap-2 border-b pb-3">
      <button
        @click="currentFilter = 'all'"
        class="cursor-pointer rounded-2xl px-5 py-2 text-sm font-bold transition-all active:scale-95"
        :class="
          currentFilter === 'all'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'hover:bg-foreground/5 text-muted-foreground'
        "
      >
        All
      </button>
      <button
        @click="currentFilter = 'unread'"
        class="flex cursor-pointer items-center gap-2 rounded-2xl px-5 py-2 text-sm font-bold transition-all active:scale-95"
        :class="
          currentFilter === 'unread'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'hover:bg-foreground/5 text-muted-foreground'
        "
      >
        Unread
        <span
          v-if="unreadNotifications.length > 0"
          class="flex h-5 items-center justify-center rounded-full bg-white/20 px-2 text-[10px] text-white"
        >
          {{ unreadNotifications.length }}
        </span>
      </button>
      <button
        @click="currentFilter = 'read'"
        class="cursor-pointer rounded-2xl px-5 py-2 text-sm font-bold transition-all active:scale-95"
        :class="
          currentFilter === 'read'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'hover:bg-foreground/5 text-muted-foreground'
        "
      >
        Read
      </button>
    </div>

    <!-- Notifications List -->
    <div class="custom-scrollbar flex-1 overflow-y-auto">
      <div
        v-if="filteredNotifications.length === 0"
        class="text-muted-foreground flex h-[50%] flex-col items-center justify-center opacity-50"
      >
        <Icon
          name="solar:bell-bing-linear"
          class="mb-4 text-7xl"
        />
        <p class="text-lg font-bold">
          No {{ currentFilter !== 'all' ? currentFilter : '' }} notifications found.
        </p>
      </div>

      <ul
        v-else
        class="flex flex-col gap-3 pb-6"
      >
        <li
          v-for="notif in filteredNotifications"
          :key="notif.id"
          class="group relative"
        >
          <AppNotificationPreview
            v-bind="{ ...notif, to: undefined }"
            :is-read="readNotifs.includes(notif.id)"
            class="bg-card border-border/20 hover:border-primary/40 rounded-2xl border shadow-sm transition-all hover:shadow-md"
            @click="handleNotificationClick(notif)"
            @delete="handleNotificationDelete(notif.id)"
          />
          <!-- unread indicator -->
          <div
            v-if="!readNotifs.includes(notif.id)"
            class="bg-primary pointer-events-none absolute top-1/2 left-0 h-10 w-1 -translate-y-1/2 rounded-r-full shadow-[0_0_8px_rgba(var(--primary),0.5)]"
          ></div>
        </li>
      </ul>
    </div>

    <!-- Notification Details Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="isModalOpen"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          @click.self="closeModal"
        >
          <!-- Backdrop -->
          <div
            class="bg-background/80 absolute inset-0 backdrop-blur-sm"
            @click="closeModal"
          ></div>

          <!-- Modal Content -->
          <div
            class="bg-card border-border/50 relative w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl"
          >
            <!-- Header -->
            <div class="border-border/50 flex items-center justify-between border-b p-6 pb-4">
              <h2 class="text-xl font-bold">Notification Details</h2>
              <button
                @click="closeModal"
                class="text-muted-foreground hover:bg-secondary/20 rounded-full p-2 transition-colors"
              >
                <Icon
                  name="heroicons:x-mark-20-solid"
                  size="24"
                />
              </button>
            </div>

            <!-- Body -->
            <div
              class="flex flex-col gap-5 p-6"
              v-if="selectedNotification"
            >
              <div class="flex items-start gap-4">
                <div
                  class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  :class="selectedNotification.color + ' bg-opacity-10 bg-current'"
                >
                  <Icon
                    :name="selectedNotification.icon"
                    class="text-3xl"
                  />
                </div>
                <div class="min-w-0 flex-1 pt-1">
                  <h3 class="text-foreground text-lg leading-tight font-bold">
                    {{ selectedNotification.title }}
                  </h3>
                  <span
                    class="text-muted-foreground mt-1 block text-xs font-semibold tracking-wider uppercase"
                    >{{ selectedNotification.time }}</span
                  >
                </div>
              </div>

              <div class="bg-secondary/5 border-border/30 rounded-2xl border p-5">
                <p class="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                  {{ selectedNotification.description }}
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div class="border-border/50 bg-secondary/5 flex justify-end gap-3 border-t p-6">
              <AppButton
                @click="closeModal"
                variant="outline"
                class="rounded-xl"
                >Close</AppButton
              >
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
