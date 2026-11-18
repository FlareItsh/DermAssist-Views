<script setup lang="ts">
  import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { userService } from '~/api/user/UserService'
  import { authService } from '~/api/auth/AuthService'
  import {
    usePrescriptions,
    type PendingTodayMedication,
    type PendingTodayPrescriptionGroup
  } from '~/composables/usePrescriptions'
  import { useAuth } from '~/composables/useAuth'

  const route = useRoute()
  const { searchQuery } = useSearch()
  const { getStorageUrl } = useStorage()
  const { unreadNotifications } = useAppNotifications()
  const { hasUnseenUpdate, fetchPublishedPatchNotes } = usePatchNotes()
  const { allAppointments } = useAppointments()
  const { uuid: authUserUuid } = useAuth()
  const {
    pendingTodayGroups,
    pendingTodayMedications,
    fetchPrescriptionsAndLogs,
    isMedicationUpdating,
    setMedicationStatus,
    dismissAllPendingForToday
  } = usePrescriptions()

  const isMedReminderOpen = ref(false)
  const currentMedRxIndex = ref(0)
  const currentMedItemIndex = ref(0)
  const medCardTouchStartX = ref(0)
  const medReminderRef = ref<HTMLElement | null>(null)

  watch(
    () => pendingTodayGroups.value.length,
    newLen => {
      if (newLen === 0) {
        currentMedRxIndex.value = 0
        currentMedItemIndex.value = 0
        isMedReminderOpen.value = false
      } else if (currentMedRxIndex.value >= newLen) {
        currentMedRxIndex.value = Math.max(0, newLen - 1)
      }
    }
  )

  const activeMedRxGroup = computed<PendingTodayPrescriptionGroup | null>(() => {
    return pendingTodayGroups.value[currentMedRxIndex.value] || null
  })

  watch(
    () => activeMedRxGroup.value?.prescriptionKey,
    (newKey, oldKey) => {
      if (newKey !== oldKey) {
        currentMedItemIndex.value = 0
      }
    }
  )

  watch(
    () => activeMedRxGroup.value?.entries.length ?? 0,
    newLen => {
      if (newLen === 0) {
        currentMedItemIndex.value = 0
      } else if (currentMedItemIndex.value >= newLen) {
        currentMedItemIndex.value = Math.max(0, newLen - 1)
      }
    }
  )

  const activeMedEntry = computed<PendingTodayMedication | null>(() => {
    return activeMedRxGroup.value?.entries[currentMedItemIndex.value] || null
  })

  const MAX_VISIBLE_MED_DOTS = 5

  const visibleMedDots = computed(() => {
    const entries = activeMedRxGroup.value?.entries ?? []
    const total = entries.length
    if (total <= 1) return []

    const activeIdx = currentMedItemIndex.value
    const start =
      total <= MAX_VISIBLE_MED_DOTS
        ? 0
        : Math.min(Math.max(0, activeIdx - 2), total - MAX_VISIBLE_MED_DOTS)
    const end = Math.min(total, start + MAX_VISIBLE_MED_DOTS)

    return entries.slice(start, end).map((medEntry, offset) => {
      const realIndex = start + offset
      const isLeftEdgeOverflow = offset === 0 && start > 0
      const isRightEdgeOverflow = offset === end - start - 1 && end < total
      return {
        index: realIndex,
        key: medEntry.item.key,
        isActive: realIndex === activeIdx,
        isEdgeOverflow: (isLeftEdgeOverflow || isRightEdgeOverflow) && realIndex !== activeIdx
      }
    })
  })

  const handlePrevMedRx = () => {
    isMedReminderOpen.value = true
    if (currentMedRxIndex.value > 0) {
      currentMedRxIndex.value -= 1
      currentMedItemIndex.value = 0
    }
  }

  const handleNextMedRx = () => {
    isMedReminderOpen.value = true
    if (currentMedRxIndex.value < pendingTodayGroups.value.length - 1) {
      currentMedRxIndex.value += 1
      currentMedItemIndex.value = 0
    }
  }

  const handlePrevMedItem = () => {
    isMedReminderOpen.value = true
    if (currentMedItemIndex.value > 0) {
      currentMedItemIndex.value -= 1
    }
  }

  const handleNextMedItem = () => {
    isMedReminderOpen.value = true
    const total = activeMedRxGroup.value?.entries.length ?? 0
    if (currentMedItemIndex.value < total - 1) {
      currentMedItemIndex.value += 1
    }
  }

  const handleSelectMedItem = (idx: number) => {
    isMedReminderOpen.value = true
    currentMedItemIndex.value = idx
  }

  const handleMedCardTouchStart = (e: TouchEvent) => {
    medCardTouchStartX.value = e.touches[0]?.clientX ?? 0
  }

  const handleMedCardTouchEnd = (e: TouchEvent) => {
    const endX = e.changedTouches[0]?.clientX ?? 0
    const deltaX = medCardTouchStartX.value - endX
    if (Math.abs(deltaX) > 36) {
      if (deltaX > 0) {
        handleNextMedItem()
      } else {
        handlePrevMedItem()
      }
    }
  }

  const formatDurationLabel = (duration?: string | null): string => {
    if (!duration) return ''
    const trimmed = duration.trim()
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed)
      return `${n} ${n === 1 ? 'day' : 'days'}`
    }
    return trimmed
  }

  const toggleMedReminder = () => {
    isMedReminderOpen.value = !isMedReminderOpen.value
    if (isMedReminderOpen.value) {
      isDropdownOpen.value = false
    }
  }

  const closeMedReminder = () => {
    isMedReminderOpen.value = false
  }

  const handleClickOutsideMedReminder = (event: MouseEvent | TouchEvent) => {
    if (!isMedReminderOpen.value) return
    const target = event.target as Node | null
    if (!target || !target.isConnected) return
    if (medReminderRef.value && !medReminderRef.value.contains(target)) {
      isMedReminderOpen.value = false
    }
  }

  const handleMarkMedTaken = async (entry: PendingTodayMedication) => {
    await setMedicationStatus(entry.prescriptionKey, entry.item.key, 'taken', entry.item.medication)
    if (pendingTodayMedications.value.length === 0) {
      isMedReminderOpen.value = false
    }
  }

  const handleDismissMedReminder = async () => {
    isMedReminderOpen.value = false
    if (pendingTodayMedications.value.length === 0) return
    await dismissAllPendingForToday(pendingTodayMedications.value)
  }

  watch(
    () => allAppointments.value.length,
    () => {
      fetchPrescriptionsAndLogs(true)
    }
  )

  const { data: response } = userService.useShow(() => authUserUuid.value, {
    key: `userProfile-${authUserUuid.value}`
  })

  const user = computed(() => (response.value as any)?.data ?? response.value)
  const firstName = computed(() => user.value?.first_name || 'there')

  const isDropdownOpen = ref(false)
  const isLogoutModalOpen = ref(false)
  const avatarError = ref(false)

  const handleAvatarError = () => {
    avatarError.value = true
  }

  const closeDropdown = () => {
    isDropdownOpen.value = false
  }

  const triggerLogout = () => {
    isDropdownOpen.value = false
    isLogoutModalOpen.value = true
  }

  const logout = async () => {
    isLogoutModalOpen.value = false
    try {
      await authService.logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      useSessionCleanup().clearSessionCaches()
      if (import.meta.client) {
        window.location.href = '/auth/login'
      } else {
        await navigateTo('/auth/login')
      }
    }
  }

  const greeting = ref('Good day')
  const todayLabel = ref('')
  let greetingTimer: any = null
  const isScrolled = ref(false)
  const headerRoot = ref<HTMLElement | null>(null)

  const closeLogoutModal = () => {
    isLogoutModalOpen.value = false
  }

  let touchStartY = 0

  const getSnapTarget = () => {
    if (!headerRoot.value) return 140
    return headerRoot.value.offsetHeight - 80
  }

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement
    isScrolled.value = target.scrollTop > 2
  }

  const handleTouchStart = (e: TouchEvent) => {
    touchStartY = e.touches[0].clientY
  }

  const handleTouchEnd = (e: TouchEvent) => {
    const target = document.getElementById('main-content')
    if (!target) return

    const currentScrollTop = target.scrollTop
    const touchEndY = e.changedTouches[0].clientY
    const deltaY = touchStartY - touchEndY // Positive means swiped up (scrolled down)
    const snapTarget = getSnapTarget()

    // Allow snapping from the absolute top (currentScrollTop >= 0)
    if (currentScrollTop >= 0 && currentScrollTop < snapTarget - 10) {
      if (deltaY > 10) {
        target.scrollTo({ top: snapTarget, behavior: 'smooth' })
      } else if (deltaY < -10 && currentScrollTop > 0) {
        target.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  const isDashboard = computed(() => {
    const path = route.path.toLowerCase().replace(/\/$/, '')
    return path === '/patient'
  })

  onMounted(() => {
    const updateGreeting = () => {
      const now = new Date()
      const h = now.getHours()
      if (h < 12) {
        greeting.value = 'Good morning'
      } else if (h < 18) {
        greeting.value = 'Good afternoon'
      } else {
        greeting.value = 'Good evening'
      }
      todayLabel.value = now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      })
    }
    updateGreeting()
    greetingTimer = setInterval(updateGreeting, 60000)
    fetchPublishedPatchNotes()
    fetchPrescriptionsAndLogs()

    // Attach touch and scroll listeners directly to main-content
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.addEventListener('scroll', handleScroll, { passive: true })
      mainContent.addEventListener('touchstart', handleTouchStart, { passive: true })
      mainContent.addEventListener('touchend', handleTouchEnd, { passive: true })
    }
    document.addEventListener('mousedown', handleClickOutsideMedReminder)
    document.addEventListener('touchstart', handleClickOutsideMedReminder, { passive: true })
  })

  onUnmounted(() => {
    if (greetingTimer) {
      clearInterval(greetingTimer)
    }
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.removeEventListener('scroll', handleScroll)
      mainContent.removeEventListener('touchstart', handleTouchStart)
      mainContent.removeEventListener('touchend', handleTouchEnd)
    }
    document.removeEventListener('mousedown', handleClickOutsideMedReminder)
    document.removeEventListener('touchstart', handleClickOutsideMedReminder)
  })
