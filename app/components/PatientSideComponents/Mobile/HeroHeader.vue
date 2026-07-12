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

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  isScrolled.value = target.scrollTop > 20
}

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

  const mainContent = document.getElementById('main-content')
  if (mainContent) {
    mainContent.addEventListener('scroll', handleScroll)
  }
})

onUnmounted(() => {
  if (greetingTimer) {
    clearInterval(greetingTimer)
  }
  const mainContent = document.getElementById('main-content')
  if (mainContent) {
    mainContent.removeEventListener('scroll', handleScroll)
  }
})

const isCompact = computed(() => {
  const path = route.path.toLowerCase().replace(/\/$/, '')
  return path !== '/patient' || isScrolled.value
})
</script>

<template>
  <div
    class="sticky top-0 z-50 bg-primary px-5 pt-4 rounded-b-[36px] transition-all duration-300 ease-in-out"
    :class="isCompact ? 'pb-4 shadow-md' : 'pb-10'"
  >
    <!-- Decorative circles -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none rounded-b-[36px]">
      <div class="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5"></div>
      <div class="absolute top-10 -right-4 h-20 w-20 rounded-full bg-white/10"></div>
    </div>

    <!-- Top row: logo + avatar -->
    <div
      class="relative z-20 flex items-center justify-between transition-all duration-300 ease-in-out"
      :class="isCompact ? 'mb-0' : 'mb-8'"
    >
      <NuxtImg src="/DA_Logo.png" class="h-12 brightness-0 invert" alt="DermAssist" />
      <div class="relative">
        <button
          @click="isDropdownOpen = !isDropdownOpen"
          class="h-11 w-11 rounded-full border-2 border-white/40 overflow-hidden bg-white/20 flex items-center justify-center focus:outline-none relative z-50 cursor-pointer"
        >
          <NuxtImg
            v-if="user?.avatar_path"
            :src="getStorageUrl(user.avatar_path)"
            class="h-full w-full object-cover"
          />
          <span v-else class="text-white font-bold text-sm">{{ firstName.charAt(0).toUpperCase() }}</span>
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
          class="absolute right-0 mt-2 w-48 bg-card rounded-2xl shadow-xl border border-border py-1 z-50 transform origin-top-right transition-all"
        >
          <NuxtLink
            to="/patient/profile"
            @click="isDropdownOpen = false"
            class="flex items-center gap-3 px-4 py-2.5 text-xs text-foreground hover:bg-muted transition-colors font-medium"
          >
            <Icon name="solar:user-bold-duotone" class="text-primary shrink-0" size="16" />
            <span>Profile Settings</span>
          </NuxtLink>
          
          <button
            @click="triggerLogout"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left font-medium cursor-pointer"
          >
            <Icon name="solar:logout-bold-duotone" class="text-destructive shrink-0" size="16" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Expandable Section for greeting + search -->
    <div
      class="relative z-10 transition-all duration-300 ease-in-out overflow-hidden"
      :class="isCompact ? 'max-h-0 opacity-0' : 'max-h-[400px] opacity-100'"
    >
      <!-- Greeting -->
      <div>
        <h1 class="text-white text-3xl font-black leading-tight">{{ greeting }}, {{ firstName }}</h1>
        <p class="text-white/70 text-sm mt-1">How are you today?</p>
      </div>

      <!-- Search / Help bar -->
      <div class="mt-5">
        <div class="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/20">
          <Icon name="solar:magnifer-linear" class="text-white/60 shrink-0" size="18" />
          <input
            type="text"
            placeholder="Search doctors, conditions..."
            v-model="searchQuery"
            class="bg-transparent text-white placeholder-white/50 text-sm flex-1 outline-none font-medium"
          />
          <button v-if="searchQuery" @click="searchQuery = ''" class="text-white/60 hover:text-white shrink-0">
            <Icon name="heroicons:x-mark-20-solid" size="16" />
          </button>
        </div>
        <p class="text-white/50 text-xs mt-2 ml-1 mb-2">How can I help you Today?</p>
      </div>
    </div>

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
  </div>
</template>
