<script setup lang="ts">
  import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
  import { useRoute } from 'vue-router'

  const props = withDefaults(
    defineProps<{
      modelValue: boolean
      role?: 'admin' | 'doctor' | 'patient' | 'secretary' | string
      displayName?: string
      email?: string
      avatarUrl?: string | null
      initial?: string
      hasUnseenUpdate?: boolean
      showWhatsNew?: boolean
      profileRoute?: string
      whatsNewRoute?: string
      roleLabel?: string
    }>(),
    {
      modelValue: false,
      role: 'patient',
      displayName: '',
      email: '',
      avatarUrl: null,
      initial: 'U',
      hasUnseenUpdate: false,
      showWhatsNew: true,
      showProfileSettings: undefined,
      profileRoute: '',
      whatsNewRoute: '',
      roleLabel: ''
    }
  )

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'logout'): void
  }>()

  const route = useRoute()
  const avatarError = ref(false)

  const shouldShowProfileSettings = computed(() => {
    if (typeof props.showProfileSettings === 'boolean') return props.showProfileSettings
    return resolvedRole.value !== 'admin'
  })

  watch(
    () => props.avatarUrl,
    () => {
      avatarError.value = false
    }
  )

  const resolvedRole = computed(() => {
    const r = (props.role || '').toLowerCase()
    if (r.includes('admin')) return 'admin'
    if (r.includes('doc')) return 'doctor'
    if (r.includes('sec')) return 'secretary'
    return 'patient'
  })

  const resolvedRoleLabel = computed(() => {
    if (props.roleLabel) return props.roleLabel
    switch (resolvedRole.value) {
      case 'admin':
        return 'System Administrator'
      case 'doctor':
        return 'Attending Doctor'
      case 'secretary':
        return 'Medical Secretary'
      default:
        return 'Patient'
    }
  })

  const roleBadgeClass = computed(() => {
    switch (resolvedRole.value) {
      case 'admin':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400'
      case 'doctor':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
      case 'secretary':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
      default:
        return 'bg-primary/10 text-primary border-primary/20'
    }
  })

  const resolvedProfileRoute = computed(() => {
    if (props.profileRoute) return props.profileRoute
    return `/${resolvedRole.value}/profile`
  })

  const resolvedWhatsNewRoute = computed(() => {
    if (props.whatsNewRoute) return props.whatsNewRoute
    if (resolvedRole.value === 'admin') return '/admin/patch-notes'
    return `/${resolvedRole.value}/updates`
  })

  const close = () => {
    emit('update:modelValue', false)
  }

  const handleLogout = () => {
    close()
    emit('logout')
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.modelValue) {
      close()
    }
  }

  watch(
    () => route.fullPath,
    () => {
      if (props.modelValue) close()
    }
  )

  onMounted(() => {
    if (import.meta.client) {
      window.addEventListener('keydown', handleKeydown)
    }
  })

  onUnmounted(() => {
    if (import.meta.client) {
      window.removeEventListener('keydown', handleKeydown)
    }
  })
</script>

