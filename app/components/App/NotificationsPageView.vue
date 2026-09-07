<script setup lang="ts">
  import type { AppNotification } from '~/composables/useAppNotifications'

  const userRole = useCookie('user_role')

  const {
    notifications,
    unreadNotifications,
    readNotifs,
    dismissedNotifs,
    refreshProfile,
    fetchAppointments
  } = useAppNotifications()

  type FilterType = 'all' | 'unread' | 'invitations'
  const activeFilter = ref<FilterType>('all')

  const selectedNotification = ref<AppNotification | null>(null)
  const isDetailModalOpen = ref(false)

  const invitationsCount = computed(() => {
    return notifications.value.filter(n => n.type === 'clinic_invitation').length
  })

  const filteredNotifications = computed(() => {
    if (activeFilter.value === 'unread') {
      return unreadNotifications.value
    }
    if (activeFilter.value === 'invitations') {
      return notifications.value.filter(n => n.type === 'clinic_invitation')
    }
    return notifications.value
  })

  const isRead = (id: string | number) => {
    return (readNotifs.value || []).includes(id)
  }

  const handleOpenDetail = (notif: AppNotification) => {
    selectedNotification.value = notif
    isDetailModalOpen.value = true

    // Auto-mark as read
    if (notif.id !== undefined && notif.id !== null) {
      const arr = [...(readNotifs.value || [])]
      if (!arr.includes(notif.id)) {
        arr.push(notif.id)
        readNotifs.value = arr
      }
    }
  }

  const handleDismiss = (id: string | number) => {
    const arr = [...(dismissedNotifs.value || [])]
    if (!arr.includes(id)) {
      arr.push(id)
      dismissedNotifs.value = arr
    }
  }

  const markAllAsRead = () => {
    const arr = [...(readNotifs.value || [])]
    notifications.value.forEach(n => {
      if (!arr.includes(n.id)) arr.push(n.id)
    })
    readNotifs.value = arr
  }
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
      <div class="space-y-1">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon name="solar:bell-bing-bold" class="text-2xl" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-black text-foreground">Notifications</h1>
              <span
                v-if="unreadNotifications.length > 0"
                class="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-bold"
              >
                {{ unreadNotifications.length }} New
              </span>
            </div>
            <p class="text-xs sm:text-sm text-muted-foreground">
              Stay updated on your clinic invitations, appointment schedules, and practice updates.
            </p>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="flex items-center gap-2">
        <AppButton
          v-if="unreadNotifications.length > 0"
          variant="outline"
          size="sm"
          @click="markAllAsRead"
        >
          <Icon name="solar:check-read-linear" class="mr-1.5 text-base" />
          Mark all as read
        </AppButton>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        @click="activeFilter = 'all'"
        class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer"
        :class="activeFilter === 'all' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'"
      >
        <span>All</span>
        <span
          class="rounded-full px-2 py-0.5 text-[10px]"
          :class="activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-foreground/10 text-foreground'"
        >
          {{ notifications.length }}
        </span>
      </button>

      <button
        type="button"
        @click="activeFilter = 'unread'"
        class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer"
        :class="activeFilter === 'unread' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'"
      >
        <span>Unread</span>
        <span
          class="rounded-full px-2 py-0.5 text-[10px]"
          :class="activeFilter === 'unread' ? 'bg-white/20 text-white' : 'bg-foreground/10 text-foreground'"
        >
          {{ unreadNotifications.length }}
        </span>
      </button>

      <button
        v-if="userRole === 'doctor' || invitationsCount > 0"
        type="button"
        @click="activeFilter = 'invitations'"
        class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer"
        :class="activeFilter === 'invitations' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'"
      >
        <Icon name="solar:user-plus-bold" class="text-sm" />
        <span>Invitations</span>
        <span
          v-if="invitationsCount > 0"
          class="rounded-full px-2 py-0.5 text-[10px]"
          :class="activeFilter === 'invitations' ? 'bg-white/20 text-white' : 'bg-primary/20 text-primary font-black'"
        >
          {{ invitationsCount }}
        </span>
      </button>
    </div>

    <!-- Notifications List -->
    <div v-if="filteredNotifications.length > 0" class="space-y-3">
      <div
        v-for="notif in filteredNotifications"
        :key="notif.id"
        @click="handleOpenDetail(notif)"
        class="group relative flex cursor-pointer items-start gap-4 rounded-3xl border p-4 sm:p-5 transition-all shadow-sm hover:shadow-md active:scale-[0.99]"
        :class="[
          notif.type === 'clinic_invitation'
            ? 'border-primary/40 bg-primary/5 hover:border-primary/70'
            : (isRead(notif.id)
                ? 'border-border/50 bg-card/60 hover:bg-card hover:border-border'
                : 'border-primary/30 bg-card hover:border-primary/50 ring-1 ring-primary/10')
        ]"
      >
        <!-- Icon Squircle -->
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105"
          :class="[
            notif.color + ' bg-opacity-10 bg-current',
            isRead(notif.id) ? 'opacity-60' : 'opacity-100'
          ]"
        >
          <Icon :name="notif.icon || 'solar:bell-linear'" class="text-2xl" />
        </div>

        <!-- Notification Details -->
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <h3
                class="text-sm sm:text-base transition-colors"
                :class="isRead(notif.id) ? 'font-semibold text-foreground/80' : 'font-black text-foreground'"
              >
                {{ notif.title }}
              </h3>
              <!-- Unread dot -->
              <span
                v-if="!isRead(notif.id)"
                class="inline-block h-2 w-2 rounded-full bg-primary"
                title="Unread notification"
              ></span>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {{ notif.time }}
              </span>
              <button
                type="button"
                @click.stop="handleDismiss(notif.id)"
                class="text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-full p-1 transition-colors"
                title="Dismiss"
              >
                <Icon name="lucide:x" class="text-sm" />
              </button>
            </div>
          </div>

          <p
            class="text-xs sm:text-sm leading-relaxed transition-colors"
            :class="isRead(notif.id) ? 'text-muted-foreground/70' : 'text-muted-foreground'"
          >
            {{ notif.description }}
          </p>

          <!-- Action tag badge -->
          <div class="pt-1 flex items-center gap-2">
            <span
              v-if="notif.type === 'clinic_invitation'"
              class="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[11px] font-bold shadow-sm"
            >
              <Icon name="solar:user-plus-bold" class="text-xs" />
              Review & Respond to Invite
            </span>
            <span
              v-else
              class="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1"
            >
              <span>Click to view details</span>
              <Icon name="solar:arrow-right-linear" class="text-xs" />
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="border border-border/60 bg-card rounded-3xl p-12 text-center space-y-4"
    >
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground/40">
        <Icon name="solar:bell-bing-linear" class="text-3xl" />
      </div>
      <div class="space-y-1">
        <h3 class="text-base font-bold text-foreground">No notifications found</h3>
        <p class="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
          {{ activeFilter === 'unread' ? "You're all caught up! There are no unread notifications right now." : (activeFilter === 'invitations' ? "You have no pending clinic seat invitations." : "You do not have any notifications at the moment.") }}
        </p>
      </div>
    </div>

    <!-- Notification Detail Modal -->
    <AppModalNotificationDetail
      v-model="isDetailModalOpen"
      :notification="selectedNotification"
      @close="isDetailModalOpen = false"
      @invitation-accepted="() => { refreshProfile(); fetchAppointments(); }"
      @invitation-declined="() => { refreshProfile(); fetchAppointments(); }"
    />
  </div>
</template>
