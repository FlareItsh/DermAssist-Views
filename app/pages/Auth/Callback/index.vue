<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import { $api } from '~/composables/useApi'

  definePageMeta({
    layout: false
  })

  const route = useRoute()
  const errorMessage = ref('')
  const userGreeting = ref('')
  const isCompleted = ref(false)

  const handleReturnToLogin = () => {
    navigateTo('/auth/login', { replace: true })
  }

  onMounted(async () => {
    const error = route.query.error as string
    if (error) {
      errorMessage.value = error
      toast.error(error)
      return
    }

    const token = route.query.token as string
    if (!token) {
      errorMessage.value = 'No authentication token provided.'
      toast.error('Authentication token missing.')
      return
    }

    try {
      // Store Sanctum token cookie
      const tokenCookie = useCookie('auth_token', {
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      })
      tokenCookie.value = token

      let userData: any = null

      // Check if user payload was passed directly in redirect query
      const encodedUser = route.query.user as string
      if (encodedUser) {
        try {
          const jsonStr = atob(decodeURIComponent(encodedUser))
          userData = JSON.parse(jsonStr)
        } catch (e) {
          console.warn('Failed to parse query user payload, falling back to /user API', e)
        }
      }

      // If user data not in query or failed to parse, fetch with explicit Authorization header
      if (!userData) {
        const response: any = await $api('/user', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        userData = response?.data || response
      }

      if (!userData) {
        throw new Error('Failed to retrieve user profile.')
      }

      const rawRole = userData?.role?.slug || userData?.role || 'patient'
      const baseRole = String(rawRole).split('/')[0].toLowerCase() || 'patient'

      // Set session cookies
      const roleCookie = useCookie('user_role', {
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      })
      roleCookie.value = baseRole

      const fullName = `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim()
      userGreeting.value = userData?.first_name || fullName || 'User'

      const userName = useCookie('user_name', {
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      })
      const authName = useCookie('auth_user_name', {
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      })
      userName.value = fullName
      authName.value = fullName

      const userUuid = useCookie('user_uuid', {
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      })
      userUuid.value = userData?.uuid

      const doctorUuid = useCookie('doctor_uuid', {
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      })
      doctorUuid.value = userData?.doctor_uuid || null

      const accountStatusCookie = useCookie('account_status', {
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      })
      accountStatusCookie.value = userData?.account_status || 'active'

      const verificationDeadlineCookie = useCookie('verification_deadline', {
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      })
      verificationDeadlineCookie.value = userData?.verification_deadline || null

      isCompleted.value = true
      toast.success('Signed in with Google successfully!')

      // Smooth navigate to designated role dashboard
      setTimeout(async () => {
        await navigateTo(`/${baseRole}`, { replace: true })
      }, 600)
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to authenticate with Google.'
      errorMessage.value = msg
      toast.error(msg)
    }
  })
</script>

<template>
  <div
    class="bg-background relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8 select-none"
  >
    <!-- Ambient Healthcare Tech Background Gradients -->
    <div
      class="bg-primary/15 pointer-events-none absolute -top-40 -left-40 size-96 rounded-full blur-3xl"
    />
    <div
      class="bg-secondary/15 pointer-events-none absolute -right-40 -bottom-40 size-96 rounded-full blur-3xl"
    />
    <div
      class="from-primary/5 pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] via-transparent to-transparent"
    />

    <!-- Main Glassmorphism Card -->
    <div
      class="border-border/70 bg-card/90 relative z-10 flex w-full max-w-md flex-col items-center rounded-3xl border p-8 text-center shadow-2xl backdrop-blur-2xl transition-all duration-300 sm:p-10"
    >
      <!-- DermAssist Official Logo -->
      <NuxtLink
        to="/"
        class="mb-6 inline-block transition-transform hover:scale-105"
      >
        <NuxtImg
          src="/DA_Logo.png"
          alt="DermAssist Logo"
          class="h-12 object-contain sm:h-14"
        />
      </NuxtLink>

      <!-- Sync Graphic / Icon Container -->
      <div class="relative mb-6 flex items-center justify-center">
        <!-- Dual Sync Badges -->
        <div class="flex items-center gap-3">
          <!-- Google Badge -->
          <div
            class="border-border/70 bg-background flex size-14 items-center justify-center rounded-2xl border shadow-sm transition-transform"
          >
            <svg
              class="size-7"
              viewBox="0 0 24 24"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>

          <!-- Connection Status Badge with Centered Spinner -->
          <div
            class="border-primary/25 bg-primary/10 text-primary relative flex size-10 shrink-0 items-center justify-center rounded-full border shadow-xs"
          >
            <svg
              v-if="!errorMessage && !isCompleted"
              class="text-primary size-5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="3"
              />
              <path
                class="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <Icon
              v-else-if="isCompleted"
              name="lucide:check"
              class="size-5 text-emerald-600 dark:text-emerald-400"
            />
            <Icon
              v-else
              name="lucide:alert-circle"
              class="size-5 text-rose-500"
            />
          </div>

          <!-- DermAssist System Badge -->
          <div
            class="border-primary/30 bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl border shadow-sm"
          >
            <Icon
              name="lucide:activity"
              class="size-7"
            />
          </div>
        </div>
      </div>

      <!-- State 1: Active Authentication -->
      <template v-if="!errorMessage && !isCompleted">
        <h2 class="font-primary text-foreground text-xl font-bold tracking-tight sm:text-2xl">
          Authenticating with Google
        </h2>
        <p class="text-muted-foreground mt-2 max-w-xs text-xs leading-relaxed sm:text-sm">
          Securely verifying your identity and preparing your DermAssist clinical portal...
        </p>

        <!-- Shimmering Progress Bar -->
        <div
          class="border-border/50 bg-muted mt-6 w-full max-w-xs overflow-hidden rounded-full border p-0.5"
        >
          <div
            class="from-primary via-secondary to-primary h-1.5 w-full animate-pulse rounded-full bg-gradient-to-r bg-[length:200%_100%]"
          />
        </div>
      </template>

      <!-- State 2: Completed / Transitioning -->
      <template v-else-if="isCompleted">
        <h2
          class="font-primary text-xl font-bold tracking-tight text-emerald-600 sm:text-2xl dark:text-emerald-400"
        >
          Welcome, {{ userGreeting }}!
        </h2>
        <p class="text-muted-foreground mt-2 max-w-xs text-xs leading-relaxed sm:text-sm">
          Authentication confirmed. Launching your personalized dashboard...
        </p>

        <!-- Success Progress Bar -->
        <div
          class="mt-6 w-full max-w-xs overflow-hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 p-0.5"
        >
          <div class="h-1.5 w-full rounded-full bg-emerald-500 transition-all duration-500" />
        </div>
      </template>

      <!-- State 3: Authentication Error -->
      <template v-else>
        <h2
          class="font-primary text-xl font-bold tracking-tight text-rose-600 sm:text-2xl dark:text-rose-400"
        >
          Authentication Unsuccessful
        </h2>
        <p class="text-muted-foreground mt-2 max-w-xs text-xs leading-relaxed sm:text-sm">
          {{ errorMessage }}
        </p>

        <button
          type="button"
          class="bg-primary hover:bg-primary/90 mt-6 flex w-full max-w-xs cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all"
          @click="handleReturnToLogin"
        >
          <Icon
            name="lucide:arrow-left"
            class="size-4"
          />
          Return to Sign In
        </button>
      </template>

      <!-- Healthcare Security Trust Seal -->
      <div
        class="border-primary/20 bg-primary/5 text-primary mt-8 flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
      >
        <Icon
          name="lucide:shield-check"
          class="size-3.5"
        />
        <span>Protected Healthcare Session</span>
      </div>
    </div>
  </div>
</template>
