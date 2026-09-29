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
    <div
      class="border-border/60 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="space-y-1">
        <div class="flex items-center gap-3">
          <div
            class="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-2xl"
          >
            <Icon
              name="solar:bell-bing-bold"
              class="text-2xl"
            />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-foreground text-2xl font-black">Notifications</h1>
              <span
                v-if="unreadNotifications.length > 0"
                class="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-bold"
              >
                {{ unreadNotifications.length }} New
              </span>
            </div>
            <p class="text-muted-foreground text-xs sm:text-sm">
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
          <Icon
            name="solar:check-read-linear"
            class="mr-1.5 text-base"
          />
          Mark all as read
        </AppButton>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        @click="activeFilter = 'all'"
        class="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all"
        :class="
          activeFilter === 'all'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
        "
      >
        <span>All</span>
        <span
          class="rounded-full px-2 py-0.5 text-[10px]"
          :class="
            activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-foreground/10 text-foreground'
          "
        >
          {{ notifications.length }}
        </span>
      </button>

      <button
        type="button"
        @click="activeFilter = 'unread'"
        class="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all"
        :class="
          activeFilter === 'unread'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
        "
      >
        <span>Unread</span>
        <span
          class="rounded-full px-2 py-0.5 text-[10px]"
          :class="
            activeFilter === 'unread'
              ? 'bg-white/20 text-white'
              : 'bg-foreground/10 text-foreground'
          "
        >
          {{ unreadNotifications.length }}
        </span>
      </button>

      <button
        v-if="userRole === 'doctor' || invitationsCount > 0"
        type="button"
        @click="activeFilter = 'invitations'"
        class="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all"
        :class="
          activeFilter === 'invitations'
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
        "
      >
        <Icon
          name="solar:user-plus-bold"
          class="text-sm"
        />
        <span>Invitations</span>
        <span
          v-if="invitationsCount > 0"
          class="rounded-full px-2 py-0.5 text-[10px]"
          :class="
            activeFilter === 'invitations'
              ? 'bg-white/20 text-white'
              : 'bg-primary/20 text-primary font-black'
          "
        >
          {{ invitationsCount }}
        </span>
      </button>
    </div>

    <!-- Notifications List -->
    <div
      v-if="filteredNotifications.length > 0"
      class="space-y-3"
    >
      <div
        v-for="notif in filteredNotifications"
        :key="notif.id"
        @click="handleOpenDetail(notif)"
        class="group relative flex cursor-pointer items-start gap-4 rounded-3xl border p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99] sm:p-5"
        :class="[
          notif.type === 'clinic_invitation'
            ? 'border-primary/40 bg-primary/5 hover:border-primary/70'
            : isRead(notif.id)
              ? 'border-border/50 bg-card/60 hover:bg-card hover:border-border'
              : 'border-primary/30 bg-card hover:border-primary/50 ring-primary/10 ring-1'
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
          <Icon
            :name="notif.icon || 'solar:bell-linear'"
            class="text-2xl"
          />
        </div>

        <!-- Notification Details -->
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <h3
                class="text-sm transition-colors sm:text-base"
                :class="
                  isRead(notif.id)
                    ? 'text-foreground/80 font-semibold'
                    : 'text-foreground font-black'
                "
              >
                {{ notif.title }}
              </h3>
              <!-- Unread dot -->
              <span
                v-if="!isRead(notif.id)"
                class="bg-primary inline-block h-2 w-2 rounded-full"
                title="Unread notification"
              ></span>
            </div>

            <div class="flex items-center gap-2">
              <span
                class="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase"
              >
                {{ notif.time }}
              </span>
              <button
                type="button"
                @click.stop="handleDismiss(notif.id)"
                class="text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-full p-1 transition-colors"
                title="Dismiss"
              >
                <Icon
                  name="lucide:x"
                  class="text-sm"
                />
              </button>
            </div>
          </div>

          <p
            class="text-xs leading-relaxed transition-colors sm:text-sm"
            :class="isRead(notif.id) ? 'text-muted-foreground/70' : 'text-muted-foreground'"
          >
            {{ notif.description }}
          </p>

          <!-- Action tag badge -->
          <div class="flex items-center gap-2 pt-1">
            <span
              v-if="notif.type === 'clinic_invitation'"
              class="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm"
            >
              <Icon
                name="solar:user-plus-bold"
                class="text-xs"
              />
              Review & Respond to Invite
            </span>
            <span
              v-else
              class="text-primary inline-flex items-center gap-1 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100"
            >
              <span>Click to view details</span>
              <Icon
                name="solar:arrow-right-linear"
                class="text-xs"
              />
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="border-border/60 bg-card space-y-4 rounded-3xl border p-12 text-center"
    >
      <div
        class="bg-muted text-muted-foreground/40 mx-auto flex h-16 w-16 items-center justify-center rounded-full"
      >
        <Icon
          name="solar:bell-bing-linear"
          class="text-3xl"
        />
      </div>
      <div class="space-y-1">
        <h3 class="text-foreground text-base font-bold">No notifications found</h3>
        <p class="text-muted-foreground mx-auto max-w-sm text-xs sm:text-sm">
          {{
            activeFilter === 'unread'
              ? "You're all caught up! There are no unread notifications right now."
              : activeFilter === 'invitations'
                ? 'You have no pending clinic seat invitations.'
                : 'You do not have any notifications at the moment.'
          }}
        </p>
      </div>
    </div>

    <!-- Notification Detail Modal -->
    <AppModalNotificationDetail
      v-model="isDetailModalOpen"
      :notification="selectedNotification"
      @close="isDetailModalOpen = false"
      @invitation-accepted="
        () => {
          refreshProfile()
          fetchAppointments()
        }
      "
      @invitation-declined="
        () => {
          refreshProfile()
          fetchAppointments()
        }
      "
    />
  </div>
</template>
