<script setup lang="ts">
  import { toast } from 'vue-sonner'
  import { $api } from '~/composables/useApi'

  definePageMeta({
    layout: false
  })

  const route = useRoute()
  const router = useRouter()

  const tokenInput = ref('')
  const isVerifying = ref(false)
  const isVerified = ref(false)
  const errorMessage = ref('')
  const successMessage = ref('')

  const authToken = useCookie('auth_token')
  const userRole = useCookie('user_role')

  const verifyToken = async (tokenToVerify: string) => {
    const cleanToken = tokenToVerify.trim()
    if (!cleanToken) {
      errorMessage.value = 'Please provide a valid verification token.'
      return
    }

    isVerifying.value = true
    errorMessage.value = ''

    try {
      const response: any = await $api('/verify-account', {
        method: 'POST',
        body: { token: cleanToken }
      })

      isVerified.value = true
      successMessage.value = response?.message || 'Account successfully verified!'
      toast.success(successMessage.value)

      // Update session cookies if logged in
      const accountStatusCookie = useCookie('account_status', { path: '/' })
      accountStatusCookie.value = 'active'

      const deadlineCookie = useCookie('verification_deadline', { path: '/' })
      deadlineCookie.value = null
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Invalid or expired verification token.'
      errorMessage.value = msg
      toast.error(msg)
    } finally {
      isVerifying.value = false
    }
  }

  const handleManualSubmit = () => {
    verifyToken(tokenInput.value)
  }

  const handleGoToDestination = () => {
    if (authToken.value && userRole.value) {
      router.push(`/${userRole.value}`)
    } else {
      router.push('/auth/login')
    }
  }

  onMounted(() => {
    const queryToken = route.query.token as string
    if (queryToken) {
      tokenInput.value = queryToken
      verifyToken(queryToken)
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

      <!-- Verification Icon Graphic -->
      <div class="relative mb-6 flex items-center justify-center">
        <!-- Success State -->
        <div
          v-if="isVerified"
          class="flex size-20 items-center justify-center rounded-3xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 shadow-sm transition-all dark:text-emerald-400"
        >
          <Icon
            name="lucide:shield-check"
            class="size-10"
          />
        </div>

        <!-- Verifying State -->
        <div
          v-else-if="isVerifying"
          class="border-primary/30 bg-primary/10 text-primary relative flex size-20 items-center justify-center rounded-3xl border shadow-sm"
        >
          <svg
            class="text-primary size-10 animate-spin"
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
        </div>

        <!-- Error or Manual Input State -->
        <div
          v-else-if="errorMessage"
          class="flex size-20 items-center justify-center rounded-3xl border border-rose-500/30 bg-rose-500/10 text-rose-600 shadow-sm dark:text-rose-400"
        >
          <Icon
            name="lucide:shield-alert"
            class="size-10"
          />
        </div>

        <div
          v-else
          class="border-primary/30 bg-primary/10 text-primary flex size-20 items-center justify-center rounded-3xl border shadow-sm"
        >
          <Icon
            name="lucide:mail-check"
            class="size-10"
          />
        </div>
      </div>

      <!-- State 1: Verification Successful -->
      <template v-if="isVerified">
        <h2
          class="font-primary text-xl font-bold tracking-tight text-emerald-600 sm:text-2xl dark:text-emerald-400"
        >
          Account Verified!
        </h2>
        <p class="text-muted-foreground mt-2 max-w-xs text-xs leading-relaxed sm:text-sm">
          Your email address has been verified and your account is permanently activated.
        </p>

        <button
          type="button"
          class="bg-primary hover:bg-primary/90 mt-6 flex w-full max-w-xs cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-sm transition-all"
          @click="handleGoToDestination"
        >
          <span>{{ authToken ? 'Continue to Dashboard' : 'Sign In Now' }}</span>
          <Icon
            name="lucide:arrow-right"
            class="size-4"
          />
        </button>
      </template>

      <!-- State 2: Actively Verifying -->
      <template v-else-if="isVerifying">
        <h2 class="font-primary text-foreground text-xl font-bold tracking-tight sm:text-2xl">
          Verifying Account
        </h2>
        <p class="text-muted-foreground mt-2 max-w-xs text-xs leading-relaxed sm:text-sm">
          Confirming your verification token with DermAssist security...
        </p>

        <div
          class="border-border/50 bg-muted mt-6 w-full max-w-xs overflow-hidden rounded-full border p-0.5"
        >
          <div
            class="from-primary via-secondary to-primary h-1.5 w-full animate-pulse rounded-full bg-gradient-to-r bg-[length:200%_100%]"
          />
        </div>
      </template>

      <!-- State 3: Error or Manual Token Input -->
      <template v-else>
        <h2 class="font-primary text-foreground text-xl font-bold tracking-tight sm:text-2xl">
          {{ errorMessage ? 'Verification Failed' : 'Verify Your Account' }}
        </h2>
        <p class="text-muted-foreground mt-2 max-w-xs text-xs leading-relaxed sm:text-sm">
          {{
            errorMessage
              ? errorMessage
              : 'Paste the verification token sent to your email to activate your account.'
          }}
        </p>

        <!-- Manual Token Input Form -->
        <div class="mt-6 flex w-full max-w-xs flex-col gap-3">
          <input
            v-model="tokenInput"
            type="text"
            placeholder="Paste 40-character token here..."
            class="focus:ring-primary border-border/80 bg-background text-foreground placeholder:text-muted-foreground/60 w-full rounded-xl border px-3.5 py-2.5 text-center text-xs tracking-wider transition-all focus:ring-2 focus:outline-none"
          />

          <button
            type="button"
            class="bg-primary hover:bg-primary/90 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50"
            :disabled="!tokenInput.trim() || isVerifying"
            @click="handleManualSubmit"
          >
            <Icon
              name="lucide:check"
              class="size-4"
            />
            Submit Verification
          </button>

          <NuxtLink
            to="/auth/login"
            class="text-muted-foreground hover:text-foreground mt-2 text-xs font-medium transition-colors"
          >
            Return to Sign In
          </NuxtLink>
        </div>
      </template>

      <!-- Trust Seal -->
      <div
        class="border-primary/20 bg-primary/5 text-primary mt-8 flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
      >
        <Icon
          name="lucide:shield-check"
          class="size-3.5"
        />
        <span>Protected Healthcare Verification</span>
      </div>
    </div>
  </div>
</template>
