<script setup lang="ts">
  import { computed, ref, onMounted, onUnmounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { userService } from '~/api/user/UserService'
  import { authService } from '~/api/auth/AuthService'

  const route = useRoute()
  const { searchQuery } = useSearch()
  const { getStorageUrl } = useStorage()

  const { data: response } = userService.useShow(useCookie('user_uuid').value as string, {
    key: `userProfile-${useCookie('user_uuid').value}`
  })

  const user = computed(() => (response.value as any)?.data ?? response.value)
  const firstName = computed(() => user.value?.first_name || 'there')

  const isDropdownOpen = ref(false)
  const isLogoutModalOpen = ref(false)

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
      useCookie('auth_token').value = null
      useCookie('user_role').value = null
      useCookie('user_uuid').value = null
      useCookie('user_name').value = null
      useCookie('auth_user_name').value = null
      await navigateTo('/auth/login')
    }
  }

  const greeting = ref('Good day')
  let greetingTimer: any = null
  const isScrolled = ref(false)
  const headerRoot = ref<HTMLElement | null>(null)

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
      const h = new Date().getHours()
      if (h < 12) {
        greeting.value = 'Good morning'
      } else if (h < 18) {
        greeting.value = 'Good afternoon'
      } else {
        greeting.value = 'Good evening'
      }
    }
    updateGreeting()
    greetingTimer = setInterval(updateGreeting, 60000)

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
      class="bg-primary fixed top-0 right-0 left-0 z-50 px-5 pt-4 pb-4 transition-all duration-150"
      :class="{ 'rounded-b-[36px] shadow-md': !isDashboard || isScrolled }"
    >
      <div
        class="pointer-events-none absolute inset-0 overflow-hidden transition-all duration-150"
        :class="{ 'rounded-b-[36px]': !isDashboard || isScrolled }"
      >
        <div class="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5"></div>
      </div>

      <div class="relative z-20 flex items-center justify-between">
        <NuxtImg
          src="/DA_Logo.png"
          class="h-12 brightness-0 invert"
          alt="DermAssist"
        />
        <div class="relative">
          <button
            @click="isDropdownOpen = !isDropdownOpen"
            class="relative z-50 flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-white/40 bg-white/20 focus:outline-none"
          >
            <NuxtImg
              v-if="user?.avatar_path"
              :src="getStorageUrl(user.avatar_path)"
              class="h-full w-full object-cover"
            />
            <span
              v-else
              class="text-sm font-bold text-white"
              >{{ firstName.charAt(0).toUpperCase() }}</span
            >
          </button>

          <!-- Click outside overlay -->
          <div
            v-if="isDropdownOpen"
            class="fixed inset-0 z-40 bg-transparent"
            @click="isDropdownOpen = false"
          ></div>

          <!-- Dropdown Menu -->
          <div
            v-if="isDropdownOpen"
            class="bg-card border-border absolute right-0 z-50 mt-2 w-48 origin-top-right transform rounded-2xl border py-1 shadow-xl transition-all"
          >
            <NuxtLink
              to="/patient/profile"
              @click="isDropdownOpen = false"
              class="text-foreground hover:bg-muted flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-colors"
            >
              <Icon
                name="solar:user-bold-duotone"
                class="text-primary shrink-0"
                size="16"
              />
              <span>Profile Settings</span>
            </NuxtLink>

            <button
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
      </div>
    </div>

    <!-- SPACER to offset the fixed top row -->
    <div class="h-[80px] w-full"></div>

    <!-- SCROLLING SECTION -->
    <div
      v-if="isDashboard"
      class="bg-primary relative z-10 -mt-6 rounded-b-[36px] px-5 pt-6 pb-10"
    >
      <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-b-[36px]">
        <div class="absolute top-10 -right-4 h-20 w-20 rounded-full bg-white/10"></div>
      </div>

      <div
        class="mt-8 transform transition-all duration-300 ease-out"
        :class="
          isScrolled ? '-translate-y-4 scale-95 opacity-0' : 'translate-y-0 scale-100 opacity-100'
        "
      >
        <h1 class="text-3xl leading-tight font-black text-white">
          {{ greeting }}, {{ firstName }}
        </h1>
        <p class="mt-1 text-sm text-white/70">How are you today?</p>
      </div>

      <div
        class="mt-5 transform transition-all delay-75 duration-300 ease-out"
        :class="
          isScrolled ? '-translate-y-4 scale-95 opacity-0' : 'translate-y-0 scale-100 opacity-100'
        "
      >
        <div
          class="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/20 px-4 py-3 backdrop-blur-sm"
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
            class="flex-1 bg-transparent text-sm font-medium text-white placeholder-white/50 outline-none"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="shrink-0 text-white/60 hover:text-white"
          >
            <Icon
              name="heroicons:x-mark-20-solid"
              size="16"
            />
          </button>
        </div>
        <p class="mt-2 mb-2 ml-1 text-xs text-white/50">How can I help you Today?</p>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="isLogoutModalOpen"
          class="bg-foreground/40 fixed inset-0 z-[999] flex items-center justify-center p-4"
          @click.self="isLogoutModalOpen = false"
        >
          <AppModalLogoutConfirmation
            @close="isLogoutModalOpen = false"
            @confirm="logout"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
