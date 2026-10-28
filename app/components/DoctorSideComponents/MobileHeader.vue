<script setup lang="ts">
  import { computed, ref, onMounted, onUnmounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { userService } from '~/api/user/UserService'
  import { authService } from '~/api/auth/AuthService'

  const route = useRoute()
  const { searchQuery } = useSearch()
  const { getStorageUrl } = useStorage()
  const { hasUnseenUpdate, fetchPublishedPatchNotes } = usePatchNotes()
  const { unreadNotifications } = useAppNotifications()
  const { todayAppointments } = useAppointments()

  const { data: response } = userService.useShow(useCookie('user_uuid').value as string, {
    key: `userProfile-${useCookie('user_uuid').value}`
  })

  const user = computed(() => (response.value as any)?.data ?? response.value)
  const doctorInitial = computed(() =>
    String(user.value?.first_name || user.value?.last_name || 'D')
      .charAt(0)
      .toUpperCase()
  )
  const doctorDisplayName = computed(() => {
    const surname = user.value?.last_name || user.value?.first_name
    return surname ? `Dr. ${surname}` : 'Doctor'
  })

  const unreadCount = computed(() => unreadNotifications.value.length)
  const avatarError = ref(false)
  const handleAvatarError = () => {
    avatarError.value = true
  }

  const menuLinks = computed(() => [
    { icon: 'solar:user-bold-duotone', label: 'Profile Settings', to: '/doctor/profile' },
    { icon: 'solar:pill-bold-duotone', label: 'Medicine Library', to: '/doctor/medicines' },
    { icon: 'solar:folder-with-files-bold-duotone', label: 'Records', to: '/doctor/records' },
    {
      icon: 'solar:users-group-two-rounded-bold-duotone',
      label: 'Secretaries',
      to: '/doctor/secretaries'
    },
    { icon: 'solar:database-bold-duotone', label: 'Dataset', to: '/doctor/dataset' },
    { icon: 'solar:card-bold-duotone', label: 'Subscription', to: '/doctor/subscription' }
  ])

  const isDropdownOpen = ref(false)
  const isLogoutModalOpen = ref(false)

  const toggleDropdown = () => {
    isDropdownOpen.value = !isDropdownOpen.value
  }

  const closeDropdown = () => {
    isDropdownOpen.value = false
  }

  const triggerLogout = () => {
    isDropdownOpen.value = false
    isLogoutModalOpen.value = true
  }

  const closeLogoutModal = () => {
    isLogoutModalOpen.value = false
  }

  const clearSearch = () => {
    searchQuery.value = ''
  }

  const logout = async () => {
    isLogoutModalOpen.value = false
    try {
      await authService.logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      useDiagnosis().resetScanner()
      useCookie('auth_token').value = null
      useCookie('user_role').value = null
      useCookie('user_uuid').value = null
      useCookie('user_name').value = null
      useCookie('auth_user_name').value = null
      await navigateTo('/auth/login')
    }
  }

  const isDashboard = computed(() => {
    const path = route.path.toLowerCase().replace(/\/$/, '')
    return path === '/doctor'
  })

  const greeting = ref('Good day')
  const todayLabel = ref('')
  const isScrolled = ref(false)
  const headerRoot = ref<HTMLElement | null>(null)
  let greetingTimer: ReturnType<typeof setInterval> | null = null

  let touchStartY = 0

  const getSnapTarget = () => {
    if (!headerRoot.value) return 140
    return headerRoot.value.offsetHeight - 80
  }

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

  onMounted(() => {
    updateGreeting()
    greetingTimer = setInterval(updateGreeting, 60000)
    fetchPublishedPatchNotes()

    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.addEventListener('scroll', handleScroll, { passive: true })
      mainContent.addEventListener('touchstart', handleTouchStart, { passive: true })
      mainContent.addEventListener('touchend', handleTouchEnd, { passive: true })
    }
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
  })
</script>

