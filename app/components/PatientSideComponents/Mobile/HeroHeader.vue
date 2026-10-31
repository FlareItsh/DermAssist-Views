<script setup lang="ts">
  import { computed, ref, onMounted, onUnmounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { userService } from '~/api/user/UserService'
  import { authService } from '~/api/auth/AuthService'

  const route = useRoute()
  const { searchQuery } = useSearch()
  const { getStorageUrl } = useStorage()
  const { unreadNotifications } = useAppNotifications()
  const { hasUnseenUpdate, fetchPublishedPatchNotes } = usePatchNotes()

  const { data: response } = userService.useShow(useCookie('user_uuid').value as string, {
    key: `userProfile-${useCookie('user_uuid').value}`
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
      useDiagnosis().resetScanner()
      useCookie('auth_token').value = null
      useCookie('user_role').value = null
      useCookie('user_uuid').value = null
      useCookie('user_name').value = null
      useCookie('auth_user_name').value = null
      await navigateTo('/auth/login')
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

    // Attach touch and scroll listeners directly to main-content
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
</style>