</script>

<template>
  <div
    class="relative w-full"
    ref="headerRoot"
  >
    <!-- FIXED TOP ROW -->
    <div
      class="bg-primary fixed top-0 right-0 left-0 z-50 px-4 pt-4 pb-4 transition-all duration-150 sm:px-6"
      :class="[!isDashboard ? 'rounded-b-[32px]' : isScrolled ? 'rounded-b-[32px]' : '']"
    >
      <div
        class="pointer-events-none absolute inset-0 transition-all duration-150"
        :class="[
          !isDashboard || isScrolled
            ? 'overflow-hidden rounded-b-[32px]'
            : 'overflow-x-clip overflow-y-visible'
        ]"
      >
        <div
          class="absolute -top-[88px] -right-[88px] h-[256px] w-[256px] rounded-full bg-white/8"
        ></div>
      </div>

      <div class="relative z-20 flex items-center justify-between">
        <NuxtLink
          to="/patient"
          class="flex items-center"
        >
          <NuxtImg
            src="/DA_Logo.png"
            class="h-12 brightness-0 invert"
            alt="DermAssist"
          />
        </NuxtLink>

        <div class="flex items-center gap-2.5">
          <!-- What's New Pill (appears when there's an unseen update) -->
          <NuxtLink
            v-if="hasUnseenUpdate"
            to="/patient/updates"
            class="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-white/30 active:scale-95"
          >
            <Icon
              name="lucide:sparkles"
              size="15"
              class="text-amber-300"
            />
            <span>What's New</span>
            <span class="relative flex h-2 w-2">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"
              ></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-amber-400"></span>
            </span>
          </NuxtLink>

          <!-- Daily Medication Reminder Button (Mobile Top Navbar beside Bell & User) -->
          <div
            v-if="pendingTodayMedications.length > 0"
            ref="medReminderRef"
            class="relative"
          >
            <button
              type="button"
              @click="toggleMedReminder"
              class="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-white transition-all hover:bg-white/30 focus:outline-none active:scale-95"
              title="Daily Medication Reminder"
              aria-label="Daily Medication Reminder"
            >
              <Icon
                name="lucide:pill"
                class="text-lg"
              />
              <span
                class="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center"
              >
                <span
                  class="bg-destructive absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                />
                <span
                  class="bg-destructive relative inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white"
                >
                  {{ pendingTodayMedications.length }}
                </span>
              </span>
            </button>

            <!-- Mobile Medication Reminder Popover -->
            <Transition
              enter-active-class="transition duration-200 ease-out"
              enter-from-class="opacity-0 -translate-y-2 scale-95"
              enter-to-class="opacity-100 translate-y-0 scale-100"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="opacity-100 translate-y-0 scale-100"
              leave-to-class="opacity-0 -translate-y-2 scale-95"
            >
              <div
                v-if="isMedReminderOpen"
                class="bg-card border-border fixed top-[74px] right-3 left-3 z-[60] rounded-2xl border p-4 shadow-xl"
                role="region"
                aria-label="Daily Medication Reminder"
                @mousedown.stop
                @touchstart.stop
              >
                <div
                  class="border-border/60 flex items-center justify-between gap-3 border-b pb-2.5"
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="bg-destructive h-2 w-2 shrink-0 rounded-full" />
                    <h3 class="text-foreground truncate text-xs font-semibold tracking-tight">
                      Daily Medication Reminder
                    </h3>
                    <span class="text-muted-foreground shrink-0 text-xs">
                      &middot; {{ pendingTodayMedications.length }} due today
                    </span>
                  </div>

                  <button
                    type="button"
                    @click="closeMedReminder"
                    class="text-muted-foreground hover:text-foreground hover:bg-muted -mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
                    title="Close reminder"
                    aria-label="Close reminder"
                  >
                    <Icon
                      name="lucide:x"
                      class="text-xs"
                    />
                  </button>
                </div>

                <div v-if="activeMedRxGroup">
                  <!-- Compact Prescription Sub-Header & Pager -->
                  <div
                    class="border-border/60 flex items-center justify-between gap-2 border-b py-2"
                  >
                    <div class="min-w-0">
                      <p class="text-foreground truncate text-xs font-semibold">
                        Prescribed by {{ activeMedRxGroup.doctorName }}
                      </p>
                      <p class="text-muted-foreground truncate text-[10px]">
                        Issued {{ activeMedRxGroup.dateFormatted }} &middot;
                        {{ activeMedRxGroup.prescriptionNumber }}
                      </p>
                    </div>

                    <div class="flex shrink-0 items-center gap-1.5">
                      <span
                        v-if="activeMedRxGroup.conditionLabel"
                        class="bg-muted text-muted-foreground max-w-[100px] shrink-0 truncate rounded-md px-2 py-0.5 text-[10px] font-medium"
                      >
                        {{ activeMedRxGroup.conditionLabel }}
                      </span>

                      <div
                        v-if="pendingTodayGroups.length > 1"
                        class="flex shrink-0 items-center gap-1"
                      >
                        <AppButton
                          variant="ghost"
                          size="unstyled"
                          rounded="full"
                          :disabled="currentMedRxIndex === 0"
                          @click.stop="handlePrevMedRx"
                          class="flex h-6 w-6 items-center justify-center"
                          aria-label="Newer prescription"
                        >
                          <Icon
                            name="lucide:chevron-left"
                            class="text-sm"
                          />
                        </AppButton>
                        <span class="text-muted-foreground text-[11px] font-semibold">
                          {{ currentMedRxIndex + 1 }}/{{ pendingTodayGroups.length }}
                        </span>
                        <AppButton
                          variant="ghost"
                          size="unstyled"
                          rounded="full"
                          :disabled="currentMedRxIndex >= pendingTodayGroups.length - 1"
                          @click.stop="handleNextMedRx"
                          class="flex h-6 w-6 items-center justify-center"
                          aria-label="Older prescription"
                        >
                          <Icon
                            name="lucide:chevron-right"
                            class="text-sm"
                          />
                        </AppButton>
                      </div>
                    </div>
                  </div>

                  <div
                    class="mt-2.5"
                    @touchstart.passive="handleMedCardTouchStart"
                    @touchend.passive="handleMedCardTouchEnd"
                  >
                    <Transition
                      name="med-slide"
                      mode="out-in"
                    >
                      <div
                        v-if="activeMedEntry"
                        :key="`${activeMedEntry.prescriptionKey}-${activeMedEntry.item.key}`"
                        class="flex flex-col"
                      >
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <p class="text-foreground text-sm leading-snug font-bold break-words">
                                {{ activeMedEntry.item.medication }}
                              </p>
                              <span
                                v-if="activeMedEntry.item.quantity"
                                class="text-muted-foreground text-xs font-medium"
                              >
                                {{ activeMedEntry.item.quantity }}
                              </span>
                            </div>

                            <p
                              v-if="activeMedEntry.item.frequency || activeMedEntry.item.duration"
                              class="text-muted-foreground mt-0.5 text-xs leading-snug break-words"
                            >
                              <span v-if="activeMedEntry.item.frequency">{{
                                activeMedEntry.item.frequency
                              }}</span>
                              <span
                                v-if="activeMedEntry.item.frequency && activeMedEntry.item.duration"
                              >
                                &middot;
                              </span>
                              <span v-if="activeMedEntry.item.duration">{{
                                formatDurationLabel(activeMedEntry.item.duration)
                              }}</span>
                            </p>
                          </div>

                          <div class="flex shrink-0 items-center">
                            <AppButton
                              variant="solid"
                              size="sm"
                              :loading="
                                isMedicationUpdating(
                                  activeMedEntry.prescriptionKey,
                                  activeMedEntry.item.key
                                )
                              "
                              @click="handleMarkMedTaken(activeMedEntry)"
                              class="!h-8 !rounded-lg !px-3 !text-xs"
                            >
                              <span>Mark as taken</span>
                            </AppButton>
                          </div>
                        </div>

                        <div
                          v-if="activeMedEntry.item.instructions"
                          class="border-primary bg-muted/60 mt-2 w-full rounded-r-md border-l-2 px-2.5 py-1.5"
                        >
                          <div
                            class="custom-scrollbar max-h-16 overflow-x-hidden overflow-y-auto pr-1"
                          >
                            <p class="text-foreground text-xs leading-snug font-medium break-words">
                              <span class="text-primary font-semibold">Doctor's instruction:</span>
                              {{ activeMedEntry.item.instructions }}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Transition>

                    <!-- Medicine Dot Pagination (Hidden when only 1 medicine remains in this prescription) -->
                    <div
                      v-if="activeMedRxGroup.entries.length > 1"
                      class="mt-2.5 flex items-center justify-center gap-2 pt-0.5"
                    >
                      <button
                        type="button"
                        :disabled="currentMedItemIndex === 0"
                        @click.stop="handlePrevMedItem"
                        class="text-muted-foreground hover:text-foreground flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-30"
                        aria-label="Previous medicine"
                      >
                        <Icon
                          name="lucide:chevron-left"
                          class="text-xs"
                        />
                      </button>

                      <div class="flex items-center gap-1.5">
                        <button
                          v-for="dot in visibleMedDots"
                          :key="dot.key"
                          type="button"
                          @click.stop="handleSelectMedItem(dot.index)"
                          :aria-label="`Go to medicine ${dot.index + 1}`"
                          class="cursor-pointer rounded-full transition-all duration-200"
                          :class="
                            dot.isActive
                              ? 'bg-primary h-2 w-2 scale-110'
                              : dot.isEdgeOverflow
                                ? 'bg-muted-foreground/25 hover:bg-muted-foreground/45 h-1.5 w-1.5'
                                : 'bg-muted-foreground/30 hover:bg-muted-foreground/50 h-2 w-2'
                          "
                        />
                      </div>

                      <button
                        type="button"
                        :disabled="currentMedItemIndex >= activeMedRxGroup.entries.length - 1"
                        @click.stop="handleNextMedItem"
                        class="text-muted-foreground hover:text-foreground flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-30"
                        aria-label="Next medicine"
                      >
                        <Icon
                          name="lucide:chevron-right"
                          class="text-xs"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Notification Bell -->
          <NuxtLink
            to="/patient/notifications"
            class="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-white transition-all hover:bg-white/30 focus:outline-none"
            title="Notifications"
          >
            <Icon
              name="solar:bell-bold"
              class="text-xl"
            />
            <span
              v-if="unreadNotifications.length > 0"
              class="bg-destructive absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white"
            >
              {{ unreadNotifications.length > 9 ? '9+' : unreadNotifications.length }}
            </span>
          </NuxtLink>

          <div class="relative">
            <button
              @click="isDropdownOpen = !isDropdownOpen"
              class="relative z-50 flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-white/40 bg-white/20 focus:outline-none"
            >
              <img
                v-if="(user?.avatar_url || user?.avatar_path) && !avatarError"
                :src="getStorageUrl(user.avatar_url || user.avatar_path)"
                class="h-full w-full object-cover"
                alt="Avatar"
                @error="handleAvatarError"
              />
              <span
                v-else
                class="text-sm font-bold text-white"
                >{{ firstName.charAt(0).toUpperCase() }}</span
              >
            </button>

            <!-- Modern Touch-first Mobile Profile Sheet -->
            <AppMobileProfileSheet
              v-model="isDropdownOpen"
              role="patient"
              :display-name="
                user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Patient'
              "
              :email="user?.email"
              :avatar-url="
                (user?.avatar_url || user?.avatar_path) && !avatarError
                  ? getStorageUrl(user.avatar_url || user.avatar_path)
                  : null
              "
              :initial="firstName.charAt(0).toUpperCase()"
              :has-unseen-update="hasUnseenUpdate"
              @logout="triggerLogout"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- SPACER to offset the fixed top row -->
    <div class="h-[76px] w-full"></div>

    <!-- SCROLLING SECTION -->
    <div
      v-if="isDashboard"
      class="bg-primary relative z-10 -mt-6 overflow-hidden rounded-b-[32px] px-4 pt-6 pb-7 sm:px-6 sm:pb-8"
    >
      <div
        class="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/6"
      ></div>

      <div
        class="relative mx-auto flex max-w-5xl flex-col gap-5 pt-4 md:flex-row md:items-end md:justify-between md:gap-8"
      >
        <div
          class="min-w-0 transform transition-all duration-300 ease-out"
          :class="
            isScrolled
              ? '-translate-y-3 scale-[0.98] opacity-0'
              : 'translate-y-0 scale-100 opacity-100'
          "
        >
          <p class="text-xs font-semibold tracking-wide text-white/60 uppercase">
            {{ todayLabel }}
          </p>
          <h1 class="mt-1 text-[28px] leading-tight font-black text-white sm:text-3xl">
            {{ greeting }}, {{ firstName }}
          </h1>
          <p class="mt-1 text-sm text-white/70">How are you today?</p>
        </div>

        <div
          class="w-full transform transition-all delay-75 duration-300 ease-out md:max-w-sm"
          :class="
            isScrolled
              ? '-translate-y-3 scale-[0.98] opacity-0'
              : 'translate-y-0 scale-100 opacity-100'
          "
        >
          <div
            class="mt-10 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/20 px-4 py-3 backdrop-blur-sm transition focus-within:bg-white/25"
          >
            <Icon
              name="solar:magnifer-linear"
              class="shrink-0 text-white/60"
              size="18"
            />
            <input
              type="text"
              placeholder="Search doctors, conditions..."
              v-model="searchQuery"
              class="min-w-0 flex-1 bg-transparent text-sm font-medium text-white placeholder-white/50 outline-none"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="searchQuery = ''"
              class="shrink-0 text-white/60 hover:text-white"
            >
              <Icon
                name="heroicons:x-mark-20-solid"
                size="16"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="isLogoutModalOpen"
          class="bg-foreground/40 fixed inset-0 z-[999] flex items-center justify-center p-4"
          @click.self="closeLogoutModal"
        >
          <AppModalLogoutConfirmation
            @close="closeLogoutModal"
            @confirm="logout"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }

  .dropdown-enter-from,
  .dropdown-leave-to {
    opacity: 0;
    transform: translateY(-4px) scale(0.97);
  }

  .med-slide-enter-active,
  .med-slide-leave-active {
    transition:
      opacity 0.16s ease,
      transform 0.16s ease;
  }

  .med-slide-enter-from {
    opacity: 0;
    transform: translateX(8px);
  }

  .med-slide-leave-to {
    opacity: 0;
    transform: translateX(-8px);
  }
</style>
