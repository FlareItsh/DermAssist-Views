<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { userService } from '~/api/user/UserService'

const route = useRoute()
const { searchQuery } = useSearch()
const { getStorageUrl } = useStorage()

const { data: response } = userService.useShow(useCookie('user_uuid').value as string, {
  key: `userProfile-${useCookie('user_uuid').value}`
})

const user = computed(() => (response.value as any)?.data ?? response.value)
const firstName = computed(() => user.value?.first_name || 'there')

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Goodmorning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})

const isCompact = computed(() => {
  const path = route.path.toLowerCase().replace(/\/$/, '')
  return path !== '/patient'
})
</script>

<template>
  <div
    class="relative bg-primary px-5 pt-8 rounded-b-[36px] overflow-hidden transition-all duration-300 ease-in-out"
    :class="isCompact ? 'pb-4 shadow-md' : 'pb-10'"
  >
    <!-- Decorative circles -->
    <div class="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5"></div>
    <div class="absolute top-10 -right-4 h-20 w-20 rounded-full bg-white/10"></div>

    <!-- Top row: logo + avatar -->
    <div
      class="relative z-10 flex items-center justify-between transition-all duration-300 ease-in-out"
      :class="isCompact ? 'mb-0' : 'mb-8'"
    >
      <NuxtImg src="/DA_Logo.png" class="h-12 brightness-0 invert" alt="DermAssist" />
      <NuxtLink to="/patient/profile">
        <div class="h-11 w-11 rounded-full border-2 border-white/40 overflow-hidden bg-white/20 flex items-center justify-center">
          <NuxtImg
            v-if="user?.avatar_path"
            :src="getStorageUrl(user.avatar_path)"
            class="h-full w-full object-cover"
          />
          <span v-else class="text-white font-bold text-sm">{{ firstName.charAt(0).toUpperCase() }}</span>
        </div>
      </NuxtLink>
    </div>

    <!-- Expandable Section for greeting + search -->
    <div
      v-if="!isCompact"
      class="relative z-10 transition-all duration-300 ease-in-out"
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
  </div>
</template>