<template>
  <div
    class="relative z-50 w-full lg:hidden"
    id="doctor-mobile-header"
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
          to="/doctor"
          class="flex items-center"
          id="doctor-mobile-logo"
        >
          <NuxtImg
            src="/DA_Logo.png"
            class="h-12 brightness-0 invert"
            alt="DermAssist"
          />
        </NuxtLink>

        <div class="flex items-center gap-2.5">
          <!-- What's New Pill -->
          <NuxtLink
            v-if="hasUnseenUpdate"
            to="/doctor/updates"
            id="doctor-mobile-whats-new"
            class="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-xs font-bold text-white shadow-xs backdrop-blur-md transition-all hover:bg-white/30 active:scale-95"
          >
            <Icon
              name="solar:megaphone-loud-bold-duotone"
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

          <!-- Notification Bell -->
          <NuxtLink
            to="/doctor/notifications"
            id="doctor-mobile-notifications"
            class="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-white transition-all hover:bg-white/30 focus:outline-none"
            title="Notifications"
          >
            <Icon
              name="solar:bell-bold"
              class="text-xl"
            />
            <span
              v-if="unreadCount > 0"
              class="bg-destructive absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white"
            >
              {{ unreadCount > 9 ? '9+' : unreadCount }}
            </span>
          </NuxtLink>

          <!-- Avatar + Menu -->
          <div class="relative">
            <button
              type="button"
              id="doctor-mobile-avatar"
              @click="toggleDropdown"
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
                >{{ doctorInitial }}</span
              >
            </button>

            <!-- Click outside overlay -->
            <div
              v-if="isDropdownOpen"
              class="fixed inset-0 z-40 bg-transparent"
              @click="closeDropdown"
            ></div>

            <Transition name="dropdown">
              <div
                v-if="isDropdownOpen"
                class="bg-card border-border absolute right-0 z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border shadow-xl"
              >
                <div class="border-border/70 flex items-center gap-3 border-b px-4 py-3">
                  <div
                    class="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-black"
                  >
                    <img
                      v-if="(user?.avatar_url || user?.avatar_path) && !avatarError"
                      :src="getStorageUrl(user.avatar_url || user.avatar_path)"
                      class="h-full w-full object-cover"
                      alt="Avatar"
                      @error="handleAvatarError"
                    />
                    <span v-else>{{ doctorInitial }}</span>
                  </div>
                  <div class="min-w-0">
                    <p class="text-foreground truncate text-sm font-bold">
                      {{ doctorDisplayName }}
                    </p>
                    <p class="text-muted-foreground truncate text-[11px]">
                      {{ user?.email || 'Attending Physician' }}
                    </p>
                  </div>
                </div>

                <div class="py-1">
                  <NuxtLink
                    to="/doctor/updates"
                    @click="closeDropdown"
                    class="text-foreground hover:bg-muted flex items-center justify-between px-4 py-2.5 text-xs font-medium transition-colors"
                  >
                    <div class="flex items-center gap-3">
                      <Icon
                        name="solar:megaphone-bold-duotone"
                        class="text-primary shrink-0"
                        size="16"
                      />
                      <span>What's New</span>
                    </div>
                    <span
                      v-if="hasUnseenUpdate"
                      class="rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"
                    >
                      New
                    </span>
                  </NuxtLink>

                  <NuxtLink
                    v-for="link in menuLinks"
                    :key="link.to"
                    :to="link.to"
                    @click="closeDropdown"
                    class="text-foreground hover:bg-muted flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-colors"
                  >
                    <Icon
                      :name="link.icon"
                      class="text-primary shrink-0"
                      size="16"
                    />
                    <span>{{ link.label }}</span>
                  </NuxtLink>
                </div>

                <div class="border-border/70 border-t py-1">
                  <button
                    type="button"
                    @click="triggerLogout"
                    class="text-destructive hover:bg-destructive/10 flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-xs font-medium transition-colors"
                  >
                    <Icon
                      name="solar:logout-bold-duotone"
                      class="text-destructive shrink-0"
                      size="16"
                    />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>

    <!-- SPACER to offset the fixed top row -->
    <div class="h-[76px] w-full"></div>

    <!-- SCROLLING HERO (dashboard only) -->
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
            {{ greeting }}, {{ doctorDisplayName }}
          </h1>
          <p class="mt-1 text-sm text-white/70">
            {{
              todayAppointments.length > 0
                ? `You have ${todayAppointments.length} appointment${todayAppointments.length === 1 ? '' : 's'} scheduled today.`
                : "Ready for today's clinical consultations?"
            }}
          </p>
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
              id="doctor-mobile-search"
              type="text"
              placeholder="Search patients, conditions..."
              v-model="searchQuery"
              class="min-w-0 flex-1 bg-transparent text-sm font-medium text-white placeholder-white/50 outline-none"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="clearSearch"
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
</style>
