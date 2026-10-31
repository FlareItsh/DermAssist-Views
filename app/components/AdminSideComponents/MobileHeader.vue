<script setup lang="ts">
  import { authService } from '~/api/auth/AuthService'

  defineProps<{
    title?: string
  }>()

  const userName = useCookie('user_name')
  const authUserName = useCookie('auth_user_name')
  const { hasUnseenUpdate } = usePatchNotes()

  const isAccountMenuOpen = ref(false)
  const isLogoutModalOpen = ref(false)

  const accountInitial = computed(() => {
    const name = String(userName.value || authUserName.value || 'Admin').trim()
    return (name.charAt(0) || 'A').toUpperCase()
  })

  const toggleAccountMenu = () => {
    isAccountMenuOpen.value = !isAccountMenuOpen.value
  }

  const closeAccountMenu = () => {
    isAccountMenuOpen.value = false
  }

  const triggerLogout = () => {
    isAccountMenuOpen.value = false
    isLogoutModalOpen.value = true
  }

  const closeLogoutModal = () => {
    isLogoutModalOpen.value = false
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
</script>

<template>
  <header
    class="bg-primary sticky top-0 z-50 rounded-b-[28px] px-4 pt-3 pb-4 shadow-md md:hidden"
    id="admin-mobile-header"
  >
    <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-b-[28px]">
      <div
        class="absolute -top-[88px] -right-[88px] h-[200px] w-[200px] rounded-full bg-white/8"
      ></div>
    </div>

    <div class="relative z-20 flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <NuxtImg
          src="/DA_Logo.png"
          class="h-9 shrink-0 brightness-0 invert"
          alt="DermAssist"
        />
        <div class="min-w-0 border-l border-white/25 pl-3">
          <p class="text-[10px] leading-none font-bold tracking-widest text-white/60 uppercase">
            Admin
          </p>
          <h1 class="mt-1 truncate text-base leading-none font-black text-white">
            {{ title || 'Dashboard' }}
          </h1>
        </div>
      </div>

      <div class="relative">
        <button
          type="button"
          id="admin-mobile-account-button"
          aria-label="Open account menu"
          class="relative z-50 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-white/40 bg-white/30 text-sm font-bold text-white transition-all active:scale-90"
          @click="toggleAccountMenu"
        >
          {{ accountInitial }}
        </button>

        <!-- Modern Touch-first Mobile Profile Sheet -->
        <AppMobileProfileSheet
          v-model="isAccountMenuOpen"
          role="admin"
          :display-name="userName || authUserName || 'Administrator'"
          email="admin@dermassist.ph"
          :initial="accountInitial"
          :has-unseen-update="hasUnseenUpdate"
          @logout="triggerLogout"
        />
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
  </header>
</template>