<template>
  <Teleport to="body">
    <Transition name="mobile-profile-sheet">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[120] flex flex-col justify-end"
        id="app-mobile-profile-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="User Account Menu"
      >
        <!-- Dimmed Backdrop Overlay -->
        <div
          class="fixed inset-0 bg-black/60 transition-opacity"
          @click="close"
        ></div>

        <!-- Sheet Panel -->
        <div
          class="sheet-panel pb-safe bg-card border-border relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-[32px] border-t px-5 pt-3 pb-6 shadow-2xl"
        >
          <!-- Pull Pill Indicator -->
          <div class="bg-muted-foreground/25 mx-auto mb-3 h-1.5 w-12 rounded-full"></div>

          <!-- Header Top Row (Dismiss Button) -->
          <div class="mb-3 flex items-center justify-between">
            <span class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              Account & Profile
            </span>
            <button
              type="button"
              aria-label="Close profile menu"
              class="text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors active:scale-90"
              @click="close"
            >
              <Icon
                name="lucide:x"
                size="16"
              />
            </button>
          </div>

          <!-- User Identity Profile Card -->
          <div
            class="border-border/80 bg-muted/30 mb-4 flex items-center gap-3.5 rounded-2xl border p-3.5"
          >
            <!-- Avatar -->
            <div
              class="bg-primary/10 text-primary border-primary/20 relative flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-2xl border text-lg font-black shadow-xs"
            >
              <img
                v-if="avatarUrl && !avatarError"
                :src="avatarUrl"
                class="h-full w-full object-cover"
                alt="Profile Avatar"
                @error="avatarError = true"
              />
              <span
                v-else
                class="select-none"
              >
                {{ (initial || displayName || 'U').charAt(0).toUpperCase() }}
              </span>
            </div>

            <!-- Identity Info -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="text-foreground truncate text-base font-bold">
                  {{ displayName || 'User' }}
                </h3>
              </div>
              <p
                v-if="email"
                class="text-muted-foreground truncate text-xs font-medium"
              >
                {{ email }}
              </p>
              <div class="mt-1.5 flex items-center gap-1.5">
                <span
                  class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                  :class="roleBadgeClass"
                >
                  <Icon
                    v-if="resolvedRole === 'doctor'"
                    name="solar:stethoscope-bold"
                    size="11"
                  />
                  <Icon
                    v-else-if="resolvedRole === 'admin'"
                    name="solar:shield-check-bold"
                    size="11"
                  />
                  <Icon
                    v-else
                    name="solar:user-bold"
                    size="11"
                  />
                  {{ resolvedRoleLabel }}
                </span>
              </div>
            </div>
          </div>

          <!-- Account Actions Navigation List -->
          <nav
            aria-label="Account Settings"
            class="mb-4 flex flex-col gap-2"
          >
            <!-- Profile Settings Link -->
            <NuxtLink
              v-if="shouldShowProfileSettings"
              :to="resolvedProfileRoute"
              class="border-border/60 hover:bg-muted/50 flex min-h-[52px] items-center justify-between rounded-2xl border p-3 transition-colors active:scale-[0.99]"
              @click="close"
            >
              <div class="flex items-center gap-3">
                <div
                  class="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                >
                  <Icon
                    name="solar:user-bold-duotone"
                    size="20"
                  />
                </div>
                <div class="text-left">
                  <p class="text-foreground text-sm font-bold">Profile Settings</p>
                  <p class="text-muted-foreground text-[11px]">
                    Manage account details, security & preferences
                  </p>
                </div>
              </div>
              <Icon
                name="lucide:chevron-right"
                class="text-muted-foreground/60"
                size="18"
              />
            </NuxtLink>

            <!-- What's New / App Patch Notes Link -->
            <NuxtLink
              v-if="showWhatsNew"
              :to="resolvedWhatsNewRoute"
              class="border-border/60 hover:bg-muted/50 flex min-h-[52px] items-center justify-between rounded-2xl border p-3 transition-colors active:scale-[0.99]"
              @click="close"
            >
              <div class="flex items-center gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
                >
                  <Icon
                    name="solar:megaphone-bold-duotone"
                    size="20"
                  />
                </div>
                <div class="text-left">
                  <div class="flex items-center gap-2">
                    <p class="text-foreground text-sm font-bold">What's New</p>
                    <span
                      v-if="hasUnseenUpdate"
                      class="py-0.2 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 text-[10px] font-black text-amber-700 dark:text-amber-300"
                    >
                      New
                    </span>
                  </div>
                  <p class="text-muted-foreground text-[11px]">Recent improvements and changelog</p>
                </div>
              </div>
              <Icon
                name="lucide:chevron-right"
                class="text-muted-foreground/60"
                size="18"
              />
            </NuxtLink>
          </nav>

          <!-- Divider -->
          <div class="border-border/70 my-3 border-t"></div>

          <!-- Session Actions: Log Out Button -->
          <div class="flex flex-col gap-2">
            <button
              type="button"
              id="mobile-profile-logout-button"
              class="bg-destructive/10 text-destructive hover:bg-destructive/15 flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              @click="handleLogout"
            >
              <Icon
                name="solar:logout-bold-duotone"
                size="18"
              />
              <span>Log Out</span>
            </button>

            <!-- Cancel Button -->
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/70 flex h-11 w-full cursor-pointer items-center justify-center rounded-2xl text-xs font-semibold transition-colors active:scale-[0.98]"
              @click="close"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .pb-safe {
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }

  .mobile-profile-sheet-enter-active,
  .mobile-profile-sheet-leave-active {
    transition: opacity 0.25s ease;
  }

  .mobile-profile-sheet-enter-active .sheet-panel,
  .mobile-profile-sheet-leave-active .sheet-panel {
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .mobile-profile-sheet-enter-from,
  .mobile-profile-sheet-leave-to {
    opacity: 0;
  }

  .mobile-profile-sheet-enter-from .sheet-panel,
  .mobile-profile-sheet-leave-to .sheet-panel {
    transform: translateY(100%);
  }
</style>
